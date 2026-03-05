import Driver from "../models/Driver.js"
import User from "../models/User.js"
import CorporateDriver from "../models/CorporateDriver.js"
import B2CPartnerTrip from "../models/B2CPartnerTrip.js"
import B2CPartnerDriver from "../models/B2CPartnerDriver.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { sendDriverCredentials } from "../Services/emailService.js"
import { initializeTripTracking, updateTripLocation, completeTrip } from "../Services/locationTrackingService.js"
import crypto from "crypto"

export const generateRandomPassword = () => {
    return crypto.randomBytes(6).toString('hex');
}

export const createDriver = async (req, res) => {
    try {
        console.log("[v0] Creating driver with fleetOwnerId:", req.userId)
        console.log("[v0] Request body:", JSON.stringify(req.body, null, 2))
        console.log("[v0] Files received:", {
            license: req.files?.license?.length || 0,
            passport: req.files?.passport?.length || 0,
            visa: req.files?.visa?.length || 0,
            medicalCertificate: req.files?.medicalCertificate?.length || 0,
        })

        let experienceYears = req.body.experienceYears || req.body["experience[years]"]
        experienceYears = Number.parseInt(experienceYears, 10)

        if (isNaN(experienceYears) || experienceYears < 0) {
            return res.status(400).json({
                success: false,
                message: "Experience years must be a valid number",
            })
        }

        const driverData = {
            fleetOwnerId: req.userId,
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            licenseNumber: req.body.licenseNumber,
            licenseExpiry: req.body.licenseExpiry,
            licenseType: req.body.licenseType,
            dateOfBirth: req.body.dateOfBirth,
            nationality: req.body.nationality,
            address: {
                street: req.body["address[street]"] || req.body.street,
                city: req.body["address[city]"] || req.body.city,
                country: req.body["address[country]"] || req.body.country,
            },
            experience: {
                years: experienceYears,
                description: req.body["experience[description]"] || req.body.experienceDescription,
            },
            documents: {
                license: null,
                passport: null,
                visa: null,
                medicalCertificate: null,
            },
        }

        if (req.files) {
            const fileUploads = []

            if (req.files.license) {
                fileUploads.push({
                    file: req.files.license[0],
                    fieldName: "license",
                })
            }
            if (req.files.passport) {
                fileUploads.push({
                    file: req.files.passport[0],
                    fieldName: "passport",
                })
            }
            if (req.files.visa) {
                fileUploads.push({
                    file: req.files.visa[0],
                    fieldName: "visa",
                })
            }
            if (req.files.medicalCertificate) {
                fileUploads.push({
                    file: req.files.medicalCertificate[0],
                    fieldName: "medicalCertificate",
                })
            }

            if (fileUploads.length > 0) {
                for (const upload of fileUploads) {
                    const uploadedFile = await uploadToCloudinary(upload.file, `driveme/drivers/${req.userId}`, upload.fieldName)
                    driverData.documents[upload.fieldName] = uploadedFile.secure_url
                }
            }
        }

        const driver = await Driver.create(driverData)

        // Create User account for driver with B2B_PARTNER_DRIVER role
        const generatedPassword = generateRandomPassword()
        const userData = {
            role: "B2B_PARTNER_DRIVER",
            fullName: req.body.name,
            email: req.body.email,
            whatsappNumber: req.body.phone,
            password: generatedPassword,
            employedBy: req.userId,
            driverId: driver._id,
            driverModel: "Driver",
            driverInfo: {
                licenseNumber: req.body.licenseNumber,
                licenseExpiry: req.body.licenseExpiry,
                licenseType: req.body.licenseType,
                dateOfBirth: req.body.dateOfBirth,
                nationality: req.body.nationality,
                address: {
                    street: req.body["address[street]"] || req.body.street,
                    city: req.body["address[city]"] || req.body.city,
                    country: req.body["address[country]"] || req.body.country,
                },
                experience: {
                    years: experienceYears,
                    description: req.body["experience[description]"] || req.body.experienceDescription,
                },
                documents: driverData.documents,
                status: "AVAILABLE",
            },
        }

        const userDriver = await User.create(userData)

        // Send email with login credentials to driver
        try {
            const fleetOwner = await User.findById(req.userId)
            const emailResult = await sendDriverCredentials(
                req.body.email,
                generatedPassword,
                req.body.name,
                fleetOwner?.companyName || 'Your Company'
            )

            if (emailResult.success) {
                console.log(`Driver credentials email sent to: ${req.body.email}`)
            } else {
                console.error('Failed to send driver credentials email:', emailResult.message)
            }
        } catch (emailError) {
            console.error('Error sending driver credentials email:', emailError)
        }

        res.status(201).json({
            success: true,
            message: "B2B Partner Driver registered successfully! Login credentials sent to driver's email.",
            driver,
            userDriver: {
                id: userDriver._id,
                email: userDriver.email,
                role: userDriver.role,
            },
        })
    } catch (error) {
        console.error("[v0] Error creating driver:", error.message)
        res.status(500).json({
            success: false,
            message: "Error creating driver",
            error: error.message,
        })
    }
}

export const getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find().sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        })
    } catch (error) {
        console.error("[v0] Error fetching all drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching drivers",
            error: error.message,
        })
    }
}

// Get all drivers for fleet owner
export const getFleetOwnerDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({ fleetOwnerId: req.userId }).sort({
            createdAt: -1,
        })

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        })
    } catch (error) {
        console.error("[v0] Error fetching drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching drivers",
            error: error.message,
        })
    }
}

// Get available drivers
export const getAvailableDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({
            fleetOwnerId: req.userId,
            status: "AVAILABLE",
        }).sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        })
    } catch (error) {
        console.error("[v0] Error fetching available drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching available drivers",
            error: error.message,
        })
    }
}

// Update driver
export const updateDriver = async (req, res) => {
    try {
        const { driverId } = req.params

        const driver = await Driver.findOneAndUpdate({ _id: driverId, fleetOwnerId: req.userId }, req.body, {
            new: true,
            runValidators: true,
        })

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            })
        }

        res.status(200).json({
            success: true,
            message: "Driver updated successfully",
            driver,
        })
    } catch (error) {
        console.error("[v0] Error updating driver:", error)
        res.status(500).json({
            success: false,
            message: "Error updating driver",
            error: error.message,
        })
    }
}

// Delete driver
export const deleteDriver = async (req, res) => {
    try {
        const { driverId } = req.params

        const driver = await Driver.findOne({
            _id: driverId,
            fleetOwnerId: req.userId,
        })

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            })
        }

        if (driver.status === "ASSIGNED") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete assigned driver",
            })
        }

        await driver.deleteOne()

        res.status(200).json({
            success: true,
            message: "Driver deleted successfully",
        })
    } catch (error) {
        console.error("[v0] Error deleting driver:", error)
        res.status(500).json({
            success: false,
            message: "Error deleting driver",
            error: error.message,
        })
    }
}

export const createCorporateDriver = async (req, res) => {
    try {
        console.log("[v0] Creating driver with corporateOwnerId:", req.userId)
        console.log("[v0] Request body:", JSON.stringify(req.body, null, 2))
        console.log("[v0] Files received:", {
            license: req.files?.license?.length || 0,
            passport: req.files?.passport?.length || 0,
            visa: req.files?.visa?.length || 0,
            medicalCertificate: req.files?.medicalCertificate?.length || 0,
        })

        let experienceYears = req.body.experienceYears || req.body["experience[years]"]
        experienceYears = Number.parseInt(experienceYears, 10)

        if (isNaN(experienceYears) || experienceYears < 0) {
            return res.status(400).json({
                success: false,
                message: "Experience years must be a valid number",
            })
        }

        const driverData = {
            corporateOwnerId: req.userId,
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            licenseNumber: req.body.licenseNumber,
            licenseExpiry: req.body.licenseExpiry,
            licenseType: req.body.licenseType,
            dateOfBirth: req.body.dateOfBirth,
            nationality: req.body.nationality,
            address: {
                street: req.body["address[street]"] || req.body.street,
                city: req.body["address[city]"] || req.body.city,
                country: req.body["address[country]"] || req.body.country,
            },
            experience: {
                years: experienceYears,
                description: req.body["experience[description]"] || req.body.experienceDescription,
            },
            documents: {
                license: null,
                passport: null,
                visa: null,
                medicalCertificate: null,
            },
        }

        if (req.files) {
            const fileUploads = []

            if (req.files.license) {
                fileUploads.push({
                    file: req.files.license[0],
                    fieldName: "license",
                })
            }
            if (req.files.passport) {
                fileUploads.push({
                    file: req.files.passport[0],
                    fieldName: "passport",
                })
            }
            if (req.files.visa) {
                fileUploads.push({
                    file: req.files.visa[0],
                    fieldName: "visa",
                })
            }
            if (req.files.medicalCertificate) {
                fileUploads.push({
                    file: req.files.medicalCertificate[0],
                    fieldName: "medicalCertificate",
                })
            }

            if (fileUploads.length > 0) {
                for (const upload of fileUploads) {
                    const uploadedFile = await uploadToCloudinary(upload.file, `driveme/drivers/${req.userId}`, upload.fieldName)
                    driverData.documents[upload.fieldName] = uploadedFile.secure_url
                }
            }
        }

        const corporateDriver = await CorporateDriver.create(driverData)

        // Create User account for driver with CORPORATE_DRIVER role
        const generatedPassword = generateRandomPassword()
        const userData = {
            role: "CORPORATE_DRIVER",
            fullName: req.body.name,
            email: req.body.email,
            whatsappNumber: req.body.phone,
            password: generatedPassword,
            employedBy: req.userId,
            driverId: corporateDriver._id,
            driverModel: "CorporateDriver",
            driverInfo: {
                licenseNumber: req.body.licenseNumber,
                licenseExpiry: req.body.licenseExpiry,
                licenseType: req.body.licenseType,
                dateOfBirth: req.body.dateOfBirth,
                nationality: req.body.nationality,
                address: {
                    street: req.body["address[street]"] || req.body.street,
                    city: req.body["address[city]"] || req.body.city,
                    country: req.body["address[country]"] || req.body.country,
                },
                experience: {
                    years: experienceYears,
                    description: req.body["experience[description]"] || req.body.experienceDescription,
                },
                documents: driverData.documents,
                status: "AVAILABLE",
            },
        }

        const userDriver = await User.create(userData)

        // Send email with login credentials to driver
        try {
            const corporateOwner = await User.findById(req.userId)
            const emailResult = await sendDriverCredentials(
                req.body.email,
                generatedPassword,
                req.body.name,
                corporateOwner?.companyName || 'Your Company'
            )

            if (emailResult.success) {
                console.log(`Corporate driver credentials email sent to: ${req.body.email}`)
            } else {
                console.error('Failed to send corporate driver credentials email:', emailResult.message)
            }
        } catch (emailError) {
            console.error('Error sending corporate driver credentials email:', emailError)
        }


        res.status(201).json({
            success: true,
            message: "Corporate Driver registered successfully! Login credentials sent to driver's email.",
            driver: corporateDriver,
            userDriver: {
                id: userDriver._id,
                email: userDriver.email,
                role: userDriver.role,
            },
        })
    } catch (error) {
        console.error("[v0] Error creating driver:", error.message)
        res.status(500).json({
            success: false,
            message: "Error creating driver",
            error: error.message,
        })
    }
}

// Get available drivers
export const getAvailableCorporateDrivers = async (req, res) => {
    try {
        const drivers = await CorporateDriver.find({
            corporateOwnerId: req.userId,
            status: "AVAILABLE",
        }).sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        })
    } catch (error) {
        console.error("[v0] Error fetching available drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching available drivers",
            error: error.message,
        })
    }
}

// Get ALL corporate drivers (for Drivers tab in Corporate dashboard)
export const getAllCorporateDrivers = async (req, res) => {
    try {
        const drivers = await CorporateDriver.find({
            corporateOwnerId: req.userId,
        }).sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        })
    } catch (error) {
        console.error("Error fetching corporate drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching corporate drivers",
            error: error.message,
        })
    }
}

// Create B2C Partner Driver
export const createB2CPartnerDriver = async (req, res) => {
    try {
        console.log("[v0] Creating B2C Partner Driver with b2cPartnerId:", req.userId)
        console.log("[v0] Request body:", JSON.stringify(req.body, null, 2))
        console.log("[v0] Files received:", {
            license: req.files?.license?.length || 0,
            passport: req.files?.passport?.length || 0,
            visa: req.files?.visa?.length || 0,
            medicalCertificate: req.files?.medicalCertificate?.length || 0,
            driverImage: req.files?.driverImage?.length || 0,
        })

        // Validate required fields
        if (!req.body.fullName) {
            return res.status(400).json({
                success: false,
                message: "Driver name is required",
                error: "Missing required field: fullName"
            })
        }

        if (!req.body.email) {
            return res.status(400).json({
                success: false,
                message: "Driver email is required",
                error: "Missing required field: email"
            })
        }

        if (!req.body.phone) {
            return res.status(400).json({
                success: false,
                message: "Driver phone is required",
                error: "Missing required field: phone"
            })
        }

        let experienceYears = req.body.experience || req.body["experience[years]"]
        experienceYears = Number.parseInt(experienceYears, 10)

        if (isNaN(experienceYears) || experienceYears < 0) {
            return res.status(400).json({
                success: false,
                message: "Experience years must be a valid number",
            })
        }

        // B2C Partner Driver data for B2CPartnerDriver table
        const b2cDriverData = {
            b2cPartnerId: req.userId,
            name: req.body.fullName,
            email: req.body.email,
            phoneNumber: req.body.phone,
            licenseNumber: req.body.licenseNumber,
            licenseExpiry: req.body.licenseExpiry,
            nationality: req.body.nationality,
            experience: experienceYears,
            address: req.body.address || `${req.body.street || ''}, ${req.body.city || ''}, ${req.body.country || ''}`,
            emergencyContact: {
                name: req.body.emergencyContactName || '',
                phone: req.body.emergencyContactPhone || '',
            },
            driverImage: {
                url: null,
                publicId: null,
            },
            documents: {
                license: null,
                passport: null,
                visa: null,
                medicalCertificate: null,
            },
        }

        // Upload files to Cloudinary
        if (req.files) {
            const fileUploads = []

            if (req.files.license) {
                fileUploads.push({
                    file: req.files.license[0],
                    fieldName: "license",
                })
            }
            if (req.files.passport) {
                fileUploads.push({
                    file: req.files.passport[0],
                    fieldName: "passport",
                })
            }
            if (req.files.visa) {
                fileUploads.push({
                    file: req.files.visa[0],
                    fieldName: "visa",
                })
            }
            if (req.files.medicalCertificate) {
                fileUploads.push({
                    file: req.files.medicalCertificate[0],
                    fieldName: "medicalCertificate",
                })
            }
            if (req.files.driverImage) {
                fileUploads.push({
                    file: req.files.driverImage[0],
                    fieldName: "driverImage",
                })
            }

            if (fileUploads.length > 0) {
                for (const upload of fileUploads) {
                    const uploadedFile = await uploadToCloudinary(upload.file, `b2c-drivers/${req.userId}`, upload.fieldName)
                    
                    if (upload.fieldName === "driverImage") {
                        b2cDriverData.driverImage.url = uploadedFile.secure_url
                        b2cDriverData.driverImage.publicId = uploadedFile.public_id
                    } else {
                        b2cDriverData.documents[upload.fieldName] = uploadedFile.secure_url
                    }
                }
            }
        }

        // Create B2C Partner Driver in B2CPartnerDriver table
        const b2cDriver = await B2CPartnerDriver.create(b2cDriverData)

        // Create User account for driver with B2C_PARTNER_DRIVER role
        const generatedPassword = generateRandomPassword()
        const userData = {
            role: "B2C_PARTNER_DRIVER",
            fullName: req.body.fullName,
            email: req.body.email,
            whatsappNumber: req.body.phone,
            password: generatedPassword,
            b2cPartnerId: req.userId,
            driverId: b2cDriver._id,
            driverModel: "B2CPartnerDriver",
            driverInfo: {
                licenseNumber: req.body.licenseNumber,
                licenseExpiry: req.body.licenseExpiry,
                nationality: req.body.nationality,
                address: {
                    street: req.body.street || '',
                    city: req.body.city || 'Kuwait City',
                    country: req.body.country || 'Kuwait'
                },
                experience: {
                    years: experienceYears,
                    description: req.body.experienceDescription || ''
                },
                documents: b2cDriverData.documents,
                status: "AVAILABLE",
                emergencyContact: {
                    name: req.body.emergencyContactName || '',
                    phone: req.body.emergencyContactPhone || '',
                },
            },
        }

        const userDriver = await User.create(userData)

        // Send email with login credentials to driver
        try {
            const b2cPartner = await User.findById(req.userId)
            const emailResult = await sendDriverCredentials(
                req.body.email,
                generatedPassword,
                req.body.fullName,
                b2cPartner?.fullName || 'B2C Partner'
            )

            if (emailResult.success) {
                console.log(`B2C Driver credentials email sent to: ${req.body.email}`)
            } else {
                console.error('Failed to send B2C driver credentials email:', emailResult.message)
            }
        } catch (emailError) {
            console.error('Error sending B2C driver credentials email:', emailError)
        }

        res.status(201).json({
            success: true,
            message: "B2C Partner Driver registered successfully! Login credentials sent to driver's email.",
            b2cDriver,
            userDriver: {
                id: userDriver._id,
                email: userDriver.email,
                role: userDriver.role,
            },
        })
    } catch (error) {
        console.error("[v0] Error creating B2C partner driver:", error.message)
        res.status(500).json({
            success: false,
            message: "Error creating B2C partner driver",
            error: error.message,
        })
    }
}

// Get B2C Partner Drivers
export const getB2CPartnerDrivers = async (req, res) => {
    try {
        console.log("[v0] Fetching B2C Partner Drivers for partner:", req.userId)
        
        // Get B2C Partner details
        const b2cPartner = await User.findById(req.userId);
        
        // Get assigned drivers from B2CPartnerDriver table
        const assignedDrivers = await B2CPartnerDriver.find({
            b2cPartnerId: req.userId,
        })
        .populate('assignedVehicles', 'model licensePlate vehicleType seatingCapacity')
        .populate('assignedRoutes', 'fromLocation toLocation routeName')
        .sort({ createdAt: -1 })

        // Create drivers array
        let drivers = [...assignedDrivers];
        
        // Add B2C Partner as a driver option if they can drive
        if (b2cPartner && (b2cPartner.canDrive || b2cPartner.hasDrivingLicense || b2cPartner.role === 'B2C_PARTNER')) {
            // Add B2C Partner as a driver option
            const partnerAsDriver = {
                _id: b2cPartner._id,
                name: b2cPartner.name || b2cPartner.businessName || 'Self',
                email: b2cPartner.email,
                phone: b2cPartner.phone,
                isSelf: true, // Flag to identify this is the partner themselves
                assignedVehicles: [],
                assignedRoutes: [],
                b2cPartnerId: req.userId,
                createdAt: b2cPartner.createdAt,
                // Add driver-like fields for compatibility
                licenseNumber: b2cPartner.licenseNumber || 'Self-Employed',
                experience: b2cPartner.experience || 'Owner-Operator',
                status: 'Available'
            };
            
            drivers.unshift(partnerAsDriver); // Add at the beginning
        }

        console.log("[v0] Found B2C Partner Drivers:", drivers.length)
        console.log("[v0] Drivers data:", JSON.stringify(drivers, null, 2))

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers: drivers,
        })
    } catch (error) {
        console.error("[v0] Error fetching B2C partner drivers:", error)
        res.status(500).json({
            success: false,
            message: "Error fetching B2C partner drivers",
            error: error.message,
        })
    }
}

// Update B2C Partner Driver
export const updateB2CPartnerDriver = async (req, res) => {
    try {
        const { driverId } = req.params
        
        const b2cDriver = await B2CPartnerDriver.findOne({
            _id: driverId,
            b2cPartnerId: req.userId,
        })

        if (!b2cDriver) {
            return res.status(404).json({
                success: false,
                message: "B2C Partner Driver not found",
            })
        }

        // Update B2C Partner Driver data
        const updateData = {
            name: req.body.name || b2cDriver.name,
            email: req.body.email || b2cDriver.email,
            phoneNumber: req.body.phone || b2cDriver.phoneNumber,
            licenseNumber: req.body.licenseNumber || b2cDriver.licenseNumber,
            licenseExpiry: req.body.licenseExpiry || b2cDriver.licenseExpiry,
            nationality: req.body.nationality || b2cDriver.nationality,
            experience: req.body.experience || b2cDriver.experience,
            address: req.body.address || b2cDriver.address,
            emergencyContact: {
                name: req.body.emergencyContactName || b2cDriver.emergencyContact.name,
                phone: req.body.emergencyContactPhone || b2cDriver.emergencyContact.phone,
            },
        }

        // Handle file uploads if any
        if (req.files) {
            const fileUploads = []

            if (req.files.license) {
                fileUploads.push({
                    file: req.files.license[0],
                    fieldName: "license",
                })
            }
            if (req.files.passport) {
                fileUploads.push({
                    file: req.files.passport[0],
                    fieldName: "passport",
                })
            }
            if (req.files.visa) {
                fileUploads.push({
                    file: req.files.visa[0],
                    fieldName: "visa",
                })
            }
            if (req.files.medicalCertificate) {
                fileUploads.push({
                    file: req.files.medicalCertificate[0],
                    fieldName: "medicalCertificate",
                })
            }
            if (req.files.driverImage) {
                fileUploads.push({
                    file: req.files.driverImage[0],
                    fieldName: "driverImage",
                })
            }

            if (fileUploads.length > 0) {
                for (const upload of fileUploads) {
                    const uploadedFile = await uploadToCloudinary(upload.file, `b2c-drivers/${req.userId}`, upload.fieldName)
                    
                    if (upload.fieldName === "driverImage") {
                        updateData.driverImage = {
                            url: uploadedFile.secure_url,
                            publicId: uploadedFile.public_id,
                        }
                    } else {
                        updateData.documents = updateData.documents || {}
                        updateData.documents[upload.fieldName] = uploadedFile.secure_url
                    }
                }
            }
        }

        const updatedB2CDriver = await B2CPartnerDriver.findByIdAndUpdate(
            driverId,
            updateData,
            { new: true }
        )

        // Update corresponding User record
        const userUpdateData = {
            fullName: updateData.name,
            email: updateData.email,
            whatsappNumber: updateData.phoneNumber,
            'driverInfo.licenseNumber': updateData.licenseNumber,
            'driverInfo.licenseExpiry': updateData.licenseExpiry,
            'driverInfo.nationality': updateData.nationality,
            'driverInfo.experience': updateData.experience,
            'driverInfo.address': updateData.address,
            'driverInfo.emergencyContact': updateData.emergencyContact,
        }

        if (updateData.driverImage) {
            userUpdateData['driverInfo.driverImage'] = updateData.driverImage
        }

        if (updateData.documents) {
            userUpdateData['driverInfo.documents'] = {
                ...b2cDriver.documents,
                ...updateData.documents
            }
        }

        await User.findOneAndUpdate(
            {
                driverId: driverId,
                role: "B2C_PARTNER_DRIVER",
                b2cPartnerId: req.userId,
            },
            userUpdateData
        )

        res.status(200).json({
            success: true,
            message: "B2C Partner Driver updated successfully",
            driver: updatedB2CDriver,
        })
    } catch (error) {
        console.error("[v0] Error updating B2C partner driver:", error.message)
        res.status(500).json({
            success: false,
            message: "Error updating B2C partner driver",
            error: error.message,
        })
    }
}

// Delete B2C Partner Driver
export const deleteB2CPartnerDriver = async (req, res) => {
    try {
        const { driverId } = req.params
        
        const b2cDriver = await B2CPartnerDriver.findOne({
            _id: driverId,
            b2cPartnerId: req.userId,
        })

        if (!b2cDriver) {
            return res.status(404).json({
                success: false,
                message: "B2C Partner Driver not found",
            })
        }

        // Delete B2C Partner Driver from B2CPartnerDriver table
        await B2CPartnerDriver.findByIdAndDelete(driverId)

        // Delete corresponding User record
        await User.findOneAndDelete({
            driverId: driverId,
            role: "B2C_PARTNER_DRIVER",
            b2cPartnerId: req.userId,
        })

        res.status(200).json({
            success: true,
            message: "B2C Partner Driver deleted successfully",
        })
    } catch (error) {
        console.error("[v0] Error deleting B2C partner driver:", error.message)
        res.status(500).json({
            success: false,
            message: "Error deleting B2C partner driver",
            error: error.message,
        })
    }
}
