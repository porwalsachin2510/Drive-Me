import CorporateEmployee from "../models/CorporateEmployee.js";
import User from "../models/User.js";
import Contract from "../models/Contract.js";
import Route from "../models/Route.js";
import CorporateRouteSchedule from "../models/CorporateRouteSchedule.js";
import CorporateBooking from "../models/CorporateBooking.js";
import MonthlyPass from "../models/MonthlyPass.js";
import Trip from "../models/Trip.js";
import { sendEmail } from "../Services/emailService.js";
import { logRequestActivity } from "../utils/operationContext.js";
import { autoFulfillBriefItem } from "./managedServiceBriefController.js";
import { getEffectiveCountry, getCountryCurrency } from "../Config/localizationConfig.js";
import { passengerRoleForOwner, isSchoolRole } from "../utils/roleFamilies.js";
import csv from "csv-parser";
import fs from "fs";

/**
 * Resolve the public app origin for links in invitation emails.
 *
 * FRONTEND_URL may be unset, or a comma-separated list of allowed origins.
 * Reading it as `process.env.FRONTEND_URL.split(",")[0]` throws a TypeError when
 * the var is missing, and that throw was being swallowed by the per-recipient
 * try/catch — so invitation emails silently landed in "failed" and never sent.
 * This helper never throws and always returns a usable origin.
 */
const getAppOrigin = () => {
    const raw =
        process.env.FRONTEND_URL ||
        process.env.CLIENT_URL ||
        process.env.APP_URL ||
        "";
    const first = String(raw).split(",")[0].trim();
    return first || "http://localhost:5173";
};

/**
 * Segment-aware wording for passenger invitation emails. A SCHOOL_CUSTOMER /
 * SCHOOL_PARTNER owner invites students, so the copy must say "school" and
 * "student" instead of the corporate "employee" wording.
 */
const invitationBranding = (ownerRole) => {
    // Accept either an owner role (SCHOOL_CUSTOMER/CORPORATE) or a passenger
    // role (SCHOOL_STUDENT/CORPORATE_EMPLOYEE) — both signal the segment.
    const school =
        isSchoolRole(ownerRole) || ownerRole === "SCHOOL_STUDENT";
    const passenger = school ? "student" : "employee";
    const Passenger = passenger.charAt(0).toUpperCase() + passenger.slice(1);
    return {
        school,
        passenger,
        Passenger,
        serviceName: school ? "School Transport" : "Corporate Transport",
        productLine: school
            ? "DriveMe School Transport"
            : "DriveMe Corporate Transport",
        subject: school
            ? "You're invited to your school transport portal - DriveMe"
            : "You are invited to join Corporate Transport - DriveMe",
        // School segment uses a warmer green; corporate keeps the navy.
        headerGradient: school
            ? "linear-gradient(135deg, #0f766e 0%, #047857 100%)"
            : "linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)",
        accent: school ? "#0f766e" : "#1a237e",
    };
};

// Helper function to calculate pass dates based on duration type
const calculatePassDates = (passDuration) => {
    // Use custom start date if provided, otherwise use today
    const startDate = passDuration?.startDate ? new Date(passDuration.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date(startDate);

    if (passDuration?.durationType === "CUSTOM" && passDuration.customEndDate) {
        return {
            startDate: startDate,
            endDate: new Date(passDuration.customEndDate)
        };
    }

    switch (passDuration?.durationType) {
        case "1_MONTH":
            endDate.setMonth(endDate.getMonth() + 1);
            break;
        case "2_MONTHS":
            endDate.setMonth(endDate.getMonth() + 2);
            break;
        case "3_MONTHS":
            endDate.setMonth(endDate.getMonth() + 3);
            break;
        case "6_MONTHS":
            endDate.setMonth(endDate.getMonth() + 6);
            break;
        case "1_YEAR":
            endDate.setFullYear(endDate.getFullYear() + 1);
            break;
        default:
            endDate.setMonth(endDate.getMonth() + 1); // Default to 1 month
    }

    return { startDate, endDate };
};

// Helper function to get pass type from duration
const getPassType = (durationType) => {
    switch (durationType) {
        case "3_MONTHS":
            return "QUARTERLY";
        case "1_YEAR":
            return "YEARLY";
        default:
            return "MONTHLY";
    }
};

// Helper function to generate trips for an employee based on their route schedule and pass duration
const generateTripsForEmployee = async (employee, companyId, passDuration = null) => {
    try {
        if (!employee.transportDetails?.assignedRoute) {
            console.log("[v0] Employee has no assigned route, skipping trip generation");
            return { generated: 0, message: "No assigned route", monthlyPass: null, bookings: [] };
        }

        const routeId = employee.transportDetails.assignedRoute;

        // Get the route schedule
        const routeSchedule = await CorporateRouteSchedule.findOne({
            routeId: routeId,
            corporateId: companyId,
            isActive: true
        });

        if (!routeSchedule) {
            console.log("[v0] No active schedule found for route:", routeId);
            return { generated: 0, message: "No schedule found for route", monthlyPass: null, bookings: [] };
        }

        const route = await Route.findById(routeId).populate('vehicleId');
        if (!route) {
            console.log("[v0] Route not found:", routeId);
            return { generated: 0, message: "Route not found", monthlyPass: null, bookings: [] };
        }

        // Get contract for this route
        const contract = await Contract.findOne({
            corporateId: companyId,
            status: "ACTIVE"
        });

        // Currency must follow the corporate's country (identity-locked), never
        // a hard-coded value. Prefer the contract/route currency; fall back to
        // the corporate account's country currency so UAE corporates get AED
        // and Kuwait corporates get KWD.
        let passCurrency = contract?.financials?.currency || route?.currency;
        if (!passCurrency) {
            const corporate = await User.findById(companyId).select("country countryCode role adminPermissions");
            passCurrency = getCountryCurrency(getEffectiveCountry(corporate));
        }

        // Calculate pass dates based on duration
        const { startDate, endDate } = calculatePassDates(passDuration);

        // CHECK FOR EXISTING ACTIVE MONTHLY PASS - Prevent duplicates
        const existingPass = await MonthlyPass.findOne({
            employeeId: employee.userId,
            corporateId: companyId,
            routeId: routeId,
            status: "ACTIVE",
            validTo: { $gte: new Date() }
        });

        if (existingPass) {
            console.log(`[v0] Active monthly pass already exists for employee ${employee._id}: ${existingPass._id}`);
            return {
                generated: 0,
                message: "Active monthly pass already exists",
                monthlyPass: existingPass._id,
                booking: null,
                bookingsCount: 0
            };
        }

        // Get pickup/dropoff details
        const outboundPickup = employee.transportDetails?.outboundPickupStop ||
            employee.transportDetails?.pickupPoint ||
            routeSchedule.tripTimes?.[0]?.outboundStopPoints?.[0]?.location;
        const outboundDropoff = employee.transportDetails?.outboundDropoffStop ||
            employee.transportDetails?.dropOffPoint ||
            route.toLocation;
        const assignedTripTime = employee.transportDetails?.assignedTripDepartureTime ||
            routeSchedule.tripTimes?.[0]?.departureTime || "08:00";

        // Create Monthly Pass for the employee
        const monthlyPass = new MonthlyPass({
            employeeId: employee.userId,
            corporateId: companyId,
            contractId: contract?._id,
            routeId: routeId,
            passType: getPassType(passDuration?.durationType),
            validFrom: startDate,
            validTo: endDate,
            preferredPickupPoint: outboundPickup,
            preferredPickupTime: assignedTripTime,
            preferredDropPoint: outboundDropoff,
            totalAmount: 0, // Corporate billed
            currency: passCurrency,
            paymentStatus: "PAID", // Corporate billing
            paidAt: new Date(),
            paymentMethod: "CORPORATE_BILLED",
            totalTrips: 0, // Will be updated
            usedTrips: 0,
            remainingTrips: 0,
            status: "ACTIVE",
            autoRenewal: false,
            createdBy: companyId
        });

        await monthlyPass.save();
        console.log(`[v0] Created monthly pass for employee ${employee._id}: ${monthlyPass._id}`);

        let tripsGenerated = 0;
        const allTripIds = []; // Collect all trip IDs for monthlyTrips array
        const currentDate = new Date(startDate);

        // Get the assigned trip info for return trip details
        const employeeAssignedTripNumber = employee.transportDetails?.assignedTripNumber || 1;
        const employeeAssignedTripType = employee.transportDetails?.assignedTripType;
        const assignedTripTimeObj = routeSchedule.tripTimes?.find(t => Number(t.tripNumber) === Number(employeeAssignedTripNumber));

        // Determine return trip info
        const returnDepartureTimeGlobal = assignedTripTimeObj?.returnDepartureTime || routeSchedule.returnDepartureTime;
        const returnStopPointsGlobal = assignedTripTimeObj?.returnStopPoints || routeSchedule.returnStopPoints || [];
        const returnPickupGlobal = employee.transportDetails?.returnPickupStop || route.toLocation;
        const returnDropoffGlobal = employee.transportDetails?.returnDropoffStop ||
            employee.transportDetails?.outboundPickupStop ||
            returnStopPointsGlobal?.[returnStopPointsGlobal.length - 1]?.location;

        // Determine if this is a round trip assignment
        // If the schedule's trip type is "Round Trip", generate return trips
        // The schedule is the source of truth
        const scheduleTripType = assignedTripTimeObj?.tripType || "";
        const isRoundTripAssignment = scheduleTripType.toLowerCase().replace(/[\s_-]/g, '') === 'roundtrip' &&
            !!returnDepartureTimeGlobal;



        // Generate trips for the entire pass duration
        while (currentDate <= endDate) {
            const dayIndex = currentDate.getDay();
            const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex];

            // Check if this day is in the schedule
            if (routeSchedule.availableDays.includes(dayName)) {
                // Get the assigned trip number for this employee (if specified)
                const employeeAssignedTripNumber = employee.transportDetails?.assignedTripNumber || 1;
                const employeeAssignedTripType = employee.transportDetails?.assignedTripType;

                // Generate trips for each trip time in the schedule
                for (const tripTime of routeSchedule.tripTimes) {
                    // If employee has a specific trip assigned, only generate for that trip
                    // Use Number() to handle string vs number comparison
                    const empTripNum = Number(employeeAssignedTripNumber);
                    const scheduleTripNum = Number(tripTime.tripNumber);
                    if (empTripNum && scheduleTripNum !== empTripNum) {
                        continue;
                    }

                    const tripDate = new Date(currentDate);
                    tripDate.setHours(0, 0, 0, 0);

                    // Check if OUTBOUND trip already exists for this employee on this date/time
                    const existingOutboundTrip = await Trip.findOne({
                        corporateId: companyId,
                        routeId: route._id,
                        tripDate: tripDate,
                        startTime: tripTime.departureTime,
                        direction: "FORWARD",
                        'passengers.passengerId': employee.userId
                    });

                    // Skip this tripTime if outbound already exists (but don't skip the day)
                    if (existingOutboundTrip) {
                        continue;
                    }

                    // Use the new transport detail fields for pickup/dropoff
                    const tripOutboundPickup = employee.transportDetails?.outboundPickupStop ||
                        employee.transportDetails?.pickupPoint ||
                        tripTime.outboundStopPoints?.[0]?.location;
                    const tripOutboundDropoff = employee.transportDetails?.outboundDropoffStop ||
                        employee.transportDetails?.dropOffPoint ||
                        route.toLocation;
                    const returnPickup = employee.transportDetails?.returnPickupStop || route.toLocation;
                    const returnDropoff = employee.transportDetails?.returnDropoffStop ||
                        employee.transportDetails?.outboundPickupStop ||
                        tripTime.returnStopPoints?.[0]?.location;

                    // Get driver ID from schedule or route
                    const tripDriverId = routeSchedule.assignedDriver ||
                        route.driverId ||
                        routeSchedule.driverId ||
                        null;

                    // Create outbound trip (home -> office)
                    const outboundTripData = {
                        corporateId: companyId,
                        routeId: route._id,
                        vehicleId: route.vehicleId?._id || routeSchedule.assignedVehicle,
                        driverId: tripDriverId,
                        tripDate: tripDate,
                        startTime: tripTime.departureTime,
                        endTime: tripTime.arrivalTime || null,
                        tripType: tripTime.tripType === "Round Trip" ? "ROUND_TRIP" : "ONE_WAY",
                        direction: "FORWARD",
                        fromLocation: route.fromLocation,
                        toLocation: route.toLocation,
                        totalDistance: route.totalDistance || 0,
                        estimatedDuration: route.estimatedDuration || "30 mins",
                        totalSeats: routeSchedule.totalSeats,
                        availableSeats: routeSchedule.totalSeats - 1,
                        bookedSeats: 1,
                        status: "SCHEDULED",
                        stopPoints: tripTime.outboundStopPoints?.map((stop, index) => ({
                            location: stop.location,
                            sequence: index + 1,
                            scheduledTime: stop.time
                        })) || [],
                        passengers: [{
                            passengerId: employee.userId,
                            employeeId: employee._id,
                            name: `${employee.personalInfo?.firstName || ''} ${employee.personalInfo?.lastName || ''}`.trim() || employee.fullName,
                            pickupStop: tripOutboundPickup,
                            dropoffStop: tripOutboundDropoff,
                            status: "CONFIRMED",
                            bookingStatus: "CONFIRMED",
                            bookedAt: new Date()
                        }]
                    };

                    const outboundTrip = await Trip.create(outboundTripData);
                    tripsGenerated++;
                    allTripIds.push(outboundTrip._id); // Collect trip ID for monthlyTrips array

                    // Create return trip if the schedule's trip type is "Round Trip"
                    // The schedule is the source of truth - if tripType is "Round Trip", generate return trips
                    const isRoundTrip = tripTime.tripType?.toLowerCase()?.replace(/[\s_-]/g, '') === 'roundtrip';

                    // Get return departure time - it could be in tripTime OR in routeSchedule
                    const returnDepartureTime = tripTime.returnDepartureTime || routeSchedule.returnDepartureTime;
                    const returnArrivalTime = tripTime.returnArrivalTime || routeSchedule.returnArrivalTime;
                    const returnStopPoints = tripTime.returnStopPoints || routeSchedule.returnStopPoints || [];

                    const shouldGenerateReturn = isRoundTrip && returnDepartureTime;



                    if (shouldGenerateReturn) {
                        // Check if RETURN trip already exists
                        const existingReturnTrip = await Trip.findOne({
                            corporateId: companyId,
                            routeId: route._id,
                            tripDate: tripDate,
                            startTime: returnDepartureTime,
                            direction: "RETURN",
                            'passengers.passengerId': employee.userId
                        });

                        if (!existingReturnTrip) {
                            const returnTripData = {
                                corporateId: companyId,
                                routeId: route._id,
                                vehicleId: route.vehicleId?._id || routeSchedule.assignedVehicle,
                                driverId: tripDriverId, // Use the same driver as outbound trip
                                tripDate: tripDate,
                                startTime: returnDepartureTime,
                                endTime: returnArrivalTime || null,
                                tripType: "ROUND_TRIP",
                                direction: "RETURN",
                                fromLocation: route.toLocation,
                                toLocation: route.fromLocation,
                                totalDistance: route.totalDistance || 0,
                                estimatedDuration: route.estimatedDuration || "30 mins",
                                totalSeats: routeSchedule.totalSeats,
                                availableSeats: routeSchedule.totalSeats - 1,
                                bookedSeats: 1,
                                status: "SCHEDULED",
                                stopPoints: returnStopPoints?.map((stop, index) => ({
                                    location: stop.location,
                                    sequence: index + 1,
                                    scheduledTime: stop.time
                                })) || [],
                                passengers: [{
                                    passengerId: employee.userId,
                                    employeeId: employee._id,
                                    name: `${employee.personalInfo?.firstName || ''} ${employee.personalInfo?.lastName || ''}`.trim() || employee.fullName,
                                    pickupStop: returnPickup,
                                    dropoffStop: returnDropoff,
                                    status: "CONFIRMED",
                                    bookingStatus: "CONFIRMED",
                                    bookedAt: new Date()
                                }]
                            };

                            const createdReturnTrip = await Trip.create(returnTripData);
                            tripsGenerated++;
                            allTripIds.push(createdReturnTrip._id); // Collect return trip ID
                        }
                    }
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Update monthly pass with trip counts
        monthlyPass.totalTrips = tripsGenerated;
        monthlyPass.remainingTrips = tripsGenerated;
        await monthlyPass.save();

        // Create a SINGLE CorporateBooking with all trips in monthlyTrips array (similar to B2CPassengerBooking)
        const isRoundTripBooking = isRoundTripAssignment && returnDepartureTimeGlobal;
        const corporateBooking = new CorporateBooking({
            passengerId: employee.userId,
            corporateOwnerId: companyId,
            routeId: route._id,
            contractId: contract?._id,
            driverId: routeSchedule.assignedDriver || null,
            bookingType: isRoundTripBooking ? "ROUND_TRIP" : "ONE_WAY",
            linkedSchedule: routeSchedule._id,
            pickupLocation: outboundPickup,
            dropoffLocation: outboundDropoff,
            returnPickupLocation: isRoundTripBooking ? returnPickupGlobal : null,
            returnDropoffLocation: isRoundTripBooking ? returnDropoffGlobal : null,
            travelPath: assignedTripTimeObj?.outboundStopPoints?.map((stop, idx) => ({
                location: stop.location,
                time: stop.time,
                isFromLocation: idx === 0,
                isToLocation: idx === assignedTripTimeObj?.outboundStopPoints?.length - 1,
                isStop: true
            })) || [],
            returnTravelPath: isRoundTripBooking ? (returnStopPointsGlobal?.map((stop, idx) => ({
                location: stop.location,
                time: stop.time,
                isFromLocation: idx === 0,
                isToLocation: idx === returnStopPointsGlobal.length - 1,
                isStop: true
            })) || []) : [],
            bookingDate: new Date(),
            travelDate: startDate,
            numberOfSeats: 1,
            isMonthlyPass: true,
            monthlyPassId: monthlyPass._id,
            passDuration: passDuration?.durationType?.toLowerCase() === "1_month" ? 1 : (passDuration?.durationType?.toLowerCase() === "3_months" ? 3 : (passDuration?.durationType?.toLowerCase() === "6_months" ? 6 : 1)),
            passStartDate: startDate,
            passEndDate: endDate,
            monthlyTrips: allTripIds, // All trip IDs (outbound + return)
            createdTripsCount: tripsGenerated,
            totalTripsCount: tripsGenerated,
            bookingStatus: "CONFIRMED",
            vehicleModel: typeof route.vehicleId?.model === 'string' ? route.vehicleId.model : (routeSchedule.vehicleName || ""),
            vehiclePlate: typeof route.vehicleId?.plateNumber === 'string' ? route.vehicleId.plateNumber : (route.vehicleId?.registrationNumber || ""),
            createdAt: new Date()
        });
        await corporateBooking.save();



        return {
            generated: tripsGenerated,
            message: `Generated ${tripsGenerated} trips`,
            monthlyPass: monthlyPass._id,
            booking: corporateBooking._id,
            bookingsCount: 1
        };
    } catch (error) {
        console.error("[v0] Error generating trips for employee:", error);
        return { generated: 0, message: error.message, monthlyPass: null, bookings: [] };
    }
};

// Helper to resolve companyId from the authenticated user
const resolveCompanyId = async (userId) => {
    const user = await User.findById(userId).select("companyId role");
    if (!user) throw new Error("User not found");
    // For CORPORATE users, the companyId is their own _id (they ARE the company)
    return user.companyId || userId;
};

const generateEmployeeId = async (companyId) => {
    const count = await CorporateEmployee.countDocuments({ companyId });
    return `EMP-${companyId.slice(-4)}-${String(count + 1).padStart(4, '0')}`;
};

// Valid enum values on CorporateEmployee.transportDetails.
const VALID_SHIFT_TYPES = ["MORNING", "EVENING", "NIGHT", "FULL_DAY"];
const VALID_TRIP_TYPES = ["One Way", "Round Trip"];

/**
 * Coerce any shift value into a valid `transportDetails.shiftType` enum.
 *
 * The manual "Add Employee" form sends a canonical enum ("FULL_DAY", "MORNING",
 * ...), but the managed-service brief importer feeds free-text shift labels the
 * customer typed into their spreadsheet ("General (09:00-18:00)", "Night Shift",
 * "Morning batch", ...). Those free-text labels are NOT enum members, so writing
 * them straight to the model made every imported row fail validation and created
 * zero employees. We normalize here so both entry points behave identically.
 */
const normalizeShiftType = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "FULL_DAY";

    const upper = text.toUpperCase().replace(/[^A-Z]/g, "");
    // Exact enum match first (covers the manual form's canonical values).
    const exact = VALID_SHIFT_TYPES.find((s) => s.replace(/[^A-Z]/g, "") === upper);
    if (exact) return exact;

    // Keyword match for free-text labels coming from a brief spreadsheet.
    if (upper.includes("MORNING") || upper.includes("AM")) return "MORNING";
    if (upper.includes("EVENING")) return "EVENING";
    if (upper.includes("NIGHT")) return "NIGHT";
    // Everything else (General / Regular / Day / blank / unknown) maps to a full day.
    return "FULL_DAY";
};

/** Coerce any trip-type value into a valid `assignedTripType` enum. */
const normalizeTripType = (value) => {
    const text = String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!text) return "One Way";
    if (text.includes("round") || text.includes("both") || text.includes("return")) {
        return "Round Trip";
    }
    return "One Way";
};

/**
 * Create many CorporateEmployee records (plus their User logins, monthly passes
 * and trips) from plain rows.
 *
 * Extracted from bulkUploadEmployees so the managed-service brief importer can
 * reuse the exact same creation path — duplicate detection, trip generation and
 * brief auto-fulfilment all behave identically no matter which screen the rows
 * came from.
 *
 * `briefContractId` is the contract whose brief should be auto-fulfilled. For a
 * B2B/school partner acting on behalf of a customer this is req.onBehalfContractId;
 * for a customer importing their own brief it is passed explicitly (there is no
 * on-behalf context in that case, but the brief items still need to be marked).
 */
export const createEmployeesFromRows = async ({
    rows,
    companyId,
    skipInvitation = false,
    briefContractId = null,
    actorId = null,
    actorRole = "B2B_PARTNER",
}) => {
    const results = {
        success: [],
        errors: [],
        duplicates: []
    };

    // The passenger login must carry the segment's role: a SCHOOL_CUSTOMER's
    // passengers are SCHOOL_STUDENT, a CORPORATE's are CORPORATE_EMPLOYEE. Resolve
    // the owning company's role ONCE (the company IS the customer account) so we
    // never mislabel a school's students as corporate employees in the database.
    const owner = await User.findById(companyId).select("role");
    const passengerRole = passengerRoleForOwner(owner?.role);

    for (const employeeData of rows) {
        // Track the login we create for this row so we can roll it back if any
        // later step (employee document, etc.) fails — otherwise a failed row
        // leaves an orphan User whose unique email then blocks every retry.
        let createdUser = null;
        try {
                // Build the duplicate query from ONLY the identifying fields that
                // are actually present. Including an `undefined` value here made
                // Mongoose match rows whose phoneNumber/employeeId was empty,
                // producing false "duplicate" skips.
                const phoneValue = employeeData.contactNumber || employeeData.whatsappNumber;
                const duplicateOr = [];
                if (employeeData.email) duplicateOr.push({ "personalInfo.email": employeeData.email });
                if (employeeData.employeeId) duplicateOr.push({ employeeId: employeeData.employeeId });
                if (phoneValue) duplicateOr.push({ "personalInfo.phoneNumber": phoneValue });

                // Check if a REAL employee record already exists (a login alone is
                // not a duplicate — see orphan reclaim below).
                const existingEmployee = duplicateOr.length
                    ? await CorporateEmployee.findOne({ $or: duplicateOr })
                    : null;

                if (existingEmployee) {
                    results.duplicates.push({
                        employee: employeeData,
                        reason: "Employee already exists",
                        existingId: existingEmployee._id
                    });
                    continue;
                }

                // Create user account for employee with a known temporary password
                // Using a consistent password that will be sent in the email
                const tempPassword = "tempPassword123";

                // A login for this email may already exist WITHOUT a corporate
                // employee record — an "orphan" left behind by an earlier import
                // that failed after creating the User but before the employee doc
                // (e.g. the old shift-enum validation crash). Reusing that orphan
                // makes re-import idempotent instead of crashing on the unique
                // email index and permanently blocking the row.
                let user = employeeData.email
                    ? await User.findOne({ email: employeeData.email })
                    : null;

                if (user) {
                    const linkedEmployee = await CorporateEmployee.findOne({ userId: user._id }).select("_id");
                    if (linkedEmployee) {
                        // A genuine employee already owns this login -> real duplicate.
                        results.duplicates.push({
                            employee: employeeData,
                            reason: "Employee already exists",
                            existingId: linkedEmployee._id
                        });
                        continue;
                    }
                    // Reclaim the orphan login: refresh its basic fields and reuse it.
                    user.fullName = employeeData.fullName || user.fullName;
                    user.role = passengerRole;
                    user.companyId = companyId;
                    user.whatsappNumber = phoneValue || user.whatsappNumber || "N/A";
                    user.status = "ACTIVE";
                    if (user.isPasswordSet === undefined) user.isPasswordSet = false;
                    await user.save();
                } else {
                    user = new User({
                        fullName: employeeData.fullName,
                        email: employeeData.email,
                        password: tempPassword, // Random temp password - employee will set their own via invitation
                        role: passengerRole,
                        companyId: companyId,
                        whatsappNumber: phoneValue || "N/A",
                        status: "ACTIVE",
                        isPasswordSet: false // Mark that password needs to be set
                    });
                    await user.save();
                }

                // Track the login (new OR reclaimed orphan) so a later failure in
                // this row rolls it back — a User with no employee doc is useless
                // and would otherwise block the next retry.
                createdUser = user;

                // Parse full name into first/last
                const nameParts = (employeeData.fullName || "").trim().split(/\s+/);
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || firstName;

                const generatedEmployeeId = await generateEmployeeId(companyId);

                // Create corporate employee record with correct schema mapping
                const corporateEmployee = new CorporateEmployee({
                    userId: user._id,
                    companyId: companyId,
                    employeeId: employeeData.employeeId || generatedEmployeeId,
                    personalInfo: {
                        firstName,
                        lastName,
                        email: employeeData.email,
                        phoneNumber: employeeData.contactNumber || employeeData.whatsappNumber || "",
                        department: employeeData.department || "",
                        designation: employeeData.designation || "",
                        workLocation: employeeData.workLocation || ""
                    },
                    homeAddress: employeeData.homeAddress || "",
                    residentialAddress: employeeData.residentialAddress || {},
                    transportDetails: {
                        assignedRoute: employeeData.routeId || employeeData.transportDetails?.assignedRoute || undefined,
                        seatNumber: employeeData.seatNumber || employeeData.transportDetails?.seatNumber || undefined,
                        pickupPoint: employeeData.pickupLocation || employeeData.outboundPickupStop || employeeData.transportDetails?.pickupPoint || "",
                        dropOffPoint: employeeData.dropoffLocation || employeeData.outboundDropoffStop || employeeData.transportDetails?.dropOffPoint || "",
                        outboundPickupStop: employeeData.outboundPickupStop || employeeData.pickupLocation || "",
                        outboundDropoffStop: employeeData.outboundDropoffStop || employeeData.dropoffLocation || "",
                        returnPickupStop: employeeData.returnPickupStop || "",
                        returnDropoffStop: employeeData.returnDropoffStop || "",
                        assignedTripNumber: employeeData.assignedTripNumber || 1,
                        assignedTripType: normalizeTripType(
                            employeeData.assignedTripType || employeeData.transportDetails?.assignedTripType,
                        ),
                        shiftType: normalizeShiftType(
                            employeeData.workShift || employeeData.transportDetails?.shiftType,
                        ),
                        transportStatus: "ACTIVE"
                    },
                    // Persist the pass duration + start date on the employee so that
                    // when an invitation is later sent, the invitation-time trip
                    // generation honours the brief's duration/start date instead of
                    // silently defaulting to a 1-month pass starting today. This
                    // mirrors the single "Add Employee" path exactly, so importing
                    // from a brief behaves identically to adding manually.
                    passDuration: employeeData.passDuration ? {
                        durationType: employeeData.passDuration.durationType || "1_MONTH",
                        startDate: employeeData.passDuration.startDate ? new Date(employeeData.passDuration.startDate) : undefined,
                        customEndDate: employeeData.passDuration.customEndDate ? new Date(employeeData.passDuration.customEndDate) : undefined
                    } : { durationType: "1_MONTH" },
                    accessControl: {
                        isActive: true,
                        accessLevel: "EMPLOYEE"
                    },
                    documents: {
                        verificationStatus: "PENDING"
                    }
                });

                await corporateEmployee.save();

                // Auto-generate trips if route is assigned
                let tripGenerationResult = null;
                if (corporateEmployee.transportDetails?.assignedRoute) {
                    try {
                        // Use the SAME pass duration we just persisted so import-time
                        // trip generation matches what a later invitation would produce.
                        const passDuration = corporateEmployee.passDuration || employeeData.passDuration || { durationType: '1_MONTH' };
                        tripGenerationResult = await generateTripsForEmployee(corporateEmployee, companyId, passDuration);
                        console.log(`[v0] Auto-generated trips for new employee ${corporateEmployee._id}:`, tripGenerationResult);
                    } catch (tripError) {
                        console.error(`[v0] Error generating trips for employee ${corporateEmployee._id}:`, tripError);
                    }
                }

                // Send invitation email — unless the caller asked to skip it.
                // The managed-service brief flow creates employees first and lets
                // the B2B partner send invitations manually afterwards, so it
                // passes skipInvitation:true here.
                if (!skipInvitation) {
                    await sendEmployeeInvitation(user, employeeData);
                }

            // Managed-service auto-link: when this employee was added to fulfil a
            // specific brief roster item, mark that item FULFILLED and link it.
            // Works for a partner acting on behalf of the customer AND for the
            // customer importing its own brief (briefContractId is supplied).
            let briefAutoFulfilled = false;
            if (employeeData.briefItemId && briefContractId) {
                briefAutoFulfilled = await autoFulfillBriefItem({
                    contractId: briefContractId,
                    section: "employeeRoster",
                    briefItemId: employeeData.briefItemId,
                    entityId: corporateEmployee._id,
                    entityType: "EMPLOYEE",
                    actorId,
                    actorRole,
                });
            }

            results.success.push({
                employeeId: corporateEmployee.employeeId,
                fullName: employeeData.fullName,
                email: employeeData.email,
                userId: user._id,
                corporateEmployeeId: corporateEmployee._id,
                tripsGenerated: tripGenerationResult?.generated || 0,
                monthlyPassId: tripGenerationResult?.monthlyPass || null,
                briefItemId: employeeData.briefItemId || null,
                sourceKey: employeeData.sourceKey || null,
                briefAutoFulfilled
            });

        } catch (error) {
            // Roll back the login we created for this row so a partial failure
            // never leaves an orphan User (whose unique email would otherwise
            // block re-importing the same person).
            if (createdUser?._id) {
                try {
                    await User.deleteOne({ _id: createdUser._id });
                } catch (cleanupError) {
                    console.error(
                        `[v0] Failed to roll back orphan user ${createdUser._id}:`,
                        cleanupError.message,
                    );
                }
            }

            results.errors.push({
                employee: employeeData,
                sourceKey: employeeData.sourceKey || null,
                briefItemId: employeeData.briefItemId || null,
                error: error.message
            });
        }
    }

    return results;
};

// Bulk upload employees
export const bulkUploadEmployees = async (req, res) => {
    try {
        const { employees, skipInvitation } = req.body;
        const companyId = await resolveCompanyId(req.userId);

        if (!employees || !Array.isArray(employees)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee data format"
            });
        }

        // Only a partner request carries an on-behalf contract. A customer
        // importing its OWN brief passes briefContractId in the body — which is
        // client-supplied, so it must be verified to belong to this customer
        // before it is allowed to drive brief auto-fulfilment.
        let briefContractId = req.onBehalfContractId || null;
        if (!briefContractId && req.body.briefContractId) {
            const ownContract = await Contract.findOne({
                _id: req.body.briefContractId,
                corporateOwnerId: req.userId,
                serviceMode: "MANAGED",
            }).select("_id");
            briefContractId = ownContract ? String(ownContract._id) : null;
        }

        const results = await createEmployeesFromRows({
            rows: employees,
            companyId,
            skipInvitation,
            briefContractId,
            actorId: req.actorId || req.userId,
            actorRole: req.actingRole || "CORPORATE",
        });

        if (results.success.length > 0) {
            await logRequestActivity(req, {
                // So a customer importing its own brief is logged on the managed
                // contract too, not just a partner acting on behalf.
                contractId: briefContractId || undefined,
                action: "EMPLOYEE_ADDED",
                entityType: "EMPLOYEE",
                description: `Added ${results.success.length} employee(s)`,
                meta: { count: results.success.length },
            });
        }

        res.status(201).json({
            success: true,
            message: "Employee bulk upload completed",
            data: {
                results,
                summary: {
                    total: employees.length,
                    successful: results.success.length,
                    errors: results.errors.length,
                    duplicates: results.duplicates.length
                }
            }
        });

    } catch (error) {
        console.error("Error in bulk employee upload:", error);
        res.status(500).json({
            success: false,
            message: "Error uploading employees",
            error: error.message
        });
    }
};

// Upload employees from CSV file
export const uploadEmployeesFromCSV = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No CSV file uploaded"
            });
        }

        const employees = [];
        const parser = csv();

        parser.on('data', (data) => {
            employees.push({
                employeeId: data['Employee ID'] || data['employeeId'],
                fullName: data['Full Name'] || data['fullName'],
                email: data['Email'] || data['email'],
                contactNumber: data['Contact Number'] || data['contactNumber'],
                department: data['Department'] || data['department'],
                designation: data['Designation'] || data['designation'],
                workShift: data['Work Shift'] || data['workShift'],
                pickupLocation: data['Pickup Location'] || data['pickupLocation'],
                dropoffLocation: data['Dropoff Location'] || data['dropoffLocation'],
                routeId: data['Route ID'] || data['routeId'],
                seatNumber: data['Seat Number'] || data['seatNumber']
            });
        });

        parser.on('end', async () => {
            try {
                const results = await createEmployeesFromRows({
                    rows: employees,
                    companyId,
                    actorId: req.actorId || req.userId,
                    actorRole: req.actingRole || "CORPORATE",
                });
                res.status(201).json({
                    success: true,
                    message: "CSV upload completed",
                    data: results
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Error processing CSV",
                    error: error.message
                });
            }
        });

        parser.write(req.file.buffer);
        parser.end();

    } catch (error) {
        console.error("Error uploading CSV:", error);
        res.status(500).json({
            success: false,
            message: "Error uploading CSV file",
            error: error.message
        });
    }
};

// Get employees with pagination and filters
export const getEmployees = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const {
            page = 1,
            limit = 20,
            department,
            designation,
            workShift,
            isActive,
            search
        } = req.query;

        const query = { companyId };

        if (department) query["personalInfo.department"] = department;
        if (designation) query["personalInfo.designation"] = designation;
        if (workShift) query["transportDetails.shiftType"] = workShift;
        if (isActive !== undefined) query["accessControl.isActive"] = isActive === 'true';

        if (search) {
            query.$or = [
                { "personalInfo.firstName": { $regex: search, $options: 'i' } },
                { "personalInfo.lastName": { $regex: search, $options: 'i' } },
                { "personalInfo.email": { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
                { "personalInfo.phoneNumber": { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await CorporateEmployee.find(query)
            .populate('userId', 'email isActive fullName')
            .populate('transportDetails.assignedRoute', 'routeName fromLocation toLocation')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await CorporateEmployee.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                employees,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalEmployees: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting employees:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving employees",
            error: error.message
        });
    }
};

// Update employee
export const updateEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const companyId = await resolveCompanyId(req.userId);
        const updates = req.body;

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Apply nested updates correctly
        if (updates.personalInfo) {
            Object.assign(employee.personalInfo, updates.personalInfo);
        }
        if (updates.homeAddress !== undefined) {
            employee.homeAddress = updates.homeAddress;
        }
        if (updates.transportDetails) {
            Object.assign(employee.transportDetails, updates.transportDetails);
        }
        if (updates.residentialAddress) {
            Object.assign(employee.residentialAddress, updates.residentialAddress);
        }
        if (updates.accessControl) {
            Object.assign(employee.accessControl, updates.accessControl);
        }
        if (updates.employeeId) {
            employee.employeeId = updates.employeeId;
        }
        await employee.save();

        // Keep the linked login aligned with the owning customer's segment.
        // This also repairs legacy school records that were incorrectly created
        // as CORPORATE_EMPLOYEE when they are edited from the roster.
        const owner = await User.findById(companyId).select("role");
        const userUpdate = { role: passengerRoleForOwner(owner?.role), companyId };
        if (updates.personalInfo?.email) userUpdate.email = updates.personalInfo.email;
        if (updates.personalInfo?.firstName) {
            userUpdate.fullName = `${updates.personalInfo.firstName} ${updates.personalInfo.lastName || employee.personalInfo.lastName || ''}`.trim();
        }
        await User.findByIdAndUpdate(employee.userId, userUpdate);

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: {
                employeeId: employee._id,
                updates
            }
        });

    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({
            success: false,
            message: "Error updating employee",
            error: error.message
        });
    }
};

// Delete employee
export const deleteEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const userId = employee.userId;

        // Delete any trips where this employee is a passenger
        await Trip.updateMany(
            { 'passengers.passengerId': userId },
            {
                $pull: { passengers: { passengerId: userId } },
                $inc: { bookedSeats: -1, availableSeats: 1 }
            }
        );

        // Delete trips that have no passengers left
        await Trip.deleteMany({
            'passengers': { $size: 0 }
        });

        // Delete any monthly passes for this employee
        await MonthlyPass.deleteMany({ employeeId: userId });

        // Delete any bookings for this employee
        await CorporateBooking.deleteMany({ passengerId: userId });

        // Delete the corporate employee record
        await CorporateEmployee.findByIdAndDelete(employeeId);

        // Delete the user account associated with the employee
        if (userId) {
            await User.findByIdAndDelete(userId);
        }

        res.status(200).json({
            success: true,
            message: "Employee deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting employee",
            error: error.message
        });
    }
};

// Get employee attendance report
export const getEmployeeAttendance = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const {
            startDate,
            endDate,
            employeeId,
            department,
            page = 1,
            limit = 50
        } = req.query;

        const query = { companyId };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (employeeId) query.employeeId = employeeId;
        if (department) query.department = department;

        // This would integrate with a travel history or attendance tracking system
        const attendance = await getAttendanceData(query, page, limit);

        res.status(200).json({
            success: true,
            data: {
                attendance,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(attendance.total / limit),
                    totalRecords: attendance.total,
                    hasNext: page * limit < attendance.total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting attendance:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving attendance",
            error: error.message
        });
    }
};

// Get route utilization report
export const getRouteUtilization = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const {
            startDate,
            endDate,
            routeId,
            page = 1,
            limit = 20
        } = req.query;

        const query = { companyId };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (routeId) query.routeId = routeId;

        const utilization = await getRouteUtilizationData(query, page, limit);

        res.status(200).json({
            success: true,
            data: {
                utilization,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(utilization.total / limit),
                    totalRecords: utilization.total,
                    hasNext: page * limit < utilization.total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting route utilization:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route utilization",
            error: error.message
        });
    }
};

// Approve employee registration
export const approveEmployeeRegistration = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        employee.documents.verificationStatus = "VERIFIED";
        employee.documents.verifiedAt = new Date();
        employee.documents.verifiedBy = managerId;
        employee.accessControl.isActive = true;
        await employee.save();

        // Activate user account
        await User.findByIdAndUpdate(employee.userId, { isActive: true });

        // Send approval notification
        await sendEmployeeApproval(employee);

        res.status(200).json({
            success: true,
            message: "Employee registration approved successfully"
        });

    } catch (error) {
        console.error("Error approving employee:", error);
        res.status(500).json({
            success: false,
            message: "Error approving employee",
            error: error.message
        });
    }
};

// Send invitation emails to selected employees
export const sendInvitationEmails = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const { employeeIds } = req.body;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of employee IDs to send invitations"
            });
        }

        const manager = await User.findById(managerId).select("companyName fullName role");
        // School owners invite students; brand the email for that segment.
        const brand = invitationBranding(manager?.role);
        const appOrigin = getAppOrigin();
        const results = { sent: [], failed: [] };

        // Import crypto for token generation
        const crypto = await import('crypto');

        for (const empId of employeeIds) {
            try {
                const employee = await CorporateEmployee.findOne({
                    _id: empId,
                    companyId
                }).populate("userId", "email fullName isPasswordSet");

                if (!employee || !employee.userId) {
                    results.failed.push({ employeeId: empId, reason: "Employee not found or no user account" });
                    continue;
                }

                const userAccount = await User.findById(employee.userId._id);
                if (!userAccount) {
                    results.failed.push({ employeeId: empId, reason: "User account not found" });
                    continue;
                }

                // Generate password setup token
                const passwordSetupToken = crypto.default.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

                // Update user with password setup token
                userAccount.passwordSetupToken = passwordSetupToken;
                userAccount.passwordSetupTokenExpiry = tokenExpiry;
                await userAccount.save();

                const setPasswordUrl = `${appOrigin}/set-password?token=${passwordSetupToken}`;

                console.log("Sending invitation email to:", employee.userId.email);

                const emailResult = await sendEmail(
                    employee.userId.email,
                    brand.subject,
                    `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: ${brand.headerGradient}; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px;">Welcome to ${brand.productLine}</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <p>Hello <strong>${employee.personalInfo?.firstName || employee.fullName || brand.Passenger} ${employee.personalInfo?.lastName || ''}</strong>,</p>
                                <p>You have been invited by <strong>${manager?.companyName || manager?.fullName || (brand.school ? 'your school' : 'your company')}</strong> to use the DriveMe ${brand.school ? 'school' : 'corporate'} transport service.</p>
                                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${brand.accent}; margin: 20px 0;">
                                    <h3 style="color: ${brand.accent}; margin-top: 0;">Your Account Details</h3>
                                    <p><strong>Email:</strong> ${employee.userId.email}</p>
                                    <p><strong>${brand.school ? 'Student ID' : 'Employee ID'}:</strong> ${employee.employeeId}</p>
                                    ${brand.school
                                        ? `<p><strong>Grade / Class:</strong> ${employee.personalInfo?.department || 'N/A'}</p>`
                                        : `<p><strong>Department:</strong> ${employee.personalInfo?.department || 'N/A'}</p>`}
                                </div>
                                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                                    <p style="margin: 0; color: #856404; font-weight: 500;">Please click the button below to set up your password and activate your account. Once activated you can track your ${brand.school ? 'school bus' : 'ride'} and view your scheduled trips.</p>
                                </div>
                                <div style="text-align: center; margin: 25px 0;">
                                    <a href="${setPasswordUrl}" style="background: ${brand.accent}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Your Password</a>
                                </div>
                                <p style="color: #666; font-size: 13px; text-align: center;">This link will expire in 7 days. If you have any questions, contact your ${brand.school ? 'school transport coordinator' : 'transport coordinator'}.</p>
                                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">If the button doesn't work, copy and paste this link in your browser:<br><a href="${setPasswordUrl}" style="color: ${brand.accent}; word-break: break-all;">${setPasswordUrl}</a></p>
                            </div>
                        </div>
                    `
                );

                if (!emailResult.success) {
                    results.failed.push({
                        employeeId: empId,
                        reason: emailResult.message
                    });
                    continue;
                }

                // Auto-generate trips for the employee based on their assigned route schedule and pass duration
                let tripGenerationResult = { generated: 0, monthlyPass: null, bookings: 0 };
                if (employee.transportDetails?.assignedRoute) {
                    // Use the pass duration from the employee record
                    const passDuration = employee.passDuration || { durationType: "1_MONTH" };
                    tripGenerationResult = await generateTripsForEmployee(employee, companyId, passDuration);

                    // Update employee record with monthly pass reference
                    if (tripGenerationResult.monthlyPass) {
                        await CorporateEmployee.findByIdAndUpdate(employee._id, {
                            monthlyPassId: tripGenerationResult.monthlyPass
                        });
                    }
                    console.log(`[v0] Trip generation for ${employee.userId.email}:`, tripGenerationResult);
                }

                results.sent.push({
                    employeeId: empId,
                    name: employee.fullName || `${employee.personalInfo?.firstName || ''} ${employee.personalInfo?.lastName || ''}`.trim(),
                    email: employee.userId.email,
                    tripsGenerated: tripGenerationResult.generated
                });

            } catch (error) {
                results.failed.push({ employeeId: empId, reason: error.message });
            }
        }

        if (results.sent.length > 0) {
            const tripsGenerated = results.sent.reduce((sum, s) => sum + (s.tripsGenerated || 0), 0);
            await logRequestActivity(req, {
                action: "INVITATION_SENT",
                entityType: "INVITATION",
                description: `Sent invitation(s) to ${results.sent.length} employee(s)${tripsGenerated ? ` and generated ${tripsGenerated} trip(s)` : ""}`,
                meta: { invited: results.sent.length, tripsGenerated },
            });
        }

        res.status(200).json({
            success: true,
            message: `Invitations sent: ${results.sent.length} successful, ${results.failed.length} failed`,
            data: {
                results,
                summary: {
                    total: employeeIds.length,
                    sent: results.sent.length,
                    failed: results.failed.length,
                    totalTripsGenerated: results.sent.reduce((sum, item) => sum + (item.tripsGenerated || 0), 0)
                }
            }
        });

    } catch (error) {
        console.error("Error sending invitation emails:", error);
        res.status(500).json({
            success: false,
            message: "Error sending invitation emails",
            error: error.message
        });
    }
};

// Get employee feedback aggregation for corporate view
export const getEmployeeFeedbackSummary = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        // Get all employees under this company with feedback data
        const employees = await CorporateEmployee.find({ companyId }).select("_id userId personalInfo feedback");

        // Aggregate feedback from CorporateEmployee.feedback.feedbackHistory
        let totalFeedbacks = 0;
        let allRatings = [];
        let recentFeedbacks = [];

        employees.forEach(emp => {
            const history = emp.feedback?.feedbackHistory || [];
            history.forEach(fb => {
                if (fb.rating) {
                    totalFeedbacks++;
                    allRatings.push(fb.rating);
                    recentFeedbacks.push({
                        passengerId: emp.userId,
                        employeeName: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || "Unknown",
                        rating: fb.rating,
                        feedback: fb.comments || fb.comment || "",
                        suggestions: fb.suggestions || "",
                        driverRating: fb.driverRating || null,
                        punctualityRating: fb.punctualityRating || null,
                        vehicleRating: fb.vehicleRating || null,
                        date: fb.submittedAt || fb.ratedAt,
                        route: fb.route || "",
                        tripDate: fb.tripDate
                    });
                }
            });
        });

        // Calculate average
        const averageRating = allRatings.length > 0
            ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
            : 0;

        // Calculate rating distribution
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allRatings.forEach(r => {
            if (r >= 1 && r <= 5) ratingDistribution[Math.round(r)]++;
        });

        // Sort by date and take last 10
        recentFeedbacks.sort((a, b) => new Date(b.date) - new Date(a.date));
        recentFeedbacks = recentFeedbacks.slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                averageRating: Math.round(averageRating * 10) / 10,
                totalFeedbacks,
                totalEmployees: employees.length,
                ratingDistribution,
                recentFeedbacks
            }
        });

    } catch (error) {
        console.error("Error getting feedback summary:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving feedback summary",
            error: error.message
        });
    }
};

// Get route schedule for employee assignment
export const getRouteSchedule = async (req, res) => {
    try {
        const { routeId } = req.params;
        const companyId = await resolveCompanyId(req.userId);

        // First, get the route details
        const route = await Route.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Verify the route belongs to this corporate
        if (route.corporateId?.toString() !== companyId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Route does not belong to your organization"
            });
        }

        // Get the corporate route schedule for this route
        const routeSchedule = await CorporateRouteSchedule.findOne({
            routeId: routeId,
            corporateId: companyId,
            isActive: true
        }).populate('routeId', 'fromLocation toLocation availableDays');

        if (!routeSchedule) {
            // Return basic route info if no schedule exists
            return res.status(200).json({
                success: true,
                data: {
                    routeId: route._id,
                    routeInfo: {
                        fromLocation: route.fromLocation,
                        toLocation: route.toLocation
                    },
                    availableDays: route.availableDays || [],
                    tripTimes: [],
                    hasSchedule: false
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                scheduleId: routeSchedule._id,
                routeId: route._id,
                routeInfo: {
                    fromLocation: route.fromLocation,
                    toLocation: route.toLocation
                },
                scheduleName: routeSchedule.scheduleName,
                availableDays: routeSchedule.availableDays,
                tripTimes: routeSchedule.tripTimes,
                startDate: routeSchedule.startDate,
                endDate: routeSchedule.endDate,
                totalSeats: routeSchedule.totalSeats,
                hasSchedule: true
            }
        });

    } catch (error) {
        console.error("Error getting route schedule:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route schedule",
            error: error.message
        });
    }
};

// Helper functions
const processEmployeeUpload = async (employees, managerId, companyId) => {
    const results = {
        success: [],
        errors: [],
        duplicates: []
    };

    // Tag each passenger login with the segment's role (SCHOOL_STUDENT for a
    // school customer, CORPORATE_EMPLOYEE otherwise) — see createEmployeesFromRows.
    const owner = await User.findById(companyId).select("role");
    const passengerRole = passengerRoleForOwner(owner?.role);

    for (const employeeData of employees) {
        try {
            // Check if employee already exists
            const existingEmployee = await CorporateEmployee.findOne({
                $or: [
                    { "personalInfo.email": employeeData.email },
                    { employeeId: employeeData.employeeId }
                ]
            });

            if (existingEmployee) {
                results.duplicates.push({
                    employee: employeeData,
                    reason: "Employee already exists"
                });
                continue;
            }

            // Create user account
            const user = new User({
                fullName: employeeData.fullName,
                email: employeeData.email,
                password: "tempPassword123",
                role: passengerRole,
                companyId: companyId,
                isActive: false // Inactive until approved
            });

            await user.save();

            // Create corporate employee record with correct schema mapping
            const nameParts = (employeeData.fullName || "").trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || firstName;

            const corporateEmployee = new CorporateEmployee({
                userId: user._id,
                companyId: companyId,
                employeeId: employeeData.employeeId,
                personalInfo: {
                    firstName,
                    lastName,
                    email: employeeData.email,
                    phoneNumber: employeeData.contactNumber || employeeData.whatsappNumber || "",
                    department: employeeData.department || "",
                    designation: employeeData.designation || "",
                    workLocation: employeeData.workLocation || ""
                },
                homeAddress: employeeData.homeAddress || "",
                residentialAddress: employeeData.residentialAddress || {},
                transportDetails: {
                    assignedRoute: employeeData.routeId || employeeData.transportDetails?.assignedRoute || undefined,
                    // New trip assignment fields
                    assignedTripNumber: employeeData.assignedTripNumber || 1,
                    assignedTripType: employeeData.assignedTripType || "One Way",
                    assignedTripDepartureTime: employeeData.assignedTripDepartureTime || "",
                    // Outbound trip (home -> office)
                    outboundPickupStop: employeeData.outboundPickupStop || employeeData.pickupLocation || "",
                    outboundDropoffStop: employeeData.outboundDropoffStop || employeeData.dropoffLocation || "",
                    // Return trip (office -> home)
                    returnPickupStop: employeeData.returnPickupStop || "",
                    returnDropoffStop: employeeData.returnDropoffStop || "",
                    // Legacy fields
                    seatNumber: employeeData.seatNumber || undefined,
                    pickupPoint: employeeData.pickupLocation || employeeData.outboundPickupStop || employeeData.transportDetails?.pickupPoint || "",
                    dropOffPoint: employeeData.dropoffLocation || employeeData.outboundDropoffStop || employeeData.transportDetails?.dropOffPoint || "",
                    shiftType: employeeData.workShift || employeeData.transportDetails?.shiftType || "FULL_DAY",
                    transportStatus: "ACTIVE"
                },
                // Pass duration for route assignment
                passDuration: employeeData.passDuration ? {
                    durationType: employeeData.passDuration.durationType || "1_MONTH",
                    startDate: employeeData.passDuration.startDate ? new Date(employeeData.passDuration.startDate) : undefined,
                    customEndDate: employeeData.passDuration.customEndDate ? new Date(employeeData.passDuration.customEndDate) : undefined
                } : { durationType: "1_MONTH" },
                accessControl: {
                    isActive: true,
                    accessLevel: "EMPLOYEE"
                },
                documents: {
                    verificationStatus: "PENDING"
                }
            });

            await corporateEmployee.save();

            results.success.push({
                employeeId: employeeData.employeeId,
                userId: user._id,
                corporateEmployeeId: corporateEmployee._id
            });

        } catch (error) {
            results.errors.push({
                employee: employeeData,
                error: error.message
            });
        }
    }

    return results;
};

const sendEmployeeInvitation = async (user, employeeData) => {
    try {
        // Validate that we have a valid email recipient
        const recipientEmail = user?.email || employeeData?.email;
        if (!recipientEmail) {
            console.error("[v0] Cannot send invitation: No email address found for user or employee data");
            return;
        }
        console.log(`Sending invitation email to: ${recipientEmail}`);

        // Brand by segment (student vs employee) from the login's role, and
        // resolve links safely so a missing FRONTEND_URL never blocks sending.
        const brand = invitationBranding(user?.role);
        const appOrigin = getAppOrigin();

        // Generate a real password-setup token so the invitee actually sets
        // their own password — the old flow advertised a fake "tempPassword123"
        // that never worked, so students could not log in.
        let setPasswordUrl = `${appOrigin}/login`;
        try {
            if (user?._id) {
                const crypto = await import('crypto');
                const passwordSetupToken = crypto.default.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await User.findByIdAndUpdate(user._id, {
                    passwordSetupToken,
                    passwordSetupTokenExpiry: tokenExpiry,
                    isPasswordSet: false,
                });
                setPasswordUrl = `${appOrigin}/set-password?token=${passwordSetupToken}`;
            }
        } catch (tokenErr) {
            console.error("[v0] Failed to create password setup token:", tokenErr.message);
        }

        // Get route info if assigned
        let routeInfo = '';
        if (employeeData.assignedRoute || employeeData.transportDetails?.assignedRoute) {
            try {
                const route = await Route.findById(employeeData.assignedRoute || employeeData.transportDetails?.assignedRoute);
                if (route) {
                    routeInfo = `
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4caf50;">
                            <h3 style="margin: 0 0 10px 0; color: #2e7d32;">Assigned Route</h3>
                            <p style="margin: 5px 0;"><strong>Route:</strong> ${route.fromLocation} → ${route.toLocation}</p>
                            ${employeeData.pickupLocation ? `<p style="margin: 5px 0;"><strong>Pickup:</strong> ${employeeData.pickupLocation}</p>` : ''}
                            ${employeeData.dropoffLocation ? `<p style="margin: 5px 0;"><strong>Dropoff:</strong> ${employeeData.dropoffLocation}</p>` : ''}
                            ${employeeData.passDuration?.durationType ? `<p style="margin: 5px 0;"><strong>Pass Duration:</strong> ${employeeData.passDuration.durationType === '1_MONTH' ? '1 Month' :
                            employeeData.passDuration.durationType === '2_MONTHS' ? '2 Months' :
                                employeeData.passDuration.durationType === '3_MONTHS' ? '3 Months' :
                                    employeeData.passDuration.durationType === '6_MONTHS' ? '6 Months' :
                                        employeeData.passDuration.durationType === '1_YEAR' ? '1 Year' : 'Custom'
                            }</p>` : ''}
                        </div>
                    `;
                }
            } catch (err) {
                console.error("Error getting route info for email:", err);
            }
        }

        await sendEmail(
            recipientEmail,
            brand.subject,
            `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${brand.accent};">Welcome to ${brand.productLine}</h2>
                    <p>Hello <strong>${employeeData.fullName || brand.Passenger}</strong>,</p>
                    <p>You have been added to the ${brand.school ? 'school' : 'corporate'} transport system.${employeeData.assignedRoute || employeeData.transportDetails?.assignedRoute ? ' Your trips have been scheduled based on your assigned route.' : ''}</p>
                    <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong>Login Email:</strong> ${recipientEmail}</p>
                        <p style="margin: 0;">Set your own password using the button below to activate your account.</p>
                    </div>
                    ${routeInfo}
                    <p>Once activated, log in to view your scheduled trips and track your ${brand.school ? 'school bus' : 'driver'}.</p>
                    <a href="${setPasswordUrl}" style="background: ${brand.accent}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Set Your Password</a>
                    <p style="color: #999; font-size: 12px; margin-top: 18px;">If the button doesn't work, copy and paste this link in your browser:<br><a href="${setPasswordUrl}" style="color: ${brand.accent}; word-break: break-all;">${setPasswordUrl}</a></p>
                </div>
            `
        );
    } catch (error) {
        console.error("Error sending employee invitation:", error);
    }
};

const sendEmployeeApproval = async (employee) => {
    try {
        const user = await User.findById(employee.userId);
        if (user) {
            await sendEmail(
                user.email,
                "Your Registration Has Been Approved - DriveMe",
                `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Registration Approved!</h2>
                        <p>Hello <strong>${employee.fullName || user.fullName}</strong>,</p>
                        <p>Your registration for the corporate transport system has been approved.</p>
                        <p>You can now login and start using the service.</p>
                        <a href="${getAppOrigin()}/login" style="background: #1a237e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Login Now</a>
                    </div>
                `
            );
        }
    } catch (error) {
        console.error("Error sending employee approval:", error);
    }
};

const getAttendanceData = async (query, page, limit) => {
    try {
        // Build CorporateBooking query for attendance from real booking data
        const bookingQuery = { corporateOwnerId: query.companyId || query.managerId };

        if (query.date) {
            bookingQuery.travelDate = query.date;
        } else {
            // Default to last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            bookingQuery.travelDate = { $gte: thirtyDaysAgo };
        }

        if (query.employeeId) bookingQuery.passengerId = query.employeeId;

        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const total = await CorporateBooking.countDocuments(bookingQuery);
        const bookings = await CorporateBooking.find(bookingQuery)
            .populate("passengerId", "fullName email")
            .populate("routeId", "fromLocation toLocation")
            .sort({ travelDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const attendance = bookings.map(b => ({
            _id: b._id,
            employee: b.passengerId,
            route: b.routeId,
            date: b.travelDate,
            status: b.status,
            pickupTime: b.pickupTime,
            dropoffTime: b.dropoffTime,
            noShow: b.status === "NO_SHOW" || b.status === "CANCELLED",
        }));

        return { attendance, total };
    } catch (error) {
        console.error("Error in getAttendanceData:", error);
        return { attendance: [], total: 0 };
    }
};

const getRouteUtilizationData = async (query, page, limit) => {
    try {
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const corporateOwnerId = query.companyId || query.managerId;

        // Aggregate bookings by route to get utilization data
        const matchStage = { corporateOwnerId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(corporateOwnerId.toString()) };

        if (query.date) {
            matchStage.travelDate = query.date;
        } else {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            matchStage.travelDate = { $gte: thirtyDaysAgo };
        }

        if (query.routeId) {
            matchStage.routeId = (await import("mongoose")).default.Types.ObjectId.createFromHexString(query.routeId.toString());
        }

        const utilization = await CorporateBooking.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$routeId",
                    totalTrips: { $sum: 1 },
                    completedTrips: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
                    cancelledTrips: { $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "NO_SHOW"]] }, 1, 0] } },
                    uniquePassengers: { $addToSet: "$passengerId" },
                }
            },
            {
                $lookup: {
                    from: "routes",
                    localField: "_id",
                    foreignField: "_id",
                    as: "route"
                }
            },
            { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    routeId: "$_id",
                    routeName: { $concat: [{ $ifNull: ["$route.fromLocation", "Unknown"] }, " -> ", { $ifNull: ["$route.toLocation", "Unknown"] }] },
                    totalTrips: 1,
                    completedTrips: 1,
                    cancelledTrips: 1,
                    uniquePassengers: { $size: "$uniquePassengers" },
                    utilizationRate: {
                        $cond: [
                            { $gt: ["$totalTrips", 0] },
                            { $multiply: [{ $divide: ["$completedTrips", "$totalTrips"] }, 100] },
                            0
                        ]
                    }
                }
            },
            { $sort: { totalTrips: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit * 1 }
        ]);

        const totalRoutes = await CorporateBooking.aggregate([
            { $match: matchStage },
            { $group: { _id: "$routeId" } },
            { $count: "total" }
        ]);

        return {
            utilization,
            total: totalRoutes[0]?.total || 0
        };
    } catch (error) {
        console.error("Error in getRouteUtilizationData:", error);
        return { utilization: [], total: 0 };
    }
};

// Assign pickup and dropoff stops to employee
export const assignStopsToEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { pickupStop, dropoffStop, routeId } = req.body;
        const managerId = req.userId;

        // Validate required fields
        if (!pickupStop || !dropoffStop || !routeId) {
            return res.status(400).json({
                success: false,
                message: "pickupStop, dropoffStop, and routeId are required"
            });
        }

        // Get employee
        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId: await resolveCompanyId(req.userId)
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Validate route exists
        const route = await Route.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Validate stops exist in route
        const pickupStopObj = route.stopPoints.find(s => s._id.toString() === pickupStop);
        const dropoffStopObj = route.stopPoints.find(s => s._id.toString() === dropoffStop);

        if (!pickupStopObj || !dropoffStopObj) {
            return res.status(400).json({
                success: false,
                message: "Invalid pickup or dropoff stop. Stop not found in route."
            });
        }

        // Update employee stops
        employee.transportDetails.assignedRoute = routeId;
        employee.transportDetails.pickupPoint = pickupStopObj.location;
        employee.transportDetails.dropOffPoint = dropoffStopObj.location;

        await employee.save();

        // Send notification email
        const user = await User.findById(employee.userId);
        if (user && user.email) {
            await sendEmail({
                to: user.email,
                subject: "Your Transport Stops Have Been Updated",
                html: `
                    <h2>Hello ${user.fullName},</h2>
                    <p>Your transport stops have been updated in the Drive-Me system.</p>
                    <p><strong>Pickup Stop:</strong> ${pickupStopObj.location} at ${pickupStopObj.time}</p>
                    <p><strong>Dropoff Stop:</strong> ${dropoffStopObj.location}</p>
                    <p>Please confirm these stops in your employee dashboard.</p>
                    <p>Best regards,<br/>Drive-Me Transport System</p>
                `
            });
        }

        res.status(200).json({
            success: true,
            message: "Stops assigned successfully",
            data: {
                employeeId: employee._id,
                pickupPoint: pickupStopObj.location,
                dropoffPoint: dropoffStopObj.location,
                route: {
                    id: route._id,
                    name: route.fromLocation + " → " + route.toLocation
                }
            }
        });

    } catch (error) {
        console.error("Error assigning stops:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning stops to employee",
            error: error.message
        });
    }
};

// Assign route to employee (used by CorporateEmployeeManagement frontend)
export const assignRouteToEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { routeId, pickupLocation, dropoffLocation, startDate, endDate } = req.body;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "routeId is required"
            });
        }

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const route = await Route.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Get the contract for this employee
        const contract = await Contract.findOne({
            _id: route.contractId || { $exists: false }
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Associated contract not found"
            });
        }

        // Update employee transport details with route assignment
        employee.transportDetails = employee.transportDetails || {};
        employee.transportDetails.assignedRoute = routeId;
        employee.transportDetails.pickupPoint = pickupLocation || route.fromLocation;
        employee.transportDetails.dropOffPoint = dropoffLocation || route.toLocation;
        employee.routeId = routeId;

        await employee.save();

        // AUTO-CREATE TRIPS AND BOOKINGS FOR EMPLOYEE using generateTripsForEmployee
        // Calculate pass duration based on dates
        const assignmentStartDate = startDate ? new Date(startDate) : new Date();
        const assignmentEndDate = endDate ? new Date(endDate) : new Date(new Date().setDate(new Date().getDate() + 30));

        const daysDiff = Math.ceil((assignmentEndDate - assignmentStartDate) / (1000 * 60 * 60 * 24));
        const passDuration = {
            durationType: daysDiff <= 30 ? 'MONTHLY' : daysDiff <= 90 ? 'QUARTERLY' : 'YEARLY',
            startDate: assignmentStartDate,
            endDate: assignmentEndDate
        };

        // Use generateTripsForEmployee to create trips and monthly pass
        const tripResult = await generateTripsForEmployee(employee, companyId, passDuration);
        console.log(`[v0] Generated trips for employee ${employeeId}:`, tripResult);

        // Log on the managed contract activity timeline
        if (contract.serviceMode === "MANAGED") {
            await logRequestActivity(req, {
                contractId: contract._id,
                action: "ROUTE_ASSIGNED_TO_EMPLOYEE",
                entityType: "EMPLOYEE",
                entityId: employee._id,
                description: `Assigned route ${route.fromLocation} → ${route.toLocation} to ${employee.fullName || "employee"}${tripResult.generated ? ` and generated ${tripResult.generated} trip(s)` : ""}`,
                meta: { employeeId: employee._id, routeId: route._id, tripsGenerated: tripResult.generated },
            });
        }

        res.status(200).json({
            success: true,
            message: "Route assigned to employee successfully",
            data: {
                employeeId: employee._id,
                routeId: route._id,
                routeName: route.fromLocation + " → " + route.toLocation,
                pickupLocation: employee.transportDetails.pickupPoint,
                dropoffLocation: employee.transportDetails.dropOffPoint,
                tripsGenerated: tripResult.generated,
                monthlyPassId: tripResult.monthlyPass,
                bookingsCreated: tripResult.bookings,
                bookingPeriod: {
                    startDate: assignmentStartDate,
                    endDate: assignmentEndDate
                }
            }
        });

    } catch (error) {
        console.error("[v0] Error assigning route to employee:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning route to employee",
            error: error.message
        });
    }
};

// Deactivate employee
export const deactivateEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        employee.accessControl.isActive = false;
        employee.transportDetails.transportStatus = "TERMINATED";
        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee deactivated successfully",
            data: {
                employeeId: employee._id,
                fullName: employee.fullName,
                isActive: employee.accessControl.isActive
            }
        });

    } catch (error) {
        console.error("Error deactivating employee:", error);
        res.status(500).json({
            success: false,
            message: "Error deactivating employee",
            error: error.message
        });
    }
};

// Get corporate routes (for route assignment dropdown)
export const getCorporateRoutes = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        // Find routes associated with this corporate via contracts
        const contracts = await Contract.find({
            corporateId: companyId,
            status: { $in: ["ACTIVE", "APPROVED"] }
        }).select("routes");

        const contractRouteIds = contracts.reduce((acc, contract) => {
            if (contract.routes && Array.isArray(contract.routes)) {
                acc.push(...contract.routes);
            }
            return acc;
        }, []);

        // Get routes that belong to contracts OR are directly assigned to this corporate
        const routes = await Route.find({
            $or: [
                { _id: { $in: contractRouteIds } },
                { corporateId: companyId },
                { createdBy: managerId }
            ]
        }).select("fromLocation toLocation routeName stopPoints distance duration");

        res.status(200).json({
            success: true,
            data: {
                routes: routes.map(r => ({
                    _id: r._id,
                    routeName: r.routeName || `${r.fromLocation} → ${r.toLocation}`,
                    fromLocation: r.fromLocation,
                    toLocation: r.toLocation,
                    stopPoints: r.stopPoints,
                    distance: r.distance,
                    duration: r.duration
                }))
            }
        });

    } catch (error) {
        console.error("Error fetching corporate routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching routes",
            error: error.message
        });
    }
};


// Reset employee password to default temporary password
export const resetEmployeePassword = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const corporateId = req.corporateId || req.companyId;

        // Find the corporate employee
        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId: corporateId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Find the associated user
        const user = await User.findById(employee.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found for this employee"
            });
        }

        // Reset password to default temporary password
        const tempPassword = "tempPassword123";
        user.password = tempPassword;
        user.isPasswordSet = false;
        await user.save();

        // Send email with new credentials
        try {
            await sendEmail(
                user.email,
                "Password Reset - DriveMe Corporate Transport",
                `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Password Reset - DriveMe Corporate Transport</h2>
                        <p>Hello <strong>${user.fullName || 'Employee'}</strong>,</p>
                        <p>Your password has been reset by your company administrator.</p>
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>Login Email:</strong> ${user.email}</p>
                            <p><strong>New Temporary Password:</strong> ${tempPassword}</p>
                        </div>
                        <p>Please login and change your password after signing in.</p>
                        <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'http://localhost:5173'}/login" style="background: #1a237e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Login Now</a>
                    </div>
                `
            );
        } catch (emailError) {
            console.error("Error sending password reset email:", emailError);
        }

        res.status(200).json({
            success: true,
            message: "Password reset successfully. A new temporary password has been sent to the employee's email.",
            temporaryPassword: tempPassword
        });

    } catch (error) {
        console.error("Error resetting employee password:", error);
        res.status(500).json({
            success: false,
            message: "Error resetting password",
            error: error.message
        });
    }
};
