import api from "../utils/api"

/**
 * Managed-service SLA & operation-based billing API.
 * Endpoints are shared by the corporate owner and the operating B2B partner;
 * the backend resolves access per request. When a partner acts on behalf of a
 * corporate, the "x-onbehalf-contract" header is set separately — but these
 * endpoints authorize the partner directly as the contract's fleet owner, so
 * they work from either surface.
 */

const base = (contractId) => `/managed-service/${contractId}`

// --- SLA ---
export const getSlaConfig = (contractId) => api.get(`${base(contractId)}/sla`)

export const updateSlaConfig = (contractId, payload) =>
    api.put(`${base(contractId)}/sla`, payload)

export const getSlaPerformance = (contractId, { month, year } = {}) =>
    api.get(`${base(contractId)}/sla/performance`, { params: { month, year } })

// --- Complaints ---
export const listComplaints = (contractId, status) =>
    api.get(`${base(contractId)}/complaints`, { params: status ? { status } : {} })

export const createComplaint = (contractId, payload) =>
    api.post(`${base(contractId)}/complaints`, payload)

export const updateComplaint = (contractId, complaintId, payload) =>
    api.patch(`${base(contractId)}/complaints/${complaintId}`, payload)

// --- Operation-based billing ---
export const getBillingConfig = (contractId) =>
    api.get(`${base(contractId)}/billing/config`)

export const updateBillingConfig = (contractId, payload) =>
    api.put(`${base(contractId)}/billing/config`, payload)

export const previewOperationalInvoice = (contractId, { month, year } = {}) =>
    api.get(`${base(contractId)}/billing/preview`, { params: { month, year } })

export const generateOperationalInvoice = (contractId, { month, year } = {}) =>
    api.post(`${base(contractId)}/billing/generate`, { month, year })

export const listOperationalInvoices = (contractId) =>
    api.get(`${base(contractId)}/billing/invoices`)

export default {
    getSlaConfig,
    updateSlaConfig,
    getSlaPerformance,
    listComplaints,
    createComplaint,
    updateComplaint,
    getBillingConfig,
    updateBillingConfig,
    previewOperationalInvoice,
    generateOperationalInvoice,
    listOperationalInvoices,
}
