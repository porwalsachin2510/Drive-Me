/**
 * One-time data normalization for managed-service PASSENGERS.
 *
 * A customer buys monthly passes for the people it transports. Those people are
 * created from the customer's roster (Employees / Students screen), from the
 * bulk upload, from the requirement-brief import, or by self-registration:
 *
 *   CORPORATE        -> its passengers are employees            -> CORPORATE_EMPLOYEE
 *   SCHOOL_CUSTOMER  -> its passengers are students / teachers  -> SCHOOL_STUDENT
 *
 * Before the segment split every roster entry was persisted as
 * CORPORATE_EMPLOYEE, so a school's students carry the corporate role and render
 * as "Corporate Employee" in the passenger portal, the admin user list and the
 * admin wallet list. This script re-derives each passenger's role from the
 * segment of the organisation that owns it (`companyId`) and fixes the matching
 * Wallet.userRole, which snapshots the same value.
 *
 * Idempotent: healthy records are skipped, so it is safe to re-run.
 *
 * Run:  node src/scripts/normalizePassengerRoles.js
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "../models/User.js"
import Wallet from "../models/Wallet.js"
import { PASSENGER_ROLES, CUSTOMER_ROLES, passengerRoleForOwner } from "../utils/roleFamilies.js"

dotenv.config()

async function run() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
    if (!uri) {
        console.error("[normalizePassengerRoles] No Mongo connection string found in env.")
        process.exit(1)
    }

    await mongoose.connect(uri)
    console.log("[normalizePassengerRoles] Connected.")

    // Every passenger account, regardless of which segment role it currently
    // holds — a corporate employee could equally have been mislabeled the other
    // way by a manual edit, and re-deriving from the owner fixes both.
    const passengers = await User.find({ role: { $in: PASSENGER_ROLES } })
        .select("_id role companyId email")
        .lean()

    console.log(`[normalizePassengerRoles] Scanning ${passengers.length} passenger account(s).`)

    // Cache owner lookups: a roster typically shares one owner across many rows.
    const ownerCache = new Map()
    const getOwner = async (companyId) => {
        const key = String(companyId)
        if (ownerCache.has(key)) return ownerCache.get(key)
        const owner = await User.findById(companyId).select("role companyName").lean()
        ownerCache.set(key, owner)
        return owner
    }

    let usersUpdated = 0
    let walletsUpdated = 0
    let skippedNoOwner = 0

    for (const passenger of passengers) {
        if (!passenger.companyId) {
            skippedNoOwner += 1
            continue
        }

        const owner = await getOwner(passenger.companyId)
        // Only re-derive when the owner really is a customer-side account. Anything
        // else is unexpected data we must not guess about.
        if (!owner || !CUSTOMER_ROLES.includes(owner.role)) {
            skippedNoOwner += 1
            continue
        }

        const expectedRole = passengerRoleForOwner(owner.role)

        if (expectedRole !== passenger.role) {
            await User.updateOne({ _id: passenger._id }, { $set: { role: expectedRole } })
            usersUpdated += 1
            console.log(
                `[normalizePassengerRoles] ${passenger.email}: ${passenger.role} -> ${expectedRole} (owner ${owner.companyName || owner.role})`,
            )
        }

        // The wallet snapshots the owner's role at creation time, so it drifts with
        // the user document. Keep them in lockstep.
        const walletResult = await Wallet.updateOne(
            { userId: passenger._id, userRole: { $ne: expectedRole } },
            { $set: { userRole: expectedRole } },
        )
        if (walletResult.modifiedCount > 0) walletsUpdated += 1
    }

    console.log(
        `[normalizePassengerRoles] Done. Updated ${usersUpdated} passenger account(s) and ${walletsUpdated} wallet(s). Skipped ${skippedNoOwner} without a resolvable customer owner.`,
    )
    await mongoose.disconnect()
    process.exit(0)
}

run().catch((err) => {
    console.error("[normalizePassengerRoles] Failed:", err)
    process.exit(1)
})
