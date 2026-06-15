import User from "../models/User.js"
import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import Vehicle from "../models/Vehicle.js"
import Driver from "../models/Driver.js"
import Route from "../models/Route.js"
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js"
import Trip from "../models/Trip.js"
import EMIPayment from "../models/EMIPayment.js"
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js"

// Get B2B Partner Overview
export const getB2BPartnerOverview = async (req, res) => {
    try {
        const userId = req.userId

        // Get contracts for this B2B partner
        const contracts = await Contract.find({ fleetOwnerId: userId })
            .populate('corporateOwnerId', 'companyName email fullName')
            .populate('quotationId', 'quotedPrice totalAmount requirements')
            .populate('vehicles.vehicleId', 'vehicleType model licensePlate')
            .sort({ createdAt: -1 })

        // Get quotations for this B2B partner
        const quotations = await Quotation.find({ fleetOwnerId: userId })
            .populate('corporateOwnerId', 'companyName email')
            .sort({ createdAt: -1 })

        // Calculate metrics
        const totalContracts = contracts.length
        const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length
        const pendingContracts = contracts.filter(c => c.status === 'PENDING_CORPORATE_SIGNATURE' || c.status === 'CORPORATE_SIGNED').length
        const completedContracts = contracts.filter(c => c.status === 'COMPLETED').length

        const totalQuotations = quotations.length
        const pendingQuotations = quotations.filter(q => q.status === 'PENDING').length
        const acceptedQuotations = quotations.filter(q => q.status === 'ACCEPTED').length
        const rejectedQuotations = quotations.filter(q => q.status === 'REJECTED').length

        // Calculate total revenue from active contracts
        const totalRevenue = contracts
            .filter(c => c.status === 'ACTIVE')
            .reduce((sum, contract) => sum + (contract.financials?.totalAmount || 0), 0)

        // Get currency from the first active contract or default to AED
        const currency = contracts.find(c => c.financials?.currency)?.financials?.currency || 'AED'

        // Calculate monthly revenue / expense / profit data for charts (real data)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const currentYear = new Date().getFullYear()

        // Initialize 12 months of data
        const monthlyRevenue = new Array(12).fill(0)
        const monthlyExpenses = new Array(12).fill(0)
        const monthlyProfit = new Array(12).fill(0)

        // Revenue is recognized across the contract's rental period (real contract value).
        // Expenses for the partner = the admin commission that is deducted from that revenue
        // (real per-contract commission rate, default 20%).
        contracts.forEach(contract => {
            const startDate = contract.rentalPeriod?.startDate || contract.startDate
            const endDate = contract.rentalPeriod?.endDate || contract.endDate

            if (contract.status === 'ACTIVE' && startDate) {
                const contractStartDate = new Date(startDate)
                const contractEndDate = endDate ? new Date(endDate) : new Date()

                // Only count contracts that overlap the current year
                if (contractStartDate.getFullYear() === currentYear || contractEndDate.getFullYear() === currentYear) {
                    const startMonth = contractStartDate.getFullYear() === currentYear ? contractStartDate.getMonth() : 0
                    const endMonth = contractEndDate.getFullYear() === currentYear ? contractEndDate.getMonth() : 11
                    const durationMonths = Math.max(endMonth - startMonth + 1, 1)
                    const monthlyAmount = (contract.financials?.totalAmount || 0) / durationMonths

                    // Real commission rate charged by admin on this contract
                    const commissionRate = contract.adminCommission?.b2bPartner?.rate ?? 20
                    const monthlyCommission = monthlyAmount * (commissionRate / 100)

                    for (let i = startMonth; i <= endMonth && i < 12; i++) {
                        monthlyRevenue[i] += monthlyAmount
                        monthlyExpenses[i] += monthlyCommission
                    }
                }
            }
        })

        // Add real vehicle-financing (EMI) installments as expenses in the month they are due
        const emiPlans = await EMIPayment.find({ fleetOwnerId: userId })
        emiPlans.forEach(plan => {
            (plan.installments || []).forEach(inst => {
                if (!inst.dueDate) return
                const due = new Date(inst.dueDate)
                if (due.getFullYear() === currentYear) {
                    monthlyExpenses[due.getMonth()] += inst.amount || 0
                }
            })
        })

        // Profit = revenue - expenses, rounded for display
        for (let i = 0; i < 12; i++) {
            monthlyRevenue[i] = Math.round(monthlyRevenue[i])
            monthlyExpenses[i] = Math.round(monthlyExpenses[i])
            monthlyProfit[i] = monthlyRevenue[i] - monthlyExpenses[i]
        }

        // Get vehicles and drivers from proper tables
        const vehicles = await Vehicle.find({ fleetOwnerId: userId })
        const drivers = await Driver.find({ fleetOwnerId: userId })

        const totalVehicles = vehicles.length
        const activeVehicles = vehicles.filter(v => v.status === 'AVAILABLE').length
        const totalDrivers = drivers.length
        const activeDrivers = drivers.filter(d => d.status === 'AVAILABLE').length

        const overview = {
            contracts: {
                total: totalContracts,
                active: activeContracts,
                pending: pendingContracts,
                completed: completedContracts,
                recent: contracts.slice(0, 5)
            },
            quotations: {
                total: totalQuotations,
                pending: pendingQuotations,
                accepted: acceptedQuotations,
                rejected: rejectedQuotations,
                recent: quotations.slice(0, 5)
            },
            revenue: {
                total: Math.round(totalRevenue),
                monthly: Math.round(totalRevenue / 12), // Monthly average
                currency: currency,
                growth: calculateRevenueGrowth(contracts),
                chartData: {
                    labels: months, // Full year, Jan - Dec
                    revenue: monthlyRevenue,
                    profit: monthlyProfit,
                    expenses: monthlyExpenses
                }
            },
            vehicles: {
                total: totalVehicles,
                active: activeVehicles,
                utilization: totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) + '%' : '0%'
            },
            drivers: {
                total: totalDrivers,
                active: activeDrivers,
                utilization: totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) + '%' : '0%'
            },
            performance: {
                onTimeDelivery: '94%',
                customerSatisfaction: '4.8',
                averageResponseTime: '2.3 hours'
            }
        }

        res.json({
            success: true,
            data: {
                overview
            }
        })
    } catch (error) {
        console.error("Error fetching B2B partner overview:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch overview data"
        })
    }
}

// Get B2B Partner Settings
export const getB2BPartnerSettings = async (req, res) => {
    try {
        const userId = req.userId
        const user = await User.findById(userId)

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        const settings = {
            companyName: user.companyName || "",
            tradeLicense: user.tradeLicense || "",
            officeAddress: user.companyAddress || "",  // Use existing companyAddress
            email: user.email || "",
            phone: user.whatsappNumber || "",
            website: user.website || "",
            notifications: {
                emailNotifications: user.notifications?.emailNotifications ?? true,
                smsNotifications: user.notifications?.smsNotifications ?? true,
                bookingAlerts: user.notifications?.bookingAlerts ?? true,
                paymentAlerts: user.notifications?.paymentAlerts ?? true
            }
        }

        res.json({
            success: true,
            data: { settings }
        })
    } catch (error) {
        console.error("Error fetching B2B partner settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch settings"
        })
    }
}

// Update B2B Partner Settings
export const updateB2BPartnerSettings = async (req, res) => {
    try {
        const userId = req.userId
        const { companyInfo, notifications } = req.body

        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    companyName: companyInfo.companyName,
                    tradeLicense: companyInfo.tradeLicense,
                    companyAddress: companyInfo.officeAddress,  // Save to companyAddress
                    website: companyInfo.website,
                    'notifications.emailNotifications': notifications?.emailNotifications ?? true,
                    'notifications.smsNotifications': notifications?.smsNotifications ?? true,
                    'notifications.bookingAlerts': notifications?.bookingAlerts ?? true,
                    'notifications.paymentAlerts': notifications?.paymentAlerts ?? true
                }
            }
        )

        res.json({
            success: true,
            message: "Settings updated successfully"
        })
    } catch (error) {
        console.error("Error updating B2B partner settings:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update settings"
        })
    }
}

// Get B2B Partner Analytics
export const getB2BPartnerAnalytics = async (req, res) => {
    try {
        const userId = req.userId
        const { period = 'monthly' } = req.query

        // Get contracts and vehicles for analytics
        const contracts = await Contract.find({ fleetOwnerId: userId })
        const vehicles = await Vehicle.find({ fleetOwnerId: userId })

        // Calculate analytics based on period
        const now = new Date()
        let startDate

        switch (period) {
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case 'monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            case 'yearly':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
                break
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        }

        const periodContracts = contracts.filter(c => new Date(c.createdAt) >= startDate)

        // Get currency from contracts
        const currency = contracts.find(c => c.financials?.currency)?.financials?.currency || 'AED'

        const analytics = {
            revenue: {
                total: periodContracts.reduce((sum, c) => sum + (c.financials?.totalAmount || 0), 0),
                currency: currency,
                growth: '+15.3%',
                chartData: generateRevenueChart(periodContracts, period)
            },
            contracts: {
                total: periodContracts.length,
                active: periodContracts.filter(c => c.status === 'ACTIVE').length,
                completed: periodContracts.filter(c => c.status === 'COMPLETED').length,
                pending: periodContracts.filter(c => c.status.includes('PENDING')).length,
                chartData: generateContractsChart(periodContracts, period)
            },
            performance: {
                utilization: '87%',
                onTimeDelivery: '94%',
                customerSatisfaction: '4.8',
                averageResponseTime: '1.8 hours'
            },
            fleet: {
                totalVehicles: vehicles.length,
                activeVehicles: vehicles.filter(v => v.status === 'AVAILABLE').length,
                maintenance: vehicles.filter(v => v.status === 'MAINTENANCE').length,
                utilization: vehicles.length > 0 ? Math.round((vehicles.filter(v => v.status === 'AVAILABLE').length / vehicles.length) * 100) + '%' : '0%'
            }
        }

        res.json({
            success: true,
            data: { analytics }
        })
    } catch (error) {
        console.error("Error fetching B2B partner analytics:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch analytics data"
        })
    }
}

// Helper function to calculate revenue growth percentage
const calculateRevenueGrowth = (contracts) => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Get last month's range
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1)
    const lastMonthEnd = new Date(currentYear, currentMonth, 0)

    // Get current month's range
    const currentMonthStart = new Date(currentYear, currentMonth, 1)
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0)

    // Calculate revenue for each period
    let lastMonthRevenue = 0
    let currentMonthRevenue = 0

    contracts.forEach(contract => {
        if (contract.status === 'ACTIVE') {
            const startDate = new Date(contract.rentalPeriod?.startDate || contract.createdAt)
            const endDate = contract.rentalPeriod?.endDate ? new Date(contract.rentalPeriod.endDate) : new Date()
            const monthlyRate = (contract.financials?.totalAmount || 0) / Math.max((contract.rentalPeriod?.duration || 1), 1)

            // Check if contract was active last month
            if (startDate <= lastMonthEnd && endDate >= lastMonthStart) {
                lastMonthRevenue += monthlyRate
            }

            // Check if contract is active current month
            if (startDate <= currentMonthEnd && endDate >= currentMonthStart) {
                currentMonthRevenue += monthlyRate
            }
        }
    })

    if (lastMonthRevenue === 0) {
        return currentMonthRevenue > 0 ? '+100%' : '0%'
    }

    const growth = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`
}

// Helper function to generate revenue chart data from real contracts
const generateRevenueChart = (contracts, period) => {
    const labels = []
    const revenue = []
    const profit = []
    const expenses = []

    if (period === 'weekly') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const now = new Date()

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            labels.push(days[date.getDay()])

            // Calculate revenue from contracts active on this day
            const dayRevenue = contracts
                .filter(c => {
                    const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                    const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                    return c.status === 'ACTIVE' && startDate <= date && endDate >= date
                })
                .reduce((sum, contract) => {
                    const duration = contract.rentalPeriod?.duration || 1
                    const dailyRate = (contract.financials?.totalAmount || 0) / (duration * 30) // Daily rate
                    return sum + dailyRate
                }, 0)

            revenue.push(Math.round(dayRevenue))
            profit.push(Math.round(dayRevenue * 0.8)) // 80% profit margin
            expenses.push(Math.round(dayRevenue * 0.2)) // 20% expenses
        }
    } else if (period === 'monthly') {
        const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
        const now = new Date()

        for (let i = 0; i < 4; i++) {
            labels.push(weeks[i])

            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - (3 - i) * 7)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 7)

            // Calculate revenue from contracts active during this week
            const weekRevenue = contracts
                .filter(c => {
                    const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                    const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                    return c.status === 'ACTIVE' && startDate <= weekEnd && endDate >= weekStart
                })
                .reduce((sum, contract) => {
                    const duration = contract.rentalPeriod?.duration || 1
                    const weeklyRate = (contract.financials?.totalAmount || 0) / (duration * 4) // Weekly rate
                    return sum + weeklyRate
                }, 0)

            revenue.push(Math.round(weekRevenue))
            profit.push(Math.round(weekRevenue * 0.8))
            expenses.push(Math.round(weekRevenue * 0.2))
        }
    } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
        const currentYear = new Date().getFullYear()

        months.forEach((month, index) => {
            labels.push(month)

            const monthStart = new Date(currentYear, index, 1)
            const monthEnd = new Date(currentYear, index + 1, 0)

            // Calculate revenue from contracts active during this month
            const monthRevenue = contracts
                .filter(c => {
                    const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                    const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                    return c.status === 'ACTIVE' && startDate <= monthEnd && endDate >= monthStart
                })
                .reduce((sum, contract) => {
                    const duration = contract.rentalPeriod?.duration || 1
                    const monthlyRate = (contract.financials?.totalAmount || 0) / duration // Monthly rate
                    return sum + monthlyRate
                }, 0)

            revenue.push(Math.round(monthRevenue))
            profit.push(Math.round(monthRevenue * 0.8))
            expenses.push(Math.round(monthRevenue * 0.2))
        })
    }

    return { labels, revenue, profit, expenses }
}

// Helper function to generate contracts chart data from real contracts
const generateContractsChart = (contracts, period) => {
    const labels = []
    const data = []
    const now = new Date()

    if (period === 'weekly') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            labels.push(days[date.getDay()])

            // Count active contracts on this day
            const dayContracts = contracts.filter(c => {
                const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                return c.status === 'ACTIVE' && startDate <= date && endDate >= date
            }).length

            data.push(dayContracts)
        }
    } else if (period === 'monthly') {
        const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

        for (let i = 0; i < 4; i++) {
            labels.push(weeks[i])

            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - (3 - i) * 7)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 7)

            // Count active contracts during this week
            const weekContracts = contracts.filter(c => {
                const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                return c.status === 'ACTIVE' && startDate <= weekEnd && endDate >= weekStart
            }).length

            data.push(weekContracts)
        }
    } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
        const currentYear = now.getFullYear()

        months.forEach((month, index) => {
            labels.push(month)

            const monthStart = new Date(currentYear, index, 1)
            const monthEnd = new Date(currentYear, index + 1, 0)

            // Count active contracts during this month
            const monthContracts = contracts.filter(c => {
                const startDate = new Date(c.rentalPeriod?.startDate || c.createdAt)
                const endDate = c.rentalPeriod?.endDate ? new Date(c.rentalPeriod.endDate) : new Date()
                return c.status === 'ACTIVE' && startDate <= monthEnd && endDate >= monthStart
            }).length

            data.push(monthContracts)
        })
    }

    return { labels, data }
}


// ================= B2B Partner Routes Management =================

// Get all routes created by B2B Partner
export const getB2BPartnerRoutes = async (req, res) => {
    try {
        const userId = req.userId

        // Get routes where B2B Partner is the assignedBy (for contract vehicles) or where they created via their fleet
        const routes = await Route.find({
            $or: [
                { assignedBy: userId },
                { b2cPartnerId: userId }
            ]
        })
            .populate('vehicleId', 'vehicleName registrationNumber vehicleCategory')
            .populate('contractId', 'contractNumber status')
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            routes
        })
    } catch (error) {
        console.error("Error fetching B2B partner routes:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch routes",
            error: error.message
        })
    }
}

// Update a route
export const updateB2BPartnerRoute = async (req, res) => {
    try {
        const userId = req.userId
        const { routeId } = req.params
        const updates = req.body

        const route = await Route.findOne({
            _id: routeId,
            $or: [
                { assignedBy: userId },
                { b2cPartnerId: userId }
            ]
        })

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or you don't have permission to update it"
            })
        }

        // Update allowed fields
        const allowedFields = ['fromLocation', 'toLocation', 'totalDistance', 'estimatedDuration', 'status', 'availableDays', 'routeNotes']
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                route[field] = updates[field]
            }
        })

        await route.save()

        res.status(200).json({
            success: true,
            message: "Route updated successfully",
            route
        })
    } catch (error) {
        console.error("Error updating route:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update route",
            error: error.message
        })
    }
}

// Delete a route
export const deleteB2BPartnerRoute = async (req, res) => {
    try {
        const userId = req.userId
        const { routeId } = req.params

        const route = await Route.findOne({
            _id: routeId,
            $or: [
                { assignedBy: userId },
                { b2cPartnerId: userId }
            ]
        })

        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found or you don't have permission to delete it"
            })
        }

        // Delete associated schedules
        await CorporateRouteSchedule.deleteMany({ routeId: route._id })

        // Delete associated trips that haven't started
        await Trip.deleteMany({ routeId: route._id, status: 'SCHEDULED' })

        // Delete the route
        await Route.findByIdAndDelete(routeId)

        res.status(200).json({
            success: true,
            message: "Route deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting route:", error)
        res.status(500).json({
            success: false,
            message: "Failed to delete route",
            error: error.message
        })
    }
}

// Get assigned vehicles for a contract (B2B Partner view)
export const getB2BContractAssignedVehicles = async (req, res) => {
    try {
        const userId = req.userId
        const { contractId } = req.params

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: userId
        })
            .populate({
                path: "vehicles.vehicleId",
                select: "vehicleName vehicleCategory registrationNumber photos capacity"
            })
            .populate({
                path: "vehicles.assignedVehicles.driverId",
                select: "name licenseNumber phone email"
            })
            .populate({
                path: "vehicles.assignedVehicles.routeDetails",
                select: "fromLocation toLocation routeStartDate startTime endTime stopPoints totalDistance estimatedDuration routeNotes status availableDays tripTimes"
            })
            .populate({
                path: "corporateOwnerId",
                select: "fullName companyName email"
            })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            })
        }

        // Extract assigned vehicles
        const assignedVehicles = []
        contract.vehicles.forEach((vehicleGroup) => {
            if (vehicleGroup.assignedVehicles && vehicleGroup.assignedVehicles.length > 0) {
                vehicleGroup.assignedVehicles.forEach((assigned) => {
                    assignedVehicles.push({
                        ...assigned.toObject(),
                        vehicleDetails: vehicleGroup.vehicleId
                    })
                })
            }
        })

        res.status(200).json({
            success: true,
            data: {
                contract,
                assignedVehicles
            }
        })
    } catch (error) {
        console.error("Error fetching B2B assigned vehicles:", error)
        res.status(500).json({
            success: false,
            message: "Failed to fetch assigned vehicles",
            error: error.message
        })
    }
}

// Assign route to contract vehicle (B2B Partner)
export const assignRouteToContractVehicle = async (req, res) => {
    try {
        const userId = req.userId
        const { contractId, assignedVehicleId } = req.params
        const {
            fromLocation,
            toLocation,
            routeStartDate,
            routeEndDate,
            availableDays,
            totalDistance,
            estimatedDuration,
            routeNotes,
            tripTimes
        } = req.body

        // Verify B2B Partner owns this contract
        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: userId
        }).populate({
            path: "vehicles.vehicleId",
            select: "capacity vehicleName registrationNumber"
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            })
        }

        // Find the assigned vehicle
        let assignedVehicleData = null
        let vehicleDetails = null
        for (const vehicleGroup of contract.vehicles) {
            const found = vehicleGroup.assignedVehicles.find(v => v._id.toString() === assignedVehicleId)
            if (found) {
                assignedVehicleData = found
                vehicleDetails = vehicleGroup.vehicleId
                break
            }
        }

        if (!assignedVehicleData) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found in contract"
            })
        }

        const seatingCapacity = vehicleDetails?.capacity?.seatingCapacity || 30

        // Create new route
        const route = new Route({
            contractId,
            assignedVehicleId,
            vehicleId: vehicleDetails?._id || null,
            fromLocation,
            toLocation,
            routeStartDate,
            stopPoints: [],
            totalDistance: totalDistance || 0,
            estimatedDuration,
            availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI"],
            routeNotes,
            assignedBy: userId,
            totalSeats: seatingCapacity,
            availableSeats: seatingCapacity,
            routeType: "CORPORATE",
            corporateId: contract.corporateOwnerId,
            status: "ACTIVE"
        })

        await route.save()

        // Create CorporateRouteSchedule if tripTimes provided
        let routeSchedule = null
        if (tripTimes && tripTimes.length > 0) {
            const formattedTripTimes = tripTimes.map((trip, index) => {
                const validOutboundStops = (trip.outboundStopPoints || [])
                    .filter(stop => stop.location && stop.location.trim() !== '')
                    .map(stop => ({
                        location: stop.location.trim(),
                        time: stop.time || ''
                    }))

                const validReturnStops = (trip.returnStopPoints || [])
                    .filter(stop => stop.location && stop.location.trim() !== '')
                    .map(stop => ({
                        location: stop.location.trim(),
                        time: stop.time || ''
                    }))

                return {
                    tripNumber: index + 1,
                    departureTime: trip.departureTime,
                    arrivalTime: trip.arrivalTime || null,
                    returnDepartureTime: trip.returnTime || null,
                    returnArrivalTime: trip.returnArrivalTime || null,
                    tripType: trip.tripType || "One Way",
                    outboundStopPoints: validOutboundStops,
                    returnStopPoints: validReturnStops
                }
            })

            routeSchedule = new CorporateRouteSchedule({
                corporateId: contract.corporateOwnerId,
                routeId: route._id,
                contractId: contractId,
                scheduleName: `${fromLocation} to ${toLocation} Schedule`,
                tripTimes: formattedTripTimes,
                availableDays: availableDays || ["MON", "TUE", "WED", "THU", "FRI"],
                assignedVehicleId: assignedVehicleId,
                assignedVehicle: vehicleDetails?._id || null,
                assignedDriver: assignedVehicleData.driverId || null,
                startDate: routeStartDate ? new Date(routeStartDate) : new Date(),
                endDate: routeEndDate ? new Date(routeEndDate) : null,
                totalSeats: seatingCapacity,
                isActive: true,
                status: "Active"
            })

            await routeSchedule.save()
        }

        // Update the contract to link route to assigned vehicle
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(v => v._id.toString() === assignedVehicleId)
            if (assignedVehicle) {
                assignedVehicle.routeDetails = route._id
                break
            }
        }

        contract.markModified("vehicles")
        await contract.save()

        res.status(200).json({
            success: true,
            message: "Route assigned successfully",
            data: {
                route,
                schedule: routeSchedule
            }
        })
    } catch (error) {
        console.error("Error assigning route to contract vehicle:", error)
        res.status(500).json({
            success: false,
            message: "Failed to assign route",
            error: error.message
        })
    }
}

// Update vehicle on contract (B2B Partner can change vehicle if needed)
export const updateContractVehicle = async (req, res) => {
    try {
        const userId = req.userId
        const { contractId, assignedVehicleId } = req.params
        const { newVehicleId } = req.body

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: userId
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            })
        }

        // Verify new vehicle belongs to B2B Partner
        const newVehicle = await Vehicle.findOne({
            _id: newVehicleId,
            fleetOwnerId: userId
        })

        if (!newVehicle) {
            return res.status(404).json({
                success: false,
                message: "New vehicle not found or doesn't belong to you"
            })
        }

        // Find and update the assigned vehicle
        let oldVehicleId = null
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(v => v._id.toString() === assignedVehicleId)
            if (assignedVehicle) {
                oldVehicleId = assignedVehicle.vehicleId
                assignedVehicle.vehicleId = newVehicleId
                break
            }
        }

        if (!oldVehicleId) {
            return res.status(404).json({
                success: false,
                message: "Assigned vehicle not found"
            })
        }

        contract.markModified("vehicles")
        await contract.save()

        // Update routes
        await Route.updateMany(
            { contractId, vehicleId: oldVehicleId },
            { vehicleId: newVehicleId }
        )

        // Update schedules
        await CorporateRouteSchedule.updateMany(
            { contractId, assignedVehicle: oldVehicleId },
            { assignedVehicle: newVehicleId }
        )

        // Update trips
        await Trip.updateMany(
            { vehicleId: oldVehicleId, status: 'SCHEDULED' },
            { vehicleId: newVehicleId }
        )

        // Get user info for notifications
        const b2bPartner = await User.findById(userId).select('fullName companyName businessName')
        const b2bPartnerName = b2bPartner?.companyName || b2bPartner?.businessName || b2bPartner?.fullName || 'B2B Partner'
        const oldVehicle = await Vehicle.findById(oldVehicleId).select('vehicleName registrationNumber')
        const oldVehicleName = oldVehicle?.vehicleName || 'Previous Vehicle'

        // Send notification to Corporate user about vehicle change
        const corporateNotification = await createNotification({
            userId: contract.corporateOwnerId,
            type: "ASSIGNMENT_UPDATED",
            title: "Vehicle Changed for Your Contract",
            message: `${b2bPartnerName} has changed the vehicle assignment for contract ${contract.contractNumber}. Old vehicle: ${oldVehicleName}. New vehicle: ${newVehicle.vehicleName} (${newVehicle.registrationNumber}).`,
            metadata: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                changeType: "VEHICLE_CHANGED",
                oldVehicleId,
                oldVehicleName,
                newVehicleId,
                newVehicleName: newVehicle.vehicleName,
                newVehicleRegistration: newVehicle.registrationNumber,
                changedBy: userId,
                changedByName: b2bPartnerName,
            },
        })
        sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateNotification)

        // Notify Admin
        await sendAdminNotification(
            "Contract Vehicle Changed",
            `${b2bPartnerName} changed vehicle for contract ${contract.contractNumber}. From: ${oldVehicleName} To: ${newVehicle.vehicleName}`,
            "ASSIGNMENT_UPDATED",
            {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                b2bPartnerId: userId,
                corporateId: contract.corporateOwnerId,
                changeType: "VEHICLE_CHANGED",
            }
        )

        res.status(200).json({
            success: true,
            message: "Vehicle updated successfully across all records"
        })
    } catch (error) {
        console.error("Error updating contract vehicle:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update vehicle",
            error: error.message
        })
    }
}

// Update driver on contract (B2B Partner can change driver if needed)
export const updateContractDriver = async (req, res) => {
    try {
        const userId = req.userId
        const { contractId, assignedVehicleId } = req.params
        const { newDriverId } = req.body

        const contract = await Contract.findOne({
            _id: contractId,
            fleetOwnerId: userId
        })

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Contract not found or access denied"
            })
        }

        // Verify new driver belongs to B2B Partner
        const newDriver = await Driver.findOne({
            _id: newDriverId,
            fleetOwnerId: userId
        })

        if (!newDriver) {
            return res.status(404).json({
                success: false,
                message: "New driver not found or doesn't belong to you"
            })
        }

        // Find and update the assigned vehicle's driver
        let oldDriverId = null
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(v => v._id.toString() === assignedVehicleId)
            if (assignedVehicle) {
                oldDriverId = assignedVehicle.driverId
                assignedVehicle.driverId = newDriverId
                assignedVehicle.driverAssignedBy = "B2B_PARTNER"
                assignedVehicle.driverModel = "Driver"
                break
            }
        }

        contract.markModified("vehicles")
        await contract.save()

        // Update schedules
        if (oldDriverId) {
            await CorporateRouteSchedule.updateMany(
                { contractId, assignedDriver: oldDriverId },
                { assignedDriver: newDriverId }
            )

            // Update trips
            await Trip.updateMany(
                { driverId: oldDriverId, status: 'SCHEDULED' },
                { driverId: newDriverId }
            )
        }

        // Get user info for notifications
        const b2bPartner = await User.findById(userId).select('fullName companyName businessName')
        const b2bPartnerName = b2bPartner?.companyName || b2bPartner?.businessName || b2bPartner?.fullName || 'B2B Partner'
        const oldDriver = oldDriverId ? await Driver.findById(oldDriverId).select('name fullName') : null
        const oldDriverName = oldDriver?.fullName || oldDriver?.name || 'Previous Driver'

        // Get vehicle name for this assignment
        let vehicleName = "Vehicle"
        for (const vehicleGroup of contract.vehicles) {
            const assignedVehicle = vehicleGroup.assignedVehicles.find(v => v._id.toString() === assignedVehicleId)
            if (assignedVehicle) {
                const vehicle = await Vehicle.findById(vehicleGroup.vehicleId).select('vehicleName')
                vehicleName = vehicle?.vehicleName || "Vehicle"
                break
            }
        }

        // Send notification to Corporate user about driver change
        const corporateNotification = await createNotification({
            userId: contract.corporateOwnerId,
            type: "ASSIGNMENT_UPDATED",
            title: "Driver Changed for Your Contract",
            message: `${b2bPartnerName} has assigned a new driver for ${vehicleName} in contract ${contract.contractNumber}. New driver: ${newDriver.fullName || newDriver.name}. ${oldDriver ? `Previous driver: ${oldDriverName}.` : ''}`,
            metadata: {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                changeType: "DRIVER_CHANGED",
                oldDriverId: oldDriverId?.toString(),
                oldDriverName,
                newDriverId,
                newDriverName: newDriver.fullName || newDriver.name,
                vehicleName,
                changedBy: userId,
                changedByName: b2bPartnerName,
            },
        })
        sendRealTimeNotification(contract.corporateOwnerId.toString(), corporateNotification)

        // Notify Admin
        await sendAdminNotification(
            "Contract Driver Changed",
            `${b2bPartnerName} changed driver for ${vehicleName} in contract ${contract.contractNumber}. New driver: ${newDriver.fullName || newDriver.name}`,
            "ASSIGNMENT_UPDATED",
            {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                b2bPartnerId: userId,
                corporateId: contract.corporateOwnerId,
                changeType: "DRIVER_CHANGED",
            }
        )

        res.status(200).json({
            success: true,
            message: "Driver updated successfully across all records"
        })
    } catch (error) {
        console.error("Error updating contract driver:", error)
        res.status(500).json({
            success: false,
            message: "Failed to update driver",
            error: error.message
        })
    }
}
