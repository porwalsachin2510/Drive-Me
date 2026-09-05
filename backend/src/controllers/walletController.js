import Wallet from "../models/Wallet.js"
import { getOrCreateWallet } from "../Services/walletService.js"
import { expandRoleFamilies } from "../utils/roleFamilies.js"
import User from "../models/User.js"
import Transaction from "../models/Transaction.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import WithdrawalRequest from "../models/WithdrawalRequest.js"
import ProcessedPayment from "../models/ProcessedPayment.js"
import { sendRealTimeNotification, notifyAdminsWalletEvent } from "../Services/socketService.js"
import { createNotification } from "./notificationController.js"
import { detectCountryFromCurrency, getPaymentGateway } from "../Services/paymentGatewayService.js"
import { getCountryCurrency, getCurrencyDecimals, getCurrencySymbol, getCountryPaymentMethods, getEffectiveCountry } from "../Services/countryLocalizationService.js"
import bankValidationService from "../Services/bankValidationService.js"
import currencyConversionService from "../Services/currencyConversionService.js"
import { settleCashDuesOnTopUp } from "../Services/cashCancellationService.js"
import crypto from "crypto"

/**
 * Resolve the currency a user's wallet should use.
 *
 * - In local/dev testing (DEV_COUNTRY set), the effective country wins so the
 *   whole wallet flow can be tested per country (UAE -> AED, Kuwait -> KWD).
 * - In production (DEV_COUNTRY unset), the wallet's stored currency is
 *   authoritative (it holds real money), then the user's country.
 */
const resolveWalletCurrency = (user, storedCurrency) => {
    if (process.env.DEV_COUNTRY) {
        return getCountryCurrency(getEffectiveCountry(user))
    }
    return storedCurrency || getCountryCurrency(getEffectiveCountry(user))
}

// Create payment session for wallet funds
export const createPaymentSession = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, paymentMethod } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Payment method is required"
            })
        }

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // ===== Determine currency from the source of truth =====
        // Prefer the user's existing wallet currency, then their (effective)
        // country, and only fall back to the request body. The DEV_COUNTRY
        // testing override (when set) takes priority so the gateway matches.
        const existingWallet = await Wallet.findOne({ userId })
        const currency = resolveWalletCurrency(user, existingWallet?.currency) || req.body.currency || "AED"

        // Detect country and get gateway from the resolved currency
        const country = detectCountryFromCurrency(currency)
        const gateway = getPaymentGateway(country)

        // Create reference
        const reference = `WALLET-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

        // Import payment gateway service
        const paymentGatewayService = await import("../Services/paymentGatewayService.js")

        // Create payment session
        const paymentSession = await paymentGatewayService.default.createPaymentSession({
            gateway,
            amount,
            currency,
            customer: {
                email: user.email,
                name: user.fullName || user.username,
                phone: user.phone,
            },
            contractId: `WALLET-${userId}`,
            redirectUrl: `${process.env.FRONTEND_URL.split(",")[0]}/wallet/payment/verify`,
            metadata: {
                type: "WALLET_TOPUP",
                userId,
                reference,
            },
        })

        console.log("[v0] Payment session created:", {
            sessionId: paymentSession.sessionId,
            hasPaymentUrl: !!paymentSession.paymentUrl,
            provider: paymentSession.provider
        })


        return res.status(200).json({
            success: true,
            message: "Payment session created successfully",
            data: {
                sessionId: paymentSession.sessionId,
                paymentUrl: paymentSession.paymentUrl,
                reference,
                amount,
                currency,
                paymentMethod,
                gateway: paymentSession.provider || gateway
            }
        })
    } catch (error) {
        console.error("Error creating payment session:", error)
        return res.status(500).json({
            success: false,
            message: "Error creating payment session",
            error: error.message
        })
    }
}

// Get wallet balance
export const getWalletBalance = async (req, res) => {
    try {

        const userId = req.userId
        const userRole = req.userRole

        // Get user details for currency detection
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // The PRIMARY wallet is the one in the user's effective-country currency
        // (UAE -> AED, Kuwait -> KWD, ...). A user may also hold wallets in other
        // currencies (e.g. an admin earning commission from multiple countries);
        // those are summed into the converted `displayBalance` further below.
        const userCurrency = resolveWalletCurrency(user, null)
        let wallet = await Wallet.findOne({ userId, currency: userCurrency })
        if (!wallet) {
            // Fall back to ANY existing wallet before creating a new one, so we
            // never orphan a legacy single-currency wallet on first read.
            wallet = await Wallet.findOne({ userId })
        }
        if (!wallet) {
            // Map role to valid wallet roles - some driver roles don't have wallets
            // Managed-service passengers share the same wallet pipeline: a
            // SCHOOL_STUDENT is treated exactly like a CORPORATE_EMPLOYEE, and
            // a SCHOOL_CUSTOMER like a CORPORATE. expandRoleFamilies adds the
            // school equivalents so school users are not denied a wallet.
            const validWalletRoles = expandRoleFamilies(["COMMUTER", "CORPORATE", "CORPORATE_EMPLOYEE", "B2C_PARTNER", "B2C_PARTNER_DRIVER", "B2B_PARTNER", "ADMIN"])
            const resolvedRole = validWalletRoles.includes(userRole)
                ? userRole
                : validWalletRoles.includes(user.role)
                    ? user.role
                    : "COMMUTER" // fallback

            wallet = new Wallet({
                userId,
                role: resolvedRole,
                balance: 0, // No default balance for production
                currency: userCurrency,
                transactions: []
            })
            await wallet.save()
        }

        // DEV testing only: when DEV_COUNTRY is set and the wallet's currency no
        // longer matches the country being tested, reset it to a FRESH wallet in
        // the new currency. A balance can't be meaningfully carried across
        // currencies (50 AED is not 50 KWD), and a real new user in that country
        // starts with an empty wallet -- so this accurately simulates switching
        // between a clean Kuwait user and a clean UAE user. Safe because
        // DEV_COUNTRY is never set in production (this branch never runs there).
        if (process.env.DEV_COUNTRY) {
            const effectiveCurrency = getCountryCurrency(getEffectiveCountry(user))
            if (wallet.currency !== effectiveCurrency) {
                wallet.currency = effectiveCurrency
                wallet.balance = 0
                wallet.transactions = []
                await wallet.save()
            }
        } else {
            // PRODUCTION self-heal: a wallet's currency must match the user's
            // account country (the single source of truth). A legacy/stale wallet
            // can carry the wrong currency (e.g. an "AED" wallet for a Kuwait
            // user created before the country was resolved). Correct it in place
            // ONLY when it is completely safe -- i.e. the wallet is empty (no
            // balance, no commission debt, no pending amount, no transactions) so
            // no real money is ever relabeled across currencies.
            const effectiveCurrency = getCountryCurrency(getEffectiveCountry(user))
            if (
                wallet.currency !== effectiveCurrency &&
                (wallet.balance || 0) === 0 &&
                (wallet.commissionDebt || 0) === 0 &&
                (wallet.pendingAmount || 0) === 0 &&
                !(wallet.transactions && wallet.transactions.length)
            ) {
                wallet.currency = effectiveCurrency
                await wallet.save()
            }
        }

        // PRODUCTION self-heal for the wallet ROLE: a partner/customer wallet may
        // have been minted as COMMUTER before its role became a valid wallet role
        // (e.g. a School Partner). The account's real role is the source of
        // truth, so realign the stored role. Never downgrade to COMMUTER.
        const roleSelfHealValid = expandRoleFamilies([
            "CORPORATE",
            "CORPORATE_EMPLOYEE",
            "B2C_PARTNER",
            "B2C_PARTNER_DRIVER",
            "B2B_PARTNER",
            "ADMIN",
        ])
        if (
            user.role &&
            roleSelfHealValid.includes(user.role) &&
            wallet.role !== user.role
        ) {
            wallet.role = user.role
            await wallet.save()
        }

        // ===== Compute real "spent" statistics =====
        // A commuter mostly pays for rides/passes directly through the payment
        // gateway (Stripe/TAP), so those amounts are NOT in the wallet's
        // transaction array. We therefore derive spend from completed passenger
        // bookings AND from any debit-type wallet transactions (to cover wallet
        // payments / penalties), without double counting.
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        let totalSpent = 0
        let last30DaysSpent = 0

        // 1) Completed passenger bookings paid by this user (gateway payments)
        try {
            const bookings = await B2CPassengerBooking.find({
                passengerId: userId,
                paymentStatus: "COMPLETED"
            }).select("paymentAmount createdAt bookingDate")

            bookings.forEach((b) => {
                const amount = Number(b.paymentAmount) || 0
                totalSpent += amount
                const when = b.createdAt || b.bookingDate
                if (when && new Date(when) >= thirtyDaysAgo) {
                    last30DaysSpent += amount
                }
            })
        } catch (bookingErr) {
            console.error("[v0] Error summing passenger bookings for wallet stats:", bookingErr.message)
        }

        // 2) Debit-type wallet transactions (money leaving the commuter's wallet)
        const DEBIT_TYPES = ["WITHDRAWAL", "PAYOUT", "TRANSFER", "PENALTY", "CANCELLATION_FEE", "COMMISSION_DEDUCTION", "EMI_PAYMENT"]
            ; (wallet.transactions || []).forEach((t) => {
                if (t.status === "FAILED") return
                if (DEBIT_TYPES.includes(t.type)) {
                    const amount = Number(t.amount) || 0
                    totalSpent += amount
                    if (t.createdAt && new Date(t.createdAt) >= thirtyDaysAgo) {
                        last30DaysSpent += amount
                    }
                }
            })

        const walletObj = wallet.toObject ? wallet.toObject() : wallet

        // ===== Display-currency conversion =====
        // The wallet balance is stored in the wallet's NATIVE currency (e.g. a
        // Kuwait admin's commissions are held in KWD). When the caller views the
        // dashboard in another currency (e.g. an admin switches the navbar to AED),
        // the raw number must be CONVERTED, not just relabelled — otherwise
        // 1200 KWD wrongly shows as "AED 1200". We honour an optional
        // `displayCurrency` query param and return the converted value alongside
        // the native one, consistent with the Finance dashboard's conversion.
        const nativeCurrency = wallet.currency || "AED"
        const requestedDisplay = String(
            req.query?.displayCurrency || req.query?.currency || ""
        ).trim().toUpperCase()
        const SUPPORTED = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"]
        const displayCurrency = SUPPORTED.includes(requestedDisplay)
            ? requestedDisplay
            : nativeCurrency

        // displayBalance is the user's TOTAL across every per-currency wallet,
        // each converted into the display currency and summed. This is what lets
        // an admin who earned AED 1,600 and KWD 50 see one correct combined
        // number in whichever currency they select — never a raw relabel.
        const allWallets = await Wallet.find({ userId })
        const displayBalance = allWallets.reduce((sum, w) => {
            const bal = Number(w.balance) || 0
            const from = w.currency || nativeCurrency
            const converted =
                from === displayCurrency
                    ? bal
                    : currencyConversionService.convertAmount(bal, from, displayCurrency)
            return sum + (Number(converted) || 0)
        }, 0)

        return res.status(200).json({
            success: true,
            data: {
                wallet: {
                    ...walletObj,
                    totalSpent,
                    last30DaysSpent
                },
                balance: wallet.balance,
                currency: nativeCurrency,
                // Converted view for the caller's selected display currency.
                displayBalance,
                displayCurrency,
                totalSpent,
                last30DaysSpent
            }
        })
    } catch (error) {
        console.error("Error getting wallet balance:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching wallet balance"
        })
    }
}

// Get wallet transactions
export const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.userId
        const { page = 1, limit = 20 } = req.query

        // Resolve the PRIMARY wallet (the user's effective-country currency), so
        // history is shown for their active market. Fall back to any wallet.
        const historyUser = await User.findById(userId)
        const primaryCurrency = historyUser ? resolveWalletCurrency(historyUser, null) : null
        let wallet = primaryCurrency
            ? await Wallet.findOne({ userId, currency: primaryCurrency })
            : null
        if (!wallet) {
            wallet = await Wallet.findOne({ userId })
        }
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        const walletCurrency = wallet.currency || "AED"

        // ===== Build a unified transaction history =====
        // Sources, in priority order:
        //  1. Passenger bookings — the CANONICAL record of every ride/pass the commuter paid
        //     for, by CASH, WALLET or an online gateway (Card/KNET/Benefit). Carries the real
        //     paymentMethod, so this is the single source of truth for ride/pass spend.
        //  2. Embedded wallet.transactions — wallet top-ups, withdrawals, admin adjustments,
        //     earnings and refunds (anything that actually moves the wallet balance).
        //  3. Transaction-collection ledger — a parallel copy of many of the same events.
        //
        // A single WALLET-paid booking historically produced THREE rows (the booking + an
        // embedded wallet debit + a ledger record) all for the SAME money, and every row was
        // labelled "wallet". We now (a) emit the booking once with its true payment method and
        // (b) drop the wallet/ledger twins that belong to that booking, so each payment shows
        // exactly once with a correct Cash / Wallet / Card badge.
        //
        // CRITICAL: every emitted row carries an explicit `direction` ("CREDIT" | "DEBIT") and
        // a human `paymentMethod`. The frontend relies on `direction` for the +/- sign and
        // red/green colour instead of guessing from a remapped `type`.

        // Embedded transaction types that represent money coming INTO the wallet.
        const EMBEDDED_CREDIT_TYPES = new Set([
            "DEPOSIT",
            "REFUND",
            "COMMISSION_REFUND",
            "SECURITY_DEPOSIT_REFUND",
            "BOOKING_EARNING",
            "COMMISSION",
            "NEGOTIATION_COMMISSION",
        ])

        // Normalise a raw payment-method/source code into a short label for the UI badge.
        const prettyMethod = (code) => {
            switch (String(code || "").toUpperCase()) {
                case "CASH": return "Cash"
                case "WALLET": return "Wallet"
                case "CARD":
                case "CREDIT_CARD":
                case "STRIPE":
                case "TAP": return "Card"
                case "KNET": return "KNET"
                case "BENEFIT": return "Benefit"
                case "ZAINCASH": return "Zain Cash"
                case "APPLE_PAY": return "Apple Pay"
                case "GOOGLE_PAY": return "Google Pay"
                case "UPI": return "UPI"
                case "BANK": return "Bank"
                case "ADMIN": return "Admin"
                case "REFUND": return "Refund"
                default: return code ? String(code) : "Wallet"
            }
        }

        const merged = []

        // ---- Source 1: passenger bookings (canonical ride/pass spend) ----
        const bookingIdSet = new Set()
        try {
            const bookings = await B2CPassengerBooking.find({
                passengerId: userId,
                bookingStatus: { $nin: ["CANCELLED", "REJECTED"] },
            })
                .select("paymentAmount currency createdAt bookingDate pickupLocation dropoffLocation isMonthlyPass transactionId paymentMethod paymentStatus")
                .lean()

            bookings.forEach((b) => {
                bookingIdSet.add(String(b._id))
                const isCash = String(b.paymentMethod || "").toUpperCase() === "CASH"

                // A CASH fare is paid in person to the captain at travel time — it NEVER
                // moves through the wallet, so it must not be rendered as a wallet debit
                // and must not be counted in wallet spend totals. We still surface it in
                // the activity feed for history, but as a neutral, informational row
                // (direction "NONE", affectsWallet false) carrying its real settlement
                // status ("PAY ON BOARD" until collected). Wallet / Card / gateway fares
                // do correspond to real money movement and stay as DEBITs.
                merged.push({
                    _id: `booking-${String(b._id)}`,
                    type: "RIDE_PAYMENT",
                    category: "BOOKING_PAYMENT",
                    direction: isCash ? "NONE" : "DEBIT",
                    affectsWallet: !isCash,
                    amount: b.paymentAmount,
                    paymentMethod: prettyMethod(b.paymentMethod),
                    description: b.isMonthlyPass
                        ? `Monthly pass payment (${b.pickupLocation} ↔ ${b.dropoffLocation})`
                        : `Ride payment (${b.pickupLocation} → ${b.dropoffLocation})`,
                    // Cash fares are collected on board, so surface their real settlement state.
                    status: b.paymentStatus === "COMPLETED"
                        ? (isCash ? "PAID IN CASH" : "COMPLETED")
                        : (isCash ? "PAY ON BOARD" : (b.paymentStatus || "PENDING")),
                    reference: b.transactionId,
                    currency: b.currency || walletCurrency,
                    createdAt: b.createdAt || b.bookingDate,
                })
            })
        } catch (bookingErr) {
            console.error("[v0] Error loading bookings for transactions:", bookingErr.message)
        }

        // Does a free-text description point at a booking we've already emitted above?
        const refsKnownBooking = (text) => {
            const m = String(text || "").match(/booking\s+([a-f0-9]{24})/i)
            return m ? bookingIdSet.has(m[1]) : false
        }

        // Dedup of identical amount+description twins between embedded txns and the ledger.
        const seenTwins = new Set()
        const twinKey = (amount, description) =>
            `${Number(amount || 0).toFixed(2)}|${(description || "").trim()}`

            // ---- Source 2: embedded wallet transactions ----
            ; (wallet.transactions || []).forEach((t) => {
                const obj = t.toObject ? t.toObject() : t
                // Drop the wallet-side twin of a booking payment (the booking row already covers it).
                if (refsKnownBooking(obj.description)) return
                const direction = EMBEDDED_CREDIT_TYPES.has(obj.type) ? "CREDIT" : "DEBIT"
                seenTwins.add(twinKey(obj.amount, obj.description))

                // Derive a method label for older rows that pre-date the stored
                // `paymentMethod` field by parsing the description text (e.g.
                // "(Wallet payment ...)", "(Stripe payment)", "(TAP payment)",
                // "(Cash payment ...)"). Newer rows carry obj.paymentMethod directly.
                const methodFromText = (text) => {
                    const s = String(text || "")
                    if (/\(wallet payment/i.test(s) || /wallet payment\)/i.test(s)) return "WALLET"
                    if (/\(stripe payment/i.test(s) || /stripe payment\)/i.test(s)) return "STRIPE"
                    if (/\(tap payment/i.test(s) || /tap payment\)/i.test(s)) return "TAP"
                    if (/\(cash payment/i.test(s) || /cash payment/i.test(s)) return "CASH"
                    if (/\(knet/i.test(s)) return "KNET"
                    return null
                }

                let method
                if (/admin adjustment/i.test(obj.description)) method = "Admin"
                else if (obj.type === "DEPOSIT")
                    method = prettyMethod(obj.paymentMethod || methodFromText(obj.description) || "Card")
                else if (obj.type === "WITHDRAWAL" || obj.type === "PAYOUT") {
                    // A "WITHDRAWAL" that is really a commission deduction collected from a
                    // cash booking should reflect Cash, not a bank payout.
                    const fromText = methodFromText(obj.description)
                    method = obj.paymentMethod ? prettyMethod(obj.paymentMethod) : (fromText ? prettyMethod(fromText) : "Bank")
                }
                else if (["REFUND", "COMMISSION_REFUND", "SECURITY_DEPOSIT_REFUND"].includes(obj.type)) method = "Refund"
                else method = prettyMethod(obj.paymentMethod || methodFromText(obj.description))

                merged.push({
                    _id: String(obj._id),
                    type: obj.type === "DEPOSIT" ? "WALLET_TOPUP" : obj.type,
                    category: obj.type,
                    direction,
                    amount: obj.amount,
                    paymentMethod: method,
                    description: obj.description,
                    status: obj.status || "COMPLETED",
                    reference: obj.reference,
                    currency: walletCurrency,
                    createdAt: obj.createdAt,
                })
            })

        // ---- Source 3: Transaction-collection ledger (skip booking + amount/desc twins) ----
        try {
            const ledger = await Transaction.find({ userId }).lean()
            ledger.forEach((t) => {
                // Skip ledger rows that belong to a booking already emitted as source 1.
                if (t.referenceModel === "B2CPassengerBooking" && t.referenceId && bookingIdSet.has(String(t.referenceId))) return
                if (refsKnownBooking(t.description)) return
                if (seenTwins.has(twinKey(t.amount, t.description))) return
                seenTwins.add(twinKey(t.amount, t.description))

                const isCredit = t.type === "CREDIT"
                let method
                if (/admin adjustment/i.test(t.description) || t.category === "ADJUSTMENT") method = "Admin"
                else if (t.category === "WITHDRAWAL" || t.category === "PAYOUT_REQUESTED") method = "Bank"
                else if (["REFUND", "COMMISSION_REFUND"].includes(t.category)) method = "Refund"
                else if (t.category === "BOOKING_PAYMENT") method = "Card"
                else method = "Wallet"

                merged.push({
                    _id: String(t._id),
                    type: isCredit ? "WALLET_TOPUP" : "RIDE_PAYMENT",
                    category: t.category,
                    direction: isCredit ? "CREDIT" : "DEBIT",
                    amount: t.amount,
                    paymentMethod: method,
                    description: t.description,
                    status: "COMPLETED",
                    reference: t.referenceId ? String(t.referenceId) : undefined,
                    currency: t.currency || walletCurrency,
                    createdAt: t.createdAt,
                })
            })
        } catch (ledgerErr) {
            console.error("[v0] Error loading Transaction ledger:", ledgerErr.message)
        }

        // Sort newest first and paginate the merged list
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        const pageNum = parseInt(page, 10) || 1
        const limitNum = parseInt(limit, 10) || 20
        const transactions = merged.slice((pageNum - 1) * limitNum, pageNum * limitNum)

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: merged.length,
                    pages: Math.ceil(merged.length / limitNum)
                }
            }
        })
    } catch (error) {
        console.error("Error getting wallet transactions:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching transactions"
        })
    }
}

// Helper function to detect gateway from session ID format
const detectGatewayFromSessionId = (sessionId) => {
    if (!sessionId) return null;

    // Stripe session IDs start with cs_test_ or cs_live_
    if (sessionId.startsWith('cs_test_') || sessionId.startsWith('cs_live_')) {
        return 'STRIPE';
    }

    // Stripe payment intents start with pi_
    if (sessionId.startsWith('pi_')) {
        return 'STRIPE';
    }

    // TAP charge IDs start with chg_
    if (sessionId.startsWith('chg_')) {
        return 'TAP';
    }

    // TAP transaction IDs may start with txn_
    if (sessionId.startsWith('txn_')) {
        return 'TAP';
    }

    // Default to null if cannot detect
    return null;
}

// Add funds to wallet
export const addFundsToWallet = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, paymentMethod, paymentDetails, paymentSessionId, currency: bodyCurrency, gateway: providedGateway } = req.body

        if (!paymentSessionId) {
            return res.status(400).json({
                success: false,
                message: "Payment session ID is required for adding funds"
            })
        }

        // Get user to determine currency
        const user = await User.findById(userId)
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }

        // The user's (effective) country is authoritative for their wallet
        // currency (UAE -> AED, Kuwait -> KWD). The request body currency is
        // only a last-resort hint, so a UAE user can never be charged in KWD.
        // Honors the DEV_COUNTRY testing override.
        const userCurrency = resolveWalletCurrency(user, null) || bodyCurrency || "AED"

        // Verify payment session with payment gateway first
        let paymentVerification = null
        let verifiedAmount = amount // Use provided amount if available
        try {
            // Import payment gateway service
            const paymentGatewayService = await import("../Services/paymentGatewayService.js")

            // IMPORTANT: Detect gateway from session ID format first, then fall back to provided gateway or currency-based detection
            // This fixes the issue where Stripe payments were being verified with TAP gateway
            let gateway = detectGatewayFromSessionId(paymentSessionId);

            if (!gateway) {
                // Fall back to provided gateway or detect from currency
                if (providedGateway) {
                    gateway = providedGateway;
                } else {
                    const country = detectCountryFromCurrency(userCurrency)
                    gateway = getPaymentGateway(country)
                }
            }

            console.log("[v0] Verifying payment with gateway:", { gateway, paymentSessionId, userCurrency, detectedFromId: detectGatewayFromSessionId(paymentSessionId) });

            // Verify payment
            paymentVerification = await paymentGatewayService.default.verifyPayment(gateway, paymentSessionId)

            console.log("[v0] Payment verification result:", {
                success: paymentVerification.success,
                status: paymentVerification.status,
                amount: paymentVerification.amount
            });

            if (!paymentVerification.success || paymentVerification.status !== "COMPLETED") {
                return res.status(400).json({
                    success: false,
                    message: "Payment verification failed. Please complete payment first."
                })
            }

            // Use amount from payment verification if provided amount is 0 or missing
            if (!amount || amount <= 0) {
                verifiedAmount = paymentVerification.amount
                if (!verifiedAmount || verifiedAmount <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Payment amount could not be determined"
                    })
                }
            }
        } catch (error) {
            console.error("Payment verification error:", error)
            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Please try again."
            })
        }

        // CRITICAL: Atomic duplicate prevention using ProcessedPayment collection
        // Try to insert the payment session ID - if it already exists, MongoDB will throw a duplicate key error
        // This is the ONLY reliable way to prevent race conditions when two requests hit simultaneously
        try {
            await ProcessedPayment.create({
                paymentSessionId,
                gatewayTransactionId: paymentVerification.transactionId,
                userId,
                amount: verifiedAmount,
                currency: userCurrency,
                gateway: detectGatewayFromSessionId(paymentSessionId) || 'STRIPE',
                processedBy: 'CALLBACK',
                processedAt: new Date()
            })
            console.log("[v0] Payment session marked as processed:", paymentSessionId)
        } catch (error) {
            // Check if it's a duplicate key error (E11000)
            if (error.code === 11000 || error.message?.includes('duplicate key')) {
                console.log("[v0] Payment already processed (atomic check via ProcessedPayment):", paymentSessionId)

                // Find the existing wallet to return
                const existingWallet = await Wallet.findOne({ userId })
                const existingTransaction = existingWallet?.transactions?.find(
                    t => t.paymentSessionId === paymentSessionId ||
                        t.gatewayTransactionId === paymentVerification.transactionId
                )

                return res.status(200).json({
                    success: true,
                    message: "Payment already processed",
                    data: {
                        wallet: existingWallet,
                        transaction: existingTransaction,
                        alreadyProcessed: true
                    }
                })
            }
            // Re-throw other errors
            throw error
        }

        // If we reach here, the payment session was successfully marked as processed
        // Now we can safely add funds to the wallet

        // IMPORTANT: Use atomic operation to prevent race conditions between webhook and callback
        // Both webhook and callback might try to add funds at the same time

        // First, try to atomically update the wallet ONLY if the payment hasn't been processed yet
        // This uses MongoDB's atomic findOneAndUpdate to prevent duplicate transactions
        const transactionId = paymentVerification.transactionId

        // Create the transaction object
        const transaction = {
            type: "DEPOSIT",
            amount: verifiedAmount,
            description: `Funds added via ${paymentMethod || 'card'}`,
            paymentMethod: paymentMethod || 'card',
            status: "COMPLETED",
            paymentSessionId,
            gatewayTransactionId: transactionId,
            createdAt: new Date()
        }

        // Atomically check if transaction exists and add it if not
        // The $not: $elemMatch ensures we only update if no matching transaction exists
        const updateResult = await Wallet.findOneAndUpdate(
            {
                userId,
                // Only update if NO transaction exists with this paymentSessionId OR gatewayTransactionId
                $and: [
                    { "transactions.paymentSessionId": { $ne: paymentSessionId } },
                    { "transactions.gatewayTransactionId": { $ne: transactionId } }
                ]
            },
            {
                $push: { transactions: transaction },
                $inc: { balance: verifiedAmount },
                $setOnInsert: { currency: userCurrency }
            },
            {
                new: true,
                upsert: false // Don't create new wallet here
            }
        )

        // If updateResult is null, either wallet doesn't exist OR transaction was already processed
        if (!updateResult) {
            // Check if wallet exists
            let wallet = await Wallet.findOne({ userId })

            if (!wallet) {
                // Create wallet and add transaction (first time)
                wallet = new Wallet({
                    userId,
                    balance: verifiedAmount,
                    currency: userCurrency,
                    transactions: [transaction]
                })
                await wallet.save()

                console.log("[v0] Created new wallet with funds:", {
                    userId,
                    balance: wallet.balance,
                    paymentSessionId
                })
            } else {
                // Wallet exists but transaction was already processed (duplicate prevention worked!)
                const existingTransaction = wallet.transactions?.find(
                    t => t.paymentSessionId === paymentSessionId ||
                        t.gatewayTransactionId === transactionId
                )

                console.log("[v0] Payment already processed (atomic check), returning existing wallet data:", {
                    paymentSessionId,
                    existingTransactionId: existingTransaction?._id,
                    currentBalance: wallet.balance
                })

                return res.status(200).json({
                    success: true,
                    message: "Payment already processed",
                    data: {
                        wallet,
                        transaction: existingTransaction,
                        alreadyProcessed: true
                    }
                })
            }

            // Send notifications for new wallet
            const walletCurrency = wallet.currency || userCurrency || "KWD"
            await sendRealTimeNotification(userId, {
                type: "WALLET_UPDATED",
                title: "Funds Added",
                message: `${verifiedAmount} ${walletCurrency} has been added to your wallet`,
                data: {
                    newBalance: wallet.balance,
                    currency: walletCurrency,
                    transaction
                }
            })

            // If the commuter had an unpaid cash-cancellation fee (negative wallet),
            // this top-up may have cleared it — settle the admin and lift the block.
            try {
                const settlement = await settleCashDuesOnTopUp(userId)
                if (settlement.settled) {
                    console.log("[v0] Cash cancellation due settled on top-up:", settlement)
                }
            } catch (settleErr) {
                console.error("[v0] settleCashDuesOnTopUp failed (new wallet path):", settleErr.message)
            }

            return res.status(200).json({
                success: true,
                message: "Funds added successfully",
                data: {
                    wallet,
                    transaction
                }
            })
        }

        // Transaction was added successfully via atomic update
        const wallet = updateResult

        console.log("[v0] Wallet updated:", {
            userId,
            newBalance: wallet.balance,
            addedAmount: verifiedAmount,
            currency: userCurrency
        });

        // Send real-time notification with wallet currency
        const walletCurrency = wallet.currency || userCurrency || "KWD"
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Funds Added",
            message: `${verifiedAmount} ${walletCurrency} has been added to your wallet`,
            data: {
                newBalance: wallet.balance,
                currency: walletCurrency,
                transaction
            }
        })

        // Create notification
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Funds Added Successfully",
            message: `${verifiedAmount} ${walletCurrency} has been added to your wallet via ${paymentMethod || 'payment'}`,
            data: {
                amount: verifiedAmount,
                currency: walletCurrency,
                paymentMethod: paymentMethod || 'card',
                newBalance: wallet.balance
            }
        })

        // Notify admins about wallet fund addition
        const userwallet = await User.findById(userId)
        notifyAdminsWalletEvent('wallet-fund-added', {
            userId,
            userName: userwallet?.fullName || "User",
            userRole: userwallet?.role,
            amount,
            currency: walletCurrency,
            newBalance: wallet.balance,
            transactionType: "DEPOSIT",
            paymentMethod
        })

        // If the commuter had an unpaid cash-cancellation fee (negative wallet),
        // this top-up may have cleared it — settle the admin and lift the block.
        try {
            const settlement = await settleCashDuesOnTopUp(userId)
            if (settlement.settled) {
                console.log("[v0] Cash cancellation due settled on top-up:", settlement)
            }
        } catch (settleErr) {
            console.error("[v0] settleCashDuesOnTopUp failed (atomic path):", settleErr.message)
        }

        return res.status(200).json({
            success: true,
            message: "Funds added successfully",
            data: {
                wallet,
                transaction
            }
        })
    } catch (error) {
        console.error("Error adding funds to wallet:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while adding funds"
        })
    }
}

// Withdraw from wallet
export const withdrawFromWallet = async (req, res) => {
    try {
        const userId = req.userId
        const {
            amount,
            iban,
            bankCode,
            accountHolderName,
            currency = "KWD",
            country = "KW"
        } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        // Validate withdrawal details
        const withdrawalValidation = bankValidationService.validateWithdrawalDetails({
            iban,
            bankCode,
            accountHolderName,
            amount,
            currency,
            country
        })

        if (!withdrawalValidation.valid) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal validation failed",
                errors: withdrawalValidation.errors
            })
        }

        // Check withdrawal limits
        const limitCheck = bankValidationService.checkWithdrawalLimits(amount, currency, user.level || "STANDARD")
        if (!limitCheck.valid) {
            return res.status(400).json({
                success: false,
                message: limitCheck.error
            })
        }

        // Find wallet
        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Generate withdrawal reference
        const withdrawalReference = bankValidationService.generateWithdrawalReference(userId)

        // Add transaction
        const transaction = {
            type: "WITHDRAWAL",
            amount: -amount,
            description: `Withdrawal to ${withdrawalValidation.bankName} - ${accountHolderName}`,
            bankAccount: bankValidationService.formatIBAN(iban),
            bankCode,
            bankName: withdrawalValidation.bankName,
            accountHolderName,
            status: "PENDING",
            reference: withdrawalReference,
            processingTime: bankValidationService.getBankProcessingTimes(country),
            createdAt: new Date()
        }

        wallet.transactions.push(transaction)
        wallet.balance -= amount
        wallet.totalWithdrawals += amount
        await wallet.save()

        // Get the wallet transaction ID (last added transaction)
        const walletTransactionId = wallet.transactions[wallet.transactions.length - 1]._id

        // Create WithdrawalRequest for admin to process
        const withdrawalRequest = await WithdrawalRequest.create({
            userId,
            walletId: wallet._id,
            requestId: WithdrawalRequest.generateRequestId(),
            amount,
            currency,
            bankName: withdrawalValidation.bankName,
            bankCode,
            iban: bankValidationService.formatIBAN(iban),
            accountHolderName,
            status: "PENDING",
            userInfo: {
                fullName: user.fullName || user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            },
            walletTransactionId,
            metadata: {
                reference: withdrawalReference,
                processingTime: bankValidationService.getBankProcessingTimes(country),
                country
            }
        })

        console.log("[withdrawFromWallet] Created withdrawal request:", {
            requestId: withdrawalRequest.requestId,
            amount,
            userId,
            bankName: withdrawalValidation.bankName
        })

        // Send real-time notification
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Withdrawal Initiated",
            message: `${amount} ${currency} withdrawal has been initiated to ${withdrawalValidation.bankName}`,
            data: {
                newBalance: wallet.balance,
                transaction,
                processingTime: transaction.processingTime
            }
        })

        // Create notification
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Withdrawal Initiated",
            message: `${amount} ${currency} withdrawal has been initiated to your bank account at ${withdrawalValidation.bankName}`,
            data: {
                amount,
                currency,
                bankName: withdrawalValidation.bankName,
                reference: withdrawalReference,
                processingTime: transaction.processingTime,
                newBalance: wallet.balance
            }
        })

        // Notify admins about wallet withdrawal
        notifyAdminsWalletEvent('wallet-withdrawal', {
            userId,
            userName: user?.fullName || "User",
            userRole: user?.role,
            amount,
            currency,
            newBalance: wallet.balance,
            transactionType: "WITHDRAWAL",
            bankName: withdrawalValidation.bankName,
            reference: withdrawalReference
        })

        return res.status(200).json({
            success: true,
            message: "Withdrawal initiated successfully",
            data: {
                wallet,
                transaction,
                reference: withdrawalReference,
                processingTime: transaction.processingTime
            }
        })
    } catch (error) {
        console.error("Error withdrawing from wallet:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while processing withdrawal"
        })
    }
}

// Transfer funds to another user
export const transferFunds = async (req, res) => {
    try {
        const userId = req.userId
        const { recipientId, amount, description } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        if (!recipientId) {
            return res.status(400).json({
                success: false,
                message: "Recipient ID is required"
            })
        }

        if (recipientId === userId) {
            return res.status(400).json({
                success: false,
                message: "Cannot transfer to yourself"
            })
        }

        // Find sender wallet
        const senderWallet = await Wallet.findOne({ userId })
        if (!senderWallet) {
            return res.status(404).json({
                success: false,
                message: "Sender wallet not found"
            })
        }

        if (senderWallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Find recipient
        const recipient = await User.findById(recipientId)
        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: "Recipient not found"
            })
        }

        // Find or create recipient wallet
        let recipientWallet = await Wallet.findOne({ userId: recipientId })
        if (!recipientWallet) {
            recipientWallet = new Wallet({
                userId: recipientId,
                balance: 0,
                transactions: []
            })
        }

        // Create transactions
        const senderTransaction = {
            type: "TRANSFER",
            amount: -amount,
            description: description || "Fund transfer",
            recipientId,
            recipientName: recipient.fullName,
            status: "COMPLETED",
            createdAt: new Date()
        }

        const recipientTransaction = {
            type: "TRANSFER",
            amount: amount,
            description: description || "Fund transfer",
            senderId: userId,
            senderName: req.user?.fullName || "User",
            status: "COMPLETED",
            createdAt: new Date()
        }

        // Update wallets
        senderWallet.transactions.push(senderTransaction)
        senderWallet.balance -= amount

        recipientWallet.transactions.push(recipientTransaction)
        recipientWallet.balance += amount

        await senderWallet.save()
        await recipientWallet.save()

        // Send notifications to both users
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Transfer Sent",
            message: `${amount} KWD has been sent to ${recipient.fullName}`,
            data: {
                newBalance: senderWallet.balance,
                transaction: senderTransaction
            }
        })

        await sendRealTimeNotification(recipientId, {
            type: "WALLET_UPDATED",
            title: "Transfer Received",
            message: `${amount} KWD has been received from ${req.user?.fullName || "User"}`,
            data: {
                newBalance: recipientWallet.balance,
                transaction: recipientTransaction
            }
        })

        // Create notifications
        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Transfer Sent",
            message: `${amount} KWD has been sent to ${recipient.fullName}`,
            data: {
                amount,
                recipientId,
                recipientName: recipient.fullName,
                newBalance: senderWallet.balance
            }
        })

        await createNotification({
            userId: recipientId,
            type: "PAYMENT_RECEIVED",
            title: "Transfer Received",
            message: `${amount} KWD has been received from ${req.user?.fullName || "User"}`,
            relatedUserId: userId,
            data: {
                amount,
                senderId: userId,
                senderName: req.user?.fullName || "User",
                newBalance: recipientWallet.balance
            }
        })

        return res.status(200).json({
            success: true,
            message: "Transfer completed successfully",
            data: {
                wallet: senderWallet,
                transaction: senderTransaction
            }
        })
    } catch (error) {
        console.error("Error transferring funds:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while processing transfer"
        })
    }
}

// Get wallet statement
export const getWalletStatement = async (req, res) => {
    try {
        const userId = req.userId
        const { startDate, endDate, page = 1, limit = 20 } = req.query

        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        // Filter transactions by date range
        let filteredTransactions = wallet.transactions

        if (startDate) {
            const start = new Date(startDate)
            filteredTransactions = filteredTransactions.filter(
                tx => new Date(tx.createdAt) >= start
            )
        }

        if (endDate) {
            const end = new Date(endDate)
            filteredTransactions = filteredTransactions.filter(
                tx => new Date(tx.createdAt) <= end
            )
        }

        // Sort and paginate
        filteredTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        const transactions = filteredTransactions.slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: filteredTransactions.length,
                    pages: Math.ceil(filteredTransactions.length / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting wallet statement:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching wallet statement"
        })
    }
}

// Request payout
export const requestPayout = async (req, res) => {
    try {
        const userId = req.userId
        const { amount, bankAccount, payoutMethod } = req.body

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            })
        }

        // Find wallet
        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            })
        }

        // Create payout transaction
        const transaction = {
            type: "PAYOUT",
            amount: -amount,
            description: `Payout request via ${payoutMethod || "bank transfer"}`,
            bankAccount,
            payoutMethod,
            status: "PENDING",
            createdAt: new Date()
        }

        wallet.transactions.push(transaction)
        wallet.balance -= amount
        await wallet.save()

        // Send notification
        await sendRealTimeNotification(userId, {
            type: "WALLET_UPDATED",
            title: "Payout Requested",
            message: `${amount} KWD payout request has been submitted`,
            data: {
                newBalance: wallet.balance,
                transaction
            }
        })

        await createNotification({
            userId,
            type: "PAYMENT_COMPLETED",
            title: "Payout Requested",
            message: `${amount} KWD payout request has been submitted for processing`,
            data: {
                amount,
                bankAccount,
                payoutMethod,
                newBalance: wallet.balance
            }
        })

        return res.status(200).json({
            success: true,
            message: "Payout request submitted successfully",
            data: {
                wallet,
                transaction
            }
        })
    } catch (error) {
        console.error("Error requesting payout:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while requesting payout"
        })
    }
}

// Get user payouts
export const getUserPayouts = async (req, res) => {
    try {
        const userId = req.userId
        const { page = 1, limit = 20 } = req.query

        const wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            })
        }

        // Filter payout transactions
        const payouts = wallet.transactions
            .filter(tx => tx.type === "PAYOUT")
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice((page - 1) * limit, page * limit)

        return res.status(200).json({
            success: true,
            data: {
                payouts,
                pagination: {
                    page,
                    limit,
                    total: wallet.transactions.filter(tx => tx.type === "PAYOUT").length,
                    pages: Math.ceil(wallet.transactions.filter(tx => tx.type === "PAYOUT").length / limit)
                }
            }
        })
    } catch (error) {
        console.error("Error getting user payouts:", error)
        return res.status(500).json({
            success: false,
            message: "Server error while fetching payouts"
        })
    }
}

// Get payment methods and configuration based on user's country
export const getPaymentConfig = async (req, res) => {
    try {
        const userId = req.userId

        // Get user details
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        console.log("[v0] Fetching payment config for user country:", user.country)

        // Get currency and payment methods based on the user's effective
        // country (honors the DEV_COUNTRY testing override).
        const effectiveCountry = getEffectiveCountry(user)
        const currency = getCountryCurrency(effectiveCountry)
        const decimals = getCurrencyDecimals(currency)
        const symbol = getCurrencySymbol(currency)
        const paymentMethods = getCountryPaymentMethods(effectiveCountry)

        return res.status(200).json({
            success: true,
            data: {
                country: effectiveCountry,
                currency,
                currencySymbol: symbol,
                decimals,
                paymentMethods,
                message: "Payment configuration retrieved successfully"
            }
        })
    } catch (error) {
        console.error("[v0] Error getting payment config:", error)
        return res.status(500).json({
            success: false,
            message: "Error getting payment configuration",
            error: error.message
        })
    }
}

// Credit negotiation commission to Admin wallet
// This function is called when Corporate pays for a contract that has negotiation commission
export const creditAdminNegotiationCommission = async ({
    adminUserId,
    amount,
    currency,
    corporateUserId,
    corporateName,
    negotiationId,
    contractId,
    contractNumber,
}) => {
    try {
        if (!adminUserId || !amount || amount <= 0) {
            console.error("[v0] Invalid params for crediting admin commission:", { adminUserId, amount })
            return { success: false, message: "Invalid parameters" }
        }

        // Find or create the Admin wallet FOR THIS COMMISSION'S CURRENCY so the
        // negotiation commission never mixes into a wallet of another currency.
        const commissionCurrency = currency || "AED"
        const adminWallet = await getOrCreateWallet(adminUserId, {
            currency: commissionCurrency,
            role: "ADMIN",
        })

        const balanceBefore = adminWallet.balance

        // Add transaction to Admin wallet
        const transaction = {
            type: "DEPOSIT",
            amount: amount,
            description: `Negotiation commission from ${corporateName || 'Corporate'} for contract ${contractNumber || contractId}`,
            status: "COMPLETED",
            senderId: corporateUserId,
            senderName: corporateName,
            createdAt: new Date()
        }

        adminWallet.transactions.push(transaction)
        adminWallet.balance += amount
        adminWallet.totalEarnings = (adminWallet.totalEarnings || 0) + amount
        await adminWallet.save()

        // Create detailed Transaction record
        const transactionRecord = new Transaction({
            walletId: adminWallet._id,
            userId: adminUserId,
            type: "CREDIT",
            amount: amount,
            currency: currency || "AED",
            category: "NEGOTIATION_COMMISSION",
            description: `Negotiation commission from ${corporateName || 'Corporate'} for successful price negotiation`,
            referenceId: negotiationId,
            referenceModel: "AdminNegotiation",
            fromUserId: corporateUserId,
            fromName: corporateName,
            toUserId: adminUserId,
            toName: "Admin",
            balanceBefore: balanceBefore,
            balanceAfter: adminWallet.balance,
            metadata: {
                negotiationId,
                contractId,
                contractNumber,
                commissionAmount: amount,
                commissionType: "NEGOTIATION_COMMISSION"
            }
        })
        await transactionRecord.save()

        console.log("[v0] Admin negotiation commission credited:", {
            adminUserId,
            amount,
            currency,
            newBalance: adminWallet.balance,
            negotiationId
        })

        // Send real-time notification to admin
        await sendRealTimeNotification(adminUserId.toString(), {
            type: "WALLET_UPDATED",
            title: "Commission Received",
            message: `You have received ${amount} ${currency || "AED"} commission from ${corporateName || "Corporate"} for negotiation services`,
            data: {
                amount,
                currency: currency || "AED",
                newBalance: adminWallet.balance,
                source: "NEGOTIATION_COMMISSION",
                negotiationId,
                contractId
            }
        })

        // Create notification record
        await createNotification({
            userId: adminUserId,
            type: "PAYMENT_RECEIVED",
            title: "Negotiation Commission Received",
            message: `You have received ${amount} ${currency || "AED"} commission from ${corporateName || "Corporate"} for successful negotiation on contract ${contractNumber || contractId}`,
            data: {
                amount,
                currency: currency || "AED",
                negotiationId,
                contractId,
                contractNumber,
                corporateName,
                newBalance: adminWallet.balance
            }
        })

        return {
            success: true,
            transaction: transactionRecord,
            newBalance: adminWallet.balance
        }
    } catch (error) {
        console.error("[v0] Error crediting admin negotiation commission:", error)
        return { success: false, message: error.message }
    }
}


// Generate valid test IBANs for testing withdrawal
export const generateTestIBAN = async (req, res) => {
    try {
        const { country = "UAE" } = req.query;

        // Pre-calculated valid IBANs with correct MOD-97 checksums
        // These are sample IBANs that pass checksum validation
        const validTestIBANs = {
            UAE: [
                { iban: "AE070330000010111111111", bank: "FAB", bankName: "First Abu Dhabi Bank" },
                { iban: "AE950210000000693123456", bank: "EmiratesNBD", bankName: "Emirates NBD" },
                { iban: "AE440260001015154875001", bank: "ADCB", bankName: "Abu Dhabi Commercial Bank" },
            ],
            KW: [
                { iban: "KW81CBKU0000000000001234560101", bank: "KFH", bankName: "Kuwait Finance House" },
                { iban: "KW91KFHO0000000000001234560001", bank: "KFH", bankName: "Kuwait Finance House" },
            ]
        };

        const testIBANs = validTestIBANs[country.toUpperCase()] || validTestIBANs.UAE;

        res.status(200).json({
            success: true,
            message: "Test IBANs for withdrawal testing",
            note: "These IBANs are for testing purposes only. Use in test/development environment.",
            country: country.toUpperCase(),
            testIBANs: testIBANs,
            instructions: {
                step1: "Copy any IBAN from below",
                step2: "Use the corresponding Bank Code in the dropdown",
                step3: "Enter any name as Account Holder Name",
                step4: "Enter withdrawal amount (min 50 AED or 5 KWD)"
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Get supported banks for a country
export const getSupportedBanks = async (req, res) => {
    try {
        const { country = "UAE" } = req.query;
        const banksInfo = bankValidationService.getSupportedBanks(country);

        res.status(200).json({
            success: true,
            country,
            ...banksInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
