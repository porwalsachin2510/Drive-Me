import Contract from "../models/Contract.js";
import CorporateBooking from "../models/CorporateBooking.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import VehicleAssignment from "../models/VehicleAssignment.js";
import mongoose from "mongoose";

// @desc    Get monthly billing report for a corporate
// @route   GET /api/corporate/billing-report
// @access  Private (CORPORATE only)
export const getBillingReport = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { month, year } = req.query;

        // Determine date range
        const now = new Date();
        const reportMonth = month ? parseInt(month) - 1 : now.getMonth();
        const reportYear = year ? parseInt(year) : now.getFullYear();

        const startDate = new Date(reportYear, reportMonth, 1);
        const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59);

        // Get active contracts for this corporate
        const contracts = await Contract.find({
            corporateOwnerId: corporateId,
            status: { $in: ["ACTIVE", "active", "Active"] }
        }).populate("fleetOwnerId", "fullName email companyName");

        // Get bookings in the date range
        const bookings = await CorporateBooking.find({
            corporateOwnerId: corporateId,
            travelDate: { $gte: startDate, $lte: endDate }
        }).populate("passengerId", "fullName email")
            .populate("routeId", "fromLocation toLocation");

        // Get total employees
        const totalEmployees = await CorporateEmployee.countDocuments({
            companyId: corporateId,
            isActive: true
        });

        // Aggregate booking stats
        const totalTrips = bookings.length;
        const completedTrips = bookings.filter(b => b.status === "COMPLETED").length;
        const cancelledTrips = bookings.filter(b => ["CANCELLED", "NO_SHOW"].includes(b.status)).length;
        const noShowTrips = bookings.filter(b => b.status === "NO_SHOW").length;

        // Calculate costs from contracts
        let totalMonthlyValue = 0;
        let totalBilled = 0;
        let totalPaid = 0;

        const contractBreakdown = contracts.map(contract => {
            const totalAmount = contract.financials?.totalAmount || 0;
            const monthlyAmount = contract.financials?.monthlyValue || totalAmount;
            const currency = contract.financials?.currency || "AED";

            totalMonthlyValue += monthlyAmount;
            totalBilled += totalAmount;

            // Calculate paid amount
            let paidAmount = 0;
            if (contract.financials?.advancePayment?.paidAt) {
                paidAmount += contract.financials.advancePayment.amount || 0;
            }
            if (contract.financials?.securityDeposit?.paidAt) {
                paidAmount += contract.financials.securityDeposit.amount || 0;
            }
            if (contract.financials?.finalPayment?.paidAt) {
                paidAmount += contract.financials.finalPayment.amount || 0;
            }
            totalPaid += paidAmount;

            // Get vehicle count
            let vehicleCount = 0;
            if (contract.vehicles && Array.isArray(contract.vehicles)) {
                vehicleCount = contract.vehicles.reduce((sum, v) => sum + (v.quantity || 1), 0);
            }

            // Determine payment status
            let paymentStatus = "Pending";
            if (paidAmount >= totalAmount) {
                paymentStatus = "Paid";
            } else if (paidAmount > 0) {
                paymentStatus = "Partial";
            }

            return {
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                fleetOwnerName: contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName || "N/A",
                startDate: contract.rentalPeriod?.startDate,
                endDate: contract.rentalPeriod?.endDate,
                monthlyAmount: monthlyAmount,
                currency: currency,
                vehicleCount: vehicleCount,
                paymentStatus: paymentStatus,
                status: contract.status
            };
        });

        // Per-route breakdown
        const routeBreakdown = {};
        bookings.forEach(b => {
            const routeKey = b.routeId?._id?.toString() || "unknown";
            if (!routeBreakdown[routeKey]) {
                routeBreakdown[routeKey] = {
                    routeId: routeKey,
                    routeName: b.routeId ? `${b.routeId.fromLocation} -> ${b.routeId.toLocation}` : "Unknown",
                    totalTrips: 0,
                    completed: 0,
                    cancelled: 0,
                    noShow: 0,
                    uniqueEmployees: new Set()
                };
            }
            routeBreakdown[routeKey].totalTrips++;
            if (b.status === "COMPLETED") routeBreakdown[routeKey].completed++;
            if (b.status === "CANCELLED") routeBreakdown[routeKey].cancelled++;
            if (b.status === "NO_SHOW") routeBreakdown[routeKey].noShow++;
            routeBreakdown[routeKey].uniqueEmployees.add(b.passengerId?._id?.toString());
        });

        const routeStats = Object.values(routeBreakdown).map(r => ({
            ...r,
            uniqueEmployees: r.uniqueEmployees.size
        }));

        res.status(200).json({
            success: true,
            data: {
                reportPeriod: {
                    month: reportMonth + 1,
                    year: reportYear,
                    startDate,
                    endDate
                },
                summary: {
                    totalBilled: totalBilled,
                    totalPaid: totalPaid,
                    outstanding: totalBilled - totalPaid,
                    activeContracts: contracts.length,
                    currency: contracts.length > 0 ? (contracts[0].financials?.currency || "AED") : "AED",
                    totalMonthlyValue,
                    totalEmployees,
                    totalTrips,
                    completedTrips,
                    cancelledTrips,
                    noShowTrips,
                    utilizationRate: totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(1) : 0
                },
                contractBreakdown,
                routeStats,
                recentBookings: bookings.slice(0, 20).map(b => ({
                    _id: b._id,
                    employee: b.passengerId?.fullName,
                    route: b.routeId ? `${b.routeId.fromLocation} -> ${b.routeId.toLocation}` : "N/A",
                    date: b.travelDate,
                    status: b.status
                }))
            }
        });

    } catch (error) {
        console.error("Error generating billing report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate billing report",
            error: error.message
        });
    }
};

// @desc    Get invoices list for corporate
// @route   GET /api/corporate/invoices
// @access  Private (CORPORATE only)
export const getInvoices = async (req, res) => {
    try {
        const corporateId = req.userId;

        // Get all active/completed contracts for this corporate
        const contracts = await Contract.find({
            corporateOwnerId: corporateId,
        }).populate("fleetOwnerId", "fullName companyName email");

        // Generate invoice-like data from contracts and their payment history
        const invoices = [];
        for (const contract of contracts) {
            if (contract.paymentHistory && contract.paymentHistory.length > 0) {
                contract.paymentHistory.forEach((payment, idx) => {
                    invoices.push({
                        _id: `${contract._id}-${idx}`,
                        invoiceNumber: `INV-${contract.contractNumber || contract._id.toString().slice(-6)}-${idx + 1}`,
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        fleetOwner: contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName,
                        amount: payment.amount,
                        currency: contract.financials?.currency || "AED",
                        createdAt: payment.paidDate || payment.createdAt,
                        date: payment.paidDate || payment.createdAt,
                        status: payment.status || "PAID",
                        method: payment.method || "Online",
                        transactionId: payment.transactionId
                    });
                });
            } else {
                // Generate invoices based on contract financials
                const totalAmount = contract.financials?.totalAmount || 0;
                const duration = contract.rentalPeriod?.duration || 1;
                const monthlyValue = totalAmount > 0 ? Math.round((totalAmount / Math.max(duration, 1)) * 100) / 100 : 0;
                const invoiceAmount = monthlyValue || totalAmount;

                // Compute billing period
                const startDate = contract.rentalPeriod?.startDate;
                const endDate = contract.rentalPeriod?.endDate;
                let billingPeriod = '';
                if (startDate && endDate) {
                    const startStr = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const endStr = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    billingPeriod = `${startStr} - ${endStr}`;
                }

                if (invoiceAmount > 0) {
                    invoices.push({
                        _id: `${contract._id}-monthly`,
                        invoiceNumber: `INV-${contract.contractNumber || contract._id.toString().slice(-6)}-M`,
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        fleetOwner: contract.fleetOwnerId?.companyName || contract.fleetOwnerId?.fullName,
                        amount: invoiceAmount,
                        currency: contract.financials?.currency || "AED",
                        billingPeriod: billingPeriod,
                        createdAt: contract.createdAt || new Date(),
                        date: contract.createdAt || new Date(),
                        status: contract.status === "ACTIVE" ? "PENDING" : "DRAFT",
                        method: "N/A"
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                invoices: invoices.sort((a, b) => new Date(b.date) - new Date(a.date)),
                total: invoices.length
            }
        });

    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch invoices",
            error: error.message
        });
    }
};

// @desc    Get B2B Partner invoices (invoices to send to corporate clients)
// @route   GET /api/b2b-partner/invoices
// @access  Private (B2B_PARTNER only)
export const getB2BPartnerInvoices = async (req, res) => {
    try {
        const partnerId = req.userId;

        // Get contracts where this partner is the fleet owner
        const contracts = await Contract.find({
            fleetOwnerId: partnerId,
        }).populate("corporateOwnerId", "fullName companyName email");

        const invoices = [];
        for (const contract of contracts) {
            const totalAmount = contract.financials?.totalAmount || 0;
            const duration = contract.rentalPeriod?.duration || 1;
            const monthlyValue = totalAmount > 0 ? Math.round((totalAmount / Math.max(duration, 1)) * 100) / 100 : 0;
            const currency = contract.financials?.currency || 'KWD';
            const corporateName = contract.corporateOwnerId?.companyName || contract.corporateOwnerId?.fullName || 'N/A';

            // Compute billing period from rentalPeriod
            const contractStart = contract.rentalPeriod?.startDate || contract.createdAt;
            const contractEnd = contract.rentalPeriod?.endDate;
            let contractPeriodStr = '';
            if (contractStart && contractEnd) {
                const startStr = new Date(contractStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = new Date(contractEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                contractPeriodStr = `${startStr} - ${endStr}`;
            }

            // Generate invoices from installments
            if (contract.financials?.installments && contract.financials.installments.length > 0) {
                contract.financials.installments.forEach((installment, idx) => {
                    const dueDate = installment.dueDate || contract.createdAt;
                    const dueMonth = dueDate ? new Date(dueDate) : new Date();
                    const billingPeriod = `${dueMonth.toLocaleString('default', { month: 'short' })} ${dueMonth.getFullYear()}`;
                    
                    invoices.push({
                        _id: `${contract._id}-inst-${idx}`,
                        invoiceNumber: `B2B-INV-${contract.contractNumber || contract._id.toString().slice(-6)}-${idx + 1}`,
                        contractId: contract._id,
                        contractNumber: contract.contractNumber,
                        client: corporateName,
                        corporateName: corporateName,
                        amount: installment.amount || monthlyValue,
                        currency: currency,
                        billingPeriod: billingPeriod,
                        date: installment.paidAt || dueDate,
                        createdAt: installment.paidAt || dueDate,
                        status: installment.status || "PENDING",
                        method: "Online",
                    });
                });
            }

            // Current month invoice
            const now = new Date();
            const currentBillingPeriod = contractPeriodStr || `${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
            
            invoices.push({
                _id: `${contract._id}-current`,
                invoiceNumber: `B2B-INV-${contract.contractNumber || contract._id.toString().slice(-6)}-CUR`,
                contractId: contract._id,
                contractNumber: contract.contractNumber,
                client: corporateName,
                corporateName: corporateName,
                amount: monthlyValue || totalAmount,
                currency: currency,
                billingPeriod: currentBillingPeriod,
                date: now,
                createdAt: now,
                status: contract.status === "ACTIVE" ? "PENDING" : "DRAFT"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                invoices: invoices.sort((a, b) => new Date(b.date) - new Date(a.date)),
                total: invoices.length
            }
        });

    } catch (error) {
        console.error("Error fetching B2B partner invoices:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch invoices",
            error: error.message
        });
    }
};
