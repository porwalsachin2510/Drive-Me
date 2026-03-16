import { v2 as cloudinary } from "cloudinary"
import streamifier from "streamifier"
import dotenv from "dotenv"
import path from "path"

dotenv.config()

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("[v0] ❌ Cloudinary credentials missing")
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
    timeout: 120000,
})

export const uploadToCloudinary = (file, folder = "driveme", fieldName = "") => {
    return new Promise((resolve, reject) => {
        if (!file?.buffer) {
            return reject(new Error("No file buffer provided"))
        }

        let fileExtension = ""
        if (file.mimetype === "application/pdf") {
            fileExtension = "pdf"
        } else if (file.mimetype.startsWith("image/")) {
            fileExtension = file.mimetype.split("/")[1] || "jpg"
        } else if (
            file.mimetype === "application/msword" ||
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
            fileExtension = file.mimetype.includes("word") ? "docx" : "doc"
        } else {
            fileExtension = path.parse(file.originalname).ext.substring(1) || "bin"
        }

        // Use fieldName for public_id if provided, otherwise use originalname
        const baseFileName = fieldName || path.parse(file.originalname).name

        const sanitizedFileName = baseFileName
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .substring(0, 100)

        const timestamp = Date.now()
        const publicIdName = `${sanitizedFileName}_${timestamp}.${fileExtension}`

        console.log("[v0] Original filename:", file.originalname)
        console.log("[v0] Mimetype:", file.mimetype)
        console.log("[v0] Sanitized filename:", sanitizedFileName)
        console.log("[v0] File extension:", fileExtension)
        console.log("[v0] Folder:", folder)
        console.log("[v0] Public ID with extension:", publicIdName)

        // Determine resource type based on mimetype
        const isImage = file.mimetype.startsWith("image/")
        const resourceType = isImage ? "image" : "raw"

        const uploadOptions = {
            resource_type: resourceType,
            folder: folder,
            public_id: publicIdName.replace(`.${fileExtension}`, ""), // Remove extension for public_id as format will be added
            format: isImage ? undefined : fileExtension, // Let Cloudinary handle image format
            use_filename: false,
            unique_filename: false,
            overwrite: false,
            access_mode: "public",
            type: "upload",
        }

        console.log("[v0] Cloudinary upload options:", uploadOptions)

        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                console.error("[v0] Cloudinary upload error:", error.message)
                return reject(error)
            }
            console.log("[v0] Cloudinary upload success:", result.secure_url)
            console.log("[v0] File location:", result.public_id)
            resolve(result)
        })

        uploadStream.on("error", reject)

        streamifier.createReadStream(file.buffer).pipe(uploadStream)
    })
}

export const uploadMultipleSequential = async (files, folder) => {
    const results = []

    for (const file of files) {
        const fieldName = file.fieldname || file.originalname.split(".")[0]
        console.log(`[v0] Uploading sequentially: ${file.originalname} with fieldname: ${fieldName}`)
        const uploaded = await uploadToCloudinary(file, folder, fieldName)
        results.push(uploaded)
    }

    return results
}

export default cloudinary
