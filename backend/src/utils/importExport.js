import * as XLSX from "xlsx"

/**
 * Generic Import / Export engine used by every bulk-data module
 * (drivers, vehicles, routes, passengers/employees).
 *
 * A "field spec" describes one column:
 *   {
 *     key:        "licenseType",              // internal object key
 *     label:      "License Type",             // human header shown in the sheet
 *     required:   true,                       // must be present & non-empty
 *     type:       "string|number|email|date|enum|boolean",
 *     enum:       ["Light", "Medium"],        // allowed values when type === "enum"
 *     example:    "Light",                    // sample value used in the template
 *     hint:       "One of: Light, Medium",    // extra guidance shown in Instructions sheet
 *   }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Accept common human date formats and normalise to a JS Date.
const parseDate = (value) => {
    if (value instanceof Date && !isNaN(value)) return value
    const str = String(value).trim()
    if (!str) return null
    // YYYY-MM-DD / YYYY/MM/DD
    let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (m) {
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
        return isNaN(d) ? null : d
    }
    // DD-MM-YYYY / DD/MM/YYYY
    m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (m) {
        const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
        return isNaN(d) ? null : d
    }
    const fallback = new Date(str)
    return isNaN(fallback) ? null : fallback
}

const truthy = (value) => {
    const s = String(value).trim().toLowerCase()
    return ["true", "yes", "y", "1"].includes(s)
}
const falsy = (value) => {
    const s = String(value).trim().toLowerCase()
    return ["false", "no", "n", "0"].includes(s)
}

/**
 * Parse an uploaded .xlsx / .csv buffer into an array of plain row objects
 * keyed by the column headers (first row).
 */
export const parseSpreadsheet = (buffer) => {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
        blankrows: false,
    })
    // Trim header keys and string values.
    return rows.map((row) => {
        const clean = {}
        for (const [k, v] of Object.entries(row)) {
            clean[String(k).trim()] = typeof v === "string" ? v.trim() : v
        }
        return clean
    })
}

/**
 * Validate + coerce a single raw row (keyed by human labels) against the spec.
 * Returns { data, errors } where data is the internal-keyed object.
 */
export const validateRow = (rawRow, fields) => {
    const data = {}
    const errors = []

    for (const field of fields) {
        const rawValue = rawRow[field.label]
        const isEmpty = rawValue === undefined || rawValue === null || String(rawValue).trim() === ""

        if (isEmpty) {
            if (field.required) {
                errors.push(`"${field.label}" is required`)
            }
            continue
        }

        const value = typeof rawValue === "string" ? rawValue.trim() : rawValue

        switch (field.type) {
            case "number": {
                const num = Number(value)
                if (Number.isNaN(num)) {
                    errors.push(`"${field.label}" must be a number (got "${value}")`)
                } else if (field.min !== undefined && num < field.min) {
                    errors.push(`"${field.label}" must be at least ${field.min}`)
                } else {
                    data[field.key] = num
                }
                break
            }
            case "email": {
                if (!EMAIL_RE.test(String(value))) {
                    errors.push(`"${field.label}" is not a valid email address (got "${value}")`)
                } else {
                    data[field.key] = String(value).toLowerCase()
                }
                break
            }
            case "date": {
                const d = parseDate(value)
                if (!d) {
                    errors.push(`"${field.label}" must be a valid date in YYYY-MM-DD format (got "${value}")`)
                } else {
                    data[field.key] = d
                }
                break
            }
            case "enum": {
                const allowed = field.enum || []
                const match = allowed.find((opt) => String(opt).toLowerCase() === String(value).toLowerCase())
                if (!match) {
                    errors.push(`"${field.label}" must be one of: ${allowed.join(", ")} (got "${value}")`)
                } else {
                    data[field.key] = match
                }
                break
            }
            case "boolean": {
                if (truthy(value)) data[field.key] = true
                else if (falsy(value)) data[field.key] = false
                else errors.push(`"${field.label}" must be Yes or No (got "${value}")`)
                break
            }
            default: {
                data[field.key] = String(value)
            }
        }
    }

    return { data, errors }
}

/**
 * Build a downloadable template workbook (Buffer) with:
 *   - a "Template" sheet: header row of labels + one example row
 *   - an "Instructions" sheet describing every column
 */
export const buildTemplateBuffer = (fields, entityLabel = "Records") => {
    const headers = fields.map((f) => f.label)
    const example = fields.map((f) => (f.example !== undefined ? f.example : ""))

    const templateSheet = XLSX.utils.aoa_to_sheet([headers, example])
    // Set a sensible column width for readability.
    templateSheet["!cols"] = headers.map((h) => ({ wch: Math.max(16, h.length + 4) }))

    const instructionRows = [
        [`How to import ${entityLabel}`],
        [""],
        ["1. Fill in one row per record on the 'Template' sheet."],
        ["2. Keep the header row exactly as-is. Do not rename or reorder columns."],
        ["3. The first data row is an EXAMPLE - replace it with your real data or delete it."],
        ["4. Required columns must not be left blank."],
        ["5. Save the file as .xlsx or .csv and upload it back."],
        [""],
        ["Column", "Required", "Type", "Allowed values / format", "Notes"],
        ...fields.map((f) => [
            f.label,
            f.required ? "Yes" : "No",
            f.type || "string",
            f.type === "enum"
                ? (f.enum || []).join(", ")
                : f.type === "date"
                    ? "YYYY-MM-DD"
                    : f.type === "boolean"
                        ? "Yes / No"
                        : f.type || "text",
            f.hint || "",
        ]),
    ]
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows)
    instructionSheet["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 40 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, templateSheet, "Template")
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions")

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
}

/**
 * Build an export workbook (Buffer) from an array of already-serialised
 * row objects (keyed by the field labels).
 */
export const buildExportBuffer = (fields, rows, sheetName = "Export") => {
    const headers = fields.map((f) => f.label)
    const aoa = [headers, ...rows.map((row) => fields.map((f) => (row[f.label] ?? "")))]
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    sheet["!cols"] = headers.map((h) => ({ wch: Math.max(16, h.length + 4) }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31))
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
}
