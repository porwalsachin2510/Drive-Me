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
