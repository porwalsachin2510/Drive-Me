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

// Corporate: start payment for a generated operational invoice. CARD/WALLET
// returns a gateway paymentSession to redirect to; CASH/BANK_TRANSFER records a
// manual payment the partner must then confirm.
export const payOperationalInvoice = (contractId, invoiceId, paymentMethod) =>
    api.post(`${base(contractId)}/billing/invoices/${invoiceId}/pay`, { paymentMethod })

// Partner: confirm a cash/bank-transfer payment was received, settling the invoice.
export const confirmOperationalInvoicePayment = (contractId, invoiceId) =>
    api.patch(`${base(contractId)}/billing/invoices/${invoiceId}/confirm-payment`)

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
    payOperationalInvoice,
    confirmOperationalInvoicePayment,
}
