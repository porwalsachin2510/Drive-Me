/**
 * briefExcel.js
 * -------------
 * Download-only helper that builds a convenience Excel template a customer can
 * fill in offline and then upload as its requirement document.
 *
 * The portal does NOT enforce a fixed template — a customer may upload anything
 * (their own spreadsheet, a PDF, a Word doc, etc.). This template is offered
 * only for customers who don't already have a format of their own.
 *
 * It is intentionally just TWO sheets, because everything the old six-sheet
 * template captured collapses into two:
 *
 *   - Routes    : the routes to operate. ONE row is ONE route, exactly like the
 *                 manual "Assign Route" form: a Trip Type column (ROUND_TRIP /
 *                 ONE_WAY) with the outbound (pickup) leg AND the return leg on
 *                 the same row. A round trip is therefore a single route, not two
 *                 PICKUP/DROP rows. Covers trip timings, outbound & return stops,
 *                 passenger count, vehicle requirements, working days and special
 *                 instructions.
 *
 *   - Employees : the passenger roster, with the WORK LOCATION merged in
 *                 (office name / address / city on the same row) plus pickup
 *                 address, which route they ride and pass duration.
 *
 * There is no import/parse step: the filled workbook is uploaded as-is and stays
 * attached to the request for the partner to read.
 */

/**
 * Build and download the two-sheet brief template as an .xlsx file.
 * xlsx is loaded lazily so it never weighs down the initial bundle.
 */
export const downloadBriefTemplate = async ({
    audience = "corporate",
    fileName,
} = {}) => {
    const isSchool = audience === "school-customer" || audience === "school-partner";
    const outputFileName = fileName || `${isSchool ? "school_transport_requirement" : "transport_requirement"}_template.xlsx`;
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const wb = XLSX.utils.book_new();

    /* ------------------------------- Routes -------------------------------- */
    // ONE row = ONE route, exactly like the manual "Assign Route" form. A round
    // trip is a SINGLE row (Trip Type = ROUND_TRIP) that carries both the
    // outbound (pickup) leg AND the return leg on the same row, instead of being
    // split into two PICKUP/DROP rows that used to create two separate routes.
    const routes = [
        [
            `${isSchool ? "School Route" : "Route"} Label`,
            `${isSchool ? "Student Pickup Area" : "Pickup Area"} (From)`,
            `${isSchool ? "School / Campus" : "Work Location"} (To)`,
            "Trip Type (ROUND_TRIP/ONE_WAY)",
            // Outbound leg (origin -> destination). For a ONE_WAY drop route,
            // this is simply the single trip's start/end.
            "Pickup Start Time",
            "Pickup End Time",
            // Return leg (destination -> origin). Fill ONLY for ROUND_TRIP.
            "Return Start Time",
            "Return End Time",
            "Number of Trips",
            `${isSchool ? "Student / Passenger" : "Passenger"} Count`,
            `${isSchool ? "School Vehicle" : "Vehicle"} Requirement`,
            "Working Days",
            "Outbound Stops (Name @ HH:MM, comma separated)",
            "Return Stops (Name @ HH:MM, comma separated)",
            "Special Instructions",
        ],
        // Example 1: a full ROUND TRIP as a SINGLE route (pickup + return legs).
        [
            isSchool ? "Marina -> School (Round)" : "Marina <-> HQ (Round)",
            "Dubai Marina",
            isSchool ? "Main School Campus" : "HQ - Tower B",
            "ROUND_TRIP",
            "07:30",
            "08:15",
            "14:30",
            "15:15",
            1,
            22,
            "Shuttle Bus (AC)",
            "MON, TUE, WED, THU, FRI",
            "Marina Mall @ 07:35, JBR @ 07:50, Media City @ 08:05",
            "Media City @ 14:40, JBR @ 14:55, Marina Mall @ 15:10",
            "Peak traffic on SZR; female driver preferred",
        ],
        // Example 2: a ONE WAY route (return columns left blank).
        [
            isSchool ? "Late Bus (One Way)" : "HQ -> Marina Evening",
            isSchool ? "Main School Campus" : "HQ - Tower B",
            isSchool ? "Dubai Marina" : "Dubai Marina",
            "ONE_WAY",
            "18:00",
            "18:45",
            "",
            "",
            1,
            18,
            "Shuttle Bus (AC)",
            "MON, TUE, WED, THU, FRI",
            "Media City @ 18:05, JBR @ 18:15, Marina Mall @ 18:25",
            "",
            "",
        ],
    ];
    const wsRoutes = XLSX.utils.aoa_to_sheet(routes);
    wsRoutes["!cols"] = [
        { wch: 26 }, { wch: 18 }, { wch: 24 }, { wch: 26 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 20 }, { wch: 26 }, { wch: 48 }, { wch: 48 }, { wch: 34 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRoutes, "Routes");

    /* ------------------------------ Employees ------------------------------ */
    // Employee roster with work-location details merged onto each row.
    const employees = [
        [
            `${isSchool ? "Student / Passenger" : "Employee"} Name`,
            "Email",
            "Phone",
            `${isSchool ? "Student" : "Employee"} Code`,
            `${isSchool ? "Grade / Class" : "Department"}`,
            // Job title / role — same field the manual "Add Employee" form captures.
            `${isSchool ? "Role / Designation" : "Designation"}`,
            `${isSchool ? "Home / Pickup Address" : "Home / Pickup Address"}`,
            `${isSchool ? "School / Campus Name" : "Work Location Name"}`,
            `${isSchool ? "School / Campus Address" : "Work Location Address"}`,
            "City",
            // Must be one of the accepted shift values so the row imports cleanly.
            "Shift (MORNING/EVENING/NIGHT/FULL_DAY)",
            "Preferred Route",
            "Pass Months",
            // The day this passenger's monthly pass (and its auto-generated trips)
            // should start. Same field the manual "Add Employee" form captures as
            // "Pass Start Date". Leave blank to start on the service start date.
            "Pass Start Date (YYYY-MM-DD)",
            "Notes",
        ],
        [
            isSchool ? "Student One" : "John Doe",
            isSchool ? "student@example.com" : "john@acme.com",
            "+971500000000",
            isSchool ? "STU001" : "EMP001",
            isSchool ? "Grade 8" : "Engineering",
            isSchool ? "Student" : "Software Engineer",
            "Marina Tower 3, Dubai Marina",
            isSchool ? "Main School Campus" : "HQ - Tower B",
            isSchool ? "School Road, Dubai" : "Business Bay, Dubai",
            "Dubai",
            "FULL_DAY",
            "Marina -> HQ Morning",
            3,
            "2026-09-01",
            "Window seat preferred",
        ],
        [
            "Jane Smith",
            "jane@acme.com",
            "+971500000001",
            "EMP002",
            "Finance",
            isSchool ? "Student" : "HR Manager",
            "JBR Sadaf 5",
            "HQ - Tower B",
            "Business Bay, Dubai",
            "Dubai",
            "MORNING",
            "Marina -> HQ Morning",
            1,
            "2026-09-01",
            "",
        ],
    ];
    const wsEmp = XLSX.utils.aoa_to_sheet(employees);
    wsEmp["!cols"] = [
        { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 26 }, { wch: 12 },
        { wch: 32 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employees");

    XLSX.writeFile(wb, outputFileName);
};

export default { downloadBriefTemplate };
