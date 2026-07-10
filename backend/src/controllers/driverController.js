import Driver from "../models/Driver.js"
import User from "../models/User.js"
import CorporateDriver from "../models/CorporateDriver.js"
import B2CPartnerTrip from "../models/B2CPartnerTrip.js"
import B2CPartnerDriver from "../models/B2CPartnerDriver.js"
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js";
import { uploadToCloudinary } from "../Config/Cloudinary.js"
import { sendDriverCredentials } from "../Services/emailService.js"
import { initializeTripTracking, updateTripLocation, completeTrip } from "../Services/locationTrackingService.js"
import { broadcastDriverAvailabilityChange, broadcastSelfDriverAvailabilityChange } from "../Services/socketService.js"
import { sendErrorResponse } from "../utils/errorResponse.js"
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

        // Pre-check for a duplicate email before creating any records, so the user
        // gets a clear message and no orphaned Driver record is left behind if the
        // linked User account fails to create.
        const normalizedEmail = (req.body.email || "").trim().toLowerCase()
        if (normalizedEmail) {
            const existingUser = await User.findOne({ email: normalizedEmail })
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists. Please use a different email.",
                })
            }
        }

        const driverData = {
            fleetOwnerId: req.userId,
            name: req.body.name,
            email: normalizedEmail,
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
            email: normalizedEmail,
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

        let userDriver
        try {
            userDriver = await User.create(userData)
        } catch (userCreateError) {
            // Roll back the driver record so no orphaned Driver is left behind
            // if the linked User account fails to create.
            await Driver.deleteOne({ _id: driver._id })
            throw userCreateError
        }

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
        return sendErrorResponse(res, error, "Error creating driver")
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

        // Pre-check for a duplicate email before creating any records, so the user
        // gets a clear message and no orphaned CorporateDriver record is left
        // behind if the linked User account fails to create.
        const normalizedEmail = (req.body.email || "").trim().toLowerCase()
        if (normalizedEmail) {
            const existingUser = await User.findOne({ email: normalizedEmail })
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists. Please use a different email.",
                })
            }
        }

        const driverData = {
            corporateOwnerId: req.userId,
            name: req.body.name,
            email: normalizedEmail,
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
            email: normalizedEmail,
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

        let userDriver
        try {
            userDriver = await User.create(userData)
        } catch (userCreateError) {
            // Roll back the driver record so no orphaned CorporateDriver is left
            // behind if the linked User account fails to create.
            await CorporateDriver.deleteOne({ _id: corporateDriver._id })
            throw userCreateError
        }

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
        return sendErrorResponse(res, error, "Error creating driver")
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

        // Pre-check for a duplicate email BEFORE creating any records. This gives
        // the user a clear message instead of a raw Mongo E11000 error, and it
        // prevents orphaned B2CPartnerDriver rows from being left behind when the
        // linked User account fails to create.
        const normalizedEmail = req.body.email.trim().toLowerCase()
        const existingUser = await User.findOne({ email: normalizedEmail })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists. Please use a different email.",
            })
        }

        // B2C Partner Driver data for B2CPartnerDriver table
        const b2cDriverData = {
            b2cPartnerId: req.userId,
            name: req.body.fullName,
            email: normalizedEmail,
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
            email: normalizedEmail,
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

        let userDriver
        try {
            userDriver = await User.create(userData)
        } catch (userCreateError) {
            // The linked User failed to create (e.g. a race on the unique email).
            // Roll back the driver record we just created so we never leave an
            // orphaned B2CPartnerDriver behind.
            await B2CPartnerDriver.deleteOne({ _id: b2cDriver._id })
            throw userCreateError
        }

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
        // Translate low-level DB errors (e.g. duplicate email) into a clear,
        // user-friendly message the frontend can show directly in a toast.
        return sendErrorResponse(res, error, "Error creating B2C partner driver")
    }
}

// Get B2C Partner Drivers with availability status
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

        // Get current date and time for availability check
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Get all trips for today that are "In Progress" or "Scheduled" (upcoming within 2 hours)
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        // Fetch ALL trips for today (to calculate completed trips and availability windows)
        // Include bookedSeats to determine if trips have actual bookings
        const allTodayTrips = await B2CPartnerTrip.find({
            b2cPartnerId: req.userId,
            tripDate: { $gte: today, $lte: todayEnd }
        }).select('driverId tripDate startTime status fromLocation toLocation completedAt bookedSeats').sort({ startTime: 1 });

        // Separate trips by status for availability window calculation
        const completedTripsMap = new Map();
        const scheduledTripsMap = new Map();
        const inProgressTripsMap = new Map();

        for (const trip of allTodayTrips) {
            if (!trip.driverId) continue;
            const driverId = trip.driverId.toString();

            if (['COMPLETED', 'Completed', 'DONE', 'Done'].includes(trip.status)) {
                if (!completedTripsMap.has(driverId)) completedTripsMap.set(driverId, []);
                completedTripsMap.get(driverId).push({
                    _id: trip._id,
                    startTime: trip.startTime,
                    fromLocation: trip.fromLocation,
                    toLocation: trip.toLocation,
                    completedAt: trip.completedAt,
                    bookedSeats: trip.bookedSeats || 0
                });
            } else if (['SCHEDULED', 'Scheduled'].includes(trip.status)) {
                if (!scheduledTripsMap.has(driverId)) scheduledTripsMap.set(driverId, []);
                scheduledTripsMap.get(driverId).push({
                    _id: trip._id,
                    startTime: trip.startTime,
                    fromLocation: trip.fromLocation,
                    toLocation: trip.toLocation,
                    bookedSeats: trip.bookedSeats || 0
                });
            } else if (['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(trip.status)) {
                if (!inProgressTripsMap.has(driverId)) inProgressTripsMap.set(driverId, []);
                inProgressTripsMap.get(driverId).push({
                    _id: trip._id,
                    startTime: trip.startTime,
                    fromLocation: trip.fromLocation,
                    toLocation: trip.toLocation,
                    bookedSeats: trip.bookedSeats || 0
                });
            }
        }

        // Fetch trips to determine driver availability (for immediate status)
        const activeTrips = await B2CPartnerTrip.find({
            b2cPartnerId: req.userId,
            tripDate: { $gte: today, $lte: twoHoursFromNow },
            status: { $in: ["Scheduled", "In Progress"] }
        }).select('driverId tripDate startTime status fromLocation toLocation');

        // Get all active schedules for this partner to determine driver schedule assignments
        const B2CPartnerSchedule = (await import("../models/B2CPartnerSchedule.js")).default;
        const activeSchedules = await B2CPartnerSchedule.find({
            b2cPartnerId: req.userId,
            isActive: true
        }).populate('routeId', 'fromLocation toLocation');

        // Create a map of driver schedule assignments with detailed info
        const driverScheduleMap = new Map();

        for (const schedule of activeSchedules) {
            // Check tripTimes for driver assignments
            if (schedule.tripTimes && schedule.tripTimes.length > 0) {
                for (const tripTime of schedule.tripTimes) {
                    if (tripTime.assignedDriver) {
                        const driverId = tripTime.assignedDriver.toString();
                        if (!driverScheduleMap.has(driverId)) {
                            driverScheduleMap.set(driverId, []);
                        }
                        driverScheduleMap.get(driverId).push({
                            scheduleId: schedule._id,
                            scheduleName: schedule.scheduleName,
                            routeName: schedule.routeId ? `${schedule.routeId.fromLocation} → ${schedule.routeId.toLocation}` : 'Unknown Route',
                            departureTime: tripTime.departureTime,
                            arrivalTime: tripTime.arrivalTime,
                            tripType: tripTime.tripType || schedule.tripType,
                            availableDays: schedule.availableDays
                        });
                    }
                }
            }

            // Also check main assignedDriver field
            if (schedule.assignedDriver) {
                const driverId = schedule.assignedDriver.toString();
                if (!driverScheduleMap.has(driverId)) {
                    driverScheduleMap.set(driverId, []);
                }
                // Check if this schedule isn't already added from tripTimes
                const existing = driverScheduleMap.get(driverId);
                const alreadyAdded = existing.some(s => s.scheduleId.toString() === schedule._id.toString());
                if (!alreadyAdded) {
                    driverScheduleMap.get(driverId).push({
                        scheduleId: schedule._id,
                        scheduleName: schedule.scheduleName,
                        routeName: schedule.routeId ? `${schedule.routeId.fromLocation} → ${schedule.routeId.toLocation}` : 'Unknown Route',
                        departureTime: schedule.departureTime,
                        arrivalTime: schedule.arrivalTime,
                        tripType: schedule.tripType,
                        availableDays: schedule.availableDays
                    });
                }
            }
        }

        // Create a map of driver availability
        const driverAvailabilityMap = new Map();

        for (const trip of activeTrips) {
            if (trip.driverId) {
                const driverId = trip.driverId.toString();
                if (!driverAvailabilityMap.has(driverId)) {
                    driverAvailabilityMap.set(driverId, []);
                }
                driverAvailabilityMap.get(driverId).push({
                    tripDate: trip.tripDate,
                    startTime: trip.startTime,
                    status: trip.status,
                    route: `${trip.fromLocation} → ${trip.toLocation}`
                });
            }
        }

        // Function to determine availability status - now uses database stored status + trip info
        // IMPROVED: Consider driver "available" if their next trip is more than 30 minutes away
        // FIXED: Only consider schedules as commitments if they have actual booked passengers (bookedSeats > 0)
        // If driver has manually set themselves as "available" and no bookings exist, they ARE available
        const getAvailabilityStatus = (driverId, storedAvailabilityStatus = null) => {
            // First check the stored availability status from database (set by driver themselves)
            if (storedAvailabilityStatus === 'offline') {
                return { status: 'offline', message: 'Offline', color: 'gray' };
            }

            // Get current time for comparison
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            // Helper to convert time string to minutes since midnight
            const timeToMinutes = (timeStr) => {
                if (!timeStr) return 0;
                // Handle both 24h (HH:MM) and 12h (H:MM AM/PM) formats
                let hours, minutes;
                if (timeStr.includes('AM') || timeStr.includes('PM')) {
                    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (match) {
                        hours = parseInt(match[1]);
                        minutes = parseInt(match[2]);
                        const period = match[3].toUpperCase();
                        if (period === 'PM' && hours !== 12) hours += 12;
                        if (period === 'AM' && hours === 12) hours = 0;
                    } else {
                        return 0;
                    }
                } else {
                    const parts = timeStr.split(':');
                    hours = parseInt(parts[0]);
                    minutes = parseInt(parts[1] || 0);
                }
                return hours * 60 + minutes;
            };

            const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
            const BUFFER_MINUTES = 30; // 30 minute buffer before trip

            // Check if driver has active trips (from the 2-hour window query)
            const trips = driverAvailabilityMap.get(driverId.toString()) || [];

            // Also check ALL scheduled trips for today (not just 2-hour window)
            // ONLY consider trips with bookedSeats > 0 as actual commitments
            const allScheduledForDriver = (scheduledTripsMap.get(driverId.toString()) || [])
                .filter(t => t.bookedSeats && t.bookedSeats > 0);
            const inProgressForDriver = inProgressTripsMap.get(driverId.toString()) || [];

            // In progress trip - definitely busy
            const inProgressTrip = trips.find(t => t.status === 'In Progress') ||
                (inProgressForDriver.length > 0 ? inProgressForDriver[0] : null);
            if (inProgressTrip) {
                return {
                    status: 'busy',
                    message: `In Trip: ${inProgressTrip.route || `${inProgressTrip.fromLocation} → ${inProgressTrip.toLocation}`}`,
                    color: 'red',
                    currentTrip: inProgressTrip
                };
            }

            // Find the next scheduled trip that is in the future AND has booked passengers
            const upcomingTrips = allScheduledForDriver
                .filter(t => {
                    const tripMinutes = timeToMinutes(t.startTime);
                    return tripMinutes > currentMinutesSinceMidnight;
                })
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            // IMPORTANT: If driver/partner has manually set themselves as "available", 
            // they are available for new assignments EVEN IF they have schedules without bookings
            // Only actual trips with bookings should block availability

            // Check if there are any actual trips with bookings
            let nextCommitmentTime = null;
            let nextCommitmentType = null;

            if (upcomingTrips.length > 0) {
                nextCommitmentTime = timeToMinutes(upcomingTrips[0].startTime);
                nextCommitmentType = 'trip';
            }

            // NOTE: We no longer treat schedules without bookings as commitments
            // Schedules are only commitments if they have generated trips with bookedSeats > 0

            if (nextCommitmentTime) {
                const minutesUntilCommitment = nextCommitmentTime - currentMinutesSinceMidnight;
                const nextTimeStr = upcomingTrips[0].startTime;

                if (minutesUntilCommitment <= BUFFER_MINUTES) {
                    // Commitment is within 30 minutes - driver should be preparing
                    return {
                        status: 'scheduled',
                        message: `Next ${nextCommitmentType} in ${minutesUntilCommitment}min: ${nextTimeStr}`,
                        color: 'orange',
                        upcomingTrips: upcomingTrips,
                        upcomingSchedules: [],
                        nextTripTime: nextTimeStr,
                        minutesUntilTrip: minutesUntilCommitment
                    };
                } else {
                    // Commitment is more than 30 minutes away - driver is available until then
                    const availableUntilMinutes = nextCommitmentTime - BUFFER_MINUTES;
                    const availableUntilHours = Math.floor(availableUntilMinutes / 60);
                    const availableUntilMins = availableUntilMinutes % 60;
                    const availableUntilStr = `${String(availableUntilHours).padStart(2, '0')}:${String(availableUntilMins).padStart(2, '0')}`;

                    // Convert to 12-hour format for display
                    const period = availableUntilHours >= 12 ? 'PM' : 'AM';
                    const displayHours = availableUntilHours > 12 ? availableUntilHours - 12 : (availableUntilHours === 0 ? 12 : availableUntilHours);
                    const availableUntilDisplay = `${displayHours}:${String(availableUntilMins).padStart(2, '0')} ${period}`;

                    return {
                        status: 'available',
                        message: `Available until ${availableUntilDisplay}`,
                        color: 'green',
                        availableUntil: availableUntilStr,
                        availableUntilDisplay: availableUntilDisplay,
                        nextTripTime: nextTimeStr,
                        minutesUntilTrip: minutesUntilCommitment,
                        hasUpcomingTrips: upcomingTrips.length > 0,
                        hasUpcomingSchedules: false,
                        upcomingTrips: upcomingTrips,
                        upcomingSchedules: []
                    };
                }
            }

            // No scheduled trips with bookings for today
            // But we should still show "Available until X:XX" if they have SCHEDULES (for display purposes)
            // FIXED: Don't treat stored 'busy' status as "manually set" since it may have been
            // automatically set when schedules were created. Only respect 'offline' as a manual override.
            if (storedAvailabilityStatus === 'offline') {
                return { status: 'offline', message: 'Offline', color: 'gray' };
            }

            // Check if driver has upcoming SCHEDULES (not trips) to display availability window
            // This is for display purposes - they are still "available" for new assignments
            const assignedSchedules = driverScheduleMap.get(driverId.toString()) || [];
            // Use both full day names and abbreviated day names for compatibility
            const fullDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
            const shortDayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];

            // Filter schedules that are active today and in the future
            const upcomingSchedules = assignedSchedules
                .filter(s => {
                    // Check if schedule runs today - support both full names and abbreviations
                    const availableDays = s.availableDays || [];
                    const runsToday = availableDays.length === 0 ||
                        availableDays.some(day => {
                            const dayUpper = day.toUpperCase();
                            return dayUpper === shortDayName ||
                                dayUpper === fullDayName.toUpperCase() ||
                                day === fullDayName;
                        });
                    if (!runsToday) return false;

                    // Check if departure time is in the future
                    const depMinutes = timeToMinutes(s.departureTime);
                    return depMinutes > currentMinutesSinceMidnight;
                })
                .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));

            if (upcomingSchedules.length > 0) {
                // Calculate available until time (30 min before next schedule)
                const nextScheduleTime = timeToMinutes(upcomingSchedules[0].departureTime);
                const availableUntilMinutes = nextScheduleTime - BUFFER_MINUTES;
                const availableUntilHours = Math.floor(availableUntilMinutes / 60);
                const availableUntilMins = availableUntilMinutes % 60;
                const availableUntilStr = `${String(availableUntilHours).padStart(2, '0')}:${String(availableUntilMins).padStart(2, '0')}`;

                // Convert to 12-hour format for display
                const period = availableUntilHours >= 12 ? 'PM' : 'AM';
                const displayHours = availableUntilHours > 12 ? availableUntilHours - 12 : (availableUntilHours === 0 ? 12 : availableUntilHours);
                const availableUntilDisplay = `${displayHours}:${String(availableUntilMins).padStart(2, '0')} ${period}`;

                return {
                    status: 'available',
                    message: `Available until ${availableUntilDisplay}`,
                    color: 'green',
                    availableUntil: availableUntilStr,
                    availableUntilDisplay: availableUntilDisplay,
                    nextTripTime: upcomingSchedules[0].departureTime,
                    hasUpcomingTrips: false,
                    hasUpcomingSchedules: true,
                    upcomingTrips: [],
                    upcomingSchedules: upcomingSchedules
                };
            }

            return { status: 'available', message: 'Available', color: 'green' };
        };

        // Helper function to calculate availability window
        const getAvailabilityWindow = (driverId) => {
            const driverIdStr = driverId.toString();
            const completedTrips = completedTripsMap.get(driverIdStr) || [];
            const scheduledTrips = scheduledTripsMap.get(driverIdStr) || [];
            const inProgressTrips = inProgressTripsMap.get(driverIdStr) || [];

            // Get current time as HH:MM string for comparison
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            // Find next scheduled trip after current time
            const upcomingTrips = scheduledTrips.filter(t => {
                const tripTime = t.startTime || '00:00';
                return tripTime > currentTimeStr;
            });

            const nextScheduledTrip = upcomingTrips.length > 0 ? upcomingTrips[0] : null;

            // Calculate available until time (30 min before next trip)
            let availableUntil = null;
            let availableUntilFormatted = null;
            if (nextScheduledTrip) {
                const [hours, minutes] = nextScheduledTrip.startTime.split(':').map(Number);
                const nextTripDate = new Date();
                nextTripDate.setHours(hours, minutes, 0, 0);
                availableUntil = new Date(nextTripDate.getTime() - 30 * 60 * 1000);
                const availableHours = String(availableUntil.getHours()).padStart(2, '0');
                const availableMinutes = String(availableUntil.getMinutes()).padStart(2, '0');
                availableUntilFormatted = `${availableHours}:${availableMinutes}`;
            }

            // Calculate time until next trip
            let timeUntilNextTrip = null;
            if (nextScheduledTrip) {
                const [hours, minutes] = nextScheduledTrip.startTime.split(':').map(Number);
                const nextTripDate = new Date();
                nextTripDate.setHours(hours, minutes, 0, 0);
                const diffMs = nextTripDate - now;
                if (diffMs > 0) {
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    timeUntilNextTrip = diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`;
                }
            }

            return {
                completedTripsToday: completedTrips,
                nextScheduledTrip: nextScheduledTrip ? {
                    _id: nextScheduledTrip._id,
                    departureTime: nextScheduledTrip.startTime,
                    fromLocation: nextScheduledTrip.fromLocation,
                    toLocation: nextScheduledTrip.toLocation
                } : null,
                inProgressTrip: inProgressTrips.length > 0 ? inProgressTrips[0] : null,
                availableUntil,
                availableUntilFormatted,
                nextScheduledTripTime: nextScheduledTrip?.startTime || null,
                timeUntilNextTrip,
                hasCompletedTripsToday: completedTrips.length > 0,
                hasUpcomingTrips: upcomingTrips.length > 0,
                canBeAvailableBetweenTrips: completedTrips.length > 0 && upcomingTrips.length > 0 && inProgressTrips.length === 0
            };
        };

        // Collect DB corrections for drivers whose stored availabilityStatus is
        // stale. A driver's status was historically auto-set to 'busy' when a
        // schedule was created, even though the driver isn't actually on/near a
        // booked trip. That stale value leaked to the UI and made every card show
        // "Busy". We recompute the real status and heal the persisted value.
        const staleStatusFixes = [];

        // Normalize a computed availability status to the persisted enum
        // ('available' | 'busy' | 'offline'). 'scheduled' is a display-only state
        // and maps back to 'available' since the driver can still take assignments.
        const normalizeAvailabilityStatus = (computedStatus) => {
            if (computedStatus === 'busy') return 'busy';
            if (computedStatus === 'offline') return 'offline';
            return 'available';
        };

        // Create drivers array with availability status - derived from REAL trips
        let drivers = assignedDrivers.map(driver => {
            const driverObj = driver.toObject();
            // Compute the real availability from actual trips (respecting a manual
            // 'offline' override), NOT the stale stored 'busy'.
            const availabilityResult = getAvailabilityStatus(driver._id, driver.availabilityStatus);
            driverObj.availability = availabilityResult;
            // Root-level status must mirror the COMPUTED availability, not the stale
            // stored value that previously forced unassigned drivers to show "Busy".
            const normalizedStatus = normalizeAvailabilityStatus(availabilityResult.status);
            driverObj.availabilityStatus = normalizedStatus;
            // Queue a persisted correction when the DB value no longer matches reality.
            if ((driver.availabilityStatus || 'available') !== normalizedStatus) {
                staleStatusFixes.push({ id: driver._id, status: normalizedStatus });
            }
            // Add isSelfDriver flag for socket matching
            driverObj.isSelfDriver = false;

            // Add schedule assignment details
            const assignedScheduleDetails = driverScheduleMap.get(driver._id.toString()) || [];
            // Sort by departure time
            assignedScheduleDetails.sort((a, b) => {
                const timeA = a.departureTime || '23:59';
                const timeB = b.departureTime || '23:59';
                return timeA.localeCompare(timeB);
            });
            driverObj.assignedScheduleDetails = assignedScheduleDetails;

            // Add availability info with schedule windows
            if (assignedScheduleDetails.length > 0) {
                driverObj.availabilityInfo = {
                    assignedCount: assignedScheduleDetails.length,
                    schedules: assignedScheduleDetails.map(s => ({
                        time: s.departureTime + (s.arrivalTime ? ` - ${s.arrivalTime}` : ''),
                        route: s.routeName,
                        days: s.availableDays?.join(', ') || 'All Days'
                    })),
                    busyTimes: assignedScheduleDetails.map(s => s.departureTime).filter(Boolean)
                };
            }

            // Add availability window information (completed trips, next trip, time between)
            driverObj.availabilityWindow = getAvailabilityWindow(driver._id);

            return driverObj;
        });

        // Persist the corrected availability for any driver whose stored value was
        // stale (e.g. auto-set 'busy'). This is a real DB write so the bad data is
        // healed permanently and doesn't reappear on subsequent loads.
        if (staleStatusFixes.length > 0) {
            await Promise.all(
                staleStatusFixes.map(fix =>
                    B2CPartnerDriver.updateOne(
                        { _id: fix.id },
                        {
                            $set: {
                                availabilityStatus: fix.status,
                                lastAvailabilityUpdate: new Date(),
                            },
                        }
                    )
                )
            );
            console.log(`[v0] Healed ${staleStatusFixes.length} stale driver availability status(es)`);
        }

        // Add B2C Partner as a driver option if they can drive
        if (b2cPartner && b2cPartner.isRegisteredAsDriver === true) {
            // Check partner's availability as a driver - use stored selfDriverAvailability from database
            const storedSelfAvailability = b2cPartner.selfDriverAvailability?.status || 'available';
            const partnerAvailability = getAvailabilityStatus(b2cPartner._id, storedSelfAvailability);
            // Same fix as external drivers: the root status must reflect the real,
            // computed availability, not a stale stored 'busy'.
            const normalizedSelfStatus = normalizeAvailabilityStatus(partnerAvailability.status);
            // Heal the persisted self-driver status if it drifted out of sync.
            if (storedSelfAvailability !== normalizedSelfStatus) {
                await User.updateOne(
                    { _id: b2cPartner._id },
                    {
                        $set: {
                            'selfDriverAvailability.status': normalizedSelfStatus,
                            'selfDriverAvailability.lastUpdate': new Date(),
                        },
                    }
                );
            }

            // Get self-driver schedule assignments
            const selfAssignedScheduleDetails = driverScheduleMap.get(b2cPartner._id.toString()) || [];
            selfAssignedScheduleDetails.sort((a, b) => {
                const timeA = a.departureTime || '23:59';
                const timeB = b.departureTime || '23:59';
                return timeA.localeCompare(timeB);
            });

            // Add B2C Partner as a driver option with profile image
            const partnerAsDriver = {
                _id: b2cPartner._id,
                name: 'Self',
                fullName: b2cPartner.fullName || b2cPartner.businessName || 'Self',
                email: b2cPartner.email,
                phone: b2cPartner.whatsappNumber,
                phoneNumber: b2cPartner.whatsappNumber,
                isSelf: true, // Flag to identify this is the partner themselves
                isSelfDriver: true, // Flag for socket matching (both flags for compatibility)
                b2cPartnerId: req.userId,
                createdAt: b2cPartner.createdAt,
                // Add driver-like fields for compatibility
                licenseNumber: b2cPartner.driverInfo?.licenseNumber || null,
                licenseExpiry: b2cPartner.driverInfo?.licenseExpiry || null,
                experience: b2cPartner.yearsOfExperience || 0,
                status: b2cPartner.driverInfo?.status || 'AVAILABLE',
                nationality: b2cPartner.nationality || b2cPartner.country || null,
                // Add profile image for display - use correct field name
                driverImage: b2cPartner.profileImage ? { url: b2cPartner.profileImage } : null,
                profileImage: b2cPartner.profileImage,
                // Add availability status - derived from real trips, not stale DB value
                availability: partnerAvailability,
                // Also add availabilityStatus at root level for real-time socket updates compatibility
                availabilityStatus: normalizedSelfStatus,
                // Add schedule assignment details for self
                assignedScheduleDetails: selfAssignedScheduleDetails,
                availabilityInfo: selfAssignedScheduleDetails.length > 0 ? {
                    assignedCount: selfAssignedScheduleDetails.length,
                    schedules: selfAssignedScheduleDetails.map(s => ({
                        time: s.departureTime + (s.arrivalTime ? ` - ${s.arrivalTime}` : ''),
                        route: s.routeName,
                        days: s.availableDays?.join(', ') || 'All Days'
                    })),
                    busyTimes: selfAssignedScheduleDetails.map(s => s.departureTime).filter(Boolean)
                } : null,
                // Add availability window information for self-driver
                availabilityWindow: getAvailabilityWindow(b2cPartner._id)
            };

            drivers.unshift(partnerAsDriver); // Add at the beginning
        }

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

// Get B2C Partner Driver Availability for specific time slots
export const getB2CPartnerDriverAvailability = async (req, res) => {
    try {
        console.log("[v0] Checking driver availability for partner:", req.userId);

        const { tripTimes, availableDays, routeStartDate } = req.body;

        // Get B2C Partner details
        const b2cPartner = await User.findById(req.userId);

        // Get all drivers for this partner
        const assignedDrivers = await B2CPartnerDriver.find({
            b2cPartnerId: req.userId,
            status: "Active"
        }).sort({ createdAt: -1 });

        // Parse the route start date
        const startDate = routeStartDate ? new Date(routeStartDate) : new Date();
        startDate.setHours(0, 0, 0, 0);

        // Calculate end date (30 days from start for conflict checking)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        // Fetch all trips in this date range for this partner
        // ONLY consider trips with bookedSeats > 0 as actual conflicts
        const existingTrips = await B2CPartnerTrip.find({
            b2cPartnerId: req.userId,
            tripDate: { $gte: startDate, $lte: endDate },
            status: { $in: ["Scheduled", "In Progress", "Delayed"] },
            bookedSeats: { $gt: 0 } // Only trips with actual passengers
        }).select('driverId tripDate startTime status fromLocation toLocation bookedSeats').lean();

        // Helper function to convert time string to minutes for comparison
        const timeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // Helper function to check if two time ranges overlap
        const timesOverlap = (time1, time2, bufferMinutes = 30) => {
            const t1 = timeToMinutes(time1);
            const t2 = timeToMinutes(time2);
            return Math.abs(t1 - t2) < bufferMinutes;
        };

        // Map day names to numbers
        const dayNameToNumber = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

        // Create detailed availability for each driver
        const driversWithAvailability = [];

        // Process assigned drivers
        for (const driver of assignedDrivers) {
            const driverId = driver._id.toString();

            // Get all trips for this driver
            const driverTrips = existingTrips.filter(t =>
                t.driverId && t.driverId.toString() === driverId
            );

            // Check conflicts for each requested trip time
            const conflicts = [];
            const availableSlots = [];

            if (tripTimes && Array.isArray(tripTimes)) {
                for (let i = 0; i < tripTimes.length; i++) {
                    const requestedTrip = tripTimes[i];
                    const requestedTime = requestedTrip.departureTime;

                    // Find conflicting trips
                    const conflictingTrips = driverTrips.filter(existingTrip => {
                        // Check if the trip is on a matching day
                        const tripDayOfWeek = new Date(existingTrip.tripDate).getDay();
                        const tripDayName = Object.keys(dayNameToNumber).find(k => dayNameToNumber[k] === tripDayOfWeek);

                        if (!availableDays.includes(tripDayName)) return false;

                        // Check time overlap
                        return timesOverlap(existingTrip.startTime, requestedTime, 60);
                    });

                    if (conflictingTrips.length > 0) {
                        conflicts.push({
                            tripIndex: i + 1,
                            requestedTime,
                            conflictingTrips: conflictingTrips.map(t => ({
                                date: t.tripDate,
                                time: t.startTime,
                                route: `${t.fromLocation} → ${t.toLocation}`,
                                status: t.status
                            }))
                        });
                    } else {
                        availableSlots.push({
                            tripIndex: i + 1,
                            requestedTime
                        });
                    }
                }
            }

            // Determine overall availability status
            let availabilityStatus = 'available';
            let availabilityMessage = 'Available for all requested trips';

            if (conflicts.length === tripTimes?.length) {
                availabilityStatus = 'unavailable';
                availabilityMessage = 'Not available for any requested trips';
            } else if (conflicts.length > 0) {
                availabilityStatus = 'partial';
                availabilityMessage = `Available for ${availableSlots.length} of ${tripTimes?.length} trips`;
            }

            driversWithAvailability.push({
                _id: driver._id,
                name: driver.name,
                phoneNumber: driver.phoneNumber,
                email: driver.email,
                status: driver.status,
                driverImage: driver.driverImage,
                isSelf: false,
                availability: {
                    status: availabilityStatus,
                    message: availabilityMessage,
                    color: availabilityStatus === 'available' ? 'green' : availabilityStatus === 'partial' ? 'orange' : 'red',
                    conflicts,
                    availableSlots,
                    totalExistingTrips: driverTrips.length
                }
            });
        }

        // Add B2C Partner as a driver option if they can drive
        if (b2cPartner && b2cPartner.isRegisteredAsDriver === true) {
            const partnerId = b2cPartner._id.toString();

            // Get all trips for the partner (when driving)
            const partnerTrips = existingTrips.filter(t =>
                t.driverId && t.driverId.toString() === partnerId
            );

            // Check conflicts for each requested trip time
            const conflicts = [];
            const availableSlots = [];

            if (tripTimes && Array.isArray(tripTimes)) {
                for (let i = 0; i < tripTimes.length; i++) {
                    const requestedTrip = tripTimes[i];
                    const requestedTime = requestedTrip.departureTime;

                    // Find conflicting trips
                    const conflictingTrips = partnerTrips.filter(existingTrip => {
                        const tripDayOfWeek = new Date(existingTrip.tripDate).getDay();
                        const tripDayName = Object.keys(dayNameToNumber).find(k => dayNameToNumber[k] === tripDayOfWeek);

                        if (!availableDays.includes(tripDayName)) return false;

                        return timesOverlap(existingTrip.startTime, requestedTime, 60);
                    });

                    if (conflictingTrips.length > 0) {
                        conflicts.push({
                            tripIndex: i + 1,
                            requestedTime,
                            conflictingTrips: conflictingTrips.map(t => ({
                                date: t.tripDate,
                                time: t.startTime,
                                route: `${t.fromLocation} → ${t.toLocation}`,
                                status: t.status
                            }))
                        });
                    } else {
                        availableSlots.push({
                            tripIndex: i + 1,
                            requestedTime
                        });
                    }
                }
            }

            let availabilityStatus = 'available';
            let availabilityMessage = 'Available for all requested trips';

            if (tripTimes && tripTimes.length > 0) {
                if (conflicts.length === tripTimes.length) {
                    availabilityStatus = 'unavailable';
                    availabilityMessage = 'Not available for any requested trips';
                } else if (conflicts.length > 0) {
                    availabilityStatus = 'partial';
                    availabilityMessage = `Available for ${availableSlots.length} of ${tripTimes.length} trips`;
                }
            }

            driversWithAvailability.unshift({
                _id: b2cPartner._id,
                name: 'Self',
                fullName: b2cPartner.fullName || b2cPartner.businessName || 'Self',
                email: b2cPartner.email,
                phoneNumber: b2cPartner.whatsappNumber,
                isSelf: true,
                driverImage: b2cPartner.profileImage ? { url: b2cPartner.profileImage } : null,
                availability: {
                    status: availabilityStatus,
                    message: availabilityMessage,
                    color: availabilityStatus === 'available' ? 'green' : availabilityStatus === 'partial' ? 'orange' : 'red',
                    conflicts,
                    availableSlots,
                    totalExistingTrips: partnerTrips.length
                }
            });
        }

        res.status(200).json({
            success: true,
            count: driversWithAvailability.length,
            drivers: driversWithAvailability,
        });
    } catch (error) {
        console.error("[v0] Error checking driver availability:", error);
        res.status(500).json({
            success: false,
            message: "Error checking driver availability",
            error: error.message,
        });
    }
}

// Update driver availability status (for B2C_PARTNER_DRIVER)
export const updateDriverAvailabilityStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const { status, availableUntil } = req.body;

        if (!['available', 'busy', 'offline'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'available', 'busy', or 'offline'"
            });
        }

        // Get the user to check their role
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // IMPROVED: Check for incomplete trips before allowing "available" status
        // But allow "available" if there's a time gap before the next scheduled trip
        if (status === 'available') {
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            // Get driver ID based on role
            let driverId = userId;
            if (user.role === 'B2C_PARTNER_DRIVER' && user.driverId) {
                driverId = user.driverId;
            }

            // FIXED: Build proper query for B2C Partner self-drivers
            // IMPORTANT: Only consider trips that have ACTUAL bookings (bookedSeats > 0)
            let tripQuery = {
                tripDate: { $gte: todayStart, $lte: todayEnd },
                bookedSeats: { $gt: 0 } // Only trips with actual passengers
            };

            if (user.role === 'B2C_PARTNER') {
                // Self-driver: trips can have driverId = partnerId
                tripQuery.$or = [
                    { driverId: userId },
                    { b2cPartnerId: userId, driverId: userId }
                ];
            } else {
                tripQuery.driverId = driverId;
            }

            // Get all trips for today
            const todayTrips = await B2CPartnerTrip.find(tripQuery)
                .populate('routeId', 'fromLocation toLocation');

            // Helper to convert time string to 24h format for proper comparison
            const convertTo24h = (timeStr) => {
                if (!timeStr) return '23:59';
                // Handle formats like "4:00 AM", "1:00 PM", "04:00", "13:00"
                const cleanTime = timeStr.replace(/\s*(AM|PM)/gi, (match, p1) => p1.toUpperCase()).trim();
                const parts = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                if (!parts) return '23:59';

                let hour = parseInt(parts[1]);
                const min = parts[2];
                const meridian = parts[3]?.toUpperCase();

                if (meridian === 'PM' && hour < 12) hour += 12;
                if (meridian === 'AM' && hour === 12) hour = 0;

                return `${String(hour).padStart(2, '0')}:${min}`;
            };

            // Separate completed and incomplete trips
            const completedTrips = todayTrips.filter(t =>
                ['COMPLETED', 'Completed', 'DONE', 'Done'].includes(t.status)
            );
            const incompleteTrips = todayTrips.filter(t =>
                ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );

            // Sort incomplete trips by departure time to find the next one
            incompleteTrips.sort((a, b) => {
                const timeA = convertTo24h(a.startTime);
                const timeB = convertTo24h(b.startTime);
                return timeA.localeCompare(timeB);
            });

            // Check if any trip is currently IN_PROGRESS
            const inProgressTrips = incompleteTrips.filter(t =>
                ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );

            if (inProgressTrips.length > 0) {
                const tripInfo = inProgressTrips.map(t => ({
                    id: t._id,
                    route: t.routeId ? `${t.routeId.fromLocation} to ${t.routeId.toLocation}` : 'Unknown Route',
                    status: t.status,
                    startTime: t.startTime
                }));

                return res.status(400).json({
                    success: false,
                    message: `You have a trip currently in progress. Please complete it before setting your status to available.`,
                    hasInProgressTrip: true,
                    inProgressTripsCount: inProgressTrips.length,
                    assignedScheduleInfo: tripInfo
                });
            }

            // Find the next scheduled trip (not yet started)
            const scheduledTrips = incompleteTrips.filter(t =>
                ['SCHEDULED', 'Scheduled'].includes(t.status)
            );

            // Get current time as HH:MM string
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            // Find the next scheduled trip after current time
            const nextTrip = scheduledTrips.find(t => {
                const tripTime24h = convertTo24h(t.startTime);
                return tripTime24h > currentTimeStr;
            });

            // If there's a next trip, driver can be "available" with a time limit
            if (nextTrip) {
                const nextTripTime = nextTrip.startTime;
                const nextTripTime24h = convertTo24h(nextTripTime);

                // Calculate availableUntil time (30 mins before next trip)
                const [hours, minutes] = nextTripTime24h.split(':').map(Number);
                const nextTripDate = new Date();
                nextTripDate.setHours(hours, minutes, 0, 0);
                const availableUntilDate = new Date(nextTripDate.getTime() - 30 * 60 * 1000); // 30 mins before

                // Store the availableUntil time with the status update
                if (user.role === 'B2C_PARTNER_DRIVER') {
                    const driver = await B2CPartnerDriver.findOne({
                        b2cPartnerId: user.b2cPartnerId,
                        phoneNumber: user.whatsappNumber
                    });

                    if (driver) {
                        driver.availabilityStatus = status;
                        driver.lastAvailabilityUpdate = new Date();
                        driver.availableUntil = availableUntilDate;
                        driver.nextScheduledTripTime = nextTripTime;
                        await driver.save();

                        // Broadcast real-time availability change to B2C Partner
                        broadcastDriverAvailabilityChange(user.b2cPartnerId.toString(), {
                            driverId: driver._id.toString(),
                            driverName: driver.name,
                            availabilityStatus: status,
                            availableUntil: availableUntilDate,
                            nextScheduledTripTime: nextTripTime,
                            isSelfDriver: false
                        });

                        return res.status(200).json({
                            success: true,
                            message: `Availability updated to ${status} until ${nextTripTime}`,
                            availabilityStatus: status,
                            availableUntil: availableUntilDate,
                            nextScheduledTripTime: nextTripTime,
                            hasUpcomingTrip: true
                        });
                    }
                } else if (user.role === 'B2C_PARTNER') {
                    if (!user.selfDriverAvailability) {
                        user.selfDriverAvailability = {};
                    }
                    user.selfDriverAvailability.status = status;
                    user.selfDriverAvailability.lastUpdate = new Date();
                    user.selfDriverAvailability.availableUntil = availableUntilDate;
                    user.selfDriverAvailability.nextScheduledTripTime = nextTripTime;
                    await user.save();

                    // Broadcast real-time self-driver availability change
                    broadcastSelfDriverAvailabilityChange(userId, {
                        driverName: user.fullName || 'Self',
                        status: status,
                        availableUntil: availableUntilDate,
                        nextScheduledTripTime: nextTripTime
                    });

                    return res.status(200).json({
                        success: true,
                        message: `Self-driver availability updated to ${status} until ${nextTripTime}`,
                        availabilityStatus: status,
                        availableUntil: availableUntilDate,
                        nextScheduledTripTime: nextTripTime,
                        hasUpcomingTrip: true
                    });
                }
            }

            // If no more trips today, driver can be fully available
            // Continue with normal status update below
        }

        if (user.role === 'B2C_PARTNER_DRIVER') {
            // Update B2CPartnerDriver availability
            const driver = await B2CPartnerDriver.findOne({
                b2cPartnerId: user.b2cPartnerId,
                phoneNumber: user.whatsappNumber
            });

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    message: "Driver profile not found"
                });
            }

            driver.availabilityStatus = status;
            driver.lastAvailabilityUpdate = new Date();
            driver.availableUntil = null; // Clear any previous limit
            driver.nextScheduledTripTime = null;
            await driver.save();

            // Broadcast real-time availability change to B2C Partner
            broadcastDriverAvailabilityChange(user.b2cPartnerId.toString(), {
                driverId: driver._id.toString(),
                driverName: driver.name,
                availabilityStatus: status,
                isSelfDriver: false
            });

            res.status(200).json({
                success: true,
                message: `Availability updated to ${status}`,
                availabilityStatus: status
            });
        } else if (user.role === 'B2C_PARTNER') {
            // Update self-driver availability
            if (!user.selfDriverAvailability) {
                user.selfDriverAvailability = {};
            }
            user.selfDriverAvailability.status = status;
            user.selfDriverAvailability.lastUpdate = new Date();
            user.selfDriverAvailability.availableUntil = null; // Clear any previous limit
            user.selfDriverAvailability.nextScheduledTripTime = null;
            await user.save();

            // Broadcast real-time self-driver availability change
            broadcastSelfDriverAvailabilityChange(userId, {
                driverName: user.fullName || 'Self',
                status: status
            });

            res.status(200).json({
                success: true,
                message: `Self-driver availability updated to ${status}`,
                availabilityStatus: status
            });
        } else {
            return res.status(403).json({
                success: false,
                message: "Only drivers can update availability status"
            });
        }
    } catch (error) {
        console.error("[v0] Error updating driver availability:", error);
        res.status(500).json({
            success: false,
            message: "Error updating driver availability",
            error: error.message
        });
    }
}

// Get current driver's availability status
export const getMyAvailabilityStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let availabilityData = {
            status: 'available',
            assignedSchedules: [],
            availableTimeSlots: [],
            lastUpdate: null
        };

        // Get today's date range for checking incomplete trips
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        if (user.role === 'B2C_PARTNER_DRIVER') {
            const driver = await B2CPartnerDriver.findOne({
                b2cPartnerId: user.b2cPartnerId,
                phoneNumber: user.whatsappNumber
            }).populate('assignedSchedules.scheduleId');

            if (driver) {
                // Get the stored status
                let storedStatus = driver.availabilityStatus || 'available';

                // Find all trips assigned to this driver TODAY with actual bookings
                const driverTrips = await B2CPartnerTrip.find({
                    driverId: driver._id,
                    tripDate: { $gte: todayStart, $lte: todayEnd },
                    bookedSeats: { $gt: 0 } // Only trips with actual passengers
                }).select('status startTime');

                // Check for IN_PROGRESS trips
                const hasInProgressTrip = driverTrips.some(t =>
                    ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
                );

                // Check for SCHEDULED trips
                const hasScheduledTrips = driverTrips.some(t =>
                    ['SCHEDULED', 'Scheduled'].includes(t.status)
                );

                // Calculate effective status based on actual trips
                let calculatedStatus = 'available';

                if (storedStatus === 'offline') {
                    // Respect explicit offline status
                    calculatedStatus = 'offline';
                } else if (hasInProgressTrip) {
                    // Actively driving - must be busy
                    calculatedStatus = 'busy';
                } else if (hasScheduledTrips) {
                    // Has scheduled trips with passengers today
                    calculatedStatus = 'busy';
                } else {
                    // No trips with bookings today - respect stored status or available
                    calculatedStatus = storedStatus === 'busy' ? 'available' : storedStatus;
                }

                // Count incomplete trips for display
                const incompleteTripCount = driverTrips.filter(t =>
                    ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
                ).length;

                availabilityData = {
                    status: calculatedStatus,
                    assignedSchedules: driver.assignedSchedules || [],
                    availableTimeSlots: driver.availableTimeSlots || [],
                    lastUpdate: driver.lastAvailabilityUpdate,
                    hasIncompleteTrips: incompleteTripCount > 0,
                    incompleteTripsCount: incompleteTripCount
                };
            }
        } else if (user.role === 'B2C_PARTNER') {
            // For B2C_PARTNER (self-driver), calculate status based on actual trips with bookings
            let storedStatus = user.selfDriverAvailability?.status || 'available';

            // Check for trips where the B2C_PARTNER is SELF-DRIVING (driverId = partnerId)
            // Only these trips should affect the partner's availability
            const selfDrivingTrips = await B2CPartnerTrip.find({
                driverId: userId, // Partner is the driver
                b2cPartnerId: userId, // And it's their route
                tripDate: { $gte: todayStart, $lte: todayEnd },
                bookedSeats: { $gt: 0 } // Only trips with actual passengers
            }).select('status startTime');

            // Check for IN_PROGRESS trips
            const hasInProgressTrip = selfDrivingTrips.some(t =>
                ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );

            // Check for SCHEDULED trips (trips they need to drive)
            const hasScheduledTrips = selfDrivingTrips.some(t =>
                ['SCHEDULED', 'Scheduled'].includes(t.status)
            );

            // Calculate effective status based on self-driving trips
            let calculatedStatus = 'available';

            if (storedStatus === 'offline') {
                // Respect explicit offline status
                calculatedStatus = 'offline';
            } else if (hasInProgressTrip) {
                // Actively driving - must be busy
                calculatedStatus = 'busy';
            } else if (hasScheduledTrips) {
                // Has scheduled self-driving trips with passengers today
                calculatedStatus = 'busy';
            } else {
                // No self-driving trips with bookings today - available
                // Note: Having drivers assigned to other schedules doesn't make the partner busy
                calculatedStatus = 'available';
            }

            // Count incomplete self-driving trips
            const incompleteTripCount = selfDrivingTrips.filter(t =>
                ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            ).length;

            availabilityData = {
                status: calculatedStatus,
                assignedSchedules: user.selfDriverAvailability?.assignedSchedules || [],
                availableTimeSlots: user.selfDriverAvailability?.availableTimeSlots || [],
                lastUpdate: user.selfDriverAvailability?.lastUpdate,
                hasIncompleteTrips: incompleteTripCount > 0,
                incompleteTripsCount: incompleteTripCount
            };
        }

        res.status(200).json({
            success: true,
            availability: availabilityData
        });
    } catch (error) {
        console.error("[v0] Error getting availability status:", error);
        res.status(500).json({
            success: false,
            message: "Error getting availability status",
            error: error.message
        });
    }
}

// Get detailed availability info for popup (completed trips, assigned schedules, next trip)
export const getDetailedAvailabilityInfo = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Get driver ID based on role
        let driverId = userId;
        if (user.role === 'B2C_PARTNER_DRIVER' && user.driverId) {
            driverId = user.driverId;
        }

        // FIXED: For B2C_PARTNER (self-driver), also check b2cPartnerId field
        // because trips might have driverId = partnerId OR b2cPartnerId = partnerId
        let tripQuery = {
            tripDate: { $gte: todayStart, $lte: todayEnd },
            bookedSeats: { $gt: 0 } // Only trips with actual bookings
        };

        if (user.role === 'B2C_PARTNER') {
            // Self-driver: trips can have driverId = partnerId (for self-driving routes)
            tripQuery.$or = [
                { driverId: userId },
                { b2cPartnerId: userId, driverId: userId }
            ];
        } else {
            tripQuery.driverId = driverId;
        }

        // Get all trips for today
        const todayTrips = await B2CPartnerTrip.find(tripQuery)
            .populate('routeId', 'fromLocation toLocation')
            .sort({ startTime: 1 });

        // Separate completed and incomplete trips based on ACTUAL trip status in database
        // NOTE: This is a READ-ONLY operation - we do NOT auto-complete trips here
        // Trips should only be marked as completed through the proper startTrip/completeTrip flow
        const completedTrips = todayTrips.filter(t =>
            ['COMPLETED', 'Completed', 'DONE', 'Done'].includes(t.status)
        ).map(t => ({
            _id: t._id,
            fromLocation: t.fromLocation || t.routeId?.fromLocation || 'Unknown',
            toLocation: t.toLocation || t.routeId?.toLocation || 'Unknown',
            departureTime: t.startTime,
            completedAt: t.completedAt || t.actualEndTime || t.updatedAt,
            status: t.status
        }));

        // Get scheduled trips (trips that have NOT been completed yet)
        const scheduledTrips = todayTrips.filter(t =>
            ['SCHEDULED', 'Scheduled'].includes(t.status)
        );

        // Get current time as HH:MM string for comparison
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        // Helper to convert time string to comparable 24h format
        const convertTo24h = (timeStr) => {
            if (!timeStr) return '23:59';
            // Handle formats like "4:00 AM", "1:00 PM", "04:00", "13:00"
            const cleanTime = timeStr.replace(/\s*(AM|PM)/gi, (match, p1) => p1.toUpperCase()).trim();
            const parts = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (!parts) return '23:59';

            let hour = parseInt(parts[1]);
            const min = parts[2];
            const meridian = parts[3]?.toUpperCase();

            if (meridian === 'PM' && hour < 12) hour += 12;
            if (meridian === 'AM' && hour === 12) hour = 0;

            return `${String(hour).padStart(2, '0')}:${min}`;
        };

        // Sort by departure time
        scheduledTrips.sort((a, b) => {
            const timeA = convertTo24h(a.startTime);
            const timeB = convertTo24h(b.startTime);
            return timeA.localeCompare(timeB);
        });

        // Find the next scheduled trip after current time
        const nextTrip = scheduledTrips.find(t => {
            const tripTime24h = convertTo24h(t.startTime);
            return tripTime24h > currentTimeStr;
        });

        // Get assigned schedules
        let assignedSchedules = [];
        if (user.role === 'B2C_PARTNER_DRIVER') {
            const driver = await B2CPartnerDriver.findOne({
                b2cPartnerId: user.b2cPartnerId,
                phoneNumber: user.whatsappNumber
            });

            if (driver) {
                const schedules = await B2CPartnerSchedule.find({
                    $or: [
                        { assignedDriver: driver._id, isActive: true },
                        { 'tripTimes.assignedDriver': driver._id, isActive: true }
                    ]
                }).populate('routeId', 'fromLocation toLocation');

                assignedSchedules = schedules.map(s => ({
                    _id: s._id,
                    scheduleName: s.scheduleName,
                    fromLocation: s.routeId?.fromLocation || 'Unknown',
                    toLocation: s.routeId?.toLocation || 'Unknown',
                    departureTime: s.departureTime,
                    tripType: s.tripType
                }));
            }
        } else if (user.role === 'B2C_PARTNER') {
            const schedules = await B2CPartnerSchedule.find({
                $or: [
                    { assignedDriver: userId, isActive: true },
                    { 'tripTimes.assignedDriver': userId, isActive: true }
                ]
            }).populate('routeId', 'fromLocation toLocation');

            assignedSchedules = schedules.map(s => ({
                _id: s._id,
                scheduleName: s.scheduleName,
                fromLocation: s.routeId?.fromLocation || 'Unknown',
                toLocation: s.routeId?.toLocation || 'Unknown',
                departureTime: s.departureTime,
                tripType: s.tripType
            }));
        }

        // Calculate effective status based on TODAY's actual trips with bookings
        // This is the REAL availability - not just based on assigned schedules
        let currentStatus = 'available';
        let storedStatus = 'available';

        if (user.role === 'B2C_PARTNER_DRIVER') {
            const driver = await B2CPartnerDriver.findOne({
                b2cPartnerId: user.b2cPartnerId,
                phoneNumber: user.whatsappNumber
            });
            storedStatus = driver?.availabilityStatus || 'available';
        } else if (user.role === 'B2C_PARTNER') {
            storedStatus = user.selfDriverAvailability?.status || 'available';
        }

        // Check if user has explicitly set offline - honor that
        if (storedStatus === 'offline') {
            currentStatus = 'offline';
        } else {
            // Dynamically calculate status based on actual trips TODAY
            // todayTrips already filtered by bookedSeats > 0, so these are real trips with passengers
            const hasInProgressTrips = todayTrips.some(t =>
                ['IN_PROGRESS', 'In Progress', 'STARTED', 'Started'].includes(t.status)
            );
            const hasScheduledTrips = scheduledTrips.length > 0;

            if (hasInProgressTrips) {
                // Actively driving - must be busy
                currentStatus = 'busy';
            } else if (hasScheduledTrips) {
                // Has scheduled trips today with bookings - should be busy
                currentStatus = 'busy';
            } else if (completedTrips.length > 0) {
                // Completed all trips for today - can be available
                currentStatus = 'available';
            } else {
                // No trips with bookings today - available
                currentStatus = 'available';
            }
        }

        // NOTE: The status is now CALCULATED based on actual trips with bookings
        // Having an assigned schedule alone does NOT make someone "busy"
        // They are only busy when they have actual trips to drive TODAY

        res.status(200).json({
            success: true,
            currentStatus,
            assignedSchedules,
            completedTripsToday: completedTrips,
            nextScheduledTrip: nextTrip ? {
                _id: nextTrip._id,
                fromLocation: nextTrip.fromLocation || nextTrip.routeId?.fromLocation || 'Unknown',
                toLocation: nextTrip.toLocation || nextTrip.routeId?.toLocation || 'Unknown',
                departureTime: nextTrip.startTime,
                tripType: 'One Way'
            } : null,
            hasUpcomingTrips: scheduledTrips.length > 0,
            userType: user.role === 'B2C_PARTNER' ? 'partner' : 'driver'
        });
    } catch (error) {
        console.error("[v0] Error getting detailed availability info:", error);
        res.status(500).json({
            success: false,
            message: "Error getting detailed availability info",
            error: error.message
        });
    }
}

// Update driver's available time slots
export const updateAvailableTimeSlots = async (req, res) => {
    try {
        const userId = req.userId;
        const { timeSlots } = req.body;

        if (!Array.isArray(timeSlots)) {
            return res.status(400).json({
                success: false,
                message: "timeSlots must be an array"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.role === 'B2C_PARTNER_DRIVER') {
            const driver = await B2CPartnerDriver.findOne({
                b2cPartnerId: user.b2cPartnerId,
                phoneNumber: user.whatsappNumber
            });

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    message: "Driver profile not found"
                });
            }

            driver.availableTimeSlots = timeSlots;
            driver.lastAvailabilityUpdate = new Date();
            await driver.save();

            res.status(200).json({
                success: true,
                message: "Available time slots updated",
                timeSlots: driver.availableTimeSlots
            });
        } else if (user.role === 'B2C_PARTNER') {
            if (!user.selfDriverAvailability) {
                user.selfDriverAvailability = {};
            }
            user.selfDriverAvailability.availableTimeSlots = timeSlots;
            user.selfDriverAvailability.lastUpdate = new Date();
            await user.save();

            res.status(200).json({
                success: true,
                message: "Available time slots updated",
                timeSlots: user.selfDriverAvailability.availableTimeSlots
            });
        } else {
            return res.status(403).json({
                success: false,
                message: "Only drivers can update time slots"
            });
        }
    } catch (error) {
        console.error("[v0] Error updating time slots:", error);
        res.status(500).json({
            success: false,
            message: "Error updating time slots",
            error: error.message
        });
    }
}

// Get all available drivers for a B2C Partner with real-time availability
export const getAvailableDriversForAssignment = async (req, res) => {
    try {
        const b2cPartnerId = req.userId;
        const { scheduleId, tripTimeIndex, day, startTime, endTime } = req.query;

        // Get all active drivers for this partner
        const drivers = await B2CPartnerDriver.find({
            b2cPartnerId,
            isActive: true,
            status: "Active"
        }).select('name phoneNumber driverImage availabilityStatus assignedSchedules availableTimeSlots');

        // Get the B2C Partner for self-driving option
        const b2cPartner = await User.findById(b2cPartnerId)
            .select('fullName whatsappNumber profileImage selfDriverAvailability isRegisteredAsDriver');

        const availableDrivers = [];

        // Check Self (B2C Partner) availability - ONLY if they have explicitly registered as a driver
        if (b2cPartner && b2cPartner.isRegisteredAsDriver === true) {
            const selfStatus = b2cPartner.selfDriverAvailability?.status || 'available';
            const isAvailable = selfStatus === 'available';

            // Check if already assigned to this specific trip time
            const alreadyAssigned = b2cPartner.selfDriverAvailability?.assignedSchedules?.some(
                as => as.scheduleId?.toString() === scheduleId && as.tripTimeIndex === parseInt(tripTimeIndex)
            );

            availableDrivers.push({
                _id: b2cPartner._id,
                name: `Self (${b2cPartner.whatsappNumber})`,
                fullName: b2cPartner.fullName,
                phoneNumber: b2cPartner.whatsappNumber,
                isSelf: true,
                driverImage: b2cPartner.profileImage ? { url: b2cPartner.profileImage } : null,
                availabilityStatus: selfStatus,
                isAvailable: isAvailable && !alreadyAssigned,
                assignedCount: b2cPartner.selfDriverAvailability?.assignedSchedules?.length || 0
            });
        }

        // Check each driver's availability
        for (const driver of drivers) {
            const isAvailable = driver.availabilityStatus === 'available';

            // Check if already assigned to this specific trip time
            const alreadyAssigned = driver.assignedSchedules?.some(
                as => as.scheduleId?.toString() === scheduleId && as.tripTimeIndex === parseInt(tripTimeIndex)
            );

            availableDrivers.push({
                _id: driver._id,
                name: `${driver.name} (${driver.phoneNumber})`,
                fullName: driver.name,
                phoneNumber: driver.phoneNumber,
                isSelf: false,
                driverImage: driver.driverImage,
                availabilityStatus: driver.availabilityStatus || 'available',
                isAvailable: isAvailable && !alreadyAssigned,
                assignedCount: driver.assignedSchedules?.length || 0
            });
        }

        // Sort: available first, then by assigned count (less busy first)
        availableDrivers.sort((a, b) => {
            if (a.isAvailable && !b.isAvailable) return -1;
            if (!a.isAvailable && b.isAvailable) return 1;
            return a.assignedCount - b.assignedCount;
        });

        res.status(200).json({
            success: true,
            count: availableDrivers.length,
            drivers: availableDrivers
        });
    } catch (error) {
        console.error("[v0] Error getting available drivers:", error);
        res.status(500).json({
            success: false,
            message: "Error getting available drivers",
            error: error.message
        });
    }
}

// Get driver's incomplete trips for today
export const getDriverIncompleteTrips = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get driver ID based on role
        let driverId = userId;
        if (user.role === 'B2C_PARTNER_DRIVER' && user.driverId) {
            driverId = user.driverId;
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Find incomplete trips for today
        const incompleteTrips = await B2CPartnerTrip.find({
            driverId: driverId,
            tripDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['SCHEDULED', 'Scheduled', 'IN_PROGRESS', 'In Progress', 'STARTED', 'Started'] }
        }).populate('routeId', 'fromLocation toLocation');

        const tripInfo = incompleteTrips.map(t => ({
            id: t._id,
            route: t.routeId ? `${t.routeId.fromLocation} to ${t.routeId.toLocation}` : 'Unknown Route',
            fromLocation: t.fromLocation || t.routeId?.fromLocation,
            toLocation: t.toLocation || t.routeId?.toLocation,
            status: t.status,
            startTime: t.startTime,
            tripDate: t.tripDate
        }));

        res.status(200).json({
            success: true,
            hasIncompleteTrips: incompleteTrips.length > 0,
            incompleteTripsCount: incompleteTrips.length,
            trips: tripInfo
        });
    } catch (error) {
        console.error("[v0] Error getting incomplete trips:", error);
        res.status(500).json({
            success: false,
            message: "Error getting incomplete trips",
            error: error.message
        });
    }
}

// Toggle B2C Partner's self-driver registration status
// This allows a B2C Partner to register/unregister themselves as a driver
export const toggleSelfDriverRegistration = async (req, res) => {
    try {
        const userId = req.userId;
        const { register } = req.body; // true to register, false to unregister

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.role !== 'B2C_PARTNER') {
            return res.status(403).json({
                success: false,
                message: "Only B2C Partners can register as self-drivers"
            });
        }

        // If unregistering, check if they have any assigned schedules as a driver
        if (register === false) {
            const assignedSchedules = user.selfDriverAvailability?.assignedSchedules || [];
            if (assignedSchedules.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot unregister as driver while you have assigned schedules. Please reassign or remove your trips first.",
                    assignedSchedulesCount: assignedSchedules.length
                });
            }
        }

        // Update the registration status
        user.isRegisteredAsDriver = register === true;
        await user.save();

        res.status(200).json({
            success: true,
            message: register
                ? "You are now registered as a self-driver. You will appear in the driver dropdown when assigning trips."
                : "You have unregistered as a self-driver. You will no longer appear in the driver dropdown.",
            isRegisteredAsDriver: user.isRegisteredAsDriver
        });

    } catch (error) {
        console.error("[v0] Error toggling self-driver registration:", error);
        res.status(500).json({
            success: false,
            message: "Error updating self-driver registration",
            error: error.message
        });
    }
}

// Get B2C Partner's self-driver registration status
export const getSelfDriverRegistrationStatus = async (req, res) => {
    try {
        const userId = req.userId;

        const user = await User.findById(userId).select('isRegisteredAsDriver selfDriverAvailability fullName whatsappNumber profileImage');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            isRegisteredAsDriver: user.isRegisteredAsDriver || false,
            selfDriverInfo: user.isRegisteredAsDriver ? {
                name: user.fullName,
                phone: user.whatsappNumber,
                profileImage: user.profileImage,
                availabilityStatus: user.selfDriverAvailability?.status || 'available',
                assignedSchedulesCount: user.selfDriverAvailability?.assignedSchedules?.length || 0
            } : null
        });

    } catch (error) {
        console.error("[v0] Error getting self-driver status:", error);
        res.status(500).json({
            success: false,
            message: "Error getting self-driver registration status",
            error: error.message
        });
    }
}
