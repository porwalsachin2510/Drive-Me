import api from "../utils/api"

/**
 * Extra Service Day request API for MANAGED-service contracts.
 *
 * A school customer (or any managed-contract client) requests the fleet for
 * extra days beyond the recurring contract schedule — a Sunday picnic, an event
 * trip, etc. The operating partner reviews each request and either approves it
 * with a charge (billed as a SEPARATE one-off invoice or ADDED to the contract
 * payment) or rejects it.
 *
 * Endpoints are shared by both roles; the backend resolves access per request
 * (contract corporate owner vs contract fleet owner), so the same calls work
 * from the customer contract view and the partner managed-operations surface.
 */

// List requests for a specific contract (both sides). Returns { data, viewerSide }.
export const listExtraServiceRequests = (contractId) =>
    api.get(`/extra-service-requests/${contractId}`)

// List all of my extra service requests across contracts.
export const listMyExtraServiceRequests = ({ status } = {}) =>
    api.get(`/extra-service-requests/mine/all`, { params: { status } })

// Customer raises a new extra-service-day request for a contract.
export const createExtraServiceRequest = (contractId, payload) =>
    api.post(`/extra-service-requests/${contractId}`, payload)

// Partner responds to a request.
// payload = { decision: "APPROVE" | "REJECT", charge, billingMode: "SEPARATE" | "ADD_TO_CONTRACT", partnerResponseNote }
export const respondToExtraServiceRequest = (requestId, payload) =>
    api.patch(`/extra-service-requests/item/${requestId}/respond`, payload)

// Customer cancels a still-pending request.
export const cancelExtraServiceRequest = (requestId) =>
    api.patch(`/extra-service-requests/item/${requestId}/cancel`)

// Partner: list the vehicles + drivers assignable to this contract.
export const listAssignableFleet = (contractId) =>
    api.get(`/extra-service-requests/${contractId}/fleet`)

// Partner assigns a vehicle + driver per date (creates the operational trips).
// payload = { assignments: [{ serviceDate, vehicleId, driverId }] }
export const assignExtraServiceResources = (requestId, payload) =>
    api.patch(`/extra-service-requests/item/${requestId}/assign`, payload)

// Customer starts payment for a SEPARATE extra-service charge with a chosen
// method. CARD/WALLET return a gateway paymentSession.paymentUrl to redirect to;
// BANK_TRANSFER/CASH return a manual submission awaiting partner confirmation.
// paymentMethod = "CARD" | "WALLET" | "BANK_TRANSFER" | "CASH"
export const payExtraServiceRequest = (requestId, paymentMethod) =>
    api.post(`/extra-service-requests/item/${requestId}/pay`, { paymentMethod })

// Partner confirms receipt of a manual (cash/bank) extra-service payment.
export const confirmExtraServiceRequestPayment = (requestId) =>
    api.patch(`/extra-service-requests/item/${requestId}/confirm-payment`)

export default {
    listExtraServiceRequests,
    listMyExtraServiceRequests,
    createExtraServiceRequest,
    respondToExtraServiceRequest,
    cancelExtraServiceRequest,
    listAssignableFleet,
    assignExtraServiceResources,
    payExtraServiceRequest,
    confirmExtraServiceRequestPayment,
}
