import SOSAlert from "../models/SOSAlert.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import Contract from "../models/Contract.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import { createNotification, sendRealTimeNotification, sendAdminNotification } from "../Services/notificationService.js";
import { broadcastSOSAlert } from "../Services/socketService.js";

// @desc    Raise an SOS / safety alert (employee or driver, during a managed trip)
// @route   POST /api/sos
// @access  Private
export const raiseSOS = async (req, res) => {
    try {
        const userId = req.userId;
        const { tripId, emergencyType = "SOS", message, location, address } = req.body;
        // Accept either a nested { location: { lat, lng } } or top-level lat/lng
        const lat = location?.lat ?? req.body.lat;
        const lng = location?.lng ?? req.body.lng;

        const user = await User.findById(userId).select("fullName phone whatsappNumber role");
        const employee = await CorporateEmployee.findOne({ userId });

        // Resolve the managed-service context (contract / corporate owner / partner)
        let contractId = null;
        let companyId = null;
        let b2bPartnerId = null;
        let resolvedTripId = null;

        if (tripId) {
            const trip = await Trip.findById(tripId).select("contractId corporateId b2bPartnerId");
            if (trip) {
                resolvedTripId = trip._id;
                contractId = trip.contractId || null;
                companyId = trip.corporateId || null;
                b2bPartnerId = trip.b2bPartnerId || null;
            }
        }

        // Fall back to the employee's managed contract if trip context was missing
        if (!companyId && employee) {
            companyId = employee.companyId;
        }
        if ((!contractId || !b2bPartnerId) && companyId) {
            const contract = await Contract.findOne({
                corporateOwnerId: companyId,
                serviceMode: "MANAGED",
            })
                .sort({ createdAt: -1 })
                .select("_id fleetOwnerId corporateOwnerId");
            if (contract) {
                contractId = contractId || contract._id;
                b2bPartnerId = b2bPartnerId || contract.fleetOwnerId;
            }
        }

        const raisedByName = user?.fullName || "Employee";
        const raisedByPhone = user?.phone || user?.whatsappNumber || null;

        const alert = new SOSAlert({
            raisedByUserId: userId,
            raisedByRole: req.userRole || user?.role,
            raisedByName,
            raisedByPhone,
            employeeId: employee?._id,
            tripId: resolvedTripId,
            contractId,
            companyId,
            b2bPartnerId,
            emergencyType,
            message,
            location: (lat != null && lng != null) ? { lat, lng, address } : undefined,
            status: "ACTIVE",
            notifiedContacts: (employee?.emergencyContacts || []).map((c) => ({
                name: c.name,
                relationship: c.relationship,
                phoneNumber: c.phoneNumber,
            })),
            timeline: [
                {
                    action: "RAISED",
                    by: userId,
                    byName: raisedByName,
                    byRole: req.userRole,
                    note: message || `${emergencyType} alert raised`,
                    at: new Date(),
                },
            ],
        });

        await alert.save();

        // Persistent + real-time notifications to corporate owner and partner
        const notifyTargets = [
            { id: companyId, label: "corporate" },
            { id: b2bPartnerId, label: "partner" },
        ];
        for (const t of notifyTargets) {
            if (!t.id) continue;
            const notif = await createNotification({
                userId: t.id,
                type: "SOS_ALERT",
                title: `SOS Alert - ${emergencyType}`,
                message: `${raisedByName} raised an SOS (${emergencyType})${message ? `: ${message}` : ""}.`,
                metadata: {
                    alertId: alert._id,
                    alertNumber: alert.alertNumber,
                    tripId: resolvedTripId,
                    contractId,
                    location: alert.location,
                },
            });
            sendRealTimeNotification(t.id.toString(), notif);
        }

        // Alert all admins as well
        await sendAdminNotification(
            `SOS Alert - ${emergencyType}`,
            `${raisedByName} raised an SOS (${emergencyType}). Alert ${alert.alertNumber}.`,
            "SOS_ALERT",
            { alertId: alert._id, alertNumber: alert.alertNumber, tripId: resolvedTripId, contractId },
        );

        // Instant socket fan-out for open ops boards
        broadcastSOSAlert(
            {
                ...alert.toObject(),
                raisedByName,
                raisedByRole: req.userRole,
            },
            {
                corporateOwnerId: companyId,
                b2bPartnerId,
                raisedByUserId: userId,
                event: "SOS_RAISED",
            },
        );

        res.status(201).json({
            success: true,
            message: "SOS alert raised. Help is being notified.",
            data: { alert },
        });
    } catch (error) {
        console.error("Error raising SOS:", error);
        res.status(500).json({ success: false, message: "Failed to raise SOS alert" });
    }
};

// @desc    Get the SOS alerts raised by the current user
// @route   GET /api/sos/my-alerts
// @access  Private
export const getMyAlerts = async (req, res) => {
    try {
        const alerts = await SOSAlert.find({ raisedByUserId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ success: true, data: { alerts } });
    } catch (error) {
        console.error("Error fetching my SOS alerts:", error);
        res.status(500).json({ success: false, message: "Failed to fetch SOS alerts" });
    }
};

// @desc    Get the current user's still-open SOS alert (if any)
// @route   GET /api/sos/my-active
// @access  Private
export const getMyActiveAlert = async (req, res) => {
    try {
        const alert = await SOSAlert.findOne({
            raisedByUserId: req.userId,
            status: { $in: ["ACTIVE", "ACKNOWLEDGED"] },
        }).sort({ createdAt: -1 });
        res.json({ success: true, data: { alert: alert || null } });
    } catch (error) {
        console.error("Error fetching active SOS alert:", error);
        res.status(500).json({ success: false, message: "Failed to fetch active alert" });
    }
};

// @desc    Get SOS alerts visible to a corporate owner / B2B partner / admin
// @route   GET /api/sos
// @access  Private (corporate / partner / admin)
export const getAlerts = async (req, res) => {
    try {
        const { status, contractId } = req.query;
        const uid = req.userId;

        const query = {};
        if (req.userRole === "ADMIN") {
            // admins see everything
        } else {
            // Corporate owners see their company's alerts; partners see theirs.
            query.$or = [{ companyId: uid }, { b2bPartnerId: uid }];
        }
        if (status) query.status = status;
        if (contractId) query.contractId = contractId;

        const alerts = await SOSAlert.find(query)
            .populate("raisedByUserId", "fullName phone")
            .populate("employeeId", "employeeId personalInfo")
            .sort({ status: 1, createdAt: -1 })
            .limit(200);

        const summary = {
            active: await SOSAlert.countDocuments({ ...query, status: "ACTIVE" }),
            acknowledged: await SOSAlert.countDocuments({ ...query, status: "ACKNOWLEDGED" }),
            resolvedToday: await SOSAlert.countDocuments({
                ...query,
                status: "RESOLVED",
                resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
        };

        res.json({ success: true, data: { alerts, summary } });
    } catch (error) {
        console.error("Error fetching SOS alerts:", error);
        res.status(500).json({ success: false, message: "Failed to fetch SOS alerts" });
    }
};

// Helper: authorize a responder (corporate owner, partner, or admin) on an alert
const canRespond = (alert, req) => {
    if (req.userRole === "ADMIN") return true;
    const uid = req.userId.toString();
    return alert.companyId?.toString() === uid || alert.b2bPartnerId?.toString() === uid;
};

// @desc    Acknowledge an SOS alert
// @route   PATCH /api/sos/:alertId/acknowledge
// @access  Private (corporate / partner / admin)
export const acknowledgeSOS = async (req, res) => {
    try {
        const alert = await SOSAlert.findById(req.params.alertId);
        if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
        if (!canRespond(alert, req)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (alert.status !== "ACTIVE") {
            return res.status(400).json({ success: false, message: `Alert already ${alert.status.toLowerCase()}` });
        }

        const responder = await User.findById(req.userId).select("fullName");
        alert.status = "ACKNOWLEDGED";
        alert.acknowledgedBy = req.userId;
        alert.acknowledgedByName = responder?.fullName;
        alert.acknowledgedAt = new Date();
        alert.timeline.push({
            action: "ACKNOWLEDGED",
            by: req.userId,
            byName: responder?.fullName,
            byRole: req.userRole,
            note: req.body?.note || "Alert acknowledged - response in progress",
            at: new Date(),
        });
        await alert.save();

        // Tell the person who raised it that help is responding
        const notif = await createNotification({
            userId: alert.raisedByUserId,
            type: "SOS_ALERT",
            title: "Help is on the way",
            message: `Your SOS alert ${alert.alertNumber} has been acknowledged.`,
            metadata: { alertId: alert._id, alertNumber: alert.alertNumber },
        });
        sendRealTimeNotification(alert.raisedByUserId.toString(), notif);

        broadcastSOSAlert(
            { ...alert.toObject() },
            {
                corporateOwnerId: alert.companyId,
                b2bPartnerId: alert.b2bPartnerId,
                raisedByUserId: alert.raisedByUserId,
                event: "SOS_ACKNOWLEDGED",
            },
        );

        res.json({ success: true, message: "Alert acknowledged", data: { alert } });
    } catch (error) {
        console.error("Error acknowledging SOS:", error);
        res.status(500).json({ success: false, message: "Failed to acknowledge alert" });
    }
};

// @desc    Resolve an SOS alert
// @route   PATCH /api/sos/:alertId/resolve
// @access  Private (corporate / partner / admin)
export const resolveSOS = async (req, res) => {
    try {
        const alert = await SOSAlert.findById(req.params.alertId);
        if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
        if (!canRespond(alert, req)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (alert.status === "RESOLVED" || alert.status === "CANCELLED") {
            return res.status(400).json({ success: false, message: `Alert already ${alert.status.toLowerCase()}` });
        }

        const responder = await User.findById(req.userId).select("fullName");
        alert.status = "RESOLVED";
        alert.resolvedBy = req.userId;
        alert.resolvedByName = responder?.fullName;
        alert.resolvedAt = new Date();
        alert.resolutionNotes = req.body?.resolutionNotes || req.body?.note || "Resolved";
        alert.timeline.push({
            action: "RESOLVED",
            by: req.userId,
            byName: responder?.fullName,
            byRole: req.userRole,
            note: alert.resolutionNotes,
            at: new Date(),
        });
        await alert.save();

        const notif = await createNotification({
            userId: alert.raisedByUserId,
            type: "SOS_ALERT",
            title: "SOS Resolved",
            message: `Your SOS alert ${alert.alertNumber} has been marked resolved.`,
            metadata: { alertId: alert._id, alertNumber: alert.alertNumber },
        });
        sendRealTimeNotification(alert.raisedByUserId.toString(), notif);

        broadcastSOSAlert(
            { ...alert.toObject() },
            {
                corporateOwnerId: alert.companyId,
                b2bPartnerId: alert.b2bPartnerId,
                raisedByUserId: alert.raisedByUserId,
                event: "SOS_RESOLVED",
            },
        );

        res.json({ success: true, message: "Alert resolved", data: { alert } });
    } catch (error) {
        console.error("Error resolving SOS:", error);
        res.status(500).json({ success: false, message: "Failed to resolve alert" });
    }
};

// @desc    Cancel an SOS alert (only the person who raised it, if false alarm)
// @route   PATCH /api/sos/:alertId/cancel
// @access  Private (raiser)
export const cancelSOS = async (req, res) => {
    try {
        const alert = await SOSAlert.findById(req.params.alertId);
        if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
        if (alert.raisedByUserId.toString() !== req.userId.toString()) {
            return res.status(403).json({ success: false, message: "Only the person who raised it can cancel" });
        }
        if (alert.status === "RESOLVED" || alert.status === "CANCELLED") {
            return res.status(400).json({ success: false, message: `Alert already ${alert.status.toLowerCase()}` });
        }

        alert.status = "CANCELLED";
        alert.timeline.push({
            action: "CANCELLED",
            by: req.userId,
            byName: alert.raisedByName,
            byRole: req.userRole,
            note: req.body?.note || "Cancelled by employee (false alarm)",
            at: new Date(),
        });
        await alert.save();

        broadcastSOSAlert(
            { ...alert.toObject() },
            {
                corporateOwnerId: alert.companyId,
                b2bPartnerId: alert.b2bPartnerId,
                raisedByUserId: alert.raisedByUserId,
                event: "SOS_CANCELLED",
            },
        );

        res.json({ success: true, message: "Alert cancelled", data: { alert } });
    } catch (error) {
        console.error("Error cancelling SOS:", error);
        res.status(500).json({ success: false, message: "Failed to cancel alert" });
    }
};
