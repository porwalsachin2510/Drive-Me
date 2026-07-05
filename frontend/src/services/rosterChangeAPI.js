import api from "../utils/api"

/**
 * Roster change-request API for MANAGED-service contracts.
 *
 * The corporate client raises structured changes (add / remove / modify an
 * employee or a route) and the operating B2B partner drives them through a
 * status pipeline. On completion the backend applies the change to the live
 * ManagedServiceBrief roster / routes.
 *
 * Endpoints are shared by both roles; the backend resolves access per request
 * (corporate owner vs contract fleet owner), so the same calls work from the
 * corporate contract view and the partner managed-operations surface.
 */

const base = (contractId) => `/roster-change-requests/${contractId}`

// Roster / route items that MODIFY_* / REMOVE_* requests can target.
export const getRosterTargets = (contractId) => api.get(`${base(contractId)}/targets`)

// List all change requests for a contract (+ summary + viewerRole).
export const listRosterChangeRequests = (contractId, { status, type } = {}) =>
    api.get(base(contractId), { params: { status, type } })

// Corporate raises a new change request.
export const createRosterChangeRequest = (contractId, payload) =>
    api.post(base(contractId), payload)

// Drive the workflow: partner (acknowledge / progress / complete / reject) or
// corporate (cancel). payload = { status, note }.
export const updateRosterChangeStatus = (contractId, requestId, payload) =>
    api.patch(`${base(contractId)}/${requestId}/status`, payload)

// Either party posts a comment on a request.
export const addRosterChangeComment = (contractId, requestId, note) =>
    api.post(`${base(contractId)}/${requestId}/comment`, { note })

export default {
    getRosterTargets,
    listRosterChangeRequests,
    createRosterChangeRequest,
    updateRosterChangeStatus,
    addRosterChangeComment,
}
