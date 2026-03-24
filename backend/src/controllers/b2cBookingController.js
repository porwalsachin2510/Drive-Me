import B2CPassengerBooking from "../models/B2CPassengerBooking.js";
import User from "../models/User.js";
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js";
import B2CPartnerRoute from "../models/B2CPartnerRoute.js";
import B2CPartnerDriver from "../models/B2CPartnerDriver.js";

// Get B2C Partner Bookings (for B2C_PARTNER dashboard)
export const getB2CPartnerBookings = async (req, res) => {
    try {
        const partnerId = req.userId;
        
        console.log("[v0] Fetching bookings for B2C Partner:", partnerId);

        // Get all bookings for this partner
        const bookings = await B2CPassengerBooking.find({
            b2cPartnerId: partnerId
        })
        .populate('passengerId', 'name email phone')
        .populate('routeId', 'fromLocation toLocation routeName')
        .populate('assignedDriverId', 'name email phone')
        .sort({ bookingDate: -1 });

        // Filter bookings based on driver assignment
        const selfDriverBookings = bookings.filter(booking => booking.isSelfDriver);
        const assignedDriverBookings = bookings.filter(booking => !booking.isSelfDriver);

        console.log("[v0] Bookings found:", {
            total: bookings.length,
            selfDriver: selfDriverBookings.length,
            assignedDriver: assignedDriverBookings.length
        });

        res.status(200).json({
            success: true,
            data: {
                allBookings: bookings,
                selfDriverBookings, // Bookings where partner is driving
                assignedDriverBookings, // Bookings where assigned drivers are driving
                stats: {
                    total: bookings.length,
                    selfDriver: selfDriverBookings.length,
                    assignedDriver: assignedDriverBookings.length,
                    pending: bookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    completed: bookings.filter(b => b.bookingStatus === 'COMPLETED').length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C partner bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Get B2C Driver Bookings (for B2C_PARTNER_DRIVER dashboard)
export const getB2CDriverBookings = async (req, res) => {
    try {
        const driverId = req.userId;
        
        console.log("[v0] Fetching bookings for B2C Driver:", driverId);

        // Get all bookings assigned to this driver
        const bookings = await B2CPassengerBooking.find({
            assignedDriverId: driverId,
            isSelfDriver: false // Only get bookings where they are assigned driver
        })
        .populate('passengerId', 'name email phone')
        .populate('routeId', 'fromLocation toLocation routeName')
        .populate('b2cPartnerId', 'name email businessName')
        .sort({ bookingDate: -1 });

        console.log("[v0] Driver bookings found:", bookings.length);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                stats: {
                    total: bookings.length,
                    pending: bookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    completed: bookings.filter(b => b.bookingStatus === 'COMPLETED').length,
                    today: bookings.filter(b => {
                        const bookingDate = new Date(b.bookingDate);
                        const today = new Date();
                        return bookingDate.toDateString() === today.toDateString();
                    }).length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching B2C driver bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching bookings",
            error: error.message
        });
    }
};

// Update Booking Status (for both partner and driver)
export const updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status, notes } = req.body;
        const userId = req.userId;
        
        console.log("[v0] Updating booking status:", { bookingId, status, userId });

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone')
            .populate('b2cPartnerId', 'name email phone')
            .populate('assignedDriverId', 'name email phone');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Check if user has permission to update this booking
        const canUpdate = booking.b2cPartnerId._id.toString() === userId || 
                         booking.assignedDriverId?.toString() === userId;

        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to update this booking"
            });
        }

        // Update booking status
        booking.bookingStatus = status;
        if (notes) booking.notes = notes;
        booking.updatedAt = new Date();

        await booking.save();

        // Send notification to passenger
        // TODO: Implement notification service

        console.log("[v0] Booking status updated successfully");

        res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
            booking
        });
    } catch (error) {
        console.error("[v0] Error updating booking status:", error);
        res.status(500).json({
            success: false,
            message: "Error updating booking status",
            error: error.message
        });
    }
};

// Get Booking Details (with driver info for passenger)
// Get B2C Partner Driver Bookings (for B2C_PARTNER_DRIVER dashboard)
export const getB2CPartnerDriverBookings = async (req, res) => {
    try {
        const userId = req.userId;
        
        console.log("[v0] Fetching bookings for B2C Partner Driver User ID:", userId);

        // First get the B2C_PARTNER_DRIVER user to find their driverId
        const driverUser = await User.findById(userId);
        
        if (!driverUser || driverUser.role !== "B2C_PARTNER_DRIVER") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only B2C_PARTNER_DRIVER can access this resource."
            });
        }

        const driverId = driverUser.driverId;
        console.log("[v0] Found Driver ID:", driverId);

        // Get bookings assigned to this specific driver
        const bookings = await B2CPassengerBooking.find({
            assignedDriverId: driverId
        })
        .populate('passengerId', 'name email phone')
        .populate('routeId', 'fromLocation toLocation routeName')
        .populate('b2cPartnerId', 'name email phone')
        .sort({ bookingDate: -1 });

        console.log("[v0] Found bookings for driver:", bookings.length);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                stats: {
                    total: bookings.length,
                    pending: bookings.filter(b => b.bookingStatus === 'PENDING').length,
                    confirmed: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
                    accepted: bookings.filter(b => b.bookingStatus === 'ACCEPTED').length,
                    completed: bookings.filter(b => b.bookingStatus === 'COMPLETED').length,
                    rejected: bookings.filter(b => b.bookingStatus === 'REJECTED').length
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching driver bookings:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching driver bookings",
            error: error.message
        });
    }
};

export const getB2CBookingDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.userId;

        const booking = await B2CPassengerBooking.findById(bookingId)
            .populate('passengerId', 'name email phone fullName')
            .populate('b2cPartnerId', 'name email fullName phone profileImage')
            .populate('assignedDriverId', 'name email phone driverImage phoneNumber')
            .populate({
                path: 'routeId',
                select: 'fromLocation toLocation routeName assignedVehicle assignedDriver b2cPartnerId',
                populate: [
                    { path: 'assignedVehicle', select: 'model licensePlate vehicleType vehicleColor seatingCapacity images' },
                    { path: 'assignedDriver', select: 'name phoneNumber driverImage email' },
                    { path: 'b2cPartnerId', select: 'fullName name email phone' }
                ]
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Check if user has permission to view this booking
        const canView = booking.passengerId?._id?.toString() === userId ||
            booking.b2cPartnerId?._id?.toString() === userId ||
            booking.assignedDriverId?.toString() === userId;

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized to view this booking"
            });
        }

        // Prepare driver information - use stored fields first, then populated data
        let driverInfo = null;

        if (booking.driverName) {
            // Use directly stored driver info from booking
            driverInfo = {
                name: booking.driverName,
                phone: booking.driverPhoneNumber,
                profileImage: booking.driverImage,
                isSelfDriver: booking.isSelfDriver || false
            };
        } else if (booking.routeId?.assignedDriver) {
            // Get from populated route driver
            const routeDriver = booking.routeId.assignedDriver;
            driverInfo = {
                name: routeDriver.name,
                phone: routeDriver.phoneNumber,
                profileImage: routeDriver.driverImage?.url,
                isSelfDriver: false
            };
        } else if (booking.isSelfDriver && booking.b2cPartnerId) {
            // Partner is driving
            driverInfo = {
                name: booking.b2cPartnerId.businessName || booking.b2cPartnerId.name,
                phone: booking.b2cPartnerId.phone,
                profileImage: booking.b2cPartnerId.profileImage,
                isSelfDriver: true
            };
        }

        // Get vehicle info from route or partner's vehicles
        let vehicleInfo = null;

        if (booking.routeId?.assignedVehicle) {
            // Get vehicle from route
            const vehicle = booking.routeId.assignedVehicle;
            vehicleInfo = {
                model: vehicle.model,
                licensePlate: vehicle.licensePlate,
                vehicleType: vehicle.vehicleType,
                vehicleColor: vehicle.vehicleColor,
                seatingCapacity: vehicle.seatingCapacity,
                image: vehicle.images?.[0]?.url
            };
        }

        // If still no vehicle, try to get partner's vehicle directly
        if (!vehicleInfo && booking.b2cPartnerId) {
            try {
                const partnerId = booking.b2cPartnerId._id || booking.b2cPartnerId;
                // Try to find any active vehicle for this partner
                const partnerVehicle = await B2CPartnerVehicle.findOne({
                    b2cPartnerId: partnerId,
                    isActive: true
                }).sort({ createdAt: -1 });

                if (partnerVehicle) {
                    vehicleInfo = {
                        model: partnerVehicle.model,
                        licensePlate: partnerVehicle.licensePlate,
                        vehicleType: partnerVehicle.vehicleType,
                        vehicleColor: partnerVehicle.vehicleColor,
                        seatingCapacity: partnerVehicle.seatingCapacity,
                        image: partnerVehicle.images?.[0]?.url
                    };
                }
            } catch (vehicleErr) {
                console.error("Error fetching partner vehicle:", vehicleErr.message);
            }
        }

        // Get partner/service provider info - use fullName from User model
        let partnerInfo = null;
        if (booking.b2cPartnerId) {
            partnerInfo = {
                name: booking.b2cPartnerId.fullName || booking.b2cPartnerId.name || "N/A",
                phone: booking.b2cPartnerId.phone,
                email: booking.b2cPartnerId.email
            };
        } else if (booking.routeId?.b2cPartnerId) {
            partnerInfo = {
                name: booking.routeId.b2cPartnerId.fullName || booking.routeId.b2cPartnerId.name || "N/A",
                phone: booking.routeId.b2cPartnerId.phone,
                email: booking.routeId.b2cPartnerId.email
            };
        }

        res.status(200).json({
            success: true,
            data: {
                booking: {
                    ...booking.toObject(),
                    driverInfo,
                    vehicleInfo,
                    partnerInfo
                }
            }
        });
    } catch (error) {
        console.error("[v0] Error fetching booking details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking details",
            error: error.message
        });
    }
};
