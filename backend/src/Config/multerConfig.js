import multer from "multer"

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
    console.log(`[v0] Multer processing file: ${file.originalname}, Type: ${file.mimetype}, Field: ${file.fieldname}`)

    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"]

    if (allowedMimes.includes(file.mimetype)) {
        console.log(`[v0] File ${file.originalname} accepted`)
        cb(null, true)
    } else {
        console.log(`[v0] File ${file.originalname} rejected: Invalid type ${file.mimetype}`)
        cb(
            new Error(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WEBP) and PDFs are allowed.`),
            false,
        )
    }
}

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 15, // Max 15 files total
    },
})

export const uploadDriverDocuments = upload.fields([
    { name: "license", maxCount: 1 },
    { name: "passport", maxCount: 1 },
    { name: "visa", maxCount: 1 },
    { name: "medicalCertificate", maxCount: 1 },
])

// --- Managed-service brief requirement documents ---
// Customers prepare their transportation requirement in whatever format they
// already have, so this accepts spreadsheets (Excel/CSV), documents (Word),
// PDFs and images. Kept separate from the strict image/PDF-only `upload` above.
const briefDocMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    // Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // CSV / plain text
    "text/csv",
    "application/csv",
    "text/plain",
]

const briefDocFilter = (req, file, cb) => {
    // Some browsers send xlsx/csv with a generic octet-stream mimetype, so fall
    // back to the file extension when the mimetype is not explicitly allowed.
    const allowedExt = /\.(jpe?g|png|gif|webp|pdf|xlsx?|docx?|csv|txt)$/i
    if (briefDocMimes.includes(file.mimetype) || allowedExt.test(file.originalname)) {
        cb(null, true)
    } else {
        cb(
            new Error(
                `Invalid file type: ${file.mimetype}. Allowed: Excel, CSV, Word, PDF, images.`,
            ),
            false,
        )
    }
}

export const uploadBriefDocuments = multer({
    storage,
    fileFilter: briefDocFilter,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB per file (spreadsheets can be large)
        files: 10,
    },
}).array("documents", 10)

export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("[v0] Multer Error:", err.message)
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File size too large. Maximum 10MB per file allowed.",
            })
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                message: "Too many files. Maximum 15 files allowed.",
            })
        }
        return res.status(400).json({
            success: false,
            message: err.message,
        })
    }

    if (err) {
        console.error("[v0] Upload Error:", err.message)
        return res.status(400).json({
            success: false,
            message: err.message || "File upload error",
        })
    }

    next()
}
