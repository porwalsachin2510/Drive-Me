import User from "../models/User.js"
import Contract from "../models/Contract.js"
import Quotation from "../models/Quotation.js"
import Vehicle from "../models/Vehicle.js"
import Driver from "../models/Driver.js"

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

        // Calculate monthly revenue data for charts
        const monthlyRevenue = []
        const monthlyProfit = []
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const currentYear = new Date().getFullYear()

        // Initialize monthly data
        months.forEach(month => {
            monthlyRevenue.push(0)
            monthlyProfit.push(0)
        })

        // Calculate actual monthly revenue from contracts using rentalPeriod dates
        contracts.forEach(contract => {
            const startDate = contract.rentalPeriod?.startDate || contract.startDate
            const endDate = contract.rentalPeriod?.endDate || contract.endDate

            if (contract.status === 'ACTIVE' && startDate) {
                const contractStartDate = new Date(startDate)
                const contractEndDate = endDate ? new Date(endDate) : new Date()

                // Only count contracts from current year
                if (contractStartDate.getFullYear() === currentYear || contractEndDate.getFullYear() === currentYear) {
                    const startMonth = contractStartDate.getFullYear() === currentYear ? contractStartDate.getMonth() : 0
                    const endMonth = contractEndDate.getFullYear() === currentYear ? contractEndDate.getMonth() : 11
                    const durationMonths = Math.max(endMonth - startMonth + 1, 1)
                    const monthlyAmount = (contract.financials?.totalAmount || 0) / durationMonths

                    for (let i = startMonth; i <= endMonth && i < 12; i++) {
                        monthlyRevenue[i] += Math.round(monthlyAmount)
                        monthlyProfit[i] += Math.round(monthlyAmount * 0.8) // 80% profit margin
                    }
                }
            }
        })

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
                growth: calculateRevenueGrowth(contracts),
                chartData: {
                    labels: months.slice(0, 6), // Show first 6 months
                    revenue: monthlyRevenue.slice(0, 6),
                    profit: monthlyProfit.slice(0, 6),
                    expenses: monthlyRevenue.slice(0, 6).map(r => Math.round(r * 0.2)) // 20% expenses
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
        
        const analytics = {
            revenue: {
                total: periodContracts.reduce((sum, c) => sum + (c.financials?.totalAmount || 0), 0),
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

