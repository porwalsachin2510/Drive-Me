import api from "../utils/api"

/**
 * Import / Export service.
 *
 * Talks to the backend `/api/import-export` endpoints. Every entity (drivers,
 * vehicles, routes, employees, etc.) shares the same three operations:
 *   - downloadTemplate(entity)  -> a pre-formatted .xlsx template with headers,
 *                                  an example row and a "Instructions" sheet.
 *   - exportRecords(entity)     -> current records as a .xlsx file.
 *   - importRecords(entity,file)-> upload a filled .xlsx/.csv, returns a
 *                                  per-row report { created, skipped, errors }.
 *
 * The `entity` string maps to a key in the backend entity registry, e.g.
 * "b2cPartnerDriver", "b2cPartnerVehicle", "b2cPartnerRoute",
 * "driver", "vehicle", "corporateEmployee".
 */

const triggerBrowserDownload = (blob, fallbackName, contentDisposition) => {
    // Prefer the server-provided filename when present.
    let filename = fallbackName
    if (contentDisposition) {
        const match = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i.exec(contentDisposition)
        if (match && match[1]) {
            filename = decodeURIComponent(match[1])
        }
    }

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

const importExportService = {
    /** Download the pre-formatted template for an entity. */
    downloadTemplate: async (entity) => {
        const response = await api.get(`/import-export/${entity}/template`, {
            responseType: "blob",
        })
        triggerBrowserDownload(
            response.data,
            `${entity}-template.xlsx`,
            response.headers?.["content-disposition"],
        )
        return true
    },

    /** Export current records for an entity as an .xlsx file. */
    exportRecords: async (entity, params = {}) => {
        const response = await api.get(`/import-export/${entity}/export`, {
            params,
            responseType: "blob",
        })
        triggerBrowserDownload(
            response.data,
            `${entity}-export.xlsx`,
            response.headers?.["content-disposition"],
        )
        return true
    },

    /**
     * Upload a filled template. Returns the backend report:
     * { success, summary: { total, created, skipped }, errors: [{ row, messages }] }
     */
    importRecords: async (entity, file, options = {}) => {
        const formData = new FormData()
        formData.append("file", file)
        if (options.sendEmails === false) {
            formData.append("sendEmails", "false")
        }
        const response = await api.post(`/import-export/${entity}/import`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return response.data
    },
}

export default importExportService
