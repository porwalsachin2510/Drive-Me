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
            .populate('corporateOwnerId', 'companyName email')
            .populate('quotationId', 'quotedPrice totalAmount')
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
        
        // Calculate actual monthly revenue from contracts
        contracts.forEach(contract => {
            if (contract.status === 'ACTIVE' && contract.startDate) {
                const startMonth = new Date(contract.startDate).getMonth()
                const endMonth = contract.endDate ? new Date(contract.endDate).getMonth() : 11
                const monthlyAmount = (contract.financials?.totalAmount || 0) / Math.max(endMonth - startMonth + 1, 1)
                
                for (let i = startMonth; i <= endMonth && i < 12; i++) {
                    monthlyRevenue[i] += monthlyAmount
                    monthlyProfit[i] += monthlyAmount * 0.8 // 80% profit margin
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
                total: totalRevenue,
                monthly: totalRevenue * 0.08, // Approximate monthly revenue
                growth: '+12.5%', // Mock growth percentage
                chartData: {
                    labels: months.slice(0, 6), // Show first 6 months
                    revenue: monthlyRevenue.slice(0, 6),
                    profit: monthlyProfit.slice(0, 6)
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

// Helper function to generate revenue chart data from real contracts
const generateRevenueChart = (contracts, period) => {
    const labels = []
    const revenue = []
    const profit = []
    
    if (period === 'weekly') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const now = new Date()
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            labels.push(days[date.getDay()])
            
            // Calculate revenue from contracts active on this day
            const dayRevenue = contracts
                .filter(c => c.status === 'ACTIVE' && new Date(c.startDate) <= date && (!c.endDate || new Date(c.endDate) >= date))
                .reduce((sum, contract) => {
                    const dailyRate = (contract.financials?.totalAmount || 0) / 30 // Approximate daily rate
                    return sum + dailyRate
                }, 0)
            
            revenue.push(Math.round(dayRevenue))
            profit.push(Math.round(dayRevenue * 0.8)) // 80% profit margin
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
                .filter(c => c.status === 'ACTIVE' && new Date(c.startDate) <= weekEnd && (!c.endDate || new Date(c.endDate) >= weekStart))
                .reduce((sum, contract) => {
                    const weeklyRate = (contract.financials?.totalAmount || 0) / 4 // Approximate weekly rate
                    return sum + weeklyRate
                }, 0)
            
            revenue.push(Math.round(weekRevenue))
            profit.push(Math.round(weekRevenue * 0.8))
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
                .filter(c => c.status === 'ACTIVE' && new Date(c.startDate) <= monthEnd && (!c.endDate || new Date(c.endDate) >= monthStart))
                .reduce((sum, contract) => {
                    const monthlyRate = (contract.financials?.totalAmount || 0) / 12 // Approximate monthly rate
                    return sum + monthlyRate
                }, 0)
            
            revenue.push(Math.round(monthRevenue))
            profit.push(Math.round(monthRevenue * 0.8))
        })
    }
    
    return { labels, revenue, profit }
}

// Helper function to generate contracts chart data from real contracts
const generateContractsChart = (contracts, period) => {
    const labels = []
    const data = []
    
    if (period === 'weekly') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const now = new Date()
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            labels.push(days[date.getDay()])
            
            // Count contracts created on this day
            const dayContracts = contracts.filter(c => {
                const createdDate = new Date(c.createdAt)
                return createdDate.toDateString() === date.toDateString()
            }).length
            
            data.push(dayContracts)
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
            
            // Count contracts created during this week
            const weekContracts = contracts.filter(c => {
                const createdDate = new Date(c.createdAt)
                return createdDate >= weekStart && createdDate <= weekEnd
            }).length
            
            data.push(weekContracts)
        }
    } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
        const currentYear = new Date().getFullYear()
        
        months.forEach((month, index) => {
            labels.push(month)
            
            const monthStart = new Date(currentYear, index, 1)
            const monthEnd = new Date(currentYear, index + 1, 0)
            
            // Count contracts created during this month
            const monthContracts = contracts.filter(c => {
                const createdDate = new Date(c.createdAt)
                return createdDate >= monthStart && createdDate <= monthEnd
            }).length
            
            data.push(monthContracts)
        })
    }
    
    return { labels, data }
}
