/**
 * Role families & business segments.
 *
 * The platform has two "customer-side" roles and two "partner-side" roles that
 * behave identically through the Managed Services pipeline:
 *
 *   Business segment "CORPORATE": CORPORATE  (customer)  <->  B2B_PARTNER   (partner)
 *   Business segment "SCHOOL"   : SCHOOL_CUSTOMER (customer) <-> SCHOOL_PARTNER (partner)
 *
 * SCHOOL_CUSTOMER mirrors CORPORATE and SCHOOL_PARTNER mirrors B2B_PARTNER, so
 * instead of duplicating every controller we treat them as members of the same
 * "family". Existing hard-coded `=== "CORPORATE"` / `=== "B2B_PARTNER"` checks on
 * managed-service paths are replaced with these helpers so school users reuse the
 * whole pipeline.
 *
 * Segment isolation: a customer may only ever transact with a partner in the SAME
 * segment (a school customer must not receive quotations from a corporate B2B
 * partner and vice-versa). Use `sameSegment()` / `getBusinessSegment()` to enforce
 * this in discovery, requirement broadcast and quotation flows.
 */

// Customer-side roles (the party that requests transportation services)
export const CUSTOMER_ROLES = ["CORPORATE", "SCHOOL_CUSTOMER"]

// Partner-side roles (the party that provides / operates transportation services)
export const PARTNER_ROLES = ["B2B_PARTNER", "SCHOOL_PARTNER"]

// School-specific roles
export const SCHOOL_ROLES = ["SCHOOL_CUSTOMER", "SCHOOL_PARTNER"]

/**
 * Managed-service passenger roles: the people a customer buys monthly passes
 * for. A CORPORATE's passengers are its employees, a SCHOOL_CUSTOMER's are its
 * students / teachers. Both ride the identical passenger pipeline, so every
 * gate that admits one must admit the other.
 */
export const PASSENGER_ROLES = ["CORPORATE_EMPLOYEE", "SCHOOL_STUDENT"]

/** True for CORPORATE_EMPLOYEE or SCHOOL_STUDENT. */
export const isPassengerRole = (role) => PASSENGER_ROLES.includes(role)

/** True for CORPORATE or SCHOOL_CUSTOMER. */
export const isCustomerRole = (role) => CUSTOMER_ROLES.includes(role)

/** True for B2B_PARTNER or SCHOOL_PARTNER. */
export const isPartnerRole = (role) => PARTNER_ROLES.includes(role)

/** True for SCHOOL_CUSTOMER or SCHOOL_PARTNER. */
export const isSchoolRole = (role) => SCHOOL_ROLES.includes(role)

/**
 * Business segment for a role. Customers and their matching partners share a
 * segment. Returns "CORPORATE", "SCHOOL", or null for roles outside the
 * managed-service customer/partner families.
 */
export const getBusinessSegment = (role) => {
    if (role === "CORPORATE" || role === "B2B_PARTNER") return "CORPORATE"
    if (role === "SCHOOL_CUSTOMER" || role === "SCHOOL_PARTNER") return "SCHOOL"
    return null
}

/** True when both roles belong to the same business segment. */
export const sameSegment = (roleA, roleB) => {
    const a = getBusinessSegment(roleA)
    const b = getBusinessSegment(roleB)
    return a !== null && a === b
}

/**
 * The partner role that serves a given customer role, and vice-versa.
 * CORPORATE -> B2B_PARTNER, SCHOOL_CUSTOMER -> SCHOOL_PARTNER (and reverse).
 */
export const counterpartRole = (role) => {
    switch (role) {
        case "CORPORATE":
            return "B2B_PARTNER"
        case "B2B_PARTNER":
            return "CORPORATE"
        case "SCHOOL_CUSTOMER":
            return "SCHOOL_PARTNER"
        case "SCHOOL_PARTNER":
            return "SCHOOL_CUSTOMER"
        default:
            return null
    }
}

/**
 * The partner role(s) a customer role can discover / receive services from.
 * Returned as an array for use in Mongo `$in` queries.
 */
export const partnerRolesForCustomer = (customerRole) => {
    if (customerRole === "CORPORATE") return ["B2B_PARTNER"]
    if (customerRole === "SCHOOL_CUSTOMER") return ["SCHOOL_PARTNER"]
    return []
}

/**
 * The customer role(s) a partner role serves.
 */
export const customerRolesForPartner = (partnerRole) => {
    if (partnerRole === "B2B_PARTNER") return ["CORPORATE"]
    if (partnerRole === "SCHOOL_PARTNER") return ["SCHOOL_CUSTOMER"]
    return []
}

/**
 * Segment-aware, human-readable labels used in notifications and any other
 * user-facing copy generated on the backend. These keep school-segment users
 * from seeing "Corporate" / "B2B Partner" wording that only applies to the
 * corporate segment.
 *
 * `role` may be a customer or partner role, or (for the segment-tagged admin
 * copy) any of the segment members. When the role is unknown we fall back to
 * the neutral corporate wording to preserve historic behaviour.
 */
export const customerRoleLabel = (role) =>
    role === "SCHOOL_CUSTOMER" ? "School Customer" : "Corporate Client"

export const partnerRoleLabel = (role) =>
    role === "SCHOOL_PARTNER" ? "School Partner" : "Fleet Owner"

/** Short lowercase noun for a customer, e.g. "school" / "corporate client". */
export const customerNoun = (role) =>
    role === "SCHOOL_CUSTOMER" ? "school" : "corporate client"

/** Short lowercase noun for a partner, e.g. "school partner" / "B2B partner". */
export const partnerNoun = (role) =>
    role === "SCHOOL_PARTNER" ? "school partner" : "B2B partner"

/**
 * Segment tag used in admin-facing notification copy, e.g. "(SCHOOL_CUSTOMER)".
 * Falls back to the raw role when it is not a managed-service role.
 */
export const segmentTag = (role) => role || "UNKNOWN"

/** The driver role a partner/customer owner creates for its drivers. */
export const driverRoleForOwner = (ownerRole) => {
    switch (ownerRole) {
        case "SCHOOL_PARTNER":
            return "SCHOOL_PARTNER_DRIVER"
        case "B2B_PARTNER":
            return "B2B_PARTNER_DRIVER"
        case "SCHOOL_CUSTOMER":
            return "SCHOOL_CUSTOMER_DRIVER"
        case "CORPORATE":
            return "CORPORATE_DRIVER"
        default:
            return null
    }
}

/**
 * The passenger role a customer creates for the people it buys monthly passes
 * for. A CORPORATE customer's passengers are its employees (CORPORATE_EMPLOYEE);
 * a SCHOOL_CUSTOMER's passengers are its students/teachers (SCHOOL_STUDENT).
 * Both roles ride the exact same managed-service passenger pipeline, so this is
 * only about tagging the login with the correct segment. Unknown owners fall
 * back to CORPORATE_EMPLOYEE to preserve historic behaviour.
 */
export const passengerRoleForOwner = (ownerRole) =>
    ownerRole === "SCHOOL_CUSTOMER" ? "SCHOOL_STUDENT" : "CORPORATE_EMPLOYEE"

/** Human-readable singular noun for a customer's passenger. */
export const passengerNoun = (ownerRole) =>
    ownerRole === "SCHOOL_CUSTOMER" ? "student" : "employee"

/**
 * Expand an allowedRoles list so a check written for the corporate segment also
 * admits the equivalent school-segment role. Mirrors the frontend helper.
 * CORPORATE -> SCHOOL_CUSTOMER, B2B_PARTNER -> SCHOOL_PARTNER, the driver
 * families, and CORPORATE_EMPLOYEE -> SCHOOL_STUDENT (both are managed-service
 * passengers). Returns a new array; leaves other roles untouched.
 */
export const expandRoleFamilies = (roles) => {
    if (!Array.isArray(roles)) return roles
    const set = new Set(roles)
    if (set.has("CORPORATE")) set.add("SCHOOL_CUSTOMER")
    if (set.has("B2B_PARTNER")) set.add("SCHOOL_PARTNER")
    if (set.has("B2B_PARTNER_DRIVER")) set.add("SCHOOL_PARTNER_DRIVER")
    if (set.has("CORPORATE_DRIVER")) set.add("SCHOOL_CUSTOMER_DRIVER")
    if (set.has("CORPORATE_EMPLOYEE")) set.add("SCHOOL_STUDENT")
    return Array.from(set)
}
