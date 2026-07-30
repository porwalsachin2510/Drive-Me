/**
 * ============================================================================
 * CENTRAL LOCALIZATION CONFIG  (Single Source of Truth)
 * ============================================================================
 * Everything country-specific lives here: currency, symbol, decimals,
 * payment gateway, supported payment methods, phone code and service
 * availability.
 *
 * To launch the application in a NEW country, add ONE entry below and set
 * `serviceAvailable: true`. Nothing else in the codebase needs to change.
 *
 * Canonical country codes used across the whole application: "UAE", "KW",
 * "SA", "BH", "OM", "QA" (these match the `country` enum on the User model).
 * ============================================================================
 */

export const COUNTRY_CONFIG = {
    UAE: {
        code: "UAE",
        name: "United Arab Emirates",
        displayName: "UAE",
        isoCode: "AE",
        phoneCode: "+971",
        currency: "AED",
        currencySymbol: "AED",
        currencyDecimals: 2,
        // Extra wallet balance (on top of the admin commission) a partner must
        // hold to accept a CASH booking. This is a small per-country safety
        // margin expressed in the country's OWN currency — never a flat number
        // reused across currencies (50 AED is sensible; 50 KWD is not).
        cashAcceptanceBuffer: 50,
        paymentGateway: "STRIPE",
        fallbackGateway: "TAP",
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "STRIPE", enabled: true },
            { id: "apple_pay", name: "Apple Pay", gateway: "STRIPE", enabled: true },
            { id: "google_pay", name: "Google Pay", gateway: "STRIPE", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: true,
    },
    KW: {
        code: "KW",
        name: "Kuwait",
        displayName: "Kuwait",
        isoCode: "KW",
        phoneCode: "+965",
        currency: "KWD",
        currencySymbol: "KWD",
        currencyDecimals: 3,
        // ~50 AED equivalent, rounded to a clean KWD figure. KWD is a high-value
        // currency, so the buffer is small in absolute terms.
        cashAcceptanceBuffer: 5,
        paymentGateway: "TAP",
        fallbackGateway: null,
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "TAP", enabled: true },
            { id: "knet", name: "KNET", gateway: "TAP", enabled: true },
            { id: "benefit", name: "Benefit", gateway: "TAP", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: true,
    },

    // ---- Future markets (config ready, service disabled until launch) ----
    SA: {
        code: "SA",
        name: "Saudi Arabia",
        displayName: "Saudi Arabia",
        isoCode: "SA",
        phoneCode: "+966",
        currency: "SAR",
        currencySymbol: "SAR",
        currencyDecimals: 2,
        cashAcceptanceBuffer: 50,
        paymentGateway: "STRIPE",
        fallbackGateway: "TAP",
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "STRIPE", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: false,
    },
    BH: {
        code: "BH",
        name: "Bahrain",
        displayName: "Bahrain",
        isoCode: "BH",
        phoneCode: "+973",
        currency: "BHD",
        currencySymbol: "BHD",
        currencyDecimals: 3,
        cashAcceptanceBuffer: 5,
        paymentGateway: "TAP",
        fallbackGateway: null,
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "TAP", enabled: true },
            { id: "benefit", name: "Benefit", gateway: "TAP", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: false,
    },
    OM: {
        code: "OM",
        name: "Oman",
        displayName: "Oman",
        isoCode: "OM",
        phoneCode: "+968",
        currency: "OMR",
        currencySymbol: "OMR",
        currencyDecimals: 3,
        cashAcceptanceBuffer: 5,
        paymentGateway: "TAP",
        fallbackGateway: null,
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "TAP", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: false,
    },
    QA: {
        code: "QA",
        name: "Qatar",
        displayName: "Qatar",
        isoCode: "QA",
        phoneCode: "+974",
        currency: "QAR",
        currencySymbol: "QAR",
        currencyDecimals: 2,
        cashAcceptanceBuffer: 50,
        paymentGateway: "STRIPE",
        fallbackGateway: "TAP",
        paymentMethods: [
            { id: "card", name: "Credit/Debit Card", gateway: "STRIPE", enabled: true },
            { id: "wallet", name: "Wallet Balance", gateway: "WALLET", enabled: true },
        ],
        serviceAvailable: false,
    },
};

// Default country when nothing can be resolved.
export const DEFAULT_COUNTRY = "UAE";

// Stable base country/currency for platform admins & super-admins. A platform
// admin manages the WHOLE platform across every served country, so their locale
// must NOT change with their physical location. Their overview/fallback always
// uses this base (per-record currencies are still shown in each record's own
// currency). Change this single value to re-base the admin currency.
export const PLATFORM_BASE_COUNTRY = "KW";

/**
 * Maps every known alias / variant of a country to its canonical code.
 */
const COUNTRY_ALIASES = {
    UAE: "UAE",
    AE: "UAE",
    "UNITED ARAB EMIRATES": "UAE",
    "U.A.E": "UAE",
    EMIRATES: "UAE",
    DUBAI: "UAE",
    "ABU DHABI": "UAE",
    AED: "UAE",
    KW: "KW",
    KWT: "KW",
    KUWAIT: "KW",
    "STATE OF KUWAIT": "KW",
    KWD: "KW",
    SA: "SA",
    KSA: "SA",
    "SAUDI ARABIA": "SA",
    SAR: "SA",
    BH: "BH",
    BAHRAIN: "BH",
    BHD: "BH",
    OM: "OM",
    OMAN: "OM",
    OMR: "OM",
    QA: "QA",
    QATAR: "QA",
    QAR: "QA",
};

/**
 * Normalize any country-ish input to a canonical country code.
 * Returns DEFAULT_COUNTRY when the input cannot be resolved.
 */
export const normalizeCountry = (input) => {
    if (!input || typeof input !== "string") return DEFAULT_COUNTRY;
    const key = input.trim().toUpperCase();
    if (COUNTRY_CONFIG[key]) return key;
    return COUNTRY_ALIASES[key] || DEFAULT_COUNTRY;
};

/** Get the full config object for a country (any variant accepted). */
export const getCountryConfig = (input) => {
    const code = normalizeCountry(input);
    return COUNTRY_CONFIG[code] || COUNTRY_CONFIG[DEFAULT_COUNTRY];
};

/** Resolve a canonical country code from a currency code. */
export const getCountryFromCurrency = (currency) => {
    if (!currency || typeof currency !== "string") return DEFAULT_COUNTRY;
    const cur = currency.trim().toUpperCase();
    const match = Object.values(COUNTRY_CONFIG).find((c) => c.currency === cur);
    return match ? match.code : DEFAULT_COUNTRY;
};

/**
 * Resolve a canonical country code from an international dialing code
 * (e.g. "+965" -> "KW", "+971" -> "UAE"). Returns null when the phone code
 * does not belong to any configured country, so callers can decide a fallback.
 */
export const getCountryFromPhoneCode = (phoneCode) => {
    if (!phoneCode || typeof phoneCode !== "string") return null;
    const pc = phoneCode.trim();
    const match = Object.values(COUNTRY_CONFIG).find((c) => c.phoneCode === pc);
    return match ? match.code : null;
};

/**
 * Resolve the canonical country to stamp on a brand-new account at REGISTRATION
 * time. This is the single source of truth for "where did this user sign up
 * from", and must NOT silently fall back to a hard-coded country.
 *
 * Priority:
 *   1. The international dialing code the user picked at registration
 *      (e.g. "+965" => KW) -> the strongest, immutable real signal we collect.
 *      It is the SAME signal used by getEffectiveCountry/reconciliation, so the
 *      account's currency stays consistent for its whole lifetime and a Kuwait
 *      "+965" partner can never be stamped as UAE (which made them see AED).
 *   2. An explicitly provided country/nationality string (any known variant).
 *   3. DEV_COUNTRY env (LOCAL/DEV ONLY) -> only when no real signal is present,
 *      so a fresh flow can still be exercised. Unset in production (no-op).
 *      To test a specific country end to end, register with that country's
 *      dialing code (e.g. "+971" for UAE) — identity always wins.
 *   4. DEFAULT_COUNTRY.
 */
export const resolveRegistrationCountry = ({ countryCode, country } = {}) => {
    const fromPhone = getCountryFromPhoneCode(countryCode);
    if (fromPhone) return fromPhone;

    if (country) {
        const key = String(country).trim().toUpperCase();
        if (COUNTRY_CONFIG[key] || COUNTRY_ALIASES[key]) return normalizeCountry(country);
    }

    if (process.env.DEV_COUNTRY) return normalizeCountry(process.env.DEV_COUNTRY);

    return DEFAULT_COUNTRY;
};

/** List of canonical codes where the service is currently live. */
export const getServiceCountryCodes = () =>
    Object.values(COUNTRY_CONFIG)
        .filter((c) => c.serviceAvailable === true)
        .map((c) => c.code);

/** Is `input` a country we currently operate in? (any variant accepted) */
export const isServedCountry = (input) => {
    if (!input || typeof input !== "string") return false;
    const key = input.trim().toUpperCase();
    const code = COUNTRY_CONFIG[key] ? key : COUNTRY_ALIASES[key];
    return !!code && COUNTRY_CONFIG[code]?.serviceAvailable === true;
};

/**
 * Is this user a platform admin or super-admin? Such users are
 * location-independent (see PLATFORM_BASE_COUNTRY).
 */
export const isPlatformAdmin = (user) =>
    user?.role === "ADMIN" || user?.adminPermissions?.isSuperAdmin === true;

/**
 * Is this user a COMMUTER (a consumer/traveller)?
 *
 * A commuter's country is a TRAVEL CONTEXT, not a fixed business identity:
 * exactly like Uber/Careem, one account must work across every country we
 * serve. If they open the app in the UAE they should see UAE routes/prices; if
 * they fly to Kuwait they should see Kuwait routes — WITHOUT creating a second
 * account. So a commuter's country is switchable (see getEffectiveCountry) and
 * their currency simply follows the country they're currently browsing.
 */
export const isCommuter = (user) => user?.role === "COMMUTER";

/**
 * Is this user an EARNER whose country is a permanent business identity?
 *
 * Partners, their drivers, and corporate accounts/drivers/employees earn,
 * get billed, settle and are paid out in the country they registered in. That
 * currency must NEVER change with travel, IP, DEV_COUNTRY, or a stale stored
 * value — it is anchored to the immutable dialing code. This is every
 * authenticated, non-admin, non-commuter role.
 */
export const isIdentityLockedUser = (user) =>
    !!user && !isPlatformAdmin(user) && !isCommuter(user);

/**
 * Resolve the effective country for a user. This is ROLE-AWARE, because
 * "which country am I in?" means two different things for the two kinds of
 * account:
 *
 *  • EARNERS (partners / drivers / corporate / employees) — country is a fixed
 *    business IDENTITY. It must NEVER drift with travel, IP, DEV_COUNTRY, or a
 *    stale stored value, so it is anchored to the immutable dialing code
 *    ("+965" => KW, "+971" => UAE). A Kuwait partner is always paid in KWD.
 *
 *  • COMMUTERS — country is a switchable TRAVEL CONTEXT. Their stored `country`
 *    holds the country they are currently browsing (defaulted from their
 *    dialing code at registration, changed via the in-app country switcher and
 *    persisted). This lets one account use the service in both the UAE and
 *    Kuwait without re-registering, with currency following the selection.
 *
 * Priority:
 *  1. Platform admins/super-admins -> always PLATFORM_BASE_COUNTRY.
 *  2. Commuter -> stored `country` (their active selection) if present, else
 *     their dialing code, else DEV_COUNTRY (dev only), else DEFAULT_COUNTRY.
 *  3. Earner -> dialing code (identity) if it maps to a known country, else the
 *     stored account country, else DEV_COUNTRY (dev only), else DEFAULT_COUNTRY.
 */
export const getEffectiveCountry = (user) => {
    if (isPlatformAdmin(user)) return PLATFORM_BASE_COUNTRY;

    if (isCommuter(user)) {
        // Switchable travel context — the stored selection wins.
        if (user?.country) return normalizeCountry(user.country);
        const fromDial = getCountryFromPhoneCode(user?.countryCode);
        if (fromDial) return fromDial;
        if (process.env.DEV_COUNTRY) return normalizeCountry(process.env.DEV_COUNTRY);
        return DEFAULT_COUNTRY;
    }

    // Identity-locked earners (and any other authenticated non-commuter).
    const fromDial = getCountryFromPhoneCode(user?.countryCode);
    if (fromDial) return fromDial;
    if (user?.country) return normalizeCountry(user.country);
    if (process.env.DEV_COUNTRY) return normalizeCountry(process.env.DEV_COUNTRY);
    return DEFAULT_COUNTRY;
};

export const getCountryCurrency = (input) => getCountryConfig(input).currency;

/**
 * Extra wallet balance (on top of the admin commission) a partner must hold to
 * accept a CASH booking, resolved from a currency code. This replaces the old
 * hard-coded "+ 50" that was wrongly applied to every currency (making a Kuwait
 * partner need 50 KWD extra instead of a sensible ~5 KWD). Falls back to 0 when
 * a currency has no configured buffer, so no phantom requirement is ever added.
 */
export const getCashAcceptanceBuffer = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match && typeof match.cashAcceptanceBuffer === "number"
        ? match.cashAcceptanceBuffer
        : 0;
};

/**
 * Selectable service locations per country (mirrors the frontend
 * config/localeConfig.js). This is the single source of truth for validating
 * that a submitted location actually belongs to the acting user's country, so
 * a Kuwait partner can never register a Dubai vehicle and vice-versa. Add a new
 * market's cities here when launching it.
 */
export const COUNTRY_LOCATIONS = {
    UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
    KW: ["Kuwait City", "Hawalli", "Salmiya", "Farwaniya", "Ahmadi", "Jahra", "Fahaheel", "Mangaf"],
    SA: ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Al Khobar"],
    BH: ["Manama", "Muharraq", "Riffa", "Hamad Town"],
    OM: ["Muscat", "Seeb", "Salalah", "Sohar"],
    QA: ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor"],
};

/** Locations available for a given country (any variant accepted). */
export const getCountryLocations = (input) => {
    const code = normalizeCountry(input);
    return COUNTRY_LOCATIONS[code] || COUNTRY_LOCATIONS[DEFAULT_COUNTRY];
};

/**
 * Location selection granularity per country.
 *  - "CITY"    : large markets with several distinct service areas (emirates /
 *                major cities) where a corporate should pick a specific city.
 *  - "COUNTRY" : small single-metro markets (e.g. Kuwait) where splitting into
 *                cities adds no value — the corporate selects the whole country
 *                and sees every partner in it. Kept data-driven so launching a
 *                new market is a one-line change.
 */
export const LOCATION_SCOPE = {
    UAE: "CITY",
    SA: "CITY",
    OM: "CITY",
    KW: "COUNTRY",
    BH: "COUNTRY",
    QA: "COUNTRY",
};

export const getLocationScope = (input) =>
    LOCATION_SCOPE[normalizeCountry(input)] || "CITY";

/**
 * Strict country match: returns the canonical code ONLY when `input` is a real
 * country identifier (code / full name / display name / ISO code). Unlike
 * normalizeCountry it never falls back to a default, and it deliberately does
 * NOT match city aliases like "Dubai". This lets the search tell a whole-country
 * location selection ("Kuwait") apart from a specific city ("Salmiya").
 */
export const matchCountryStrict = (input) => {
    if (!input || typeof input !== "string") return null;
    const key = input.trim().toUpperCase();
    for (const [code, cfg] of Object.entries(COUNTRY_CONFIG)) {
        if (
            code === key ||
            (cfg.name && cfg.name.toUpperCase() === key) ||
            (cfg.displayName && cfg.displayName.toUpperCase() === key) ||
            (cfg.isoCode && cfg.isoCode.toUpperCase() === key)
        ) {
            return code;
        }
    }
    return null;
};

/** Reverse lookup: which canonical country does a location name belong to? */
export const getLocationCountry = (locationName) => {
    if (!locationName || typeof locationName !== "string") return null;
    const needle = locationName.trim().toLowerCase();
    for (const [code, list] of Object.entries(COUNTRY_LOCATIONS)) {
        if (list.some((loc) => loc.toLowerCase() === needle)) return code;
    }
    return null;
};

/** Does `locationName` belong to `countryInput`? Unknown locations pass (true). */
export const isLocationInCountry = (locationName, countryInput) => {
    const locCountry = getLocationCountry(locationName);
    if (!locCountry) return true;
    return locCountry === normalizeCountry(countryInput);
};

export const getCurrencySymbol = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match ? match.currencySymbol : currency;
};

export const getCurrencyDecimals = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match ? match.currencyDecimals : 2;
};

export const getCountryPaymentGateway = (input) => getCountryConfig(input).paymentGateway;
export const getCountryPaymentMethods = (input) => getCountryConfig(input).paymentMethods;
export const isServiceAvailable = (input) => getCountryConfig(input).serviceAvailable === true;

/** Build the client-facing locale payload sent to the frontend. */
export const buildLocalePayload = (input) => {
    const c = getCountryConfig(input);
    return {
        country: c.code,
        countryName: c.name,
        displayName: c.displayName,
        isoCode: c.isoCode,
        phoneCode: c.phoneCode,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        currencyDecimals: c.currencyDecimals,
        paymentGateway: c.paymentGateway,
        paymentMethods: c.paymentMethods.filter((m) => m.enabled),
        serviceAvailable: c.serviceAvailable,
    };
};

export default {
    COUNTRY_CONFIG,
    DEFAULT_COUNTRY,
    PLATFORM_BASE_COUNTRY,
    normalizeCountry,
    getCountryConfig,
    getCountryFromCurrency,
    getCountryFromPhoneCode,
    resolveRegistrationCountry,
    getServiceCountryCodes,
    isServedCountry,
    isPlatformAdmin,
    isCommuter,
    isIdentityLockedUser,
    getEffectiveCountry,
    getCountryCurrency,
    getCashAcceptanceBuffer,
    getCurrencySymbol,
    getCurrencyDecimals,
    getCountryPaymentGateway,
    getCountryPaymentMethods,
    isServiceAvailable,
    buildLocalePayload,
    COUNTRY_LOCATIONS,
    getCountryLocations,
    getLocationCountry,
    isLocationInCountry,
    LOCATION_SCOPE,
    getLocationScope,
    matchCountryStrict,
};
