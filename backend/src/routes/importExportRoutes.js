import express from "express"
import multer from "multer"
import { verifyToken } from "../middleware/auth.js"
import { getTemplate, exportData, importData } from "../controllers/importExportController.js"

const router = express.Router()

// Spreadsheet uploads are held in memory and parsed directly (never written to disk).
const SPREADSHEET_MIMES = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv",
    "application/csv",
    "text/plain",
    "application/octet-stream", // some browsers send this for .xlsx/.csv
])

const uploadSpreadsheet = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || "").toLowerCase()
        const okExt = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")
        if (SPREADSHEET_MIMES.has(file.mimetype) || okExt) {
            cb(null, true)
        } else {
            cb(new Error("Invalid file type. Please upload a .xlsx or .csv file."), false)
        }
    },
})

const handleUploadError = (err, req, res, next) => {
    if (err) {
        return res.status(400).json({ success: false, message: err.message || "File upload error." })
    }
    next()
}

// GET  /api/import-export/:entity/template  -> download a fill-in template
router.get("/:entity/template", verifyToken, getTemplate)

// GET  /api/import-export/:entity/export    -> download current records as .xlsx
router.get("/:entity/export", verifyToken, exportData)

// POST /api/import-export/:entity/import     -> bulk import from uploaded file
router.post(
    "/:entity/import",
    verifyToken,
    (req, res, next) => uploadSpreadsheet.single("file")(req, res, (err) => handleUploadError(err, req, res, next)),
    importData,
)

export default router
