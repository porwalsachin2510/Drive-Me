/**
 * briefExcel.js
 * -------------
 * Shared helpers to (a) generate a downloadable multi-sheet Excel template a
 * corporate can fill in with ALL of its managed-service requirements, and
 * (b) parse a filled workbook back into the exact shape the Managed Service
 * Brief form uses.
 *
 * The whole point: a corporate may operate millions of routes / employees /
 * locations. Typing each one into the on-screen form is impractical, so we let
 * them hand over a single Excel workbook (built from this template) at
 * quotation-request time. Import fills the brief form, they review, then submit.
 *
 * Workbook sheets:
 *   - Instructions   (human guidance, ignored on import)
 *   - Overview       (Field/Value pairs: summary, dates, contact, SLA)
 *   - Work Locations (Location Name | City | Address)
 *   - Shifts         (Location Name | Shift Label | Login | Logout | Working Days)
 *   - Routes         (Route Label | From Area | To Work Location | Direction |
 *                     Pickup Window Start | Pickup Window End | Expected Headcount |
 *                     Preferred Vehicle Type | Stops | Operating Days | Notes)
 *   - Employees      (Name | Email | Phone | Employee Code | Department |
 *                     Home Address | Pickup Area | Work Location | Shift |
 *                     Pass Months | Preferred Route | Assignment Hint)
 */

// Normalize a header/sheet name to a comparable token.
const normKey = (k) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Read a value from a row object by trying several possible header tokens.
const pickCell = (row, keys) => {
    for (const k of Object.keys(row)) {
        if (keys.includes(normKey(k))) return row[k];
    }
    return "";
};

const toArr = (str) =>
    String(str == null ? "" : str)
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);

// Convert any spreadsheet cell (JS Date via cellDates, Excel serial, or string)
// into a yyyy-mm-dd string suitable for <input type="date">. Returns "" when
// it can't be confidently parsed.
const toDateInput = (val) => {
    if (val == null || val === "") return "";
    if (val instanceof Date && !isNaN(val)) {
        return val.toISOString().slice(0, 10);
    }
    if (typeof val === "number" && isFinite(val)) {
        // Excel serial date -> JS date (Excel epoch 1899-12-30).
        const ms = Math.round((val - 25569) * 86400 * 1000);
        const d = new Date(ms);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);
        return "";
    }
    const s = String(val).trim();
    // dd-mm-yyyy or dd/mm/yyyy
    let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
        const [, d, mo, y] = m;
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // yyyy-mm-dd or yyyy/mm/dd
    m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) {
        const [, y, mo, d] = m;
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const d = new Date(s);
    return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ */
/*  Template generation                                                */
/* ------------------------------------------------------------------ */

/**
 * Build and download the multi-sheet brief template as an .xlsx file.
 * xlsx is loaded lazily so it never weighs down the initial bundle.
 */
export const downloadBriefTemplate = async (
    fileName = "managed_service_brief_template.xlsx",
) => {
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const wb = XLSX.utils.book_new();

    const instructions = [
        ["Managed Service Brief - Import Template"],
        [""],
        ["Fill in the sheets below and upload this file on the Managed Service Brief form."],
        ["Every sheet is imported automatically. You can still edit anything on screen after importing."],
        [""],
        ["Sheet", "What to enter"],
        ["Overview", "One value per row. Summary, service start date, contact person and SLA."],
        ["Work Locations", "One row per office / work site. The 'Location Name' is referenced by Shifts, Routes and Employees."],
        ["Shifts", "One row per shift. 'Location Name' must match a name in the Work Locations sheet. Working Days comma-separated (MON, TUE, ...)."],
        ["Routes", "One row per route you need covered. 'To Work Location' should match a Work Location name. Stops & Operating Days are comma-separated."],
        ["Employees", "One row per employee. 'Work Location' & 'Preferred Route' should match names used above. Pass Months is a number."],
        [""],
        ["Dates format: DD-MM-YYYY   |   Times format: HH:MM (24h)   |   Lists: comma-separated"],
        ["Delete the example rows before uploading, or keep them - real rows are detected by the required column (Name / Label)."],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
    wsInstr["!cols"] = [{ wch: 20 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");

    const overview = [
        ["Field", "Value"],
        ["Summary", "Daily home-to-office pickup & drop for 40 employees across 3 shifts."],
        ["Service Start Date", "04-07-2026"],
        ["Contact Name", "Anvi Porwal"],
        ["Contact Phone", "+971500000000"],
        ["Contact Email", "ops@acme.com"],
        ["Target Completion Date", "10-07-2026"],
        ["Fulfillment SLA Hours", 72],
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overview);
    wsOverview["!cols"] = [{ wch: 24 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsOverview, "Overview");

    const locations = [
        ["Location Name", "City", "Address"],
        ["HQ - Tower B", "Dubai", "Business Bay, Dubai"],
        ["Warehouse", "Dubai", "Dubai Investment Park"],
    ];
    const wsLoc = XLSX.utils.aoa_to_sheet(locations);
    wsLoc["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsLoc, "Work Locations");

    const shifts = [
        ["Location Name", "Shift Label", "Login Time", "Logout Time", "Working Days"],
        ["HQ - Tower B", "General", "09:00", "18:00", "MON, TUE, WED, THU, FRI"],
        ["HQ - Tower B", "Night", "21:00", "06:00", "MON, TUE, WED, THU, FRI"],
        ["Warehouse", "Morning", "07:00", "15:00", "MON, TUE, WED, THU, FRI, SAT"],
    ];
    const wsShift = XLSX.utils.aoa_to_sheet(shifts);
    wsShift["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsShift, "Shifts");

    const routes = [
        [
            "Route Label",
            "From Area",
            "To Work Location",
            "Direction",
            "Pickup Window Start",
            "Pickup Window End",
            "Expected Headcount",
            "Preferred Vehicle Type",
            "Stops",
            "Operating Days",
            "Notes",
        ],
        [
            "Marina -> HQ Morning",
            "Dubai Marina",
            "HQ - Tower B",
            "PICKUP",
            "07:30",
            "08:15",
            22,
            "Shuttle Bus",
            "Marina Mall, JBR, Media City",
            "MON, TUE, WED, THU, FRI",
            "Peak traffic on SZR",
        ],
        [
            "HQ -> Marina Evening",
            "HQ - Tower B",
            "HQ - Tower B",
            "DROP",
            "18:00",
            "18:30",
            22,
            "Shuttle Bus",
            "Media City, JBR, Marina Mall",
            "MON, TUE, WED, THU, FRI",
            "",
        ],
    ];
    const wsRoutes = XLSX.utils.aoa_to_sheet(routes);
    wsRoutes["!cols"] = [
        { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 26 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRoutes, "Routes");

    const employees = [
        [
            "Name",
            "Email",
            "Phone",
            "Employee Code",
            "Department",
            "Home Address",
            "Pickup Area",
            "Work Location",
            "Shift",
            "Pass Months",
            "Preferred Route",
            "Assignment Hint",
        ],
        [
            "John Doe",
            "john@acme.com",
            "+971500000000",
            "EMP001",
            "Engineering",
            "Marina Tower 3, Dubai Marina",
            "Dubai Marina",
            "HQ - Tower B",
            "General",
            3,
            "Marina -> HQ Morning",
            "Window seat preferred",
        ],
        [
            "Jane Smith",
            "jane@acme.com",
            "+971500000001",
            "EMP002",
            "Finance",
            "JBR Sadaf 5",
            "JBR",
            "HQ - Tower B",
            "General",
            1,
            "Marina -> HQ Morning",
            "",
        ],
    ];
    const wsEmp = XLSX.utils.aoa_to_sheet(employees);
    wsEmp["!cols"] = [
        { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
        { wch: 22 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employees");

    XLSX.writeFile(wb, fileName);
};

/* ------------------------------------------------------------------ */
/*  Workbook parsing                                                   */
/* ------------------------------------------------------------------ */

// Find a sheet whose (normalized) name matches any of the given tokens.
const findSheet = (workbook, tokens) => {
    const name = workbook.SheetNames.find((n) => tokens.includes(normKey(n)));
    return name ? workbook.Sheets[name] : null;
};

const sheetRows = (XLSX, sheet) =>
    sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];

/**
 * Parse a filled brief workbook (File / Blob) into the brief shape used by the
 * form:
 *   { summary, serviceStartDate, pointOfContact, sla, workLocations,
 *     routeRequests, employeeRoster }
 *
 * Only rows with the required identifying column are kept (Work Location Name,
 * Route Label, Employee Name). Shifts are nested under their matching location.
 */
export const parseBriefWorkbook = async (file) => {
    const xlsxModule = await import("xlsx");
    const XLSX = xlsxModule.default || xlsxModule;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });

    const result = {
        summary: "",
        serviceStartDate: "",
        pointOfContact: { name: "", phone: "", email: "" },
        sla: { targetCompletionDate: "", fulfillmentSlaHours: 72 },
        workLocations: [],
        routeRequests: [],
        employeeRoster: [],
    };

    /* ---- Overview (Field / Value pairs) ---- */
    const overviewSheet = findSheet(workbook, ["overview", "brief", "summary"]);
    for (const row of sheetRows(XLSX, overviewSheet)) {
        const field = normKey(pickCell(row, ["field", "key", "name", "label"]));
        const value = pickCell(row, ["value", "val", "detail", "details"]);
        if (!field) continue;
        if (["summary", "objectives", "objectivessummary"].includes(field))
            result.summary = String(value || "").trim();
        else if (["servicestartdate", "startdate", "desiredservicestartdate"].includes(field))
            result.serviceStartDate = toDateInput(value);
        else if (["contactname", "name"].includes(field))
            result.pointOfContact.name = String(value || "").trim();
        else if (["contactphone", "phone", "phonenumber"].includes(field))
            result.pointOfContact.phone = String(value || "").trim();
        else if (["contactemail", "email"].includes(field))
            result.pointOfContact.email = String(value || "").trim();
        else if (["targetcompletiondate", "golivedate", "targetgolivedate", "sla", "completiondate"].includes(field))
            result.sla.targetCompletionDate = toDateInput(value);
        else if (["fulfillmentslahours", "slahours", "peritemslahours", "peritemsla"].includes(field)) {
            const n = Number(value);
            if (!isNaN(n) && n > 0) result.sla.fulfillmentSlaHours = n;
        }
    }

    /* ---- Work Locations ---- */
    const locSheet = findSheet(workbook, ["worklocations", "locations", "location"]);
    const locByKey = new Map(); // normalized name -> location object
    for (const row of sheetRows(XLSX, locSheet)) {
        const name = String(pickCell(row, ["locationname", "name", "location"]) || "").trim();
        if (!name) continue;
        const loc = {
            name,
            city: String(pickCell(row, ["city"]) || "").trim(),
            address: String(pickCell(row, ["address", "fulladdress"]) || "").trim(),
            shifts: [],
        };
        result.workLocations.push(loc);
        locByKey.set(normKey(name), loc);
    }

    /* ---- Shifts (nested into their location) ---- */
    const shiftSheet = findSheet(workbook, ["shifts", "shift"]);
    for (const row of sheetRows(XLSX, shiftSheet)) {
        const locName = String(
            pickCell(row, ["locationname", "location", "worklocation"]) || "",
        ).trim();
        const label = String(pickCell(row, ["shiftlabel", "label", "shift"]) || "").trim();
        const loginTime = String(pickCell(row, ["logintime", "login", "starttime", "start"]) || "").trim();
        const logoutTime = String(pickCell(row, ["logouttime", "logout", "endtime", "end"]) || "").trim();
        const workingDays = toArr(pickCell(row, ["workingdays", "days", "operatingdays"]));
        if (!label && !loginTime && !logoutTime && workingDays.length === 0) continue;

        const shift = { label, loginTime, logoutTime, workingDays };
        let loc = locByKey.get(normKey(locName));
        if (!loc) {
            // Shift references a location not listed on the Work Locations sheet:
            // create a stub location so nothing is lost.
            loc = { name: locName || "Unspecified location", city: "", address: "", shifts: [] };
            result.workLocations.push(loc);
            locByKey.set(normKey(loc.name), loc);
        }
        loc.shifts.push(shift);
    }

    /* ---- Routes ---- */
    const routeSheet = findSheet(workbook, ["routes", "route", "routecoverage", "coverage"]);
    for (const row of sheetRows(XLSX, routeSheet)) {
        const label = String(pickCell(row, ["routelabel", "label", "route", "name"]) || "").trim();
        if (!label) continue;
        const dirRaw = normKey(pickCell(row, ["direction", "dir"]));
        const direction =
            dirRaw === "pickup" ? "PICKUP" : dirRaw === "drop" ? "DROP" : "BOTH";
        result.routeRequests.push({
            label,
            fromArea: String(pickCell(row, ["fromarea", "from", "origin"]) || "").trim(),
            toWorkLocation: String(
                pickCell(row, ["toworklocation", "to", "destination", "worklocation"]) || "",
            ).trim(),
            direction,
            pickupWindowStart: String(pickCell(row, ["pickupwindowstart", "windowstart", "starttime", "pickupstart"]) || "").trim(),
            pickupWindowEnd: String(pickCell(row, ["pickupwindowend", "windowend", "endtime", "pickupend"]) || "").trim(),
            headcount: Number(pickCell(row, ["expectedheadcount", "headcount", "count", "employees"])) || 0,
            preferredVehicleType: String(pickCell(row, ["preferredvehicletype", "vehicletype", "vehicle"]) || "").trim(),
            stops: toArr(pickCell(row, ["stops", "stoppoints", "stop"])),
            operatingDays: toArr(pickCell(row, ["operatingdays", "days", "workingdays"])),
            notes: String(pickCell(row, ["notes", "note", "remarks"]) || "").trim(),
        });
    }

    /* ---- Employees ---- */
    const empSheet = findSheet(workbook, ["employees", "employee", "roster", "employeeroster"]);
    for (const row of sheetRows(XLSX, empSheet)) {
        const name = String(pickCell(row, ["name", "fullname", "employeename"]) || "").trim();
        if (!name) continue;
        result.employeeRoster.push({
            name,
            email: String(pickCell(row, ["email", "emailaddress"]) || "").trim(),
            phone: String(pickCell(row, ["phone", "mobile", "phonenumber", "contact", "contactnumber"]) || "").trim(),
            employeeCode: String(pickCell(row, ["employeecode", "code", "empcode", "employeeid", "empid"]) || "").trim(),
            department: String(pickCell(row, ["department", "dept"]) || "").trim(),
            homeAddress: String(pickCell(row, ["homeaddress", "address"]) || "").trim(),
            pickupArea: String(pickCell(row, ["pickuparea", "pickup", "area", "pickuplocation"]) || "").trim(),
            workLocation: String(pickCell(row, ["worklocation", "office", "location"]) || "").trim(),
            shiftLabel: String(pickCell(row, ["shift", "shiftlabel"]) || "").trim(),
            passMonths: Number(pickCell(row, ["passmonths", "months", "pass", "passduration"])) || 1,
            preferredRouteLabel: String(pickCell(row, ["preferredroute", "route", "preferredroutelabel"]) || "").trim(),
            assignmentHint: String(pickCell(row, ["assignmenthint", "assignment", "note", "notes"]) || "").trim(),
        });
    }

    return result;
};

/**
 * Summarize what a parsed workbook contains, for a friendly confirmation message.
 */
export const summarizeParsedBrief = (parsed) => {
    const shiftCount = (parsed.workLocations || []).reduce(
        (n, l) => n + (l.shifts?.length || 0),
        0,
    );
    return {
        locations: parsed.workLocations?.length || 0,
        shifts: shiftCount,
        routes: parsed.routeRequests?.length || 0,
        employees: parsed.employeeRoster?.length || 0,
    };
};
