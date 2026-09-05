import mongoose from "mongoose"

/**
 * ManagedServiceBrief
 * -------------------
 * The operational specification a CORPORATE gives to its B2B_PARTNER on a
 * MANAGED-service contract. In MANAGED mode the partner runs all operations
 * (routes, schedules, employees, passes, trips) on the corporate's behalf, but
 * without a brief the partner has no way to know WHAT the corporate needs:
 *   - which work locations & shift timings exist
 *   - which routes / pickup coverage are required
 *   - who the employees are, their pickup addresses and pass durations
 *   - which employee should ideally go on which route/trip
 *
 * This model captures that brief so the partner can execute against it using the
 * existing on-behalf operations tools, and mark each item fulfilled as they go.
 * There is exactly one brief per contract.
 */

const fulfillmentSchema = {
    status: {
        type: String,
        enum: ["PENDING", "IN_PROGRESS", "FULFILLED"],
        default: "PENDING",
    },
    // Reference to the entity the partner created to satisfy this item
    // (e.g. the created route id, or the corporate employee id).
    linkedEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    // What kind of entity linkedEntityId points to, so the corporate UI can
    // deep-link / label it correctly (e.g. "ROUTE", "EMPLOYEE", "SCHEDULE").
    linkedEntityType: { type: String, default: null },
    fulfilledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    fulfilledByName: { type: String, default: null },
    fulfilledAt: { type: Date, default: null },
    note: { type: String, default: "" },

    // --- Corporate approval loop (real-world two-way handshake) ---
    // After the partner marks an item FULFILLED, the corporate reviews it and
    // either APPROVES (accepts the work) or REJECTS (sends it back for rework).
    // PENDING_REVIEW is the implicit state right after FULFILLED.
    approvalStatus: {
        type: String,
        enum: ["NONE", "PENDING_REVIEW", "APPROVED", "REJECTED"],
        default: "NONE",
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
}

// A geocoded / map-pinned point. Used for work locations (office point) and
// roster employees (home pickup point) so the partner can do route optimization
// and driver navigation. Coordinates come from Nominatim geocoding or from the
// corporate dragging the marker on the map (free OpenStreetMap + Leaflet stack).
const geoPointSchema = {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    // The human-readable address the coordinates resolved to (or that was typed).
    formattedAddress: { type: String, default: "" },
    // How the coordinates were set: GEOCODED (from address search), PINNED
    // (marker dragged on map), or NONE (not set yet).
    source: {
        type: String,
        enum: ["NONE", "GEOCODED", "PINNED"],
        default: "NONE",
    },
    updatedAt: { type: Date, default: null },
}

const workLocationSchema = new mongoose.Schema(
    {
        name: { type: String, required: true }, // e.g. "HQ - Tower B"
        address: { type: String, default: "" },
        city: { type: String, default: "" },
        // Map-pinned office coordinates (drop-off / destination point).
        location: geoPointSchema,
        // Free-form shift definitions for this location
        shifts: [
            {
                label: { type: String, default: "" }, // e.g. "General", "Night"
                loginTime: { type: String, default: "" }, // "09:00"
                logoutTime: { type: String, default: "" }, // "18:00"
                workingDays: [{ type: String }], // ["MON","TUE",...]
            },
        ],
    },
    { _id: true },
)

const routeRequestSchema = new mongoose.Schema(
    {
        label: { type: String, required: true }, // e.g. "Whitefield -> HQ Morning"
        fromArea: { type: String, default: "" },
        toWorkLocation: { type: String, default: "" }, // matches a work location name
        direction: {
            type: String,
            enum: ["PICKUP", "DROP", "BOTH"],
            default: "BOTH",
        },
        stops: [{ type: String }], // ordered stop/landmark names
        operatingDays: [{ type: String }],
        pickupWindowStart: { type: String, default: "" }, // "07:30"
        pickupWindowEnd: { type: String, default: "" }, // "08:15"
        headcount: { type: Number, default: 0 }, // expected employees on this route
        preferredVehicleType: { type: String, default: "" },
        notes: { type: String, default: "" },
        fulfillment: fulfillmentSchema,
    },
    { _id: true },
)

const rosterEmployeeSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        employeeCode: { type: String, default: "" },
        department: { type: String, default: "" },
        designation: { type: String, default: "" },
        homeAddress: { type: String, default: "" },
        pickupArea: { type: String, default: "" },
        // Map-pinned home pickup point for this employee (origin for route
        // optimization & driver navigation). UAE/Kuwait addresses are often
        // building/zone based, so an exact map pin matters more than free text.
        pickupPoint: geoPointSchema,
        workLocation: { type: String, default: "" }, // matches a work location name
        shiftLabel: { type: String, default: "" },
        // Requested monthly pass duration in months
        passMonths: { type: Number, default: 1, min: 0 },
        // Optional day the pass (and its generated trips) should start on. When
        // absent, the brief's serviceStartDate is used at import time. Mirrors the
        // manual "Add Employee" form's Pass Start Date.
        passStartDate: { type: Date, default: null },
        // Corporate's hint about which route/trip this employee should ride
        preferredRouteLabel: { type: String, default: "" },
        assignmentHint: { type: String, default: "" }, // free-form trip/assignment note
        fulfillment: fulfillmentSchema,
    },
    { _id: true },
)

const messageSchema = new mongoose.Schema(
    {
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        senderName: { type: String, default: "" },
        senderRole: { type: String, enum: ["CORPORATE", "B2B_PARTNER"] },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true },
)

// An uploaded requirement document the customer attaches to the brief. Since
// every customer prepares its transportation requirement differently, we do NOT
// enforce a template: the customer uploads whatever they have (Excel, PDF, Word,
// CSV, image, etc.) and it stays attached to the request for future reference.
// Revised versions are appended (version increments) so the full history is kept.
const briefDocumentSchema = new mongoose.Schema(
    {
        fileName: { type: String, default: "" },
        url: { type: String, required: true }, // Cloudinary secure URL
        publicId: { type: String, default: "" }, // Cloudinary public_id (for deletion)
        fileType: { type: String, default: "" }, // MIME type
        fileSize: { type: Number, default: 0 }, // bytes
        // Revision tracking: the first upload of a document is version 1; a
        // re-uploaded/updated file bumps the version so history is preserved.
        version: { type: Number, default: 1 },
        uploadedById: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        uploadedByName: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: true },
)

const managedServiceBriefSchema = new mongoose.Schema(
    {
        // The brief is created at QUOTATION-request time for a MANAGED quotation,
        // so the corporate can hand its operational requirements (routes, work
        // locations & shifts, employee roster) to the B2B partner BEFORE the
        // partner prices/agrees. It later travels onto the resulting contract:
        // when a contract is created from the quotation we stamp `contractId`
        // here so the same brief drives the contract-stage fulfilment loop.
        //
        // Therefore BOTH ids are optional individually but a brief always has a
        // quotationId (quote stage) and gains a contractId once contracted.
        // Sparse unique indexes guarantee one brief per quotation / per contract
        // without clashing on the null values that exist before contracting.
        quotationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotation",
            default: null,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
            default: null,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        b2bPartnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        status: {
            type: String,
            // DRAFT      -> corporate is still editing, partner shouldn't act yet
            // SUBMITTED  -> handed to partner, awaiting partner acknowledgement
            // ACCEPTED   -> partner reviewed & accepted the brief; execution may begin
            // IN_PROGRESS-> partner is actively fulfilling items
            // COMPLETED  -> all items fulfilled / corporate marked done
            enum: ["DRAFT", "SUBMITTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"],
            default: "DRAFT",
        },
        // --- Partner acknowledgement handshake (real-world approval loop) ---
        // After the corporate SUBMITs a brief, the partner must explicitly ACCEPT
        // it (agreeing to operate against it) or request CLARIFICATION (sending it
        // back to the corporate with questions) before execution starts. This
        // prevents the partner silently starting work on an ambiguous brief.
        partnerResponse: {
            status: {
                type: String,
                enum: ["NONE", "ACCEPTED", "CLARIFICATION_REQUESTED"],
                default: "NONE",
            },
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
            respondedByName: { type: String, default: null },
            respondedAt: { type: Date, default: null },
            note: { type: String, default: "" },
        },
        // High level summary / objectives the corporate wants
        summary: { type: String, default: "" },
        // Free-form comments / special requirements the customer wants to add.
        // The detailed requirement itself lives in the uploaded documents; this
        // is just extra context that doesn't belong in a file.
        comments: { type: String, default: "" },
        // Uploaded requirement documents (Excel, PDF, Word, CSV, images, etc.).
        // These stay attached to the request for future reference; revised
        // versions are appended so history is preserved.
        documents: [briefDocumentSchema],
        serviceStartDate: { type: Date, default: null },
        // SLA / service-level expectations the partner commits to. Used to compute
        // on-time %, overdue items, and completion health on the dashboard.
        sla: {
            // Target date by which the whole brief should be fully operational.
            targetCompletionDate: { type: Date, default: null },
            // Max hours the partner should take to fulfil each item after submit.
            fulfillmentSlaHours: { type: Number, default: 72 },
        },
        pointOfContact: {
            name: { type: String, default: "" },
            phone: { type: String, default: "" },
            email: { type: String, default: "" },
        },
        workLocations: [workLocationSchema],
        routeRequests: [routeRequestSchema],
        employeeRoster: [rosterEmployeeSchema],
        messages: [messageSchema],
        submittedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true },
)

// One brief per quotation and one brief per contract.
//
// IMPORTANT: we use PARTIAL (not sparse) unique indexes. Both ids default to
// `null` at quote-request stage, and a sparse index only ignores documents
// where the field is ABSENT — not where it is explicitly `null`. That made the
// first null-contract brief insert fine while every subsequent one collided
// with `E11000 dup key { contractId: null }`. A partial index that only covers
// documents whose id is a real ObjectId lets unlimited quote-stage briefs
// (id === null) coexist while still enforcing one brief per real quotation /
// contract.
managedServiceBriefSchema.index(
    { quotationId: 1 },
    {
        unique: true,
        partialFilterExpression: { quotationId: { $type: "objectId" } },
    },
)
managedServiceBriefSchema.index(
    { contractId: 1 },
    {
        unique: true,
        partialFilterExpression: { contractId: { $type: "objectId" } },
    },
)
managedServiceBriefSchema.index({ corporateOwnerId: 1 })
managedServiceBriefSchema.index({ b2bPartnerId: 1 })

const ManagedServiceBrief =
    mongoose.models.ManagedServiceBrief ||
    mongoose.model("ManagedServiceBrief", managedServiceBriefSchema)

export default ManagedServiceBrief
