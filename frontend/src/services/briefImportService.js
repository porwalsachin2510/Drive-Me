import api from "../utils/api"

/**
 * briefImportService
 * ------------------
 * Single client for the managed-service "import from the brief" flows.
 *
 * A managed-service brief is never one route or one person: the customer hands
 * over the requirement document (the Excel they downloaded from the "Download
 * Excel template" button, or their own file) listing many routes and many
 * passengers. Typing all of that into "+ Add Route" / "+ Add Employee" is not
 * viable, so both parties — the customer (CORPORATE / SCHOOL_CUSTOMER) and the
 * partner operating on their behalf (B2B_PARTNER / SCHOOL_PARTNER) — can import
 * straight from the brief. They hold the same document.
 *
 * Candidates come back merged from TWO sources:
 *   - BRIEF   : structured rows the customer typed into the portal. These carry
 *               a briefItemId, so importing them auto-fulfils the brief item.
 *   - DOCUMENT: rows parsed out of the attached requirement document(s).
 */

/** Routes + people that can be turned into real records for one contract. */
export const fetchImportCandidates = async (contractId) => {
    const res = await api.get(`/managed-service-brief/${contractId}/import-candidates`)
    return res.data?.data || null
}

/**
 * MANAGED contracts the caller is a party to that have something importable.
 * Used by screens that are company-wide (Employee Management) and therefore have
 * no contract id of their own to import against.
 */
export const fetchImportableContracts = async () => {
    const res = await api.get("/managed-service-brief/importable-contracts")
    return res.data?.data?.contracts || []
}

/**
 * Vehicles assigned to a contract, flattened for a picker. Every operational
 * route must attach to a vehicle, so the route import screen asks per row.
 */
export const fetchAssignedVehicleOptions = async (contractId) => {
    const res = await api.get(`/contracts/assigned-vehicles/${contractId}`)
    if (!res.data?.success) return []

    const contract = res.data.data?.contract
    const options = []
    ;(contract?.vehicles || []).forEach((group) => {
        ;(group.assignedVehicles || []).forEach((av) => {
            const routeCount = Array.isArray(av.routeDetails)
                ? av.routeDetails.length
                : av.routeDetails
                  ? 1
                  : 0
            options.push({
                id: String(av._id),
                name:
                    group.vehicleId?.vehicleName ||
                    group.vehicleId?.registrationNumber ||
                    "Vehicle",
                registration: group.vehicleId?.registrationNumber || "",
                category: group.vehicleId?.vehicleCategory || "",
                driverName: av.driverId?.name || "",
                routeCount,
            })
        })
    })
    return options
}

/**
 * Create many routes in one action, each on the vehicle chosen for it.
 * `items` are candidate rows with an `assignedVehicleId` added.
 */
export const importRoutes = async (contractId, items) => {
    const res = await api.post(`/contracts/import-routes/${contractId}`, { items })
    return res.data
}

/** Map a brief "pass months" number onto the pass duration the backend expects. */
export const monthsToDurationType = (months) => {
    switch (Number(months)) {
        case 2:
            return "2_MONTHS"
        case 3:
            return "3_MONTHS"
        case 6:
            return "6_MONTHS"
        case 12:
            return "1_YEAR"
        default:
            return "1_MONTH"
    }
}

/** Shape one employee candidate row into the bulk-upload payload. */
export const employeeCandidateToPayload = (candidate) => ({
    fullName: candidate.name,
    email: candidate.email,
    contactNumber: candidate.phone || "",
    employeeId: candidate.employeeCode || undefined,
    department: candidate.department || "",
    designation: candidate.designation || "",
    workLocation: candidate.workLocation || "",
    homeAddress: candidate.homeAddress || "",
    pickupLocation: candidate.pickupArea || candidate.homeAddress || "",
    workShift: candidate.shiftLabel || "",
    // Carry BOTH the duration and the start date from the brief so an imported
    // passenger gets the same monthly pass + trips a manually added one would.
    passDuration: {
        durationType: monthsToDurationType(candidate.passMonths),
        ...(candidate.passStartDate ? { startDate: candidate.passStartDate } : {}),
    },
    // Only structured brief rows can auto-fulfil a roster item; document rows
    // have no sub-document to link to.
    briefItemId: candidate.briefItemId || undefined,
    sourceKey: candidate.sourceKey || undefined,
})

/**
 * Create many employees/passengers from brief candidates.
 *
 * Invitations are deliberately NOT sent here — the roster is created first and
 * invitations are sent explicitly from the Employees screen once routes exist.
 * `briefContractId` lets a customer importing its OWN brief mark the roster
 * items fulfilled (a partner gets the same via the on-behalf context header).
 */
export const importEmployees = async ({ candidates, briefContractId }) => {
    const res = await api.post("/corporate-employees/bulk-upload", {
        employees: candidates.map(employeeCandidateToPayload),
        skipInvitation: true,
        briefContractId: briefContractId || undefined,
    })
    return res.data
}

export default {
    fetchImportCandidates,
    fetchImportableContracts,
    fetchAssignedVehicleOptions,
    importRoutes,
    importEmployees,
    employeeCandidateToPayload,
    monthsToDurationType,
}
