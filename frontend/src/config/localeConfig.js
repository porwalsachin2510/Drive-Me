/**
 * Frontend locale config — mirrors backend/src/Config/localizationConfig.js.
 * Used for instant client-side currency formatting and country normalization
 * without waiting for a network round-trip. The backend remains the source of
 * truth; this is the safe local default until the API responds.
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
        // Extra wallet balance (beyond the admin commission) needed to accept a
        // CASH booking. Mirrors backend localizationConfig.js — per currency, so
        // a flat "50" is never reused across currencies.
        cashAcceptanceBuffer: 50,
        paymentGateway: "STRIPE",
        serviceAvailable: true,
        exampleLocations: { from: "Dubai Marina", to: "Abu Dhabi City", stop: "Mall of the Emirates" },
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
        cashAcceptanceBuffer: 5,
        paymentGateway: "TAP",
        serviceAvailable: true,
        exampleLocations: { from: "Kuwait City", to: "Salmiya", stop: "The Avenues Mall" },
    },
    SA: {
        code: "SA", name: "Saudi Arabia", displayName: "Saudi Arabia", isoCode: "SA",
        phoneCode: "+966", currency: "SAR", currencySymbol: "SAR", currencyDecimals: 2,
        cashAcceptanceBuffer: 50, paymentGateway: "STRIPE", serviceAvailable: false,
        exampleLocations: { from: "Riyadh", to: "Jeddah", stop: "Kingdom Centre" },
    },
    BH: {
        code: "BH", name: "Bahrain", displayName: "Bahrain", isoCode: "BH",
        phoneCode: "+973", currency: "BHD", currencySymbol: "BHD", currencyDecimals: 3,
        cashAcceptanceBuffer: 5, paymentGateway: "TAP", serviceAvailable: false,
        exampleLocations: { from: "Manama", to: "Muharraq", stop: "City Centre Bahrain" },
    },
    OM: {
        code: "OM", name: "Oman", displayName: "Oman", isoCode: "OM",
        phoneCode: "+968", currency: "OMR", currencySymbol: "OMR", currencyDecimals: 3,
        cashAcceptanceBuffer: 5, paymentGateway: "TAP", serviceAvailable: false,
        exampleLocations: { from: "Muscat", to: "Seeb", stop: "Muscat Grand Mall" },
    },
    QA: {
        code: "QA", name: "Qatar", displayName: "Qatar", isoCode: "QA",
        phoneCode: "+974", currency: "QAR", currencySymbol: "QAR", currencyDecimals: 2,
        cashAcceptanceBuffer: 50, paymentGateway: "STRIPE", serviceAvailable: false,
        exampleLocations: { from: "Doha", to: "Al Wakrah", stop: "Villaggio Mall" },
    },
};

// Must mirror the backend platform base (PLATFORM_BASE_COUNTRY / DEFAULT_COUNTRY
// in backend/src/Config/localizationConfig.js). A mismatch here used to seed a
// stale "UAE" locale that was sent back to the server and overwrote a Kuwait
// user's real country.
export const DEFAULT_COUNTRY = "KW";

// Native currency symbols (used for compact inline display).
export const CURRENCY_NATIVE_SYMBOL = {
    AED: "د.إ",
    KWD: "د.ك",
    SAR: "﷼",
    BHD: ".د.ب",
    OMR: "﷼",
    QAR: "﷼",
};

// Payment methods offered per country. Gateway here is the actual processor
// used for that method. Mirrors backend payment method availability.
export const PAYMENT_METHODS = {
    UAE: [
        { id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "STRIPE" },
        { id: "apple_pay", name: "Apple Pay", icon: "🍎", gateway: "STRIPE" },
        { id: "google_pay", name: "Google Pay", icon: "🤖", gateway: "STRIPE" },
    ],
    KW: [
        { id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "TAP" },
        { id: "knet", name: "KNET", icon: "🔵", gateway: "TAP" },
        { id: "apple_pay", name: "Apple Pay", icon: "🍎", gateway: "TAP" },
    ],
    SA: [
        { id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "STRIPE" },
        { id: "mada", name: "Mada", icon: "🟢", gateway: "STRIPE" },
    ],
    BH: [{ id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "TAP" }],
    OM: [{ id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "TAP" }],
    QA: [{ id: "card", name: "Credit/Debit Card", icon: "💳", gateway: "STRIPE" }],
};

export const getPaymentMethods = (input) => {
    const code = normalizeCountry(input);
    return PAYMENT_METHODS[code] || PAYMENT_METHODS[DEFAULT_COUNTRY];
};

export const getNativeSymbol = (currency) =>
    CURRENCY_NATIVE_SYMBOL[(currency || "").toUpperCase()] || getCurrencySymbol(currency);

const COUNTRY_ALIASES = {
    UAE: "UAE", AE: "UAE", "UNITED ARAB EMIRATES": "UAE", "U.A.E": "UAE",
    EMIRATES: "UAE", DUBAI: "UAE", "ABU DHABI": "UAE", AED: "UAE",
    KW: "KW", KWT: "KW", KUWAIT: "KW", "STATE OF KUWAIT": "KW", KWD: "KW",
    SA: "SA", KSA: "SA", "SAUDI ARABIA": "SA", SAR: "SA",
    BH: "BH", BAHRAIN: "BH", BHD: "BH",
    OM: "OM", OMAN: "OM", OMR: "OM",
    QA: "QA", QATAR: "QA", QAR: "QA",
};

export const normalizeCountry = (input) => {
    if (!input || typeof input !== "string") return DEFAULT_COUNTRY;
    const key = input.trim().toUpperCase();
    if (COUNTRY_CONFIG[key]) return key;
    return COUNTRY_ALIASES[key] || DEFAULT_COUNTRY;
};

export const getCountryConfig = (input) => {
    const code = normalizeCountry(input);
    return COUNTRY_CONFIG[code] || COUNTRY_CONFIG[DEFAULT_COUNTRY];
};

/**
 * Country-appropriate example place names for form placeholders (e.g. the
 * "From / To Location" fields when creating a route). A Kuwait partner sees
 * Kuwait examples instead of Dubai/Abu Dhabi. Data-driven so new markets work
 * without touching UI code.
 */
export const getExampleLocations = (input) => {
    const cfg = getCountryConfig(input);
    return cfg.exampleLocations || COUNTRY_CONFIG[DEFAULT_COUNTRY].exampleLocations;
};

/**
 * Selectable service locations (cities / emirates / governorates) per country.
 * This is the single source of truth for location dropdowns across every form
 * (B2B add/edit vehicle, corporate requirements, etc.). Because the app is
 * multi-country, a location list is ALWAYS scoped to one country so a Kuwait
 * partner never sees Dubai and a UAE partner never sees Kuwait City. To launch a
 * new market, add its cities here (mirrors backend localizationConfig.js).
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
 * Location selection granularity per country (mirrors backend localizationConfig).
 *  - "CITY"    : large markets (UAE, Saudi) — pick a specific city/emirate.
 *  - "COUNTRY" : small single-metro markets (Kuwait, Bahrain, Qatar) — select
 *                the whole country and see every partner in it.
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
 * Options for the location dropdown, honoring the country's scope. For a
 * COUNTRY-scope market this is a single whole-country option (e.g. ["Kuwait"]);
 * for a CITY-scope market it's the list of cities/emirates.
 */
export const getLocationOptions = (input) => {
    const code = normalizeCountry(input);
    if (getLocationScope(code) === "COUNTRY") {
        return [getCountryConfig(code).displayName];
    }
    return getCountryLocations(code);
};

/**
 * Reverse lookup: which canonical country does a location name belong to?
 * Used to resolve the correct currency from a chosen location. Returns null
 * when the location is not recognized so callers can fall back to the viewer's
 * country.
 */
export const getLocationCountry = (locationName) => {
    if (!locationName || typeof locationName !== "string") return null;
    const needle = locationName.trim().toLowerCase();
    for (const [code, list] of Object.entries(COUNTRY_LOCATIONS)) {
        if (list.some((loc) => loc.toLowerCase() === needle)) return code;
    }
    return null;
};

/**
 * Resolve the currency for a chosen location. Config-driven (no hard-coded city
 * lists): the location's own country wins; otherwise fall back to the provided
 * country, else the viewer's active currency. Keeps currency and location in
 * sync for the requirements/search forms.
 */
export const getCurrencyForLocation = (locationName, fallbackCountry) => {
    const locCountry = getLocationCountry(locationName);
    if (locCountry) return getCountryConfig(locCountry).currency;
    if (fallbackCountry) return getCountryConfig(fallbackCountry).currency;
    return getActiveCurrency();
};

export const getCurrencyDecimals = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match ? match.currencyDecimals : 2;
};

export const getCurrencySymbol = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match ? match.currencySymbol : currency;
};

/**
 * Extra wallet balance (on top of the admin commission) a partner must hold to
 * accept a CASH booking, resolved from a currency code. Mirrors the backend
 * getCashAcceptanceBuffer so the client-side pre-check and the modal show the
 * same figure the server enforces — instead of a hard-coded "+ 50" that made a
 * Kuwait partner think they needed 50 KWD extra. Falls back to 0.
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
 * Resolve the payment gateway for a given currency. This makes gateway
 * selection data-driven instead of a hardcoded `currency === "KWD"` check,
 * so future countries (e.g. BHD/OMR -> TAP, SAR/QAR -> STRIPE) work without
 * changing UI code. Falls back to the default country's gateway.
 */
export const getGatewayForCurrency = (currency) => {
    const match = Object.values(COUNTRY_CONFIG).find(
        (c) => c.currency === (currency || "").toUpperCase()
    );
    return match ? match.paymentGateway : COUNTRY_CONFIG[DEFAULT_COUNTRY].paymentGateway;
};

/** Resolve the payment gateway for a country (any variant). */
export const getCountryGateway = (input) => getCountryConfig(input).paymentGateway;

/** Build the default locale object used as Redux initial state. */
export const buildLocale = (input) => {
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
        serviceAvailable: c.serviceAvailable,
    };
};

/** Format an amount using a currency's symbol + decimals. */
export const formatMoney = (amount, currency) => {
    const decimals = getCurrencyDecimals(currency);
    const symbol = getCurrencySymbol(currency);
    const value = amount === null || amount === undefined || isNaN(amount) ? 0 : parseFloat(amount);
    return `${symbol} ${value.toFixed(decimals)}`;
};

/**
 * Non-hook accessor for the viewer's active country, read from the persisted
 * locale (set by the Redux locale slice on app load). This lets plain utility
 * functions and display components resolve the right currency as a fallback
 * WITHOUT pulling in a React hook. The backend/Redux remain the source of
 * truth; this only reflects what was already resolved for this session.
 */
export const getActiveCountry = () => {
    try {
        const raw = typeof localStorage !== "undefined" && localStorage.getItem("locale");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.country) return normalizeCountry(parsed.country);
        }
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user?.country) return normalizeCountry(user.country);
    } catch (e) {
        // ignore corrupt storage
    }
    return DEFAULT_COUNTRY;
};

/** The viewer's active currency (e.g. "AED" / "KWD"), for fallback use. */
export const getActiveCurrency = () => getCountryConfig(getActiveCountry()).currency;

/** Currency dropdown options derived from served countries. */
export const getCurrencyOptions = () =>
    Object.values(COUNTRY_CONFIG)
        .filter((c) => c.serviceAvailable)
        .map((c) => ({ value: c.currency, label: `${c.currency} - ${c.name}` }));

/**
 * All country/currency options (including markets not yet launched). Used by the
 * admin currency selector so a platform admin can view the dashboard in ANY
 * supported currency. `value` is the canonical country code (what the locale
 * thunk expects); `serviceAvailable` lets the UI tag not-yet-live markets.
 */
export const getAllCurrencyOptions = () =>
    Object.values(COUNTRY_CONFIG).map((c) => ({
        value: c.code,
        currency: c.currency,
        country: c.code,
        name: c.name,
        displayName: c.displayName,
        isoCode: c.isoCode,
        label: `${c.currency} - ${c.name}`,
        serviceAvailable: c.serviceAvailable,
    }));
