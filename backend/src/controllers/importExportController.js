import crypto from "crypto"
import Driver from "../models/Driver.js"
import CorporateDriver from "../models/CorporateDriver.js"
import Vehicle from "../models/Vehicle.js"
import B2CPartnerDriver from "../models/B2CPartnerDriver.js"
import B2CPartnerVehicle from "../models/B2CPartnerVehicle.js"
import B2CPartnerRoute from "../models/B2CPartnerRoute.js"
import B2CPartnerSchedule from "../models/B2CPartnerSchedule.js"
import CorporateEmployee from "../models/CorporateEmployee.js"
import User from "../models/User.js"
import { isPartnerRole, isCustomerRole, passengerRoleForOwner } from "../utils/roleFamilies.js"
import { getEffectiveCountry, getCountryCurrency } from "../Config/localizationConfig.js"
import { sendDriverCredentials, sendEmail } from "../Services/emailService.js"
import {
    parseSpreadsheet,
    validateRow,
    buildTemplateBuffer,
    buildExportBuffer,
} from "../utils/importExport.js"

const generateRandomPassword = () => crypto.randomBytes(6).toString("hex")

// Split a "First Last" full name into parts.
const splitName = (fullName) => {
    const parts = String(fullName || "").trim().split(/\s+/)
    return {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || parts[0] || "",
    }
}

const parseList = (value) =>
    String(value || "")
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean)

const fmtDate = (d) => {
    if (!d) return ""
    const date = new Date(d)
    if (isNaN(date)) return ""
    return date.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------
   Route-import helpers (mirror the manual "Add Route" form behaviour)
------------------------------------------------------------------ */
const VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Normalise a time cell ("08:00", "8:00 AM", "18:30") into the "H:MM AM/PM"
// shape the schedule schema requires. Returns "" when it can't be parsed.
const convertToAMPM = (timeString) => {
    const str = String(timeString || "").trim()
    if (!str) return ""
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?(AM|PM)$/i.test(str)) {
        return str.toUpperCase().replace(/\s+/g, " ")
    }
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(str)) {
        const [hours, minutes] = str.split(":").map(Number)
        const period = hours >= 12 ? "PM" : "AM"
        const displayHours = hours % 12 || 12
        return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`
    }
    const m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (m) {
        let [, hours, minutes, period] = m
        hours = parseInt(hours, 10)
        minutes = parseInt(minutes, 10)
        if (!period) {
            period = hours >= 12 ? "PM" : "AM"
            hours = hours % 12 || 12
        }
        return `${hours}:${String(minutes).padStart(2, "0")} ${period.toUpperCase()}`
    }
    return ""
}

// Parse a stops cell like "Mall of the Emirates @ 08:15; Ibn Battuta @ 08:30"
// into [{ location, time }] using only stops that have a valid time.
const parseStopsCell = (cell) =>
    String(cell || "")
        .split(/[;\n]/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
            const [locationPart, timePart] = chunk.split("@")
            const location = String(locationPart || "").trim()
            const time = convertToAMPM(timePart)
            return { location, time }
        })
        .filter((s) => s.location && s.time)

// Look up one of the partner's own vehicles by license plate or model (exact, case-insensitive).
const findB2CVehicle = async (scopeId, term) => {
    const t = String(term || "").trim()
    if (!t) return null
    const rx = new RegExp(`^${escapeRegex(t)}$`, "i")
    return B2CPartnerVehicle.findOne({ b2cPartnerId: scopeId, $or: [{ licensePlate: rx }, { model: rx }] })
}

// Look up one of the partner's own drivers by name or email (exact, case-insensitive).
const findB2CDriver = async (scopeId, term) => {
    const t = String(term || "").trim()
    if (!t) return null
    const rx = new RegExp(`^${escapeRegex(t)}$`, "i")
    return B2CPartnerDriver.findOne({ b2cPartnerId: scopeId, $or: [{ name: rx }, { email: rx }] })
}

// Turn a low-level DB/validation error into a human-friendly message.
const normalizeDbError = (err) => {
    if (err?.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0]
        const val = field ? err.keyValue[field] : ""
        return `Duplicate value${field ? ` for ${field}` : ""}${val ? ` ("${val}")` : ""} - this record already exists.`
    }
    if (err?.name === "ValidationError") {
        return Object.values(err.errors || {})
            .map((e) => e.message)
            .join("; ")
    }
    return err?.message || "Unknown error while saving the record."
}

const emailCredentialsHtml = (name, email, password, companyName) => `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;">
        <h2 style="color:#111;">Welcome to ${companyName || "DriveMe"}</h2>
        <p>Hi ${name || "there"}, an account has been created for you.</p>
        <p>You can log in with the credentials below:</p>
        <table style="border-collapse:collapse;">
            <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;">${email}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;">Temporary Password</td><td style="padding:6px 12px;">${password}</td></tr>
        </table>
        <p style="color:#666;font-size:13px;">Please change your password after your first login.</p>
    </div>
`

/* ============================================================
   DRIVER account creation (shared by B2B / Corporate / B2C)
   Mirrors the single-add controllers: creates the driver record,
   a linked User login account, sends credentials, and rolls back
   the driver record if the User fails to create.
============================================================ */
const createLinkedDriver = async ({ DriverModel, driverDoc, userRole, driverModelName, ownerFields, name, email, phone, driverInfo, companyName }) => {
    const driver = await DriverModel.create(driverDoc)

    const password = generateRandomPassword()
    const userData = {
        role: userRole,
        fullName: name,
        email,
        whatsappNumber: phone,
        password,
        ...ownerFields,
        driverId: driver._id,
        driverModel: driverModelName,
        driverInfo,
    }

    let user
    try {
        user = await User.create(userData)
    } catch (err) {
        await DriverModel.deleteOne({ _id: driver._id })
        throw err
    }

    try {
        await sendDriverCredentials(email, password, name, companyName || "Your Company")
    } catch (e) {
        console.error("[importExport] driver credentials email failed:", e.message)
    }

    return driver
}

/* ============================================================
   ENTITY REGISTRY
============================================================ */
const registry = {
    /* ---------------- B2B Fleet Drivers ---------------- */
    "b2b-drivers": {
        label: "Drivers",
        role: "B2B_PARTNER",
        fields: [
            { key: "name", label: "Full Name", required: true, type: "string", example: "John Smith" },
            { key: "email", label: "Email", required: true, type: "email", example: "john.smith@example.com" },
            { key: "phone", label: "Phone", required: true, type: "string", example: "+96550012345" },
            { key: "licenseNumber", label: "License Number", required: true, type: "string", example: "DL-99881", hint: "Must be unique across the platform." },
            { key: "licenseType", label: "License Type", required: true, type: "enum", enum: ["Light", "Medium", "Heavy", "Commercial"], example: "Light" },
            { key: "licenseExpiry", label: "License Expiry", required: true, type: "date", example: "2027-12-31" },
            { key: "dateOfBirth", label: "Date of Birth", required: true, type: "date", example: "1990-05-20" },
            { key: "nationality", label: "Nationality", required: true, type: "string", example: "Indian" },
            { key: "experienceYears", label: "Experience (Years)", required: true, type: "number", min: 0, example: 5 },
            { key: "street", label: "Street", required: false, type: "string", example: "Block 4, Street 12" },
            { key: "city", label: "City", required: false, type: "string", example: "Kuwait City" },
            { key: "country", label: "Country", required: false, type: "string", example: "Kuwait" },
            { key: "experienceDescription", label: "Experience Notes", required: false, type: "string", example: "Heavy vehicle, 5 yrs" },
        ],
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("companyName")
            return { companyName: owner?.companyName || "Your Company" }
        },
        dedupe: async (scopeId, data) => {
            if (await User.findOne({ email: data.email })) return `An account with email "${data.email}" already exists.`
            if (await Driver.findOne({ licenseNumber: data.licenseNumber })) return `A driver with license number "${data.licenseNumber}" already exists.`
            return null
        },
        createOne: async (scopeId, data, ctx) => {
            const driverInfo = {
                licenseNumber: data.licenseNumber,
                licenseExpiry: data.licenseExpiry,
                licenseType: data.licenseType,
                dateOfBirth: data.dateOfBirth,
                nationality: data.nationality,
                address: { street: data.street, city: data.city, country: data.country },
                experience: { years: data.experienceYears, description: data.experienceDescription },
                documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                status: "AVAILABLE",
            }
            return createLinkedDriver({
                DriverModel: Driver,
                userRole: "B2B_PARTNER_DRIVER",
                driverModelName: "Driver",
                ownerFields: { employedBy: scopeId },
                name: data.name,
                email: data.email,
                phone: data.phone,
                driverInfo,
                companyName: ctx.companyName,
                driverDoc: {
                    fleetOwnerId: scopeId,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    licenseNumber: data.licenseNumber,
                    licenseExpiry: data.licenseExpiry,
                    licenseType: data.licenseType,
                    dateOfBirth: data.dateOfBirth,
                    nationality: data.nationality,
                    address: { street: data.street, city: data.city, country: data.country },
                    experience: { years: data.experienceYears, description: data.experienceDescription },
                    documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                },
            })
        },
        exportQuery: (scopeId) => Driver.find({ fleetOwnerId: scopeId }).sort({ createdAt: -1 }).lean(),
        toExportRow: (d) => ({
            "Full Name": d.name,
            Email: d.email,
            Phone: d.phone,
            "License Number": d.licenseNumber,
            "License Type": d.licenseType,
            "License Expiry": fmtDate(d.licenseExpiry),
            "Date of Birth": fmtDate(d.dateOfBirth),
            Nationality: d.nationality,
            "Experience (Years)": d.experience?.years ?? "",
            Street: d.address?.street || "",
            City: d.address?.city || "",
            Country: d.address?.country || "",
            "Experience Notes": d.experience?.description || "",
        }),
    },

    /* ---------------- Corporate Drivers ---------------- */
    "corporate-drivers": {
        label: "Corporate Drivers",
        role: "CORPORATE",
        get fields() {
            return registry["b2b-drivers"].fields
        },
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("companyName")
            return { companyName: owner?.companyName || "Your Company" }
        },
        dedupe: async (scopeId, data) => {
            if (await User.findOne({ email: data.email })) return `An account with email "${data.email}" already exists.`
            if (await CorporateDriver.findOne({ licenseNumber: data.licenseNumber })) return `A driver with license number "${data.licenseNumber}" already exists.`
            return null
        },
        createOne: async (scopeId, data, ctx) => {
            const driverInfo = {
                licenseNumber: data.licenseNumber,
                licenseExpiry: data.licenseExpiry,
                licenseType: data.licenseType,
                dateOfBirth: data.dateOfBirth,
                nationality: data.nationality,
                address: { street: data.street, city: data.city, country: data.country },
                experience: { years: data.experienceYears, description: data.experienceDescription },
                documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                status: "AVAILABLE",
            }
            return createLinkedDriver({
                DriverModel: CorporateDriver,
                userRole: "CORPORATE_DRIVER",
                driverModelName: "CorporateDriver",
                ownerFields: { employedBy: scopeId, corporateOwnerId: scopeId },
                name: data.name,
                email: data.email,
                phone: data.phone,
                driverInfo,
                companyName: ctx.companyName,
                driverDoc: {
                    corporateOwnerId: scopeId,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    licenseNumber: data.licenseNumber,
                    licenseExpiry: data.licenseExpiry,
                    licenseType: data.licenseType,
                    dateOfBirth: data.dateOfBirth,
                    nationality: data.nationality,
                    address: { street: data.street, city: data.city, country: data.country },
                    experience: { years: data.experienceYears, description: data.experienceDescription },
                    documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                },
            })
        },
        exportQuery: (scopeId) => CorporateDriver.find({ corporateOwnerId: scopeId }).sort({ createdAt: -1 }).lean(),
        get toExportRow() {
            return registry["b2b-drivers"].toExportRow
        },
    },

    /* ---------------- B2C Partner Drivers ---------------- */
    "b2c-drivers": {
        label: "Drivers",
        role: "B2C_PARTNER",
        fields: [
            { key: "name", label: "Full Name", required: true, type: "string", example: "Ali Hassan" },
            { key: "email", label: "Email", required: true, type: "email", example: "ali.hassan@example.com" },
            { key: "phone", label: "Phone", required: true, type: "string", example: "+96550098765" },
            { key: "licenseNumber", label: "License Number", required: true, type: "string", example: "DL-55221" },
            { key: "licenseExpiry", label: "License Expiry", required: true, type: "date", example: "2027-10-15" },
            { key: "nationality", label: "Nationality", required: true, type: "string", example: "Egyptian" },
            { key: "experience", label: "Experience (Years)", required: true, type: "number", min: 0, example: 4 },
            { key: "address", label: "Address", required: false, type: "string", example: "Salmiya, Kuwait" },
            { key: "emergencyContactName", label: "Emergency Contact Name", required: false, type: "string", example: "Sara" },
            { key: "emergencyContactPhone", label: "Emergency Contact Phone", required: false, type: "string", example: "+96550011223" },
            { key: "status", label: "Status", required: false, type: "enum", enum: ["Active", "On Leave", "Inactive"], example: "Active" },
        ],
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("fullName companyName")
            return { companyName: owner?.companyName || owner?.fullName || "B2C Partner" }
        },
        dedupe: async (scopeId, data) => {
            if (await User.findOne({ email: data.email })) return `An account with email "${data.email}" already exists.`
            return null
        },
        createOne: async (scopeId, data, ctx) => {
            const driverInfo = {
                licenseNumber: data.licenseNumber,
                licenseExpiry: data.licenseExpiry,
                nationality: data.nationality,
                address: { street: "", city: "Kuwait City", country: "Kuwait" },
                experience: { years: data.experience, description: "" },
                documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                status: "AVAILABLE",
                emergencyContact: { name: data.emergencyContactName || "", phone: data.emergencyContactPhone || "" },
            }
            return createLinkedDriver({
                DriverModel: B2CPartnerDriver,
                userRole: "B2C_PARTNER_DRIVER",
                driverModelName: "B2CPartnerDriver",
                ownerFields: { b2cPartnerId: scopeId },
                name: data.name,
                email: data.email,
                phone: data.phone,
                driverInfo,
                companyName: ctx.companyName,
                driverDoc: {
                    b2cPartnerId: scopeId,
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phone,
                    licenseNumber: data.licenseNumber,
                    licenseExpiry: data.licenseExpiry,
                    nationality: data.nationality,
                    experience: data.experience,
                    address: data.address || "",
                    emergencyContact: { name: data.emergencyContactName || "", phone: data.emergencyContactPhone || "" },
                    status: data.status || "Active",
                    documents: { license: null, passport: null, visa: null, medicalCertificate: null },
                },
            })
        },
        exportQuery: (scopeId) => B2CPartnerDriver.find({ b2cPartnerId: scopeId }).sort({ createdAt: -1 }).lean(),
        toExportRow: (d) => ({
            "Full Name": d.name,
            Email: d.email || "",
            Phone: d.phoneNumber,
            "License Number": d.licenseNumber,
            "License Expiry": fmtDate(d.licenseExpiry),
            Nationality: d.nationality,
            "Experience (Years)": d.experience ?? "",
            Address: d.address || "",
            "Emergency Contact Name": d.emergencyContact?.name || "",
            "Emergency Contact Phone": d.emergencyContact?.phone || "",
            Status: d.status || "",
        }),
    },

    /* ---------------- B2B Fleet Vehicles ---------------- */
    "b2b-vehicles": {
        label: "Vehicles",
        role: "B2B_PARTNER",
        fields: [
            { key: "vehicleName", label: "Vehicle Name", required: true, type: "string", example: "Toyota Coaster" },
            { key: "registrationNumber", label: "Registration Number", required: true, type: "string", example: "KWT-12345", hint: "Must be unique across the platform." },
            { key: "manufacturingYear", label: "Manufacturing Year", required: true, type: "number", min: 1950, example: 2022 },
            { key: "vehicleCategory", label: "Vehicle Category", required: true, type: "enum", enum: ["SEDAN", "SUV", "MINIVAN", "COASTER_BUS", "LUXURY_COACH", "SHUTTLE_BUS", "PICKUP_1TON", "PICKUP_3TON", "TRUCK_7TON", "REEFER_TRUCK", "FLATBED_TRAILER", "EXECUTIVE_VAN", "ANY_TYPE"], example: "COASTER_BUS" },
            { key: "serviceType", label: "Service Type", required: true, type: "enum", enum: ["PASSENGER", "GOODS_CARRIER", "MANAGED_SERVICES"], example: "PASSENGER" },
            { key: "seatingCapacity", label: "Seating Capacity", required: false, type: "number", min: 0, example: 24 },
            { key: "cargoCapacity", label: "Cargo Capacity (tons)", required: false, type: "number", min: 0, example: 0 },
            { key: "location", label: "Location", required: true, type: "string", example: "Kuwait City" },
            { key: "dailyRate", label: "Daily Rate", required: true, type: "number", min: 0, example: 40 },
            { key: "weeklyRate", label: "Weekly Rate", required: true, type: "number", min: 0, example: 250 },
            { key: "monthlyRate", label: "Monthly Rate", required: true, type: "number", min: 0, example: 900 },
            { key: "perKmCharge", label: "Per KM Charge", required: true, type: "number", min: 0, example: 0.5 },
            { key: "driverCharges", label: "Driver Charges", required: false, type: "number", min: 0, example: 0 },
            { key: "fuelCharges", label: "Fuel Charges", required: false, type: "number", min: 0, example: 0 },
        ],
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("country countryCode role adminPermissions companyName")
            const currency = getCountryCurrency(getEffectiveCountry(owner)) || "AED"
            return { currency }
        },
        dedupe: async (scopeId, data) => {
            if (await Vehicle.findOne({ registrationNumber: data.registrationNumber })) return `A vehicle with registration number "${data.registrationNumber}" already exists.`
            return null
        },
        createOne: async (scopeId, data, ctx) => {
            return Vehicle.create({
                fleetOwnerId: scopeId,
                vehicleName: data.vehicleName,
                registrationNumber: data.registrationNumber,
                manufacturingYear: data.manufacturingYear,
                vehicleCategory: data.vehicleCategory,
                serviceType: data.serviceType,
                capacity: {
                    seatingCapacity: data.seatingCapacity ?? undefined,
                    cargoCapacity: data.cargoCapacity ?? undefined,
                },
                location: data.location,
                pricing: {
                    currency: ctx.currency,
                    dailyRate: data.dailyRate,
                    weeklyRate: data.weeklyRate,
                    monthlyRate: data.monthlyRate,
                    perKmCharge: data.perKmCharge,
                    driverCharges: data.driverCharges ?? 0,
                    fuelCharges: data.fuelCharges ?? 0,
                },
            })
        },
        exportQuery: (scopeId) => Vehicle.find({ fleetOwnerId: scopeId }).sort({ createdAt: -1 }).lean(),
        toExportRow: (v) => ({
            "Vehicle Name": v.vehicleName,
            "Registration Number": v.registrationNumber,
            "Manufacturing Year": v.manufacturingYear,
            "Vehicle Category": v.vehicleCategory,
            "Service Type": v.serviceType,
            "Seating Capacity": v.capacity?.seatingCapacity ?? "",
            "Cargo Capacity (tons)": v.capacity?.cargoCapacity ?? "",
            Location: v.location,
            "Daily Rate": v.pricing?.dailyRate ?? "",
            "Weekly Rate": v.pricing?.weeklyRate ?? "",
            "Monthly Rate": v.pricing?.monthlyRate ?? "",
            "Per KM Charge": v.pricing?.perKmCharge ?? "",
            "Driver Charges": v.pricing?.driverCharges ?? 0,
            "Fuel Charges": v.pricing?.fuelCharges ?? 0,
        }),
    },

    /* ---------------- B2C Partner Vehicles ---------------- */
    "b2c-vehicles": {
        label: "Vehicles",
        role: "B2C_PARTNER",
        fields: [
            { key: "vehicleType", label: "Vehicle Type", required: true, type: "enum", enum: ["Sedan", "SUV", "Van", "Minibus", "Bus", "Pickup Truck", "Other"], example: "Minibus" },
            { key: "model", label: "Model", required: true, type: "string", example: "Toyota Hiace" },
            { key: "year", label: "Year", required: true, type: "number", min: 1950, example: 2021 },
            { key: "seatingCapacity", label: "Seating Capacity", required: true, type: "number", min: 1, example: 14 },
            { key: "licensePlate", label: "License Plate", required: true, type: "string", example: "KWT-88221", hint: "Must be unique across the platform." },
            { key: "vehicleColor", label: "Color", required: false, type: "string", example: "White" },
            { key: "status", label: "Status", required: false, type: "enum", enum: ["Active", "Maintenance", "Inactive"], example: "Active" },
            { key: "insuranceExpiry", label: "Insurance Expiry", required: false, type: "date", example: "2026-06-30" },
            { key: "registrationExpiry", label: "Registration Expiry", required: false, type: "date", example: "2026-06-30" },
            { key: "features", label: "Features", required: false, type: "string", example: "AC, WiFi, GPS", hint: "Comma-separated list." },
        ],
        dedupe: async (scopeId, data) => {
            if (await B2CPartnerVehicle.findOne({ licensePlate: data.licensePlate })) return `A vehicle with license plate "${data.licensePlate}" already exists.`
            return null
        },
        createOne: async (scopeId, data) => {
            return B2CPartnerVehicle.create({
                b2cPartnerId: scopeId,
                vehicleType: data.vehicleType,
                model: data.model,
                year: data.year,
                seatingCapacity: data.seatingCapacity,
                licensePlate: data.licensePlate,
                vehicleColor: data.vehicleColor || "",
                status: data.status || "Active",
                insuranceExpiry: data.insuranceExpiry || undefined,
                registrationExpiry: data.registrationExpiry || undefined,
                features: parseList(data.features),
                isActive: true,
            })
        },
        exportQuery: (scopeId) => B2CPartnerVehicle.find({ b2cPartnerId: scopeId }).sort({ createdAt: -1 }).lean(),
        toExportRow: (v) => ({
            "Vehicle Type": v.vehicleType,
            Model: v.model,
            Year: v.year,
            "Seating Capacity": v.seatingCapacity,
            "License Plate": v.licensePlate,
            Color: v.vehicleColor || "",
            Status: v.status || "",
            "Insurance Expiry": fmtDate(v.insuranceExpiry),
            "Registration Expiry": fmtDate(v.registrationExpiry),
            Features: (v.features || []).join(", "),
        }),
    },

    /* ---------------- B2C Partner Routes ---------------- */
    "b2c-routes": {
        label: "Routes",
        role: "B2C_PARTNER",
        // Columns mirror the manual "Add New Route" form (One Way / Round Trip) so a
        // partner can fill the template exactly like they would fill the form.
        fields: [
            { key: "fromLocation", label: "From Location", required: true, type: "string", example: "Dubai Marina" },
            { key: "toLocation", label: "To Location", required: true, type: "string", example: "Abu Dhabi City" },
            { key: "routeStartDate", label: "Route Start Date", required: true, type: "date", example: "2026-08-01" },
            { key: "availableDays", label: "Available Days", required: true, type: "string", example: "MON, TUE, WED, THU, FRI", hint: "Comma-separated from: MON, TUE, WED, THU, FRI, SAT, SUN" },
            { key: "description", label: "Route Description", required: false, type: "string", example: "Morning office shuttle" },
            { key: "tripType", label: "Trip Type", required: true, type: "enum", enum: ["One Way", "Round Trip"], example: "One Way" },
            { key: "direction", label: "Direction", required: false, type: "enum", enum: ["From → To", "To → From"], example: "From → To", hint: "One Way only. Which way this one-way trip runs. Defaults to From → To." },
            { key: "departureTime", label: "Departure Time", required: true, type: "string", example: "08:00", hint: "Bus leaves origin. Use 24h (08:00) or 8:00 AM." },
            { key: "arrivalTime", label: "Arrival Time", required: false, type: "string", example: "09:30", hint: "Bus reaches destination." },
            { key: "returnDepartureTime", label: "Return Departure Time", required: false, type: "string", example: "18:00", hint: "Round Trip only. Bus departs destination to head back." },
            { key: "returnArrivalTime", label: "Return Arrival Time", required: false, type: "string", example: "19:30", hint: "Round Trip only. Bus reaches back origin." },
            { key: "outboundStops", label: "Outbound Stops", required: false, type: "string", example: "Mall of the Emirates @ 08:15; Ibn Battuta @ 08:30", hint: "Optional. Format: Location @ time; separate multiple stops with a semicolon." },
            { key: "returnStops", label: "Return Stops", required: false, type: "string", example: "", hint: "Round Trip only. Same format as Outbound Stops." },
            { key: "driver", label: "Driver", required: true, type: "string", example: "ali.hassan@example.com", hint: "Driver name or email. Must already exist under Fleet & Drivers." },
            { key: "vehicle", label: "Vehicle", required: true, type: "string", example: "DXB-12345", hint: "Vehicle license plate or model. Seat capacity is taken from this vehicle." },
            { key: "returnDriver", label: "Return Driver", required: false, type: "string", example: "", hint: "Round Trip only. Leave blank to reuse the outbound driver." },
            { key: "returnVehicle", label: "Return Vehicle", required: false, type: "string", example: "", hint: "Round Trip only. Leave blank to reuse the outbound vehicle." },
            { key: "monthlyOneWayPrice", label: "One Way Monthly Price", required: true, type: "number", min: 0, example: 2000, hint: "Fixed price per month for a one-way monthly pass." },
            { key: "monthlyRoundTripPrice", label: "Round Trip Monthly Price", required: false, type: "number", min: 0, example: 4000, hint: "Fixed price per month for a round-trip monthly pass." },
            { key: "currency", label: "Currency", required: false, type: "enum", enum: ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"], example: "AED", hint: "Optional. Defaults to your account currency." },
        ],
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("country countryCode role adminPermissions")
            const currency = getCountryCurrency(getEffectiveCountry(owner)) || "AED"
            return { currency }
        },
        dedupe: async () => null,
        createOne: async (scopeId, data, ctx) => {
            const isRoundTrip = data.tripType === "Round Trip"

            // Outbound vehicle is required - the route's seat capacity comes from it,
            // exactly like the manual form (seats auto-determined by the vehicle).
            const vehicle = await findB2CVehicle(scopeId, data.vehicle)
            if (!vehicle) {
                throw new Error(`Vehicle "${data.vehicle}" was not found in your fleet. Add it under Fleet & Drivers first, or check the license plate / model.`)
            }
            if (vehicle.status && vehicle.status !== "Active") {
                throw new Error(`Vehicle "${data.vehicle}" is "${vehicle.status}" and cannot be assigned. Use an Active vehicle.`)
            }

            const driver = await findB2CDriver(scopeId, data.driver)
            if (!driver) {
                throw new Error(`Driver "${data.driver}" was not found in your fleet. Add them under Fleet & Drivers first, or check the name / email.`)
            }

            // Optional dedicated return leg (Round Trip only).
            let returnVehicle = null
            let returnDriver = null
            if (isRoundTrip) {
                if (data.returnVehicle) {
                    returnVehicle = await findB2CVehicle(scopeId, data.returnVehicle)
                    if (!returnVehicle) throw new Error(`Return Vehicle "${data.returnVehicle}" was not found in your fleet.`)
                    if (returnVehicle.status && returnVehicle.status !== "Active") {
                        throw new Error(`Return Vehicle "${data.returnVehicle}" is "${returnVehicle.status}" and cannot be assigned.`)
                    }
                }
                if (data.returnDriver) {
                    returnDriver = await findB2CDriver(scopeId, data.returnDriver)
                    if (!returnDriver) throw new Error(`Return Driver "${data.returnDriver}" was not found in your fleet.`)
                }
            }

            const availableDays = parseList(data.availableDays)
                .map((d) => d.slice(0, 3).toUpperCase())
                .filter((d) => VALID_DAYS.includes(d))
            if (!availableDays.length) {
                throw new Error(`"Available Days" must list at least one of: ${VALID_DAYS.join(", ")}.`)
            }

            const departureTime = convertToAMPM(data.departureTime)
            if (!departureTime) {
                throw new Error(`"Departure Time" is invalid. Use 24h (08:00) or 8:00 AM.`)
            }

            const direction = String(data.direction || "").includes("To → From") ? "return" : "outbound"
            const currency = data.currency || ctx?.currency || "AED"
            const totalSeats = vehicle.seatingCapacity || 20

            // 1) Create the route (same shape the manual Add Route form produces).
            const route = await B2CPartnerRoute.create({
                b2cPartnerId: scopeId,
                fromLocation: data.fromLocation,
                toLocation: data.toLocation,
                routeStartDate: data.routeStartDate,
                totalSeats,
                availableSeats: totalSeats,
                pricing: {
                    // Daily prices are no longer used by the form - only monthly passes.
                    oneWayPrice: 0,
                    roundTripPrice: 0,
                    monthlyOneWayPrice: data.monthlyOneWayPrice ?? 0,
                    monthlyRoundTripPrice: data.monthlyRoundTripPrice ?? 0,
                    currency,
                },
                tripType: isRoundTrip ? "Round Trip" : "One Way",
                startTime: departureTime,
                availableDays,
                description: data.description || "",
                assignedVehicle: vehicle._id,
                assignedDriver: driver._id,
                status: "Active",
                isActive: true,
            })

            // 2) Create the schedule + trip time so the route is actually bookable,
            //    just like creating a trip time in the manual form.
            const tripTime = {
                departureTime,
                // schema.arrivalTime == "Return Departure Time" (bus departs destination to head back)
                arrivalTime: isRoundTrip ? (convertToAMPM(data.returnDepartureTime) || null) : null,
                // schema.destinationArrivalTime == "Arrival Time" (bus reaches destination)
                destinationArrivalTime: convertToAMPM(data.arrivalTime) || null,
                // schema.returnArrivalTime == bus reaches back origin (Round Trip only)
                returnArrivalTime: isRoundTrip ? (convertToAMPM(data.returnArrivalTime) || null) : null,
                tripType: isRoundTrip ? "Round Trip" : "One Way",
                direction: isRoundTrip ? "outbound" : direction,
                assignedDriver: driver._id,
                assignedVehicle: vehicle._id,
                returnDriver: returnDriver?._id || null,
                returnVehicle: returnVehicle?._id || null,
                outboundIsSelfDriver: false,
                returnIsSelfDriver: false,
                outboundStopPoints: parseStopsCell(data.outboundStops),
                returnStopPoints: isRoundTrip ? parseStopsCell(data.returnStops) : [],
            }

            await B2CPartnerSchedule.create({
                b2cPartnerId: scopeId,
                routeId: route._id,
                scheduleName: `${route.fromLocation} to ${route.toLocation} Schedule`,
                tripTimes: [tripTime],
                availableDays,
                assignedVehicle: vehicle._id,
                assignedDriver: driver._id,
                startDate: data.routeStartDate || new Date(),
                isActive: true,
                status: "Active",
                lastTripGenerated: new Date(),
                nextTripGeneration: new Date(),
            })

            // Keep driver <-> vehicle cross-links in sync (mirrors manual schedule creation).
            try {
                await B2CPartnerDriver.findByIdAndUpdate(driver._id, { $addToSet: { assignedVehicles: vehicle._id } })
                await B2CPartnerVehicle.findByIdAndUpdate(vehicle._id, { $addToSet: { assignedDrivers: driver._id } })
            } catch (linkErr) {
                console.error("[importExport] route driver/vehicle link failed:", linkErr.message)
            }

            return route
        },
        exportQuery: async (scopeId) => {
            const routes = await B2CPartnerRoute.find({ b2cPartnerId: scopeId }).sort({ createdAt: -1 }).lean()
            const schedules = await B2CPartnerSchedule.find({ b2cPartnerId: scopeId, isActive: true }).lean()

            const schedByRoute = new Map()
            for (const s of schedules) {
                const key = String(s.routeId)
                if (!schedByRoute.has(key)) schedByRoute.set(key, s)
            }

            const vehicleIds = new Set()
            const driverIds = new Set()
            const rows = routes.map((r) => {
                const tt = schedByRoute.get(String(r._id))?.tripTimes?.[0] || null
                ;[r.assignedVehicle, tt?.assignedVehicle, tt?.returnVehicle].forEach((v) => v && vehicleIds.add(String(v)))
                ;[r.assignedDriver, tt?.assignedDriver, tt?.returnDriver].forEach((d) => d && driverIds.add(String(d)))
                return { r, tt }
            })

            const [vehicles, drivers] = await Promise.all([
                B2CPartnerVehicle.find({ _id: { $in: [...vehicleIds] } }).select("licensePlate model").lean(),
                B2CPartnerDriver.find({ _id: { $in: [...driverIds] } }).select("name email").lean(),
            ])
            const vMap = new Map(vehicles.map((v) => [String(v._id), v]))
            const dMap = new Map(drivers.map((d) => [String(d._id), d]))
            const vLabel = (id) => (id && vMap.get(String(id)) ? (vMap.get(String(id)).licensePlate || vMap.get(String(id)).model || "") : "")
            const dLabel = (id) => (id && dMap.get(String(id)) ? (dMap.get(String(id)).name || dMap.get(String(id)).email || "") : "")

            return rows.map(({ r, tt }) => {
                r._exp = {
                    tt,
                    driver: dLabel(tt?.assignedDriver || r.assignedDriver),
                    vehicle: vLabel(tt?.assignedVehicle || r.assignedVehicle),
                    returnDriver: dLabel(tt?.returnDriver),
                    returnVehicle: vLabel(tt?.returnVehicle),
                }
                return r
            })
        },
        toExportRow: (r) => {
            const tt = r._exp?.tt || null
            const isRT = (r.tripType || tt?.tripType) === "Round Trip"
            const stops = (list) => (list || []).map((s) => `${s.location} @ ${s.time}`).join("; ")
            return {
                "From Location": r.fromLocation,
                "To Location": r.toLocation,
                "Route Start Date": fmtDate(r.routeStartDate),
                "Available Days": (r.availableDays || []).join(", "),
                "Route Description": r.description || "",
                "Trip Type": r.tripType || tt?.tripType || "One Way",
                Direction: tt?.direction === "return" ? "To → From" : "From → To",
                "Departure Time": tt?.departureTime || r.startTime || "",
                "Arrival Time": tt?.destinationArrivalTime || "",
                "Return Departure Time": isRT ? (tt?.arrivalTime || "") : "",
                "Return Arrival Time": isRT ? (tt?.returnArrivalTime || "") : "",
                "Outbound Stops": stops(tt?.outboundStopPoints),
                "Return Stops": isRT ? stops(tt?.returnStopPoints) : "",
                Driver: r._exp?.driver || "",
                Vehicle: r._exp?.vehicle || "",
                "Return Driver": isRT ? (r._exp?.returnDriver || "") : "",
                "Return Vehicle": isRT ? (r._exp?.returnVehicle || "") : "",
                "One Way Monthly Price": r.pricing?.monthlyOneWayPrice ?? "",
                "Round Trip Monthly Price": r.pricing?.monthlyRoundTripPrice ?? "",
                Currency: r.pricing?.currency || "",
            }
        },
    },

    /* ---------------- Corporate Employees (Passengers) ---------------- */
    "corporate-employees": {
        label: "Employees",
        role: "CORPORATE",
        fields: [
            { key: "fullName", label: "Full Name", required: true, type: "string", example: "Priya Sharma" },
            { key: "email", label: "Email", required: true, type: "email", example: "priya.sharma@company.com" },
            { key: "phoneNumber", label: "Phone", required: true, type: "string", example: "+96550044556" },
            { key: "employeeId", label: "Employee ID", required: false, type: "string", example: "EMP-1001", hint: "Auto-generated if left blank." },
            { key: "department", label: "Department", required: false, type: "string", example: "Engineering" },
            { key: "designation", label: "Designation", required: false, type: "string", example: "Software Engineer" },
            { key: "workLocation", label: "Work Location", required: false, type: "string", example: "HQ Tower" },
            { key: "homeAddress", label: "Home Address", required: false, type: "string", example: "Hawally, Block 3" },
        ],
        prepareContext: async (scopeId) => {
            const owner = await User.findById(scopeId).select("companyId companyName role")
            return {
                companyId: owner?.companyId || scopeId,
                companyName: owner?.companyName || "Your Company",
                // The owning customer's segment decides the passenger login role:
                // a SCHOOL_CUSTOMER imports SCHOOL_STUDENT rows, a CORPORATE
                // imports CORPORATE_EMPLOYEE rows. Never mislabel a school's
                // students as corporate employees.
                ownerRole: owner?.role || null,
            }
        },
        dedupe: async (scopeId, data, ctx) => {
            if (await User.findOne({ email: data.email })) return `An account with email "${data.email}" already exists.`
            const or = [{ "personalInfo.email": data.email }]
            if (data.employeeId) or.push({ employeeId: data.employeeId })
            if (await CorporateEmployee.findOne({ companyId: ctx.companyId, $or: or })) return `An employee with this email or employee ID already exists.`
            return null
        },
        createOne: async (scopeId, data, ctx) => {
            const password = generateRandomPassword()
            const user = await User.create({
                fullName: data.fullName,
                email: data.email,
                password,
                role: passengerRoleForOwner(ctx.ownerRole),
                companyId: ctx.companyId,
                whatsappNumber: data.phoneNumber || "N/A",
                status: "ACTIVE",
            })

            const { firstName, lastName } = splitName(data.fullName)
            const count = await CorporateEmployee.countDocuments({ companyId: ctx.companyId })
            const employeeId = data.employeeId || `EMP-${String(ctx.companyId).slice(-4)}-${String(count + 1).padStart(4, "0")}`

            try {
                const employee = await CorporateEmployee.create({
                    userId: user._id,
                    companyId: ctx.companyId,
                    employeeId,
                    personalInfo: {
                        firstName,
                        lastName,
                        email: data.email,
                        phoneNumber: data.phoneNumber || "",
                        department: data.department || "",
                        designation: data.designation || "",
                        workLocation: data.workLocation || "",
                    },
                    homeAddress: data.homeAddress || "",
                })

                try {
                    await sendEmail(
                        data.email,
                        `Your ${ctx.companyName} transport account`,
                        emailCredentialsHtml(data.fullName, data.email, password, ctx.companyName),
                    )
                } catch (e) {
                    console.error("[importExport] employee credentials email failed:", e.message)
                }

                return employee
            } catch (err) {
                // Roll back the User so we never leave an orphaned login account.
                await User.deleteOne({ _id: user._id })
                throw err
            }
        },
        exportQuery: (scopeId) =>
            User.findById(scopeId)
                .select("companyId")
                .lean()
                .then((u) =>
                    CorporateEmployee.find({ companyId: u?.companyId || scopeId }).sort({ createdAt: -1 }).lean(),
                ),
        toExportRow: (e) => ({
            "Full Name": `${e.personalInfo?.firstName || ""} ${e.personalInfo?.lastName || ""}`.trim(),
            Email: e.personalInfo?.email || "",
            Phone: e.personalInfo?.phoneNumber || "",
            "Employee ID": e.employeeId || "",
            Department: e.personalInfo?.department || "",
            Designation: e.personalInfo?.designation || "",
            "Work Location": e.personalInfo?.workLocation || "",
            "Home Address": e.homeAddress || "",
        }),
    },
}

/* ============================================================
   REQUEST HANDLERS
============================================================ */
const resolveEntity = (req, res) => {
    const entity = registry[req.params.entity]
    if (!entity) {
        res.status(404).json({ success: false, message: `Unknown import/export type: "${req.params.entity}"` })
        return null
    }
    // Family-aware permission check. SCHOOL_PARTNER mirrors B2B_PARTNER and
    // SCHOOL_CUSTOMER mirrors CORPORATE, so they reuse the same import/export
    // registry entries (e.g. "b2b-vehicles", "corporate-employees").
    const roleAllowed =
        req.userRole === entity.role ||
        (entity.role === "B2B_PARTNER" && isPartnerRole(req.userRole)) ||
        (entity.role === "CORPORATE" && isCustomerRole(req.userRole))

    if (!roleAllowed) {
        res.status(403).json({ success: false, message: "You do not have permission to perform this action." })
        return null
    }
    return entity
}

const sendWorkbook = (res, buffer, filename) => {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.send(buffer)
}

export const getTemplate = (req, res) => {
    const entity = resolveEntity(req, res)
    if (!entity) return
    try {
        const buffer = buildTemplateBuffer(entity.fields, entity.label)
        sendWorkbook(res, buffer, `${req.params.entity}-import-template.xlsx`)
    } catch (error) {
        console.error("[importExport] template error:", error)
        res.status(500).json({ success: false, message: "Could not generate template." })
    }
}

export const exportData = async (req, res) => {
    const entity = resolveEntity(req, res)
    if (!entity) return
    try {
        const docs = await entity.exportQuery(req.userId)
        const rows = docs.map(entity.toExportRow)
        const buffer = buildExportBuffer(entity.fields, rows, entity.label)
        const stamp = new Date().toISOString().slice(0, 10)
        sendWorkbook(res, buffer, `${req.params.entity}-export-${stamp}.xlsx`)
    } catch (error) {
        console.error("[importExport] export error:", error)
        res.status(500).json({ success: false, message: "Could not export data." })
    }
}

export const importData = async (req, res) => {
    const entity = resolveEntity(req, res)
    if (!entity) return

    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, message: "No file uploaded. Please attach a .xlsx or .csv file." })
    }

    let rows
    try {
        rows = parseSpreadsheet(req.file.buffer)
    } catch (error) {
        console.error("[importExport] parse error:", error)
        return res.status(400).json({
            success: false,
            message: "Could not read the file. Please upload a valid .xlsx or .csv file created from the provided template.",
        })
    }

    if (!rows.length) {
        return res.status(400).json({
            success: false,
            message: "The uploaded file has no data rows. Download the template, fill it in, and try again.",
        })
    }

    const scopeId = req.userId
    let ctx = {}
    try {
        ctx = entity.prepareContext ? await entity.prepareContext(scopeId, req) : {}
    } catch (error) {
        console.error("[importExport] context error:", error)
        return res.status(500).json({ success: false, message: "Could not prepare the import. Please try again." })
    }

    const report = { total: rows.length, imported: 0, failed: 0, skipped: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2 // row 1 is the header
        const { data, errors } = validateRow(rows[i], entity.fields)

        if (errors.length) {
            report.failed++
            report.errors.push({ row: rowNum, level: "error", messages: errors })
            continue
        }

        try {
            const duplicateReason = entity.dedupe ? await entity.dedupe(scopeId, data, ctx) : null
            if (duplicateReason) {
                report.skipped++
                report.errors.push({ row: rowNum, level: "skipped", messages: [duplicateReason] })
                continue
            }
            await entity.createOne(scopeId, data, ctx)
            report.imported++
        } catch (err) {
            console.error(`[importExport] row ${rowNum} failed:`, err.message)
            report.failed++
            report.errors.push({ row: rowNum, level: "error", messages: [normalizeDbError(err)] })
        }
    }

    const parts = [`${report.imported} imported`]
    if (report.skipped) parts.push(`${report.skipped} skipped (duplicates)`)
    if (report.failed) parts.push(`${report.failed} failed`)

    return res.status(200).json({
        success: true,
        message: `Import finished: ${parts.join(", ")}.`,
        report,
    })
}
