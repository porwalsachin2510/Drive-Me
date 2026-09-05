/**
 * One-time reconciliation for GHOST "Unknown" ADMIN wallets.
 *
 * WHY THIS EXISTS
 * ---------------
 * Commission credits used to target `process.env.ADMIN_USER_ID` blindly. When
 * that env var was missing, stale, or a placeholder that no longer maps to a
 * real User, getOrCreateWallet() still created a wallet for that dangling id.
 * The Wallet Management screen then showed a phantom ADMIN wallet whose owner
 * rendered as "Unknown" (no User document to resolve a name from), quietly
 * collecting platform commission that no real admin could see or withdraw.
 *
 * The code fix (walletService.resolvePlatformAdminId) stops NEW money from
 * landing there. This script repairs the EXISTING damage: for every ADMIN wallet
 * whose userId does not map to a real ADMIN user, it moves the balance, earnings,
 * withdrawals, pending amounts and embedded transactions into the genuine
 * platform admin's wallet FOR THE SAME CURRENCY (creating it if needed), repoints
 * the normalized Transaction ledger rows to the real admin, and deletes the
 * emptied orphan wallet.
 *
 * Idempotent: once no orphan ADMIN wallets remain, re-running is a no-op.
 *
 * DRY RUN (default): prints what it WOULD do, changes nothing.
 *   node src/scripts/reconcileOrphanAdminWallets.js
 * APPLY:
 *   node src/scripts/reconcileOrphanAdminWallets.js --apply
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "../models/User.js"
import Wallet from "../models/Wallet.js"
import Transaction from "../models/Transaction.js"

dotenv.config({ path: ".env.development.local" })
dotenv.config() // fall back to .env if present

const APPLY = process.argv.includes("--apply")

async function run() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL
    if (!uri) {
        console.error("[reconcileOrphanAdminWallets] No Mongo connection string found in env.")
        process.exit(1)
    }
    await mongoose.connect(uri)
    console.log(`[reconcileOrphanAdminWallets] Connected. Mode: ${APPLY ? "APPLY" : "DRY RUN"}`)

    // 1. Resolve the genuine platform admin (prefer a valid ADMIN_USER_ID, else
    //    the oldest ADMIN account — same rule the runtime resolver uses).
    let realAdmin = null
    if (process.env.ADMIN_USER_ID) {
        realAdmin = await User.findOne({ _id: process.env.ADMIN_USER_ID, role: "ADMIN" }).select("_id fullName email")
    }
    if (!realAdmin) {
        realAdmin = await User.findOne({ role: "ADMIN" }).sort({ createdAt: 1 }).select("_id fullName email")
    }
    if (!realAdmin) {
        console.error("[reconcileOrphanAdminWallets] No real ADMIN user exists — cannot reconcile. Create an admin first.")
        await mongoose.disconnect()
        process.exit(1)
    }
    const realAdminId = String(realAdmin._id)
    console.log(`[reconcileOrphanAdminWallets] Real platform admin: ${realAdmin.fullName || realAdmin.email} (${realAdminId})`)

    // 2. Find every ADMIN wallet and figure out which ones are orphans.
    const adminWallets = await Wallet.find({ role: "ADMIN" })
    console.log(`[reconcileOrphanAdminWallets] Found ${adminWallets.length} ADMIN wallet(s).`)

    let merged = 0
    let movedTotal = 0

    for (const wallet of adminWallets) {
        const ownerId = String(wallet.userId)
        if (ownerId === realAdminId) continue // already the real admin

        // Is this wallet's owner a real ADMIN user? If so it's a legitimate
        // (perhaps secondary) admin wallet — leave it alone.
        const owner = await User.findOne({ _id: wallet.userId, role: "ADMIN" }).select("_id")
        if (owner) continue

        // Orphan wallet: its userId has no matching ADMIN user.
        const currency = wallet.currency || "AED"
        console.log(
            `[reconcileOrphanAdminWallets] ORPHAN wallet ${wallet._id} (owner ${ownerId}, ${currency}): balance=${wallet.balance}, earnings=${wallet.totalEarnings}, txns=${wallet.transactions?.length || 0}`,
        )
        movedTotal += wallet.balance || 0

        if (!APPLY) continue

        // Destination: the real admin's wallet in the SAME currency.
        let dest = await Wallet.findOne({ userId: realAdminId, currency })
        if (!dest) {
            dest = new Wallet({ userId: realAdminId, role: "ADMIN", currency, balance: 0, transactions: [] })
        }

        dest.balance = (dest.balance || 0) + (wallet.balance || 0)
        dest.totalEarnings = (dest.totalEarnings || 0) + (wallet.totalEarnings || 0)
        dest.totalWithdrawals = (dest.totalWithdrawals || 0) + (wallet.totalWithdrawals || 0)
        dest.pendingAmount = (dest.pendingAmount || 0) + (wallet.pendingAmount || 0)
        if (Array.isArray(wallet.transactions) && wallet.transactions.length) {
            dest.transactions.push(...wallet.transactions)
        }
        await dest.save()

        // Repoint the normalized ledger rows so history follows the money.
        const ledgerResult = await Transaction.updateMany(
            { walletId: wallet._id },
            { $set: { walletId: dest._id, userId: realAdminId } },
        )
        // Also fix any ledger rows that recorded the orphan userId but a different walletId.
        await Transaction.updateMany(
            { userId: wallet.userId },
            { $set: { userId: realAdminId } },
        )

        await Wallet.deleteOne({ _id: wallet._id })
        merged += 1
        console.log(
            `[reconcileOrphanAdminWallets]   -> merged into ${dest._id}; repointed ${ledgerResult.modifiedCount} ledger row(s); deleted orphan.`,
        )
    }

    if (!APPLY) {
        console.log(
            `[reconcileOrphanAdminWallets] DRY RUN complete. Would move ~${movedTotal} across orphan wallet(s). Re-run with --apply to execute.`,
        )
    } else {
        console.log(`[reconcileOrphanAdminWallets] Done. Merged ${merged} orphan ADMIN wallet(s) into the real admin.`)
    }

    await mongoose.disconnect()
    process.exit(0)
}

run().catch((err) => {
    console.error("[reconcileOrphanAdminWallets] Failed:", err)
    process.exit(1)
})
