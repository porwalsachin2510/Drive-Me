import express from "express"
import mongoose from "mongoose"
import cookieParser from "cookie-parser"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { Server } from "socket.io"
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import commuteRoutes from "./routes/commuteRoutes.js"
import locationRoutes from "./routes/locationRoutes.js"
import vehicleRoutes from "./routes/vehicleRoutes.js"
import quotationRoutes from "./routes/quotationRoutes.js"
import contractsRoutes from "./routes/contractRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import driverRoutes from "./routes/driverRoutes.js"
import paymentScheduleRoutes from "./routes/paymentScheduleRoutes.js"
import walletRoutes from "./routes/walletRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import vehicleAssignmentRoutes from "./routes/vehicleAssignmentRoutes.js"
import bookingRoutes from "./routes/bookingRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import b2cPartnerRoutes from "./routes/b2cPartnerRoutes.js"
import b2cTripRoutes from "./routes/b2cTripRoutes.js"
import b2cScheduleRoutes from "./routes/b2cScheduleRoutes.js"
import b2cDailyTripRoutes from "./routes/b2cDailyTripRoutes.js"
import b2bPartnerRoutes from "./routes/b2bPartnerRoutes.js"
import b2bClientRoutes from "./routes/b2bClientRoutes.js"
import b2bOperationsRoutes from "./routes/b2bOperationsRoutes.js"
import commuterRoutes from "./routes/commuterRoutes.js"
import tripRoutes from "./routes/tripRoutes.js"
import { initializeSocket } from "./Services/socketService.js"
import b2cMonthlyPassRoutes from "./routes/b2cMonthlyPassRoutes.js"
import b2cBookingRoutes from "./routes/b2cBookingRoutes.js"
import employeeRoutes from "./routes/employeeRoutes.js"
import corporateEmployeeUserRoutes from "./routes/corporateEmployeeUserRoutes.js"
import corporateEmployeeRoutes from "./routes/corporateEmployeeRoutes.js"
import requirementRoutes from "./routes/requirementRoutes.js"
import bankRoutes from "./routes/bankRoutes.js"
import currencyRoutes from "./routes/currencyRoutes.js"
import routeRequestRoutes from "./routes/routeRequestRoutes.js"
import noShowRoutes from "./routes/noShowRoutes.js"
import subscriptionSettingsRoutes from "./routes/subscriptionSettingsRoutes.js"
import travelHistoryRoutes from "./routes/travelHistoryRoutes.js"
import settlementRoutes from "./routes/settlementRoutes.js"
import corporateOperationsRoutes from "./routes/corporateOperationsRoutes.js"
import driverLocationRoutes from "./routes/driverLocationRoutes.js"
import corporateRoutes from "./routes/corporateRoutes.js"
import pageRoutes from "./routes/pageRoutes.js"
import dropdownRoutes from "./routes/dropdownRoutes.js"
import commissionRoutes from "./routes/commissionRoutes.js"
import negotiationRoutes from "./routes/negotiationRoutes.js"
import termsRoutes from "./routes/termsRoutes.js"
import emiPaymentRoutes from "./routes/emiPaymentRoutes.js"
import { seedDropdownOptions } from "./controllers/dropdownController.js"
import { dailyTripGeneration, frequentTripGeneration, hourlyTripGeneration, runImmediateGeneration, corporateTripGeneration } from "./cron/tripGenerationCron.js"
import { processDailyRenewals, sendDailyRenewalReminders } from "./cron/subscriptionCron.js"
import { bookingWarningsCron, bookingAutoCancellationCron, runImmediateBookingTimeoutCheck } from "./cron/bookingTimeoutCron.js"
import { initEMICronJobs } from "./cron/emiCronJobs.js"

dotenv.config()

const app = express()

// Create HTTP server
const server = createServer(app)

/* ================================
   ✅ FRONTEND ORIGINS FROM ENV
================================ */
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(o => o.trim())
    : ["http://localhost:5173"];

console.log("✅ Allowed Origins:", allowedOrigins);

/* ================================
   ✅ CORS CONFIG (FIXED)
================================ */
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Postman / mobile apps

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error("❌ CORS Blocked:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ================================
   ✅ SOCKET.IO (CORS FIXED)
================================ */
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["polling", "websocket"],
    allowEIO3: true
});

export { io };

// Store active drivers and their locations
const activeDrivers = new Map()
// Store passenger connections
const passengerConnections = new Map()

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Driver joins their room
    socket.on('join-driver-room', (driverId) => {
        socket.join(`driver-${driverId}`)
        socket.driverId = driverId
        console.log(`Driver ${driverId} joined their room`)
    })

    // Passenger joins booking room (supports both event names for compatibility)
    const handleJoinBookingRoom = (bookingId) => {
        console.log(`🗺️ Passenger joining booking room: ${bookingId}`)
        socket.join(`booking-${bookingId}`)
        socket.bookingId = bookingId
        console.log(`✅ Passenger joined booking room: ${bookingId}`)
        console.log(`📋 Socket rooms: ${Array.from(socket.rooms)}`)
    }
    socket.on('join_booking_room', handleJoinBookingRoom)
    socket.on('join-booking-room', handleJoinBookingRoom) // Alias for compatibility

    // Driver updates location
    socket.on('update-location', (locationData) => {
        const { driverId, lat, lng } = locationData

        // Store driver location
        activeDrivers.set(driverId, {
            lat,
            lng,
            lastUpdated: new Date(),
            socketId: socket.id
        })

        // Broadcast to passengers tracking this driver
        socket.broadcast.emit('location-update', {
            driverId,
            lat,
            lng,
            timestamp: new Date()
        })

        // Also emit to specific booking rooms if driver is in active trip
        socket.rooms.forEach(room => {
            if (room.startsWith('booking-')) {
                socket.to(room).emit('location-update', {
                    driverId,
                    lat,
                    lng,
                    timestamp: new Date()
                })
            }
        })

        console.log(`Driver ${driverId} location updated: ${lat}, ${lng}`)
    })

    // B2C/B2B Driver updates location (handles both nested and flat formats)
    socket.on('driver-location-update', (locationData) => {
        console.log('🚗 Received driver-location-update:', locationData);
        
        const { driverId, timestamp, bookingId, tripId } = locationData

        // Support both formats:
        // B2C sends: { driverId, location: { lat, lng }, bookingId }
        // B2B sends: { driverId, lat, lng, tripId }
        const lat = locationData.location?.lat || locationData.lat || locationData.latitude
        const lng = locationData.location?.lng || locationData.lng || locationData.longitude

        if (!lat || !lng) {
            console.log('❌ Invalid location data received:', locationData)
            return
        }

        // Store driver location using both driverId and userId for lookup compatibility
        activeDrivers.set(driverId, {
            lat,
            lng,
            lastUpdated: new Date(),
            socketId: socket.id
        })

        // Also store by userId if provided (B2B drivers have separate driverId/userId)
        if (locationData.userId && locationData.userId !== driverId) {
            activeDrivers.set(locationData.userId, {
                lat,
                lng,
                lastUpdated: new Date(),
                socketId: socket.id
            })
        }

        console.log(`✅ Driver ${driverId} location stored: ${lat}, ${lng}`)

        // Broadcast to specific booking room
        const effectiveBookingId = bookingId || tripId
        if (effectiveBookingId) {
            const roomName = `booking-${effectiveBookingId}`
            console.log(`📡 Broadcasting to room: ${roomName}`)
            
            io.to(roomName).emit('driver-location-update', {
                driverId,
                location: { lat, lng },
                timestamp: timestamp || new Date().toISOString(),
                bookingId: effectiveBookingId
            })
            
            console.log(`✅ Emitted driver-location-update to room ${roomName}`)
        }

        // Also broadcast general location update (for all listeners including commuter)
        socket.broadcast.emit('location-update', {
            driverId,
            lat,
            lng,
            timestamp: timestamp || new Date()
        })

        // Also emit with userId as driverId for B2B compatibility
        if (locationData.userId && locationData.userId !== driverId) {
            socket.broadcast.emit('location-update', {
                driverId: locationData.userId,
                lat,
                lng,
                timestamp: timestamp || new Date()
            })
        }

        console.log(`🌐 Driver ${driverId} location updated: ${lat}, ${lng} for booking/trip ${effectiveBookingId}`)
    })

    // Driver accepts booking
    socket.on('accept-booking', (bookingData) => {
        const { bookingId, driverId, passengerId } = bookingData

        // Notify passenger
        io.to(`booking-${bookingId}`).emit('booking-accepted', {
            bookingId,
            driverId,
            message: 'Your booking has been accepted'
        })

        // Start sharing location with passenger
        const driverLocation = activeDrivers.get(driverId)
        if (driverLocation) {
            io.to(`booking-${bookingId}`).emit('location-update', driverLocation)
        }

        console.log(`Driver ${driverId} accepted booking ${bookingId}`)
    })

    // Driver rejects booking
    socket.on('reject-booking', (bookingData) => {
        const { bookingId, driverId, passengerId } = bookingData

        // Notify passenger
        io.to(`booking-${bookingId}`).emit('booking-rejected', {
            bookingId,
            driverId,
            message: 'Your booking has been rejected'
        })

        console.log(`Driver ${driverId} rejected booking ${bookingId}`)
    })

    // Driver starts trip
    socket.on('start-trip', (tripData) => {
        const { bookingId, driverId, passengerId } = tripData

        // Notify passenger
        io.to(`booking-${bookingId}`).emit('trip-started', {
            bookingId,
            driverId,
            message: 'Your trip has started'
        })

        // Start sharing location with passenger
        const driverLocation = activeDrivers.get(driverId)
        if (driverLocation) {
            io.to(`booking-${bookingId}`).emit('location-update', driverLocation)
        }

        console.log(`Driver ${driverId} started trip ${bookingId}`)
    })

    // Driver completes trip
    socket.on('complete-trip', (tripData) => {
        const { bookingId, driverId, passengerId } = tripData

        // Notify passenger
        io.to(`booking-${bookingId}`).emit('trip-completed', {
            bookingId,
            driverId,
            message: 'Your trip has been completed'
        })

        // Stop sharing location
        io.to(`booking-${bookingId}`).emit('stop-location-sharing', {
            bookingId,
            message: 'Trip completed - location sharing stopped'
        })

        console.log(`Driver ${driverId} completed trip ${bookingId}`)
    })

    // Corporate driver specific events
    socket.on('join-corporate-driver-room', (driverId) => {
        socket.join(`corporate-driver-${driverId}`)
        socket.driverId = driverId
        console.log(`Corporate driver ${driverId} joined their room`)
    })

    // Corporate driver starts trip
    socket.on('start-corporate-trip', (tripData) => {
        const { bookingId, driverId, passengerId } = tripData

        // Notify passenger and corporate owner
        io.to(`booking-${bookingId}`).emit('corporate-trip-started', {
            bookingId,
            driverId,
            message: 'Your corporate trip has started'
        })

        console.log(`Corporate driver ${driverId} started trip ${bookingId}`)
    })

    // Request driver location - used by passengers to get current driver location
    socket.on('request-driver-location', (data) => {
        const { driverId, bookingId } = data
        console.log(`📍 Location request received for driver: ${driverId}, booking: ${bookingId}`)

        // Get stored driver location
        const driverLocation = activeDrivers.get(driverId)

        if (driverLocation) {
            console.log(`✅ Found driver ${driverId} location:`, driverLocation.lat, driverLocation.lng)

            // Send location back to the requesting socket
            socket.emit('driver-location-update', {
                driverId,
                location: {
                    lat: driverLocation.lat,
                    lng: driverLocation.lng
                },
                timestamp: driverLocation.lastUpdated || new Date().toISOString(),
                bookingId,
                isOnline: true
            })

            // Also emit to the booking room
            if (bookingId) {
                io.to(`booking-${bookingId}`).emit('driver-location-update', {
                    driverId,
                    location: {
                        lat: driverLocation.lat,
                        lng: driverLocation.lng
                    },
                    timestamp: driverLocation.lastUpdated || new Date().toISOString(),
                    bookingId,
                    isOnline: true
                })
            }
        } else {
            console.log(`❌ No location found for driver: ${driverId}`)
            socket.emit('driver-location-update', {
                driverId,
                location: null,
                bookingId,
                isOnline: false,
                message: 'Driver location not available'
            })
        }
    })

    // Get nearby drivers
    socket.on('get-nearby-drivers', (data) => {
        const { passengerLat, passengerLng, radius = 5000 } = data // radius in meters

        const nearbyDrivers = []
        activeDrivers.forEach((location, driverId) => {
            const distance = calculateDistance(
                passengerLat, passengerLng,
                location.lat, location.lng
            )

            if (distance <= radius) {
                nearbyDrivers.push({
                    driverId,
                    lat: location.lat,
                    lng: location.lng,
                    distance: Math.round(distance)
                })
            }
        })

        socket.emit('nearby-drivers', nearbyDrivers)
        console.log(`Found ${nearbyDrivers.length} nearby drivers`)
    })

    // Real-time notifications - support both event names for compatibility
    const handleJoinNotificationRoom = (userId) => {
        // Guard against null/undefined userId
        if (!userId || userId === 'null' || userId === 'undefined') {
            console.warn(`[v0] Attempted to join notification room with invalid userId: ${userId}`)
            return
        }
        socket.join(`notifications-${userId}`)
        socket.userId = userId
        console.log(`[v0] User ${userId} joined notification room: notifications-${userId}`)
    }
    socket.on('join-notification-room', handleJoinNotificationRoom)
    socket.on('join_user_room', handleJoinNotificationRoom) // Alias for frontend compatibility
    socket.on('join_notification_room', handleJoinNotificationRoom) // Another alias

    // Admin-specific notification room
    socket.on('join-admin-room', () => {
        socket.join('admin-notifications')
        socket.join('admin-wallet-updates')
        console.log(`[v0] Admin joined admin notification rooms`)
    })
    socket.on('join_admin_room', () => {
        socket.join('admin-notifications')
        socket.join('admin-wallet-updates')
        console.log(`[v0] Admin joined admin notification rooms`)
    })

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id)

        // Remove driver from active drivers if disconnected
        if (socket.driverId) {
            activeDrivers.delete(socket.driverId)
            console.log(`Driver ${socket.driverId} removed from active drivers`)
        }
    })
})

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

// Initialize socket service
initializeSocket(io)

// Middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(cookieParser())

app.set("trust proxy", true); // VERY IMPORTANT for Render

// Database Connection
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.log("MongoDB connection error:", err))


// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/commute", commuteRoutes)
app.use("/api/location", locationRoutes)
app.use("/api/vehicles", vehicleRoutes)
app.use("/api/quotations", quotationRoutes)
app.use("/api/contracts", contractsRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/wallet", walletRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/vehicle-assignments", vehicleAssignmentRoutes)
app.use("/api/b2b/drivers", driverRoutes)
app.use("/api/payment-schedules", paymentScheduleRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/b2c-partner", b2cPartnerRoutes)
app.use("/api/b2c-trips", b2cTripRoutes)
app.use("/api/b2c-schedules", b2cScheduleRoutes)
app.use("/api/b2c-daily-trips", b2cDailyTripRoutes)
app.use("/api/b2b-partner", b2bPartnerRoutes)
app.use("/api/b2b-client", b2bClientRoutes)
app.use("/api/b2b-operations", b2bOperationsRoutes)
app.use("/api/trips", tripRoutes)
app.use("/api/commuter", commuterRoutes)
app.use("/api/employees", employeeRoutes)
app.use("/api/corporate-employees", corporateEmployeeRoutes)
app.use("/api/corporate-employee-users", corporateEmployeeUserRoutes)
app.use("/api/requirements", requirementRoutes)
app.use("/api/bank", bankRoutes)
app.use("/api/currency", currencyRoutes)
app.use('/api/monthly-pass', b2cMonthlyPassRoutes)
app.use('/api/b2c-bookings', b2cBookingRoutes)
app.use("/api/route-requests", routeRequestRoutes)
app.use("/api/no-show", noShowRoutes)
app.use("/api/subscription-settings", subscriptionSettingsRoutes)
app.use("/api/travel-history", travelHistoryRoutes)
app.use("/api/settlement", settlementRoutes)
app.use("/api/corporate-operations", corporateOperationsRoutes)
app.use("/api/corporate", corporateRoutes)
app.use("/api/driver", driverLocationRoutes)
app.use("/api/pages", pageRoutes)
app.use("/api/dropdowns", dropdownRoutes)
app.use("/api/commission", commissionRoutes)
app.use("/api/emi-payments", emiPaymentRoutes)
app.use("/api", negotiationRoutes)
app.use("/api/terms", termsRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err)
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`Socket.io server integrated and ready`)
    console.log(`Trip generation cron jobs ENABLED`)
    console.log(`- Daily B2C: 00:00`)
    console.log(`- Daily Corporate: 00:30`)
    console.log(`- Frequent: every 6 hours`)
    console.log(`- Hourly: every hour`)
    console.log(`Subscription cron jobs ENABLED`)
    console.log(`- Daily Renewals: 00:15`)
    console.log(`- Renewal Reminders: 09:00`)
    console.log(`Booking timeout cron jobs ENABLED`)
    console.log(`- Booking warnings: every 15 minutes`)
    console.log(`- Booking auto-cancellations: every 15 minutes`)
    
    // Run immediate trip generation on server start
    console.log(`[v0] Initializing trip generation on server startup...`)
    try {
        await runImmediateGeneration();
        console.log(`[v0] Server startup trip generation completed`)
    } catch (error) {
        console.error(`[v0] Error during server startup trip generation:`, error.message)
    }

    // Run immediate booking timeout check on server start
    console.log(`[v0] Initializing booking timeout check on server startup...`)
    try {
        await runImmediateBookingTimeoutCheck();
        console.log(`[v0] Server startup booking timeout check completed`)
    } catch (error) {
        console.error(`[v0] Error during server startup booking timeout check:`, error.message)
    }

    // Seed default dropdown options on server start
    console.log(`[v0] Seeding default dropdown options...`)
    try {
        await seedDropdownOptions();
        console.log(`[v0] Dropdown options seeding completed`)
    } catch (error) {
        console.error(`[v0] Error seeding dropdown options:`, error.message)
    }

    // Initialize EMI cron jobs
    console.log(`[v0] Initializing EMI cron jobs...`)
    try {
        initEMICronJobs();
        console.log(`[v0] EMI cron jobs initialized successfully`)
    } catch (error) {
        console.error(`[v0] Error initializing EMI cron jobs:`, error.message)
    }
})
