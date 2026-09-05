// Frontend mirror of backend/src/utils/roleFamilies.js
//
// School users share the managed-service pipeline with their corporate
// counterparts: SCHOOL_CUSTOMER behaves like CORPORATE, SCHOOL_PARTNER behaves
// like B2B_PARTNER. These helpers keep role gating in sync without editing
// every allowedRoles array across the app.

export const CUSTOMER_ROLES = ["CORPORATE", "SCHOOL_CUSTOMER"];
export const PARTNER_ROLES = ["B2B_PARTNER", "SCHOOL_PARTNER"];

export const isCustomerRole = (role) => CUSTOMER_ROLES.includes(role);
export const isPartnerRole = (role) => PARTNER_ROLES.includes(role);
export const isSchoolRole = (role) =>
  role === "SCHOOL_CUSTOMER" || role === "SCHOOL_PARTNER";

/**
 * Every role that lives inside the SCHOOL segment, including the drivers and the
 * managed passengers (students / teachers). Roster wording must follow the
 * SEGMENT, not just the logged-in role: when a SCHOOL_PARTNER opens a school
 * customer's roster on-behalf (managed service) it must still read "Student",
 * and a logged-in SCHOOL_STUDENT must never see "Employee" wording either.
 */
export const SCHOOL_SEGMENT_ROLES = [
  "SCHOOL_CUSTOMER",
  "SCHOOL_PARTNER",
  "SCHOOL_PARTNER_DRIVER",
  "SCHOOL_CUSTOMER_DRIVER",
  "SCHOOL_STUDENT",
];

export const isSchoolSegmentRole = (role) =>
  SCHOOL_SEGMENT_ROLES.includes(role);

export const customerRoleLabel = (role) =>
  role === "SCHOOL_CUSTOMER" ? "School Customer" : "Corporate Customer";

export const partnerRoleLabel = (role) =>
  role === "SCHOOL_PARTNER" ? "School Partner" : "B2B Partner";

export const requestedByLabel = (role) =>
  role === "SCHOOL_CUSTOMER" ? "School Customer requested" : "Corporate requested";

/**
 * Human-readable contract status badge text, segment-aware.
 *
 * Contract statuses are stored with corporate-segment wording ("B2B", "FLEET",
 * "CORPORATE"). For school-segment contracts we swap those tokens for the
 * school equivalents so a school user never sees "PENDING B2B VERIFICATION".
 * Corporate-segment contracts are returned unchanged.
 */
export const contractStatusLabel = (status, customerRole, partnerRole) => {
  if (!status) return "";
  let label = String(status).replace(/_/g, " ");
  if (partnerRole === "SCHOOL_PARTNER") {
    label = label
      .replace(/\bB2B\b/g, "SCHOOL PARTNER")
      .replace(/\bFLEET\b/g, "SCHOOL PARTNER");
  }
  if (customerRole === "SCHOOL_CUSTOMER") {
    label = label.replace(/\bCORPORATE\b/g, "SCHOOL CUSTOMER");
  }
  return label;
};

/**
 * Expand an allowedRoles list so that any list allowing "CORPORATE" also allows
 * "SCHOOL_CUSTOMER", and any list allowing "B2B_PARTNER" also allows
 * "SCHOOL_PARTNER". Returns a new array; leaves other roles untouched.
 */
export const expandRoleFamilies = (roles) => {
  if (!Array.isArray(roles)) return roles;
  const set = new Set(roles);
  if (set.has("CORPORATE")) set.add("SCHOOL_CUSTOMER");
  if (set.has("B2B_PARTNER")) set.add("SCHOOL_PARTNER");
  // Driver families mirror their owners: a route that admits B2B partner
  // drivers also admits school partner drivers, and one that admits corporate
  // drivers also admits school customer drivers.
  if (set.has("B2B_PARTNER_DRIVER")) set.add("SCHOOL_PARTNER_DRIVER");
  if (set.has("CORPORATE_DRIVER")) set.add("SCHOOL_CUSTOMER_DRIVER");
  // Managed-service passengers: a CORPORATE_EMPLOYEE gate also admits a
  // SCHOOL_STUDENT — both ride the same passenger pipeline/portal.
  if (set.has("CORPORATE_EMPLOYEE")) set.add("SCHOOL_STUDENT");
  return Array.from(set);
};

/**
 * The passenger role a customer creates for the people it buys monthly passes
 * for. CORPORATE -> CORPORATE_EMPLOYEE, SCHOOL_CUSTOMER -> SCHOOL_STUDENT.
 */
export const passengerRoleForOwner = (ownerRole) =>
  ownerRole === "SCHOOL_CUSTOMER" ? "SCHOOL_STUDENT" : "CORPORATE_EMPLOYEE";

/**
 * Segment-aware labels for the "employees / students" roster a customer manages.
 * A SCHOOL_CUSTOMER manages students; a CORPORATE customer manages employees.
 * These keep the Employee Management screens from showing "Employee" wording to
 * a school user who is really adding students.
 */
export const passengerNounSingular = (ownerRole) =>
  isSchoolSegmentRole(ownerRole) ? "Student" : "Employee";

export const passengerNounPlural = (ownerRole) =>
  isSchoolSegmentRole(ownerRole) ? "Students" : "Employees";

/**
 * The roster form has three "who is this passenger" master-data fields that are
 * stored on the SAME CorporateEmployee columns for every segment
 * (personalInfo.department / designation / workLocation) but MEAN different
 * things depending on the contract:
 *
 *   CORPORATE  <-> B2B_PARTNER     : Department  / Designation / Work Location
 *   SCHOOL_CUSTOMER <-> SCHOOL_PARTNER : Grade / Class, Member Type, Campus
 *
 * `passengerFieldLabels` returns the wording AND the dropdown category each of
 * those three selects must read, so a school customer adding a student never
 * sees "Select Department" with "Human Resources" inside it. Keeping the
 * storage columns identical means routes, trips, passes, bookings and every
 * report keep working untouched for both segments.
 */
export const passengerFieldLabels = (ownerRole) => {
  const isSchool = isSchoolSegmentRole(ownerRole);

  return {
    isSchool,
    // Header / section wording
    personalSection: isSchool ? "Student Information" : "Personal Information",
    transportSection: isSchool
      ? "School Transport Details"
      : "Transport Details",
    // personalInfo.department
    department: {
      label: isSchool ? "Grade / Class" : "Department",
      placeholder: isSchool ? "Select Grade / Class" : "Select Department",
      category: isSchool ? "SCHOOL_GRADES" : "DEPARTMENTS",
    },
    // personalInfo.designation
    designation: {
      label: isSchool ? "Member Type" : "Designation",
      placeholder: isSchool ? "Select Member Type" : "Select Designation",
      category: isSchool ? "SCHOOL_MEMBER_TYPES" : "DESIGNATIONS",
    },
    // personalInfo.workLocation
    workLocation: {
      label: isSchool ? "Campus" : "Work Location",
      placeholder: isSchool ? "Select Campus" : "Select Work Location",
      category: isSchool ? "SCHOOL_CAMPUSES" : "WORK_LOCATIONS",
    },
    // transportDetails.shiftType
    shiftType: {
      label: isSchool ? "School Session" : "Shift Type",
      placeholder: isSchool ? "Select School Session" : "Select Shift Type",
      category: isSchool ? "SCHOOL_SHIFT_TYPES" : "SHIFT_TYPES",
    },
    // Home / destination wording used in the trip assignment blocks
    homeAddressLabel: isSchool ? "Home Address" : "Home Address",
    homeAddressPlaceholder: isSchool
      ? "Home Address (student's residential area for nearest pickup stop)"
      : "Home Address (employee's residential area for nearest pickup stop)",
    destinationNoun: isSchool ? "School" : "Office",
    outboundHint: isSchool
      ? "Morning trip - travels from home to school"
      : "Morning commute - travels from home to office",
    returnHint: isSchool
      ? "Afternoon trip - travels from school back to home"
      : "Evening commute - travels from office back to home",
  };
};
