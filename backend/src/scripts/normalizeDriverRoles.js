/**
 * One-time data normalization.
 *
 * Drivers created by a SCHOOL_PARTNER before the segment split were stored with
 * role "B2B_PARTNER_DRIVER". This aligns each driver User account's role with
 * the segment of the partner/customer that employs it, so the correct label
 * ("School Partner Driver") renders in the driver panel.
 *
 * Run:  node --env-file-if-exists=/vercel/share/.env.project src/scripts/normalizeDriverRoles.js
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "../models/User.js"

dotenv.config()

const OWNER_TO_DRIVER = {
    SCHOOL_PARTNER: "SCHOOL_PARTNER_DRIVER",
    B2B_PARTNER: "B2B_PARTNER_DRIVER",
    SCHOOL_CUSTOMER: "SCHOOL_CUSTOMER_DRIVER",
    CORPORATE: "CORPORATE_DRIVER",
}

const DRIVER_ROLES = ["B2B_PARTNER_DRIVER", "SCHOOL_PARTNER_DRIVER", "CORPORATE_DRIVER", "SCHOOL_CUSTOMER_DRIVER"]

async function run() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
    if (!uri) {
        console.error("[normalizeDriverRoles] No Mongo connection string found in env.")
        process.exit(1)
    }

    await mongoose.connect(uri)
    console.log("[normalizeDriverRoles] Connected.")

    const drivers = await User.find({ role: { $in: DRIVER_ROLES }, employedBy: { $ne: null } }).select("_id role employedBy")
    let updated = 0

    for (const driver of drivers) {
        const owner = await User.findById(driver.employedBy).select("role")
        if (!owner) continue

        const expectedRole = OWNER_TO_DRIVER[owner.role]
        if (expectedRole && expectedRole !== driver.role) {
            await User.updateOne({ _id: driver._id }, { $set: { role: expectedRole } })
            updated += 1
            console.log(`[normalizeDriverRoles] ${driver._id}: ${driver.role} -> ${expectedRole} (owner ${owner.role})`)
        }
    }

    console.log(`[normalizeDriverRoles] Done. Updated ${updated} driver account(s).`)
    await mongoose.disconnect()
    process.exit(0)
}

run().catch((err) => {
    console.error("[normalizeDriverRoles] Failed:", err)
    process.exit(1)
})
