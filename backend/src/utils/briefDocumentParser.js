/**
 * briefDocumentParser.js
 * ----------------------
 * Parses a managed-service brief's uploaded requirement document (the Excel/CSV
 * the customer attached to the brief) into normalized ROUTE and EMPLOYEE rows
 * that can be turned into real operational records.
 *
 * Why this exists
 * ---------------
 * A managed-service brief never has just one route or one employee — a school or
 * corporate hands over a spreadsheet with dozens/hundreds of rows. Adding each
 * one by hand through the "+ Add Route" / "+ Add Employee" forms is not viable.
 * Both parties (the customer AND the partner) hold the same document, so either
 * can drive the import.
 *
 * The portal deliberately does NOT enforce a template — the customer may upload
 * their own format. So this parser is tolerant:
 *   - it recognises the two-sheet template produced by briefExcel.js in BOTH its
 *     corporate ("Route Label", "Employee Name", ...) and school ("School Route
 *     Label", "Student / Passenger Name", ...) wordings,
 *   - it falls back to fuzzy/substring header matching for custom files,
 *   - if sheets aren't named Routes/Employees it classifies each sheet by
 *     looking at its headers (this is also how single-sheet CSVs are handled).
 *
 * Anything it cannot understand is reported back as a warning rather than
 * throwing, so a partially-malformed workbook still yields usable rows.
 */

import * as XLSX from "xlsx"
import axios from "axios"

// --- Hard safety limits -------------------------------------------------------
// These files are uploaded by users, so every dimension is capped to keep a
// hostile or accidentally huge workbook from exhausting memory/CPU.
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024 // 15 MB
const MAX_SHEETS = 12
const MAX_ROWS_PER_SHEET = 5000
const MAX_STOPS_PER_ROUTE = 60
const DOWNLOAD_TIMEOUT_MS = 20000

const PARSEABLE_EXTENSIONS = ["xlsx", "xlsm", "xls", "csv"]

const VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

const DAY_ALIASES = {
    MON: "MON", MONDAY: "MON",
    TUE: "TUE", TUES: "TUE", TUESDAY: "TUE",
    WED: "WED", WEDS: "WED", WEDNESDAY: "WED",
    THU: "THU", THUR: "THU", THURS: "THU", THURSDAY: "THU",
    FRI: "FRI", FRIDAY: "FRI",
    SAT: "SAT", SATURDAY: "SAT",
    SUN: "SUN", SUNDAY: "SUN",
}

/** Normalize a header cell to a comparable key: lowercase, alphanumerics only. */
const normalizeHeader = (value) =>
    String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")

/**
 * Excel time cells come back in three shapes depending on how the customer
 * formatted them: a plain string ("07:30"), a real Date (when cellDates is on),
 * or a fraction of a day (0.3125 === 07:30). Normalize all of them to "HH:MM".
 */
const toTimeString = (value) => {
    if (value === null || value === undefined || value === "") return ""

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const h = String(value.getUTCHours()).padStart(2, "0")
        const m = String(value.getUTCMinutes()).padStart(2, "0")
        return `${h}:${m}`
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        // Excel serial time: the fractional part is the time of day.
        const fraction = value % 1
        const totalMinutes = Math.round(fraction * 24 * 60)
        const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")
        const m = String(totalMinutes % 60).padStart(2, "0")
        return `${h}:${m}`
    }

    const text = String(value).trim()
    // "7:30", "07:30:00", "7.30", "0730", "7:30 AM"
    const match = text.match(/^(\d{1,2})[:.\s]?(\d{2})?(?::\d{2})?\s*(am|pm)?$/i)
    if (!match) return text

    let hours = Number.parseInt(match[1], 10)
    const minutes = Number.parseInt(match[2] || "0", 10)
    const meridiem = (match[3] || "").toLowerCase()

    if (meridiem === "pm" && hours < 12) hours += 12
    if (meridiem === "am" && hours === 12) hours = 0
    if (!Number.isFinite(hours) || hours > 23 || minutes > 59) return text

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

const toText = (value) => {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    return String(value).trim()
}

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return 0
    const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""))
    return Number.isFinite(n) ? n : 0
}

/**
 * Normalize a calendar-date cell to a "YYYY-MM-DD" string, or "" when empty.
 * The workbook is read with cellDates:false, so a date can arrive as:
 *   - a real Date (defensive: if a caller enabled cellDates),
 *   - an Excel serial number (e.g. 46266 === 2026-09-01) — converted via SSF,
 *   - a text string the customer typed ("2026-09-01", "01/09/2026", "1 Sep 2026").
 * Returns "" for anything unparseable so a bad cell never blocks the row.
 */
const toDateString = (value) => {
    if (value === null || value === undefined || value === "") return ""

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10)
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        // Excel serial date -> {y, m, d} (SSF is timezone-independent).
        const parsed = XLSX.SSF && typeof XLSX.SSF.parse_date_code === "function"
            ? XLSX.SSF.parse_date_code(value)
            : null
        if (parsed && parsed.y) {
            const mm = String(parsed.m).padStart(2, "0")
            const dd = String(parsed.d).padStart(2, "0")
            return `${parsed.y}-${mm}-${dd}`
        }
        return ""
    }

    const text = String(value).trim()
    if (!text) return ""
    // Already ISO (or ISO with time) — take the date part as-is.
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    // Fall back to Date parsing for "01/09/2026", "1 Sep 2026", etc.
    const d = new Date(text)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return ""
}

/** Split a "MON, TUE, WED" / "Mon-Fri" style cell into canonical day codes. */
const parseDays = (value) => {
    const text = toText(value)
    if (!text) return []

    // Handle simple ranges like "Mon-Fri" / "Sun to Thu".
    const rangeMatch = text.match(/^([a-z]+)\s*(?:-|–|to)\s*([a-z]+)$/i)
    if (rangeMatch) {
        const start = DAY_ALIASES[rangeMatch[1].toUpperCase()]
        const end = DAY_ALIASES[rangeMatch[2].toUpperCase()]
        if (start && end) {
            const startIdx = VALID_DAYS.indexOf(start)
            const endIdx = VALID_DAYS.indexOf(end)
            if (startIdx !== -1 && endIdx !== -1) {
                const out = []
                // Wrap around the week so "SUN to THU" works.
                for (let i = startIdx; ; i = (i + 1) % VALID_DAYS.length) {
                    out.push(VALID_DAYS[i])
                    if (i === endIdx || out.length >= 7) break
                }
                return out
            }
        }
    }

    const days = text
        .split(/[,;/|]+|\s+and\s+/i)
        .map((part) => DAY_ALIASES[part.trim().toUpperCase()])
        .filter(Boolean)

    return [...new Set(days)]
}

// Matches an optional trailing per-stop time on a single stop token, written as
// "Stop Name @ 07:35", "Stop Name @ 7:35 AM" or "Stop Name (07:35)". Only "@"
// and a parenthesised time are treated as time markers so ordinary hyphenated
// stop names ("HQ - Tower B") are never mistaken for a time.
const STOP_TIME_SUFFIX = /\s*(?:@\s*|\(\s*)(\d{1,2}[:.]\d{2}(?:\s*[ap]m)?)\s*\)?\s*$/i

/**
 * Split a "Stop A @ 07:35, Stop B @ 07:50" cell into an ordered list of
 * { location, time } objects. The time is optional — a bare "Stop A, Stop B"
 * still parses, just with empty times. This mirrors how a manually added route
 * captures a location and an optional pickup time per stop.
 */
const parseStops = (value) => {
    const text = toText(value)
    if (!text) return []
    return text
        .split(/[,;|>\n]+|->/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_STOPS_PER_ROUTE)
        .map((token) => {
            const match = token.match(STOP_TIME_SUFFIX)
            if (match) {
                const location = token.slice(0, match.index).trim()
                return { location, time: toTimeString(match[1]) }
            }
            return { location: token, time: "" }
        })
        .filter((stop) => stop.location)
}

const parseDirection = (value) => {
    const text = toText(value).toUpperCase()
    if (text.includes("BOTH") || text.includes("ROUND")) return "BOTH"
    if (text.includes("DROP")) return "DROP"
    if (text.includes("PICK")) return "PICKUP"
    return "BOTH"
}

/**
 * Normalize a Trip Type cell to "ROUND_TRIP" | "ONE_WAY" | "".
 * Accepts the template's "ROUND_TRIP"/"ONE_WAY" as well as free-text a customer
 * might type ("Round Trip", "one way", "return", "two way", ...). Returns "" when
 * the cell is empty so the caller can fall back to the legacy Direction column.
 */
const parseTripType = (value) => {
    const text = toText(value).toUpperCase().replace(/[^A-Z]/g, "")
    if (!text) return ""
    if (text.includes("ROUND") || text.includes("BOTH") || text.includes("TWOWAY") || text.includes("RETURN")) {
        return "ROUND_TRIP"
    }
    if (text.includes("ONEWAY") || text.includes("SINGLE") || text.includes("PICKUP") || text.includes("DROP")) {
        return "ONE_WAY"
    }
    return ""
}

/**
 * Build a field reader for one sheet. Given the header row, it resolves each
 * logical field to a column index using (1) exact normalized header matches for
 * the known template wordings, then (2) substring matches for custom files.
 */
const createFieldReader = (headerRow) => {
    const headers = headerRow.map(normalizeHeader)

    const findIndex = (exact = [], contains = []) => {
        for (const candidate of exact) {
            const idx = headers.indexOf(candidate)
            if (idx !== -1) return idx
        }
        for (const fragment of contains) {
            const idx = headers.findIndex((h) => h && h.includes(fragment))
            if (idx !== -1) return idx
        }
        return -1
    }

    return { headers, findIndex }
}

/** Column resolution for the Routes sheet (corporate + school wordings). */
const resolveRouteColumns = (headerRow) => {
    const { findIndex } = createFieldReader(headerRow)
    return {
        label: findIndex(["routelabel", "schoolroutelabel"], ["routelabel", "routename"]),
        // "Pickup Area (From)" / "Student Pickup Area (From)" are the current
        // templates; "From Area" is the older brief template still in circulation.
        fromArea: findIndex(
            ["pickupareafrom", "studentpickupareafrom", "fromarea", "pickuparea"],
            ["areafrom", "fromarea", "fromlocation", "pickupfrom"],
        ),
        // "Work Location (To)" / "School / Campus (To)" are current;
        // "To Work Location" / "To School" come from the older template.
        toLocation: findIndex(
            ["worklocationto", "schoolcampusto", "toworklocation", "toschool", "tocampus"],
            ["locationto", "campusto", "tolocation", "toworklocation", "destination"],
        ),
        // NEW one-row-per-route template: a Trip Type column plus explicit
        // outbound (pickup) and return leg times, mirroring the manual form.
        tripType: findIndex(
            ["triptyperoundtriponeway", "triptype"],
            ["triptype"],
        ),
        pickupStartTime: findIndex(
            ["pickupstarttime", "pickupwindowstart"],
            ["pickupstart", "outboundstart"],
        ),
        pickupEndTime: findIndex(
            ["pickupendtime", "pickupwindowend"],
            ["pickupend", "outboundend"],
        ),
        returnStartTime: findIndex(
            ["returnstarttime"],
            ["returnstart"],
        ),
        returnEndTime: findIndex(
            ["returnendtime"],
            ["returnend"],
        ),
        outboundStops: findIndex(
            ["outboundstopsnamehhmmcommaseparated", "outboundstops"],
            ["outboundstop"],
        ),
        returnStops: findIndex(
            ["returnstopsnamehhmmcommaseparated", "returnstops"],
            ["returnstop"],
        ),
        // Legacy two-row template columns (still supported for older files).
        direction: findIndex(["directionpickupdropboth"], ["direction"]),
        shiftLoginTime: findIndex(["shiftlogintime"], ["logintime"]),
        shiftLogoutTime: findIndex(["shiftlogouttime"], ["logouttime"]),
        pickupWindowStart: findIndex(["pickupwindowstart"], ["windowstart", "starttime"]),
        pickupWindowEnd: findIndex(["pickupwindowend"], ["windowend", "endtime"]),
        numberOfTrips: findIndex(["numberoftrips"], ["numberoftrips", "trips"]),
        headcount: findIndex(
            ["passengercount", "studentpassengercount", "expectedheadcount", "headcount"],
            ["headcount", "passengercount", "studentcount", "count", "strength"],
        ),
        preferredVehicleType: findIndex(
            ["vehiclerequirement", "schoolvehiclerequirement", "preferredvehicletype"],
            ["vehicle"],
        ),
        operatingDays: findIndex(["workingdays", "operatingdays"], ["days"]),
        stops: findIndex(["stopscommaseparated"], ["stops"]),
        notes: findIndex(["specialinstructions"], ["instruction", "note", "remark"]),
    }
}

/** Column resolution for the Employees sheet (corporate + school wordings). */
const resolveEmployeeColumns = (headerRow) => {
    const { findIndex } = createFieldReader(headerRow)
    return {
        name: findIndex(
            ["employeename", "studentpassengername", "passengername", "studentname", "name", "fullname"],
            ["name"],
        ),
        email: findIndex(["email", "emailaddress"], ["email", "mail"]),
        phone: findIndex(["phone", "phonenumber", "mobile", "contactnumber"], ["phone", "mobile", "contact"]),
        code: findIndex(["employeecode", "studentcode", "code"], ["code", "empid", "studentid"]),
        department: findIndex(["department", "gradeclass", "grade", "class"], ["department", "grade"]),
        // Job title / role. Kept separate from department so the imported row
        // fills the same fields the manual "Add Employee" form captures.
        designation: findIndex(["designation", "jobtitle", "title", "role", "position"], ["designation", "jobtitle"]),
        homeAddress: findIndex(
            ["homepickupaddress", "homeaddress", "pickupaddress"],
            ["homeaddress", "pickupaddress", "residentialaddress"],
        ),
        // Some templates carry the pickup AREA as its own column alongside the
        // full home address. When present it is the better route-matching key.
        pickupArea: findIndex(["pickuparea", "area"], ["pickuparea"]),
        workLocation: findIndex(
            ["worklocationname", "schoolcampusname", "worklocation", "schoolcampus", "school"],
            ["locationname", "campusname", "worklocation", "campus"],
        ),
        workLocationAddress: findIndex(
            ["worklocationaddress", "schoolcampusaddress"],
            ["locationaddress", "campusaddress"],
        ),
        city: findIndex(["city"], ["city", "emirate"]),
        shift: findIndex(["shift", "shiftlabel"], ["shift"]),
        preferredRoute: findIndex(["preferredroute", "preferredroutelabel"], ["route"]),
        passMonths: findIndex(["passmonths", "passduration"], ["passmonth", "passduration"]),
        // Optional per-passenger pass start date (matches the manual form's
        // "Pass Start Date"). Recognises the template header and common wordings.
        passStartDate: findIndex(
            ["passstartdate", "passstartdateyyyymmdd", "startdate"],
            ["passstart", "startdate"],
        ),
        notes: findIndex(["notes", "remarks"], ["note", "remark"]),
    }
}

const cell = (row, index) => (index >= 0 && index < row.length ? row[index] : "")

/** Turn a Routes sheet into normalized route rows. */
const parseRouteRows = (rows, sheetName) => {
    if (rows.length < 2) return []
    const cols = resolveRouteColumns(rows[0])
    const out = []

    rows.slice(1, MAX_ROWS_PER_SHEET + 1).forEach((row, offset) => {
        if (!Array.isArray(row)) return

        const label = toText(cell(row, cols.label))
        const fromArea = toText(cell(row, cols.fromArea))
        const toLocation = toText(cell(row, cols.toLocation))

        // Skip fully blank rows and rows with nothing identifying at all.
        if (!label && !fromArea && !toLocation) return

        const operatingDays = parseDays(cell(row, cols.operatingDays))

        // --- Trip-type / leg timings ---------------------------------------
        // Prefer the NEW one-row-per-route template (explicit Trip Type + return
        // leg). Fall back to the legacy Direction + shift columns so older files
        // and free-text uploads still import.
        const legacyDirection = parseDirection(cell(row, cols.direction))
        const explicitTripType = parseTripType(cell(row, cols.tripType))

        const pickupStartTime =
            toTimeString(cell(row, cols.pickupStartTime)) ||
            toTimeString(cell(row, cols.pickupWindowStart))
        const pickupEndTime =
            toTimeString(cell(row, cols.pickupEndTime)) ||
            toTimeString(cell(row, cols.pickupWindowEnd)) ||
            toTimeString(cell(row, cols.shiftLoginTime))
        const returnStartTime =
            toTimeString(cell(row, cols.returnStartTime)) ||
            toTimeString(cell(row, cols.shiftLogoutTime))
        const returnEndTime = toTimeString(cell(row, cols.returnEndTime))

        // Explicit outbound/return stop columns win; otherwise the single legacy
        // "Stops" column is treated as the outbound list.
        const explicitOutboundStops = parseStops(cell(row, cols.outboundStops))
        const outboundStops = explicitOutboundStops.length
            ? explicitOutboundStops
            : parseStops(cell(row, cols.stops))
        const returnStops = parseStops(cell(row, cols.returnStops))

        // Resolve the final trip type. When the Trip Type column is blank we
        // infer it: a legacy BOTH direction with a return time is a round trip.
        let tripType = explicitTripType
        if (!tripType) {
            tripType =
                legacyDirection === "BOTH" && returnStartTime ? "ROUND_TRIP" : "ONE_WAY"
        }

        out.push({
            // Stable identity for a document-sourced row so the UI can key it
            // and the backend can report per-row results.
            sourceKey: `${sheetName}:${offset + 2}`,
            sourceRow: offset + 2,
            source: "DOCUMENT",
            label: label || `${fromArea || "Pickup"} → ${toLocation || "Destination"}`,
            fromArea,
            toWorkLocation: toLocation,
            // New canonical fields (mirror the manual Assign Route form).
            tripType,
            pickupStartTime,
            pickupEndTime,
            returnStartTime,
            returnEndTime,
            outboundStops,
            returnStops,
            // Legacy fields kept so the rest of the pipeline (and older UIs) keep
            // working while everything reads the canonical fields above.
            direction:
                tripType === "ROUND_TRIP"
                    ? "BOTH"
                    : legacyDirection !== "BOTH"
                      ? legacyDirection
                      : "PICKUP",
            shiftLoginTime: toTimeString(cell(row, cols.shiftLoginTime)),
            shiftLogoutTime: returnStartTime,
            pickupWindowStart: pickupStartTime,
            pickupWindowEnd: pickupEndTime,
            numberOfTrips: toNumber(cell(row, cols.numberOfTrips)),
            headcount: toNumber(cell(row, cols.headcount)),
            preferredVehicleType: toText(cell(row, cols.preferredVehicleType)),
            operatingDays: operatingDays.length ? operatingDays : ["MON", "TUE", "WED", "THU", "FRI"],
            stops: outboundStops,
            notes: toText(cell(row, cols.notes)),
        })
    })

    return out
}

/** Turn an Employees sheet into normalized employee rows. */
const parseEmployeeRows = (rows, sheetName) => {
    if (rows.length < 2) return []
    const cols = resolveEmployeeColumns(rows[0])
    const out = []

    rows.slice(1, MAX_ROWS_PER_SHEET + 1).forEach((row, offset) => {
        if (!Array.isArray(row)) return

        const name = toText(cell(row, cols.name))
        const email = toText(cell(row, cols.email)).toLowerCase()

        // A roster row is only usable if we can identify the person.
        if (!name && !email) return

        const passMonths = toNumber(cell(row, cols.passMonths))
        const passStartDate = toDateString(cell(row, cols.passStartDate))

        out.push({
            sourceKey: `${sheetName}:${offset + 2}`,
            sourceRow: offset + 2,
            source: "DOCUMENT",
            name,
            email,
            phone: toText(cell(row, cols.phone)),
            employeeCode: toText(cell(row, cols.code)),
            department: toText(cell(row, cols.department)),
            designation: toText(cell(row, cols.designation)),
            homeAddress: toText(cell(row, cols.homeAddress)),
            // Prefer a dedicated "Pickup Area" column when the file has one,
            // otherwise fall back to the full home address.
            pickupArea:
                toText(cell(row, cols.pickupArea)) || toText(cell(row, cols.homeAddress)),
            workLocation: toText(cell(row, cols.workLocation)),
            workLocationAddress: toText(cell(row, cols.workLocationAddress)),
            city: toText(cell(row, cols.city)),
            shiftLabel: toText(cell(row, cols.shift)),
            preferredRouteLabel: toText(cell(row, cols.preferredRoute)),
            passMonths: passMonths > 0 ? passMonths : 1,
            // Empty string means "no per-row date" — getImportCandidates then
            // falls back to the brief's service start date.
            passStartDate: passStartDate || "",
            notes: toText(cell(row, cols.notes)),
        })
    })

    return out
}

/**
 * Decide what a sheet contains. Sheet NAME wins when it is explicit, otherwise
 * we score the header row — this is what makes single-sheet CSV uploads and
 * customer-specific file layouts work.
 */
const classifySheet = (sheetName, headerRow) => {
    const name = normalizeHeader(sheetName)

    // Metadata/reference sheets that the brief templates ship alongside the real
    // data (Instructions, Overview, Work Locations, Shifts). They are never
    // importable, so skip them silently instead of warning the user about them —
    // and never let "Shifts" (which also has a "Working Days" column) be
    // mistaken for a Routes sheet.
    const META_SHEETS = ["instruction", "readme", "overview", "summary", "worklocation", "location", "shift", "legend", "notes", "help"]
    if (META_SHEETS.some((meta) => name.includes(meta))) return "SKIP"

    if (name.includes("route") || name.includes("trip")) return "ROUTES"
    if (
        name.includes("employee") ||
        name.includes("student") ||
        name.includes("roster") ||
        name.includes("passenger") ||
        name.includes("staff")
    ) {
        return "EMPLOYEES"
    }

    const headers = (headerRow || []).map(normalizeHeader)
    const has = (fragment) => headers.some((h) => h && h.includes(fragment))

    // Employee sheets are identified by person-level fields.
    const employeeScore =
        (has("email") ? 2 : 0) +
        (has("phone") || has("mobile") ? 1 : 0) +
        (has("passmonth") ? 2 : 0) +
        (has("preferredroute") ? 2 : 0) +
        (has("grade") || has("department") ? 1 : 0)

    // Route sheets are identified by route-level fields.
    const routeScore =
        (has("routelabel") ? 3 : 0) +
        (has("stops") ? 2 : 0) +
        (has("workingdays") ? 2 : 0) +
        (has("pickupwindow") || has("pickupstart") ? 2 : 0) +
        (has("triptype") ? 2 : 0) +
        (has("direction") ? 1 : 0)

    if (employeeScore === 0 && routeScore === 0) return "UNKNOWN"
    return employeeScore >= routeScore ? "EMPLOYEES" : "ROUTES"
}

const extensionOf = (name = "") => {
    const match = String(name).toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
    return match ? match[1] : ""
}

/** True when a brief document looks like something this parser can read. */
export const isParseableBriefDocument = (doc = {}) => {
    const ext = extensionOf(doc.fileName) || extensionOf(doc.url)
    if (ext) return PARSEABLE_EXTENSIONS.includes(ext)
    const type = String(doc.fileType || "").toLowerCase()
    return (
        type.includes("spreadsheet") ||
        type.includes("excel") ||
        type.includes("csv") ||
        type.includes("ms-excel")
    )
}

/**
 * Parse an in-memory workbook buffer into { routes, employees, warnings }.
 * Exported separately so a freshly-uploaded file can be previewed without
 * having to be attached to the brief first.
 */
export const parseBriefWorkbookBuffer = (buffer, { label = "document" } = {}) => {
    const result = { routes: [], employees: [], sheets: [], warnings: [] }

    if (!buffer || !buffer.length) {
        result.warnings.push(`${label}: file was empty.`)
        return result
    }

    if (buffer.length > MAX_DOCUMENT_BYTES) {
        result.warnings.push(
            `${label}: file is larger than ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB and was skipped.`,
        )
        return result
    }

    let workbook
    try {
        // IMPORTANT: read with cellDates:false so time/date cells come back as
        // raw Excel serial numbers (e.g. 0.3125 === 07:30) instead of Date
        // objects. SheetJS builds Date objects using the host timezone, and for
        // Excel's 1899-12-31 epoch that pulls in historical Local Mean Time
        // offsets (e.g. Asia/Kolkata was +05:21 before 1906). That made a 07:30
        // pickup parse as 02:08 on the production server. Serial fractions are
        // timezone-independent, and toTimeString()/toNumber() handle them
        // deterministically. No column in this template is a calendar date.
        workbook = XLSX.read(buffer, { type: "buffer", cellDates: false })
    } catch (error) {
        result.warnings.push(`${label}: could not be read as a spreadsheet (${error.message}).`)
        return result
    }

    const sheetNames = (workbook.SheetNames || []).slice(0, MAX_SHEETS)
    if (!sheetNames.length) {
        result.warnings.push(`${label}: workbook has no sheets.`)
        return result
    }

    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        let rows
        try {
            rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false })
        } catch (error) {
            result.warnings.push(`${label} / ${sheetName}: sheet could not be read.`)
            continue
        }

        if (!rows.length) continue

        const kind = classifySheet(sheetName, rows[0])

        if (kind === "SKIP") {
            // Known non-data sheet (Instructions / Overview / Shifts / ...).
            result.sheets.push({ sheetName, kind: "SKIP", rows: 0 })
        } else if (kind === "ROUTES") {
            const parsed = parseRouteRows(rows, sheetName)
            result.routes.push(...parsed)
            result.sheets.push({ sheetName, kind, rows: parsed.length })
        } else if (kind === "EMPLOYEES") {
            const parsed = parseEmployeeRows(rows, sheetName)
            result.employees.push(...parsed)
            result.sheets.push({ sheetName, kind, rows: parsed.length })
        } else {
            result.sheets.push({ sheetName, kind: "UNKNOWN", rows: 0 })
            result.warnings.push(
                `${label} / ${sheetName}: could not tell whether this sheet holds routes or people, so it was skipped.`,
            )
        }
    }

    return result
}

/**
 * Download a brief document from its stored (Cloudinary) URL and parse it.
 * Never throws: download/parse problems come back as warnings so one bad
 * attachment can't break the whole import preview.
 */
export const parseBriefDocument = async (doc) => {
    const label = doc?.fileName || "attachment"

    if (!doc?.url) {
        return { routes: [], employees: [], sheets: [], warnings: [`${label}: no file URL stored.`] }
    }

    if (!isParseableBriefDocument(doc)) {
        return {
            routes: [],
            employees: [],
            sheets: [],
            warnings: [`${label}: only Excel/CSV attachments can be imported automatically.`],
        }
    }

    try {
        const response = await axios.get(doc.url, {
            responseType: "arraybuffer",
            timeout: DOWNLOAD_TIMEOUT_MS,
            maxContentLength: MAX_DOCUMENT_BYTES,
            maxBodyLength: MAX_DOCUMENT_BYTES,
        })
        return parseBriefWorkbookBuffer(Buffer.from(response.data), { label })
    } catch (error) {
        console.error("[v0] Failed to download brief document:", label, error.message)
        return {
            routes: [],
            employees: [],
            sheets: [],
            warnings: [`${label}: could not be downloaded (${error.message}).`],
        }
    }
}

/**
 * Parse every parseable attachment on a brief and merge the results, tagging
 * each row with which document it came from.
 */
export const parseBriefDocuments = async (documents = []) => {
    const merged = { routes: [], employees: [], documents: [], warnings: [] }

    for (const doc of documents) {
        const parseable = isParseableBriefDocument(doc)
        const parsed = parseable
            ? await parseBriefDocument(doc)
            : { routes: [], employees: [], sheets: [], warnings: [] }

        const docId = doc?._id ? String(doc._id) : doc?.url || ""

        merged.routes.push(
            ...parsed.routes.map((r) => ({
                ...r,
                documentId: docId,
                documentName: doc?.fileName || "",
                sourceKey: `${docId}:${r.sourceKey}`,
            })),
        )
        merged.employees.push(
            ...parsed.employees.map((e) => ({
                ...e,
                documentId: docId,
                documentName: doc?.fileName || "",
                sourceKey: `${docId}:${e.sourceKey}`,
            })),
        )
        merged.warnings.push(...parsed.warnings)
        merged.documents.push({
            documentId: docId,
            fileName: doc?.fileName || "",
            fileType: doc?.fileType || "",
            version: doc?.version || 1,
            parseable,
            routeRows: parsed.routes.length,
            employeeRows: parsed.employees.length,
            sheets: parsed.sheets,
        })
    }

    return merged
}

export default {
    parseBriefDocument,
    parseBriefDocuments,
    parseBriefWorkbookBuffer,
    isParseableBriefDocument,
}
