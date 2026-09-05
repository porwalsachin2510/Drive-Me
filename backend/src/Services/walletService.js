import Wallet from "../models/Wallet.js"
import Transaction from "../models/Transaction.js"
import User from "../models/User.js"

/**
 * walletService — the single, currency-aware entry point for every wallet
 * balance mutation in the platform.
 *
 * WHY THIS EXISTS
 * ---------------
 * A user holds ONE wallet PER currency (enforced by the compound unique index
 * { userId, currency } on the Wallet model). This is what stops money from
 * different countries from ever mixing inside one balance. The classic bug this
 * prevents: an admin earns AED 1,600 commission on a UAE booking, but the code
 * dropped it into the admin's single wallet whose currency happened to be "KWD",
 * so the dashboard rendered "KWD 1,600" — a relabel with no conversion.
 *
 * Every credit/debit MUST go through this service so the amount always lands in
 * the wallet whose currency equals the transaction's real currency. The admin
 * dashboard then converts + sums across the per-currency wallets for display.
 */

const VALID_WALLET_ROLES = [
    "COMMUTER",
    "CORPORATE",
    "CORPORATE_EMPLOYEE",
    "SCHOOL_STUDENT",
    // School segment mirrors the corporate segment (SCHOOL_CUSTOMER<->CORPORATE,
    // SCHOOL_PARTNER<->B2B_PARTNER). These MUST be valid wallet roles, otherwise
    // resolveRole() silently downgrades a School Partner's wallet to COMMUTER
    // even when the caller passes the correct role.
    "SCHOOL_CUSTOMER",
    "SCHOOL_PARTNER",
    "SCHOOL_PARTNER_DRIVER",
    "SCHOOL_CUSTOMER_DRIVER",
    "B2C_PARTNER",
    "B2C_PARTNER_DRIVER",
    "B2B_PARTNER",
    "B2B_PARTNER_DRIVER",
    "CORPORATE_DRIVER",
    "ADMIN",
    "DEMAND_FIELD",
    "DEMAND_FINANCE",
]

const SUPPORTED_CURRENCIES = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"]

const normalizeCurrency = (currency) => {
    const cur = String(currency || "AED").toUpperCase()
    return SUPPORTED_CURRENCIES.includes(cur) ? cur : "AED"
}

const resolveRole = (role) => (VALID_WALLET_ROLES.includes(role) ? role : "COMMUTER")

/**
 * Get (or lazily create) the wallet for a given user IN A SPECIFIC CURRENCY.
 * This is the function that should replace bare `Wallet.findOne({ userId })`
 * lookups anywhere money is added or removed — passing the transaction's
 * currency guarantees the funds hit the correct per-currency wallet.
 *
 * @param {string|ObjectId} userId
 * @param {object} opts
 * @param {string} opts.currency  Transaction currency (AED, KWD, ...). Required in spirit.
 * @param {string} [opts.role]    Wallet role, used only when creating a new wallet.
 * @param {import('mongoose').ClientSession} [opts.session]  Optional transaction session.
 * @returns {Promise<import('mongoose').Document>} the wallet document (unsaved if just created)
 */
export const getOrCreateWallet = async (userId, { currency, role, session } = {}) => {
    const cur = normalizeCurrency(currency)
    const query = Wallet.findOne({ userId, currency: cur })
    if (session) query.session(session)
    let wallet = await query

    // When the caller didn't pass an explicit (valid) role, derive it from the
    // user's ACTUAL role so a partner's wallet is never mislabelled COMMUTER.
    let effectiveRole = VALID_WALLET_ROLES.includes(role) ? role : null
    if (!effectiveRole) {
        const u = await User.findById(userId).select("role").lean().catch(() => null)
        effectiveRole = resolveRole(u?.role)
    }

    if (!wallet) {
        wallet = new Wallet({
            userId,
            role: effectiveRole,
            balance: 0,
            currency: cur,
            transactions: [],
        })
    } else if (
        wallet.role !== effectiveRole &&
        effectiveRole !== "COMMUTER" &&
        VALID_WALLET_ROLES.includes(effectiveRole)
    ) {
        // Self-heal a wallet whose stored role drifted from the user's real role
        // (e.g. created as COMMUTER before this role became valid). Never
        // downgrade to the COMMUTER fallback.
        wallet.role = effectiveRole
    }
    return wallet
}

// Cache the resolved platform admin id for the lifetime of the process so we
// don't re-query on every commission credit.
let _cachedPlatformAdminId = null

/**
 * Resolve the REAL platform admin user id that should receive platform
 * commission.
 *
 * The old code credited `process.env.ADMIN_USER_ID` blindly. When that env var
 * was missing, stale, or a placeholder that no longer maps to a User document,
 * `getOrCreateWallet` still happily created a wallet for that dangling id — which
 * is exactly why the Wallet Management screen showed a ghost "Unknown" ADMIN
 * wallet collecting commission that no real admin could ever see or withdraw.
 *
 * This helper only trusts `ADMIN_USER_ID` when it actually points at a real
 * ADMIN user; otherwise it falls back to the genuine ADMIN account (the oldest
 * one — the platform Super Admin). It returns null when no admin exists, so
 * callers can skip crediting instead of minting an orphan wallet.
 *
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<string|null>}
 */
export const resolvePlatformAdminId = async (session) => {
    if (_cachedPlatformAdminId) return _cachedPlatformAdminId

    const envId = process.env.ADMIN_USER_ID
    if (envId) {
        const q = User.findOne({ _id: envId, role: "ADMIN" }).select("_id")
        if (session) q.session(session)
        const envAdmin = await q.catch(() => null)
        if (envAdmin) {
            _cachedPlatformAdminId = String(envAdmin._id)
            return _cachedPlatformAdminId
        }
        console.warn(
            "[walletService] ADMIN_USER_ID does not map to a real ADMIN user; falling back to the actual platform admin account.",
        )
    }

    // Fall back to the genuine platform admin (oldest ADMIN account).
    const q = User.findOne({ role: "ADMIN" }).sort({ createdAt: 1 }).select("_id")
    if (session) q.session(session)
    const admin = await q.catch(() => null)
    if (admin) {
        _cachedPlatformAdminId = String(admin._id)
        return _cachedPlatformAdminId
    }

    console.error("[walletService] No ADMIN user found — platform commission cannot be credited.")
    return null
}

/**
 * Resolve the wallet `role` for a partner/user id from their actual User.role,
 * so a School Partner's wallet is labelled SCHOOL_PARTNER (not hardcoded as a
 * B2B partner). Falls back to the given default if the user can't be resolved.
 *
 * @param {string} userId
 * @param {string} [fallback="B2B_PARTNER"]
 * @returns {Promise<string>}
 */
export const resolveUserWalletRole = async (userId, fallback = "B2B_PARTNER") => {
    if (!userId) return fallback
    const user = await User.findById(userId).select("role").lean().catch(() => null)
    return user?.role || fallback
}

/**
 * Credit (add) money to a user's wallet in the transaction's currency, writing
 * BOTH the embedded wallet transaction entry and a normalized Transaction ledger
 * record (the ledger is the source of truth the migration rebuilds from).
 *
 * @returns {Promise<{ wallet, transaction, newBalance }>}
 */
export const creditWallet = async ({
    userId,
    role,
    amount,
    currency,
    embeddedType = "DEPOSIT",
    ledgerCategory = "PAYMENT_RECEIVED",
    description,
    reference,
    referenceId,
    referenceModel,
    fromUserId,
    fromName,
    toUserId,
    toName,
    countsAsEarning = true,
    metadata,
    session,
}) => {
    if (!userId || !amount || amount <= 0) {
        return { success: false, message: "Invalid credit parameters" }
    }
    const cur = normalizeCurrency(currency)
    const wallet = await getOrCreateWallet(userId, { currency: cur, role, session })

    const balanceBefore = wallet.balance || 0

    wallet.transactions.push({
        type: embeddedType,
        amount,
        description: description || "Wallet credit",
        reference,
        status: "COMPLETED",
        senderId: fromUserId,
        senderName: fromName,
        recipientId: toUserId,
        recipientName: toName,
        createdAt: new Date(),
    })
    wallet.balance = balanceBefore + amount
    if (countsAsEarning) {
        wallet.totalEarnings = (wallet.totalEarnings || 0) + amount
    }
    await wallet.save({ session })

    const ledger = new Transaction({
        walletId: wallet._id,
        userId,
        type: "CREDIT",
        amount,
        currency: cur,
        category: ledgerCategory,
        description: description || "Wallet credit",
        referenceId,
        referenceModel,
        fromUserId,
        fromName,
        toUserId,
        toName,
        balanceBefore,
        balanceAfter: wallet.balance,
        metadata,
    })
    await ledger.save({ session })

    return { success: true, wallet, transaction: ledger, newBalance: wallet.balance }
}

/**
 * Debit (subtract) money from a user's wallet in the transaction's currency.
 * Mirrors creditWallet and writes the same dual records.
 */
export const debitWallet = async ({
    userId,
    role,
    amount,
    currency,
    embeddedType = "WITHDRAWAL",
    ledgerCategory = "WITHDRAWAL",
    description,
    reference,
    referenceId,
    referenceModel,
    fromUserId,
    fromName,
    toUserId,
    toName,
    allowNegative = false,
    metadata,
    session,
}) => {
    if (!userId || !amount || amount <= 0) {
        return { success: false, message: "Invalid debit parameters" }
    }
    const cur = normalizeCurrency(currency)
    const wallet = await getOrCreateWallet(userId, { currency: cur, role, session })

    const balanceBefore = wallet.balance || 0
    if (!allowNegative && balanceBefore < amount) {
        return { success: false, message: "Insufficient balance", wallet, newBalance: balanceBefore }
    }

    wallet.transactions.push({
        type: embeddedType,
        amount,
        description: description || "Wallet debit",
        reference,
        status: "COMPLETED",
        senderId: fromUserId,
        senderName: fromName,
        recipientId: toUserId,
        recipientName: toName,
        createdAt: new Date(),
    })
    wallet.balance = balanceBefore - amount
    await wallet.save({ session })

    const ledger = new Transaction({
        walletId: wallet._id,
        userId,
        type: "DEBIT",
        amount,
        currency: cur,
        category: ledgerCategory,
        description: description || "Wallet debit",
        referenceId,
        referenceModel,
        fromUserId,
        fromName,
        toUserId,
        toName,
        balanceBefore,
        balanceAfter: wallet.balance,
        metadata,
    })
    await ledger.save({ session })

    return { success: true, wallet, transaction: ledger, newBalance: wallet.balance }
}

export default { getOrCreateWallet, creditWallet, debitWallet }
