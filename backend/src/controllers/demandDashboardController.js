import Lead from "../models/Lead.js"
import DemandEmployee from "../models/DemandEmployee.js"
import DemandCommission from "../models/DemandCommission.js"
import DemandExpense from "../models/DemandExpense.js"
import DemandCampaign from "../models/DemandCampaign.js"
import { resolveDisplayCurrency, fromBase } from "../Services/displayCurrency.js"

const parseRange = (from, to) => {
    const match = {}
    if (from) match.$gte = new Date(from)
    if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        match.$lte = end
    }
    return Object.keys(match).length ? match : null
}

// @desc    Performance dashboard
// @route   GET /api/demand/dashboard/performance
export const getPerformanceDashboard = async (req, res) => {
    try {
        const { from, to } = req.query
        const displayCurrency = resolveDisplayCurrency(req)
        // Records store money in the platform base currency; convert every money
        // figure to the admin's selected display currency before returning.
        const toDisp = (v) => fromBase(v, displayCurrency)
        const range = parseRange(from, to)
        const leadMatch = range ? { createdAt: range } : {}

        const [
            totalLeads,
            customerLeads,
            b2bLeads,
            b2cLeads,
            customerOnboardings,
            b2bOnboardings,
            b2cOnboardings,
            onboardedTotal,
            lostTotal,
            pendingFollowUps,
        ] = await Promise.all([
            Lead.countDocuments(leadMatch),
            Lead.countDocuments({ ...leadMatch, leadCategory: "CUSTOMER" }),
            Lead.countDocuments({ ...leadMatch, partnerType: "B2B" }),
            Lead.countDocuments({ ...leadMatch, partnerType: "B2C" }),
            Lead.countDocuments({ ...leadMatch, leadCategory: "CUSTOMER", stage: { $in: ["ONBOARDED", "ACTIVE"] } }),
            Lead.countDocuments({ ...leadMatch, partnerType: "B2B", stage: { $in: ["ONBOARDED", "ACTIVE"] } }),
            Lead.countDocuments({ ...leadMatch, partnerType: "B2C", stage: { $in: ["ONBOARDED", "ACTIVE"] } }),
            Lead.countDocuments({ ...leadMatch, stage: { $in: ["ONBOARDED", "ACTIVE"] } }),
            Lead.countDocuments({ ...leadMatch, stage: "LOST" }),
            Lead.countDocuments({ ...leadMatch, stage: { $nin: ["ONBOARDED", "ACTIVE", "LOST"] }, nextFollowUpDate: { $ne: null } }),
        ])

        // Stage funnel
        const stageAgg = await Lead.aggregate([
            { $match: leadMatch },
            { $group: { _id: "$stage", count: { $sum: 1 } } },
        ])
        const stageFunnel = stageAgg.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})

        // Employee productivity (leads handled + onboardings + target achievement)
        const employees = await DemandEmployee.find({ status: "ACTIVE" }).lean()
        const employeeProductivity = await Promise.all(
            employees.map(async (emp) => {
                const assigned = await Lead.countDocuments({ ...leadMatch, assignedTo: emp._id })
                const onboarded = await Lead.countDocuments({
                    ...leadMatch,
                    assignedTo: emp._id,
                    stage: { $in: ["ONBOARDED", "ACTIVE"] },
                })
                return {
                    _id: emp._id,
                    name: emp.fullName,
                    employeeCode: emp.employeeCode,
                    region: emp.region,
                    assigned,
                    onboarded,
                    target: emp.monthlyTarget || 0,
                    achievement: emp.monthlyTarget > 0 ? Math.round((onboarded / emp.monthlyTarget) * 100) : 0,
                    conversionRate: assigned > 0 ? Math.round((onboarded / assigned) * 100) : 0,
                }
            })
        )

        // Territory performance
        const territoryAgg = await Lead.aggregate([
            { $match: { ...leadMatch, region: { $ne: "" } } },
            {
                $group: {
                    _id: "$region",
                    leads: { $sum: 1 },
                    onboarded: { $sum: { $cond: [{ $in: ["$stage", ["ONBOARDED", "ACTIVE"]] }, 1, 0] } },
                },
            },
            { $sort: { leads: -1 } },
        ])

        // Campaign performance
        const campaigns = await DemandCampaign.find().lean()
        const campaignPerformance = await Promise.all(
            campaigns.map(async (c) => {
                const leads = await Lead.countDocuments({ campaign: c._id })
                const onboarded = await Lead.countDocuments({ campaign: c._id, stage: { $in: ["ONBOARDED", "ACTIVE"] } })
                return { _id: c._id, name: c.name, leads, onboarded, budget: toDisp(c.budget || 0) }
            })
        )

        const conversionRate = totalLeads > 0 ? Math.round((onboardedTotal / totalLeads) * 1000) / 10 : 0

        res.json({
            success: true,
            currency: displayCurrency,
            data: {
                currency: displayCurrency,
                summary: {
                    totalLeads,
                    customerLeads,
                    b2bLeads,
                    b2cLeads,
                    customerOnboardings,
                    b2bOnboardings,
                    b2cOnboardings,
                    onboardedTotal,
                    lostTotal,
                    pendingFollowUps,
                    conversionRate,
                },
                stageFunnel,
                employeeProductivity: employeeProductivity.sort((a, b) => b.onboarded - a.onboarded),
                territoryPerformance: territoryAgg.map((t) => ({
                    region: t._id,
                    leads: t.leads,
                    onboarded: t.onboarded,
                    conversionRate: t.leads > 0 ? Math.round((t.onboarded / t.leads) * 100) : 0,
                })),
                campaignPerformance: campaignPerformance.sort((a, b) => b.onboarded - a.onboarded),
            },
        })
    } catch (error) {
        console.error("[demand] getPerformanceDashboard error:", error)
        res.status(500).json({ success: false, message: "Failed to build performance dashboard" })
    }
}

// @desc    Financial dashboard (cost, commissions, expenses, ROI)
// @route   GET /api/demand/dashboard/financial
export const getFinancialDashboard = async (req, res) => {
    try {
        const { from, to } = req.query
        const displayCurrency = resolveDisplayCurrency(req)
        // All amounts are stored in the platform base currency; convert every
        // money figure to the admin's selected display currency on the way out.
        // ROI/percentages are ratios and stay identical under a linear currency
        // conversion, so they are computed on base values and left unconverted.
        const toDisp = (v) => fromBase(v, displayCurrency)
        const range = parseRange(from, to)

        // Salary cost = sum of active employees' current monthly salary + allowances
        const employees = await DemandEmployee.find().lean()
        const totalSalaryCost = employees
            .filter((e) => e.status === "ACTIVE")
            .reduce((s, e) => s + (e.monthlySalary || 0) + (e.allowances || []).reduce((a, x) => a + (x.amount || 0), 0), 0)

        // Commissions
        const commMatch = range ? { createdAt: range } : {}
        const commAgg = await DemandCommission.aggregate([
            { $match: commMatch },
            { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ])
        const commissionsByStatus = commAgg.reduce((acc, c) => ({ ...acc, [c._id]: c.total }), {})
        const totalCommissions = commAgg.reduce((s, c) => s + c.total, 0)

        // Expenses (approved only count toward cost)
        const expMatch = range ? { date: range } : {}
        const expAgg = await DemandExpense.aggregate([
            { $match: { ...expMatch, approvalStatus: "APPROVED" } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
        ])
        const expensesByCategory = expAgg.reduce((acc, e) => ({ ...acc, [e._id]: e.total }), {})
        const totalExpenses = expAgg.reduce((s, e) => s + e.total, 0)

        // Onboardings for cost-per-acquisition
        const leadMatch = range ? { onboardedAt: range } : { stage: { $in: ["ONBOARDED", "ACTIVE"] } }
        const customerOnboarded = await Lead.countDocuments({ ...leadMatch, leadCategory: "CUSTOMER", stage: { $in: ["ONBOARDED", "ACTIVE"] } })
        const partnerOnboarded = await Lead.countDocuments({ ...leadMatch, leadCategory: "PARTNER", stage: { $in: ["ONBOARDED", "ACTIVE"] } })
        const totalOnboarded = customerOnboarded + partnerOnboarded

        const totalCost = totalSalaryCost + totalCommissions + totalExpenses

        // ===== Revenue (estimated value of onboarded/active leads) =====
        // Used to compute ROI (return on investment) across dimensions.
        const onboardedStages = ["ONBOARDED", "ACTIVE"]
        const revenueMatch = range
            ? { onboardedAt: range, stage: { $in: onboardedStages } }
            : { stage: { $in: onboardedStages } }

        const totalRevenueAgg = await Lead.aggregate([
            { $match: revenueMatch },
            { $group: { _id: null, total: { $sum: "$estimatedValue" } } },
        ])
        const totalRevenue = totalRevenueAgg[0]?.total || 0

        // ===== Budget vs Actual =====
        const campaigns = await DemandCampaign.find().lean()
        const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0)
        const roi = (revenue, cost) => (cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : revenue > 0 ? 100 : 0)

        // ===== ROI by campaign (revenue vs budget + attributed commissions) =====
        const roiByCampaign = await Promise.all(
            campaigns.map(async (c) => {
                const [rev, comm] = await Promise.all([
                    Lead.aggregate([
                        { $match: { ...revenueMatch, campaign: c._id } },
                        { $group: { _id: null, total: { $sum: "$estimatedValue" } } },
                    ]),
                    DemandCommission.aggregate([
                        { $match: { campaign: c._id, ...commMatch } },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ]),
                ])
                const revenue = rev[0]?.total || 0
                const cost = (c.budget || 0) + (comm[0]?.total || 0)
                return { _id: c._id, name: c.name, budget: c.budget || 0, revenue, cost, roi: roi(revenue, cost) }
            })
        )

        // Employee-wise earnings (salary + commission + expenses) + ROI
        const employeeEarnings = await Promise.all(
            employees.map(async (emp) => {
                const salary = (emp.monthlySalary || 0) + (emp.allowances || []).reduce((a, x) => a + (x.amount || 0), 0)
                const [empComm, empExp, empRev] = await Promise.all([
                    DemandCommission.aggregate([
                        { $match: { employee: emp._id, ...commMatch } },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ]),
                    DemandExpense.aggregate([
                        { $match: { employee: emp._id, approvalStatus: "APPROVED", ...expMatch } },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ]),
                    Lead.aggregate([
                        { $match: { ...revenueMatch, assignedTo: emp._id } },
                        { $group: { _id: null, total: { $sum: "$estimatedValue" } } },
                    ]),
                ])
                const salaryCost = emp.status === "ACTIVE" ? salary : 0
                const commission = empComm[0]?.total || 0
                const expenses = empExp[0]?.total || 0
                const revenue = empRev[0]?.total || 0
                const total = salaryCost + commission + expenses
                return {
                    _id: emp._id,
                    name: emp.fullName,
                    employeeCode: emp.employeeCode,
                    region: emp.region || "",
                    salary: salaryCost,
                    commission,
                    expenses,
                    revenue,
                    total,
                    roi: roi(revenue, total),
                }
            })
        )

        // ===== ROI by region (revenue by lead region vs cost of employees in region) =====
        const regionRevAgg = await Lead.aggregate([
            { $match: { ...revenueMatch, region: { $ne: "" } } },
            { $group: { _id: "$region", revenue: { $sum: "$estimatedValue" } } },
        ])
        const regionMap = {}
        employeeEarnings.forEach((e) => {
            const key = e.region || "Unassigned"
            if (!regionMap[key]) regionMap[key] = { region: key, revenue: 0, cost: 0 }
            regionMap[key].cost += e.total
        })
        regionRevAgg.forEach((r) => {
            const key = r._id || "Unassigned"
            if (!regionMap[key]) regionMap[key] = { region: key, revenue: 0, cost: 0 }
            regionMap[key].revenue += r.revenue
        })
        const roiByRegion = Object.values(regionMap)
            .map((r) => ({ ...r, roi: roi(r.revenue, r.cost) }))
            .sort((a, b) => b.revenue - a.revenue)

        // Convert every money figure from base to the display currency.
        const commissionsByStatusDisp = Object.fromEntries(
            Object.entries(commissionsByStatus).map(([k, v]) => [k, toDisp(v)])
        )
        const expensesByCategoryDisp = Object.fromEntries(
            Object.entries(expensesByCategory).map(([k, v]) => [k, toDisp(v)])
        )
        const employeeEarningsDisp = employeeEarnings.map((e) => ({
            ...e,
            salary: toDisp(e.salary),
            commission: toDisp(e.commission),
            expenses: toDisp(e.expenses),
            revenue: toDisp(e.revenue),
            total: toDisp(e.total),
        }))
        const roiByCampaignDisp = roiByCampaign.map((c) => ({
            ...c,
            budget: toDisp(c.budget),
            revenue: toDisp(c.revenue),
            cost: toDisp(c.cost),
        }))
        const roiByRegionDisp = roiByRegion.map((r) => ({
            ...r,
            revenue: toDisp(r.revenue),
            cost: toDisp(r.cost),
        }))

        res.json({
            success: true,
            currency: displayCurrency,
            data: {
                currency: displayCurrency,
                summary: {
                    totalSalaryCost: toDisp(totalSalaryCost),
                    totalCommissions: toDisp(totalCommissions),
                    totalExpenses: toDisp(totalExpenses),
                    totalCost: toDisp(totalCost),
                    totalRevenue: toDisp(totalRevenue),
                    netProfit: toDisp(totalRevenue - totalCost),
                    overallRoi: roi(totalRevenue, totalCost),
                    totalBudget: toDisp(totalBudget),
                    budgetVariance: toDisp(totalBudget - totalCost),
                    customerOnboarded,
                    partnerOnboarded,
                    costPerCustomer: customerOnboarded > 0 ? toDisp(totalCost / customerOnboarded) : 0,
                    costPerPartner: partnerOnboarded > 0 ? toDisp(totalCost / partnerOnboarded) : 0,
                    costPerOnboarding: totalOnboarded > 0 ? toDisp(totalCost / totalOnboarded) : 0,
                },
                commissionsByStatus: commissionsByStatusDisp,
                expensesByCategory: expensesByCategoryDisp,
                employeeEarnings: employeeEarningsDisp.sort((a, b) => b.total - a.total),
                roiByCampaign: roiByCampaignDisp.sort((a, b) => b.roi - a.roi),
                roiByEmployee: [...employeeEarningsDisp].sort((a, b) => b.roi - a.roi),
                roiByRegion: roiByRegionDisp,
            },
        })
    } catch (error) {
        console.error("[demand] getFinancialDashboard error:", error)
        res.status(500).json({ success: false, message: "Failed to build financial dashboard" })
    }
}
