/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createB2CBooking,
  createCorporateBooking,
  clearBookingData,
} from "../../Redux/slices/bookingSlice";
import { getWalletBalance } from "../../Redux/slices/walletSlice";
import { useLocale } from "../../hooks/useLocale";
import {
  getGatewayForCurrency,
  getCurrencyDecimals,
} from "../../config/localeConfig";
import api from "../../utils/api";
import {
  FaTimes,
  FaMapMarkerAlt,
  FaUser,
  FaBus,
  FaCalendarAlt,
  FaMinus,
  FaPlus,
  FaCreditCard,
  FaMoneyBillWave,
  FaUniversity,
  FaWallet,
  FaCheck,
  FaSpinner,
} from "react-icons/fa";
import "./bookingmodal.css";

// ---- Monthly pass date helpers (module scope) ----
// Format a Date to YYYY-MM-DD using LOCAL time (avoids UTC timezone shifts).
const formatLocalDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Add `months` whole calendar months to a date. The day-of-month is clamped
// for shorter target months (e.g. Jan 31 + 1 month -> Feb 28).
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

// End date for an N-month pass: add N whole months then step back ONE day so
// the inclusive day-count equals the real number of days in those calendar
// months (28/29/30/31). e.g. Jun 12 -> Jul 11 = 30 days (June has 30 days).
const computeEndDateForMonths = (start, months) => {
  const end = addMonths(start, months);
  end.setDate(end.getDate() - 1);
  return end;
};

const BookingModal = ({ route, isOpen, onClose, isCorporate, onSuccess }) => {
  const dispatch = useDispatch();
  const { loading, error, currentBooking, bookingCreated, paymentData } =
    useSelector((state) => state.booking);
  const { user } = useSelector((state) => state.auth);
  const walletBalance = useSelector((state) => state.wallet?.balance || 0);
  // Active locale — used as the currency fallback when a route has no currency.
  const { currency: localeCurrency } = useLocale();

  // State for schedule data - now supports multiple schedules
  const [scheduleData, setScheduleData] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]); // Store ALL schedules
  const [allTripTimes, setAllTripTimes] = useState([]); // Combined trip times from all schedules
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Payment control state - check if online payments are enabled by admin
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true);
  const [loadingPaymentSettings, setLoadingPaymentSettings] = useState(true);

  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedReturnTrip, setSelectedReturnTrip] = useState(null);
  const [selectedPassType, setSelectedPassType] = useState("ONE_WAY");
  const [tripSeatAvailability, setTripSeatAvailability] = useState({}); // Store seat availability per trip
  const [selectedPickupPoint, setSelectedPickupPoint] = useState("");
  const [selectedDropoffPoint, setSelectedDropoffPoint] = useState("");
  const [selectedReturnPickupPoint, setSelectedReturnPickupPoint] =
    useState("");
  const [selectedReturnDropoffPoint, setSelectedReturnDropoffPoint] =
    useState("");
  const [passDuration, setPassDuration] = useState(1); // months
  // Earliest date a commuter can begin their pass. For advance bookings on a
  // route that starts in the future, the pass cannot begin before the route's
  // own start date — the rides only run from that day onward. Otherwise the
  // earliest date is today.
  const getEarliestStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (route?.startDate) {
      const routeStart = new Date(route.startDate);
      routeStart.setHours(0, 0, 0, 0);
      if (!isNaN(routeStart.getTime()) && routeStart > today) {
        return routeStart;
      }
    }
    return today;
  };

  const [passStartDate, setPassStartDate] = useState(() =>
    formatLocalDate(getEarliestStartDate()),
  ); // Custom start date
  const [passEndDate, setPassEndDate] = useState(() => {
    // Default to a 1-month pass. End date = start + 1 month - 1 day so the
    // inclusive day-count matches the actual calendar month length.
    const end = computeEndDateForMonths(getEarliestStartDate(), 1);
    return formatLocalDate(end);
  }); // Custom end date
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]); // Selected travel days (Mon-Sun)

  // Keep the month count (passDuration) in sync with the selected date range
  // so the stepper, summary, and backend durationMonths always agree — even
  // when the user edits the End Date manually.
  useEffect(() => {
    const start = new Date(passStartDate);
    const end = new Date(passEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return;
    let months = 0;
    while (months < 120) {
      const candidateEnd = computeEndDateForMonths(start, months + 1);
      if (candidateEnd <= end) months += 1;
      else break;
    }
    const derived = Math.max(1, months);
    setPassDuration((prev) => (prev === derived ? prev : derived));
  }, [passStartDate, passEndDate]);

  // Fetch payment settings to check if online payments are enabled
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        setLoadingPaymentSettings(true);
        const response = await api.get("/pages/public/payment-settings");
        if (response.data.success) {
          setOnlinePaymentsEnabled(response.data.data.onlinePaymentsEnabled);
        }
      } catch (error) {
        console.error("Error fetching payment settings:", error);
        // Default to enabled if fetch fails
        setOnlinePaymentsEnabled(true);
      } finally {
        setLoadingPaymentSettings(false);
      }
    };

    fetchPaymentSettings();
  }, []);

  // Fetch the commuter's wallet balance so we can offer "Pay with Wallet"
  useEffect(() => {
    if (isOpen) {
      dispatch(getWalletBalance());
    }
  }, [isOpen, dispatch]);

  // Set default pickup/dropoff points and selected days when route changes
  useEffect(() => {
    if (route) {
      setSelectedPickupPoint(route.fromLocation || "");
      setSelectedDropoffPoint(route.toLocation || "");
      setSelectedReturnPickupPoint(route.toLocation || "");
      setSelectedReturnDropoffPoint(route.fromLocation || "");

      // Initialize selected days from route's available days
      const allDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];

      // Map short day names (MON, TUE, etc.) to full day names
      const dayMap = {
        MON: "Monday",
        MONDAY: "Monday",
        Mon: "Monday",
        TUE: "Tuesday",
        TUESDAY: "Tuesday",
        Tue: "Tuesday",
        WED: "Wednesday",
        WEDNESDAY: "Wednesday",
        Wed: "Wednesday",
        THU: "Thursday",
        THURSDAY: "Thursday",
        Thu: "Thursday",
        FRI: "Friday",
        FRIDAY: "Friday",
        Fri: "Friday",
        SAT: "Saturday",
        SATURDAY: "Saturday",
        Sat: "Saturday",
        SUN: "Sunday",
        SUNDAY: "Sunday",
        Sun: "Sunday",
      };

      const routeDays =
        route.availableDays || route.schedule?.availableDays || [];

      if (Array.isArray(routeDays) && routeDays.length > 0) {
        // Convert short day names to full day names
        const convertedDays = routeDays.map((d) => {
          const upper = d.toUpperCase();
          return (
            dayMap[upper] ||
            dayMap[d] ||
            d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()
          );
        });
        setSelectedDays(convertedDays);
      } else if (typeof routeDays === "string") {
        if (
          routeDays.toLowerCase() === "daily" ||
          routeDays.toLowerCase() === "all"
        ) {
          setSelectedDays(allDays);
        } else if (routeDays.toLowerCase() === "weekdays") {
          setSelectedDays([
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ]);
        } else if (routeDays.toLowerCase() === "weekends") {
          setSelectedDays(["Saturday", "Sunday"]);
        } else {
          setSelectedDays(allDays);
        }
      } else {
        setSelectedDays(allDays);
      }
    }
  }, [route]);

  useEffect(() => {
    const fetchScheduleData = async () => {
      if (!route || !route._id) return;

      setLoadingSchedule(true);
      try {
        const response = await api.get(
          `/b2c-partner/routes/${route._id}/schedules`,
        );
        const data = response.data;

        if (data.success && data.schedules && data.schedules.length > 0) {
          // Store ALL schedules
          setAllSchedules(data.schedules);

          // Store combined trip times from all schedules
          setAllTripTimes(data.allTripTimes || []);

          // For backward compatibility, set first active schedule as primary
          const activeSchedule =
            data.schedules.find((s) => s.isActive) || data.schedules[0];
          setScheduleData(activeSchedule);
        } else {
          setScheduleData(null);
          setAllSchedules([]);
          setAllTripTimes([]);
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
        setScheduleData(null);
        setAllSchedules([]);
        setAllTripTimes([]);
      } finally {
        setLoadingSchedule(false);
      }
    };

    fetchScheduleData();
  }, [route, user?.token]);

  // Fetch real-time seat availability for trips
  const fetchTripSeatAvailability = async () => {
    const routeIdentifier = route?._id || route?.routeId;
    if (!routeIdentifier) return;

    try {
      const response = await api.get(
        `/b2c-partner/public/routes/${routeIdentifier}/trips/seat-availability`,
      );
      const data = response.data;
      setTripSeatAvailability(data.seatAvailability || {});
    } catch (error) {
      console.error("Error fetching seat availability:", error);
    }
  };

  // Fetch seat availability when schedule data loads
  useEffect(() => {
    if (scheduleData) {
      fetchTripSeatAvailability();
    }
  }, [scheduleData, route?._id, route?.routeId, user?.token]);

  // Also fetch seat availability when route changes (immediate trigger)
  useEffect(() => {
    const routeIdentifier = route?._id || route?.routeId;
    if (routeIdentifier) {
      fetchTripSeatAvailability();
    }
  }, [route]);

  // Retry fetch if seat data not available on initial load
  useEffect(() => {
    const routeIdentifier = route?._id || route?.routeId;
    if (routeIdentifier && !Object.keys(tripSeatAvailability).length) {
      fetchTripSeatAvailability();
    }
  }, [route, tripSeatAvailability]);

  const paymentMethodRef = useRef(paymentMethod);
  const onSuccessRef = useRef(onSuccess);
  const isCorporateRef = useRef(isCorporate);

  useEffect(() => {
    paymentMethodRef.current = paymentMethod;
  }, [paymentMethod]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    isCorporateRef.current = isCorporate;
  }, [isCorporate]);

  // Effect 1: Handle payment URL redirects
  useEffect(() => {
    if (bookingCreated && paymentData?.paymentUrl) {
      window.location.href = paymentData.paymentUrl;
    }
  }, [bookingCreated, paymentData]);

  // Effect 2: Handle step transition for CASH and CORPORATE bookings
  useEffect(() => {
    if (
      bookingCreated &&
      (paymentMethodRef.current === "CASH" || isCorporateRef.current)
    ) {
      // Defer the state update to avoid cascading renders
      queueMicrotask(() => {
        setStep(3);
        const timer = setTimeout(() => {
          if (onSuccessRef.current) onSuccessRef.current();
        }, 2000);
        return () => clearTimeout(timer);
      });
    }
  }, [bookingCreated]);

  useEffect(() => {
    return () => {
      dispatch(clearBookingData());
    };
  }, [dispatch]);

  if (!isOpen || !route) return null;

  // MONTHLY PASS PRICING LOGIC - Fixed monthly pricing
  // The partner sets a fixed price per month (monthlyOneWayPrice /
  // monthlyRoundTripPrice). The commuter pays that fixed monthly price multiplied
  // by the number of months, regardless of how many days are in each month.

  // Get the route's full weekly availability (normalized to full day names).
  // Billing is ALWAYS based on these days, regardless of which days the
  // commuter personally plans to travel. A monthly pass charges for the
  // route's entire operating week.
  const normalizeDayName = (d) => {
    if (!d) return null;
    const key = String(d).trim().toLowerCase();
    const map = {
      mon: "Monday",
      monday: "Monday",
      tue: "Tuesday",
      tues: "Tuesday",
      tuesday: "Tuesday",
      wed: "Wednesday",
      weds: "Wednesday",
      wednesday: "Wednesday",
      thu: "Thursday",
      thur: "Thursday",
      thurs: "Thursday",
      thursday: "Thursday",
      fri: "Friday",
      friday: "Friday",
      sat: "Saturday",
      saturday: "Saturday",
      sun: "Sunday",
      sunday: "Sunday",
    };
    return map[key] || null;
  };

  const getRouteAllowedDays = () => {
    const allDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    let routeDays = route.availableDays || route.schedule?.availableDays || [];

    // Handle string-based availability (e.g. "Daily", "Weekdays")
    if (typeof routeDays === "string") {
      const s = routeDays.toLowerCase();
      if (s === "daily" || s === "all") return allDays;
      if (s === "weekdays")
        return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      if (s === "weekends") return ["Saturday", "Sunday"];
      routeDays = [routeDays];
    }

    if (Array.isArray(routeDays) && routeDays.length > 0) {
      const normalized = routeDays.map(normalizeDayName).filter(Boolean);
      // De-duplicate while preserving canonical week order
      const unique = allDays.filter((day) => normalized.includes(day));
      if (unique.length > 0) return unique;
    }
    return allDays;
  };

  // The route's number of operating days per week (e.g. 5 or 7)
  const routeAllowedDays = getRouteAllowedDays();
  const routeDaysPerWeek = routeAllowedDays.length;

  const availableSeats = route.availableSeats ?? route.totalSeats ?? 10;
  // Currency comes from the route data (routes are country-filtered), falling
  // back to the viewing user's locale currency instead of a hardcoded value.
  const currency = route.pricing?.currency || route.currency || localeCurrency;
  const currencyDecimals = getCurrencyDecimals(currency);
  // Gateway is resolved from the currency (data-driven, future-country safe).
  const onlineGateway = getGatewayForCurrency(currency);

  // Calculate actual travel days based on selected date range and the route's
  // FULL weekly availability (not the commuter's personal day subset).
  // A monthly pass always bills for every operating day in the period.
  const calculateActualTravelDays = () => {
    const start = new Date(passStartDate);
    const end = new Date(passEndDate);
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const billingDays = routeAllowedDays.map((d) => d.toLowerCase());
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayName = dayNames[current.getDay()];
      if (billingDays.includes(dayName.toLowerCase())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Calculate duration in WHOLE calendar months from the custom date range.
  // A pass is billed per calendar month, so we count how many full months fit
  // between the start and (inclusive) end date. Minimum is always 1 month.
  const calculateDurationFromDates = () => {
    const start = new Date(passStartDate);
    const end = new Date(passEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return 1;
    }
    let months = 0;
    // Increase the month count while an N-month pass still ends on/before the
    // selected end date (computeEndDateForMonths is inclusive-aware).
    while (months < 120) {
      const candidateEnd = computeEndDateForMonths(start, months + 1);
      if (candidateEnd <= end) {
        months += 1;
      } else {
        break;
      }
    }
    return Math.max(1, months);
  };

  // Use custom date calculation for actual travel days
  const actualTravelDays = calculateActualTravelDays();
  const effectiveDuration = calculateDurationFromDates();

  // Per-day rate for a specific pass type (LEGACY fallback only — used for old
  // routes created before fixed monthly pricing existed).
  const getPerDayPriceFor = (passType) => {
    if (passType === "ONE_WAY") {
      return route.pricing?.oneWayPrice || route.oneWayPrice || 0;
    }
    return route.pricing?.roundTripPrice || route.roundTripPrice || 0;
  };

  // FIXED MONTHLY price for a specific pass type. This is the price the partner
  // sets and the authoritative basis for what the commuter pays.
  const getMonthlyPriceFor = (passType) => {
    if (passType === "ONE_WAY") {
      return route.pricing?.monthlyOneWayPrice || route.monthlyOneWayPrice || 0;
    }
    return (
      route.pricing?.monthlyRoundTripPrice || route.monthlyRoundTripPrice || 0
    );
  };

  // The monthly price for the currently-selected pass type.
  const monthlyPrice = getMonthlyPriceFor(selectedPassType);

  // Computed amount for a pass type over the currently-selected pass period.
  // The commuter pays a FIXED monthly price x number of months x seats — the
  // amount does NOT change with the number of calendar days (28/29/30/31) or the
  // number of travel days in a month. Falls back to legacy per-day pricing only
  // when a route has no monthly price configured.
  const getPassTypeAmount = (passType) => {
    const monthly = getMonthlyPriceFor(passType);
    if (monthly > 0) {
      return monthly * effectiveDuration * numberOfSeats;
    }
    return getPerDayPriceFor(passType) * actualTravelDays * numberOfSeats;
  };

  // Final total = fixed monthly price x months x seats (legacy fallback otherwise).
  const totalAmount =
    getPassTypeAmount(selectedPassType).toFixed(currencyDecimals);
  const adminCommission = (totalAmount * 0.2).toFixed(currencyDecimals);
  const driverEarnings = (totalAmount * 0.8).toFixed(currencyDecimals);

  // Update end date when passDuration changes (from quick-select / stepper).
  // End date = start + N months - 1 day, so the inclusive day-count equals the
  // real number of days in those calendar months (28/29/30/31).
  const handleDurationChange = (months) => {
    const safeMonths = Math.max(1, Math.round(Number(months) || 1));
    setPassDuration(safeMonths);
    const start = new Date(passStartDate);
    const newEnd = computeEndDateForMonths(start, safeMonths);
    setPassEndDate(formatLocalDate(newEnd));
  };

  // Get min date. For advance bookings on a future-start route this is the
  // route start date; otherwise today.
  const getMinDate = () => {
    return formatLocalDate(getEarliestStartDate());
  };

  // Get available trips from schedule data
  const availableTrips = route.upcomingTrips || [];

  // Use allTripTimes (combined from ALL schedules) if available, otherwise fallback to single schedule
  const tripTimes =
    allTripTimes.length > 0
      ? allTripTimes
      : scheduleData?.tripTimes || route.tripTimes || [];

  // Create trip options from schedule data
  // For ONE_WAY: Show all One Way trips
  // For ROUND_TRIP: Show 2 separate trips - outbound and return

  const allTrips = [];

  tripTimes.forEach((trip) => {
    if (trip.tripType === "One Way") {
      // Respect the direction stored on the schedule's trip time.
      // A One Way trip can run in the route's default (outbound) direction
      // (fromLocation -> toLocation) OR in the reverse (return) direction
      // (toLocation -> fromLocation), depending on what the partner configured.
      const isReturnDirection = trip.direction === "return";
      allTrips.push({
        ...trip,
        direction: isReturnDirection ? "return" : "outbound",
        fromLocation: isReturnDirection ? route.toLocation : route.fromLocation,
        toLocation: isReturnDirection ? route.fromLocation : route.toLocation,
        stopPoints: trip.outboundStopPoints || trip.stopPoints || [],
      });
    } else if (trip.tripType === "Round Trip") {
      // Split round trip into 2 separate one way trips
      if (trip.departureTime) {
        // Outbound trip
        allTrips.push({
          ...trip,
          _id: `${trip._id}_outbound`,
          tripType: "One Way",
          direction: "outbound",
          fromLocation: route.fromLocation,
          toLocation: route.toLocation,
          departureTime: trip.departureTime,
          arrivalTime: trip.arrivalTime,
          stopPoints: trip.outboundStopPoints || [],
        });
      }

      if (trip.arrivalTime) {
        // Return trip. A Round Trip can have a DEDICATED return-leg driver and
        // vehicle (different from the outbound leg). The backend exposes these as
        // effectiveReturnDriver / effectiveReturnVehicle, so remap the display
        // fields here — otherwise the return leg would wrongly show the outbound
        // driver/vehicle carried over by `...trip`.
        allTrips.push({
          ...trip,
          _id: `${trip._id}_return`,
          tripType: "One Way",
          direction: "return",
          fromLocation: route.toLocation,
          toLocation: route.fromLocation,
          departureTime: trip.arrivalTime,
          arrivalTime: null,
          stopPoints: trip.returnStopPoints || [],
          // Show the return-leg (aane) assignment, falling back to the outbound
          // leg only when no dedicated return driver/vehicle was configured.
          effectiveDriver:
            trip.effectiveReturnDriver ||
            trip.returnDriverInfo ||
            trip.effectiveDriver,
          effectiveVehicle:
            trip.effectiveReturnVehicle ||
            trip.returnVehicleInfo ||
            trip.effectiveVehicle,
          tripDriverInfo: trip.returnDriverInfo || trip.tripDriverInfo,
          tripVehicleInfo: trip.returnVehicleInfo || trip.tripVehicleInfo,
          isSelfDriver:
            typeof trip.returnIsSelfDriver === "boolean"
              ? trip.returnIsSelfDriver
              : trip.isSelfDriver,
        });
      }
    }
  });

  // Outbound trips - trips going FROM origin TO destination
  const outboundTrips = allTrips.filter(
    (trip) => trip.direction === "outbound" && trip.departureTime,
  );

  // Return trips - trips going FROM destination TO origin (back home)
  const returnTrips = allTrips.filter(
    (trip) => trip.direction === "return" && trip.departureTime,
  );

  // Group trips by schedule for grouped display
  const groupTripsBySchedule = (trips) => {
    const grouped = {};
    trips.forEach((trip) => {
      const scheduleId = trip.scheduleId || "default";
      const scheduleName = trip.scheduleName || "Default Schedule";
      if (!grouped[scheduleId]) {
        grouped[scheduleId] = {
          scheduleId,
          scheduleName,
          availableDays: trip.availableDays || [],
          trips: [],
        };
      }
      grouped[scheduleId].trips.push(trip);
    });
    // Sort trips within each schedule by departure time
    Object.values(grouped).forEach((group) => {
      group.trips.sort((a, b) => {
        const timeA = a.departureTime?.replace(/[^\d:]/g, "") || "00:00";
        const timeB = b.departureTime?.replace(/[^\d:]/g, "") || "00:00";
        return timeA.localeCompare(timeB);
      });
    });
    return Object.values(grouped);
  };

  // Get grouped outbound trips for display
  const groupedOutboundTrips = groupTripsBySchedule(outboundTrips);
  const groupedReturnTrips = groupTripsBySchedule(returnTrips);
  const groupedAllTrips = groupTripsBySchedule(allTrips);

  console.log("first groupedAllTrips", groupedAllTrips);

  // Get pickup/dropoff points from selected trip - includes all stop points with times
  const getPickupPoints = () => {
    if (selectedTrip) {
      const points = [];
      // Add origin location first (user can board from the starting point)
      const origin = selectedTrip.fromLocation || route.fromLocation;
      points.push({ location: origin, time: selectedTrip.departureTime || "" });

      // Add ALL intermediate stop points from the trip
      // User can board from origin or any intermediate stop
      // These are the stops between origin and destination
      if (selectedTrip.stopPoints && selectedTrip.stopPoints.length > 0) {
        selectedTrip.stopPoints.forEach((stop) => {
          if (
            stop.location &&
            !points.find((p) => p.location === stop.location)
          ) {
            points.push({
              location: stop.location,
              time: stop.time || stop.scheduledTime || "",
            });
          }
        });
      }

      // Note: We don't add the destination as a pickup point (can't board at final stop)
      return points;
    }
    return [{ location: route.fromLocation, time: "" }];
  };

  const getDropoffPoints = () => {
    if (selectedTrip) {
      const points = [];

      // Add ALL intermediate stop points from the trip as dropoff options
      // User can get off at any stop after their pickup point
      if (selectedTrip.stopPoints && selectedTrip.stopPoints.length > 0) {
        selectedTrip.stopPoints.forEach((stop) => {
          if (
            stop.location &&
            !points.find((p) => p.location === stop.location)
          ) {
            points.push({
              location: stop.location,
              time: stop.time || stop.scheduledTime || "",
            });
          }
        });
      }

      // Add destination location last (final stop)
      const destination = selectedTrip.toLocation || route.toLocation;
      if (!points.find((p) => p.location === destination)) {
        points.push({
          location: destination,
          time: selectedTrip.arrivalTime || "",
        });
      }

      return points;
    }
    return [{ location: route.toLocation, time: "" }];
  };

  const getReturnPickupPoints = () => {
    if (selectedReturnTrip) {
      const points = [];
      // For return trips, origin is where we start going back from (e.g., Safdarjung Hospital)
      const origin = selectedReturnTrip.fromLocation || route.toLocation;
      points.push({
        location: origin,
        time: selectedReturnTrip.departureTime || "",
      });

      // Add ALL intermediate stop points from the return trip
      // User can board from origin or any intermediate stop
      if (
        selectedReturnTrip.stopPoints &&
        selectedReturnTrip.stopPoints.length > 0
      ) {
        selectedReturnTrip.stopPoints.forEach((stop) => {
          if (
            stop.location &&
            !points.find((p) => p.location === stop.location)
          ) {
            points.push({
              location: stop.location,
              time: stop.time || stop.scheduledTime || "",
            });
          }
        });
      }

      return points;
    }
    return [{ location: route.toLocation, time: "" }];
  };

  const getReturnDropoffPoints = () => {
    if (selectedReturnTrip) {
      const points = [];

      // Add ALL intermediate stop points from the return trip as dropoff options
      // User can get off at any stop after their pickup point
      if (
        selectedReturnTrip.stopPoints &&
        selectedReturnTrip.stopPoints.length > 0
      ) {
        selectedReturnTrip.stopPoints.forEach((stop) => {
          if (
            stop.location &&
            !points.find((p) => p.location === stop.location)
          ) {
            points.push({
              location: stop.location,
              time: stop.time || stop.scheduledTime || "",
            });
          }
        });
      }

      // Add final destination (e.g., Kashmiri Gate ISBT for return trips)
      const destination = selectedReturnTrip.toLocation || route.fromLocation;
      if (!points.find((p) => p.location === destination)) {
        points.push({
          location: destination,
          time: selectedReturnTrip.arrivalTime || "",
        });
      }

      return points;
    }
    return [{ location: route.fromLocation, time: "" }];
  };

  const handleIncreaseSeats = () => {
    // Always limit to 1 seat per user
    if (numberOfSeats < 1) {
      setNumberOfSeats((prev) => prev + 1);
    }
  };

  const handleDecreaseSeats = () => {
    if (numberOfSeats > 1) {
      setNumberOfSeats((prev) => prev - 1);
    }
  };

  const handleContinueToPayment = () => {
    // A trip time (schedule) MUST be selected before continuing. Previously a
    // One-Way pass could proceed without choosing any outbound schedule and the
    // code silently fell back to the first available trip.
    if (outboundTrips.length > 0 && !selectedTrip) {
      alert("Please select a trip time before continuing.");
      return;
    }

    // For a Round Trip pass the return schedule must also be selected.
    if (selectedPassType === "ROUND_TRIP") {
      if (returnTrips.length === 0) {
        alert(
          "No return trips available for this route. Please select One-Way Monthly Pass instead.",
        );
        return;
      }
      if (!selectedReturnTrip) {
        alert("Please select a return trip time before continuing.");
        return;
      }
    }

    if (isCorporate) {
      handleCorporateBooking();
    } else {
      setStep(2);
    }
  };

  const handleSelectPaymentMethod = async (method) => {
    setPaymentMethod(method);
    setIsProcessing(true);

    // MONTHLY PASS BOOKING DATA
    const bookingData = {
      passengerId: user?.id || user?._id,
      routeId: route._id || route.id || route.routeId,
      scheduleId: scheduleData?._id || route.scheduleId || route._id, // Use schedule data ID
      passType: selectedPassType,
      // Use the commuter's explicit selection. Validation in
      // handleContinueToPayment guarantees a trip is selected when trips exist,
      // so we no longer silently fall back to the first available trip.
      outboundTripTime:
        selectedTrip?.departureTime ||
        outboundTrips[0]?.departureTime ||
        allTrips[0]?.departureTime ||
        "",
      returnTripTime:
        selectedPassType === "ROUND_TRIP"
          ? selectedReturnTrip?.departureTime || ""
          : "",
      pickupLocation: selectedPickupPoint || route.fromLocation,
      dropoffLocation: selectedDropoffPoint || route.toLocation,
      returnPickupLocation:
        selectedReturnPickupPoint ||
        (selectedPassType === "ROUND_TRIP" ? route.toLocation : ""),
      returnDropoffLocation:
        selectedReturnDropoffPoint ||
        (selectedPassType === "ROUND_TRIP" ? route.fromLocation : ""),
      durationMonths: effectiveDuration,
      numberOfSeats: numberOfSeats,
      selectedDays: routeAllowedDays, // Pass covers the route's full weekly availability
      totalAmount: Number.parseFloat(totalAmount),
      // Send the route's currency so the backend charges in the correct
      // currency (AED for UAE / KWD for Kuwait) and picks the right gateway.
      currency: currency,
      paymentMethod: method,
      notes: notes,
      // Custom date range
      customStartDate: passStartDate, // User selected start date (YYYY-MM-DD)
      customEndDate: passEndDate, // User selected end date (YYYY-MM-DD)
      actualTravelDays: actualTravelDays, // Calculated travel days in range
    };

    try {
      const response = await api.post("/monthly-pass/create", bookingData);

      if (response.data.success) {
        // Handle payment redirect for STRIPE
        if (response.data.payment?.paymentUrl) {
          // Redirect to payment gateway (Stripe or TAP)
          console.log(
            "[v0] Redirecting to payment URL:",
            response.data.payment.paymentUrl,
          );
          window.location.href = response.data.payment.paymentUrl;
          return;
        } else if (method === "CASH" || method === "WALLET") {
          // Cash and Wallet payments complete immediately (no gateway redirect)
          console.log(`[v0] ${method} payment selected - showing success`);
          if (method === "WALLET") {
            // Wallet balance changed — refresh it for the header/UI
            dispatch(getWalletBalance());
          }
          setStep(3);
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 2000);
        } else {
          // Payment method without redirect
          console.log("[v0] Payment method without redirect:", method);
          alert("Payment method not fully configured");
        }
      } else {
        console.error("Monthly pass creation failed:", response.data.message);
        alert(response.data.message || "Failed to create monthly pass");
      }
    } catch (err) {
      console.error("Booking error:", err);
      // Surface the specific backend reason (e.g. the duplicate-trip guard's 409
      // "You already have an active pass for the 7:00 AM ... trip") so the
      // commuter understands why the booking was blocked, instead of a generic
      // failure message.
      const serverMessage = err?.response?.data?.message;
      alert(
        serverMessage || "Failed to create monthly pass. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCorporateBooking = async () => {
    setIsProcessing(true);

    // Validate driver is assigned for corporate booking
    const driverId = route.driverId || route.assignedDriverId;
    if (!driverId) {
      console.error("No driver assigned to this corporate route");
      setIsProcessing(false);
      alert(
        "This route has no assigned driver. Please contact your company administrator.",
      );
      return;
    }

    const bookingData = {
      routeId: route.routeId || route.id,
      contractId: route.contractId || null,
      corporateOwnerId: user.companyId,
      driverId: driverId,
      pickupLocation: route.fromLocation,
      dropoffLocation: route.toLocation,
      travelDate: new Date().toISOString(),
      numberOfSeats,
      travelPath: route.travelPath || [],
      vehicleModel: route.vehicleModel,
      vehiclePlate: route.vehiclePlate,
      driverName: route.driverName,
      driverImage: route.driverImage,
      passengerNotes: notes,
    };

    try {
      await dispatch(createCorporateBooking(bookingData)).unwrap();
    } catch (err) {
      console.error("Corporate booking error:", err);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    dispatch(clearBookingData());
    setStep(1);
    setNumberOfSeats(1);
    setPaymentMethod("");
    setNotes("");
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="booking-modal-overlay" onClick={handleClose}>
      <div
        className="booking-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="booking-modal-header">
          <h2>
            {step === 1 && "Book Your Ride"}
            {step === 2 && "Select Payment Method"}
            {step === 3 &&
              (isCorporate ? "Booking Confirmed" : "Request Submitted")}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className="booking-modal-body">
          {step === 1 && (
            <div className="step-content step-details">
              <div className="route-summary-card">
                <div className="route-summary-header">
                  <h3>Route Details</h3>
                </div>
                <div className="route-summary-body">
                  <div className="summary-row">
                    <FaMapMarkerAlt className="icon from" />
                    <div className="summary-info">
                      <span className="label">Pickup</span>
                      <span className="value">{route.fromLocation}</span>
                    </div>
                  </div>
                  <div className="summary-row">
                    <FaMapMarkerAlt className="icon to" />
                    <div className="summary-info">
                      <span className="label">Dropoff</span>
                      <span className="value">{route.toLocation}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TRIP SELECTION */}
              <div className="trip-selection-card">
                <div className="trip-selection-header">
                  <h3
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {selectedPassType === "ROUND_TRIP"
                      ? "Select Outbound Trip (Going)"
                      : "Select Trip Time"}
                    {allSchedules.length > 1 && (
                      <span
                        style={{
                          fontSize: "12px",
                          backgroundColor: "#dbeafe",
                          color: "#1e40af",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {allSchedules.length} schedules
                      </span>
                    )}
                  </h3>
                </div>
                <div className="trip-selection-body">
                  {loadingSchedule ? (
                    <div className="loading-schedule">
                      <FaSpinner className="spinner" />
                      <p>Loading schedule...</p>
                    </div>
                  ) : (
                    <>
                      {(selectedPassType === "ONE_WAY"
                        ? groupedAllTrips
                        : groupedOutboundTrips
                      ).length > 0 ? (
                        (selectedPassType === "ONE_WAY"
                          ? groupedAllTrips
                          : groupedOutboundTrips
                        ).map((scheduleGroup, groupIndex) => (
                          <div
                            key={scheduleGroup.scheduleId || groupIndex}
                            className="schedule-group"
                            style={{ marginBottom: "16px" }}
                          >
                            {/* Schedule Header */}
                            {allSchedules.length > 1 && (
                              <div
                                className="schedule-header"
                                style={{
                                  padding: "10px 14px",
                                  backgroundColor: "#f8fafc",
                                  borderRadius: "8px",
                                  marginBottom: "8px",
                                  borderLeft: "4px solid #3b82f6",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "600",
                                      color: "#1e40af",
                                      fontSize: "14px",
                                    }}
                                  >
                                    {scheduleGroup.scheduleName
                                      ?.replace(/.*to.*-?\s*/, "")
                                      .trim() || `Schedule ${groupIndex + 1}`}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      backgroundColor: "#dbeafe",
                                      color: "#1e40af",
                                      padding: "2px 8px",
                                      borderRadius: "10px",
                                    }}
                                  >
                                    {scheduleGroup.trips.length} trip
                                    {scheduleGroup.trips.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                                {scheduleGroup.availableDays?.length > 0 && (
                                  <div
                                    style={{
                                      marginTop: "4px",
                                      fontSize: "11px",
                                      color: "#64748b",
                                    }}
                                  >
                                    Days:{" "}
                                    {Array.isArray(scheduleGroup.availableDays)
                                      ? scheduleGroup.availableDays
                                          .slice(0, 3)
                                          .map((d) => d.substring(0, 3))
                                          .join(", ")
                                      : scheduleGroup.availableDays}
                                    {scheduleGroup.availableDays.length > 3 &&
                                      ` +${scheduleGroup.availableDays.length - 3} more`}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Trips within this schedule */}
                            {scheduleGroup.trips.map((trip, index) => (
                              <div
                                key={trip._id || index}
                                className={`trip-option ${selectedTrip?._id === trip._id ? "selected" : ""}`}
                                onClick={() => {
                                  setSelectedTrip(trip);
                                  const pickupStop = trip.stopPoints?.[0];
                                  const dropoffStop =
                                    trip.stopPoints?.[
                                      trip.stopPoints?.length - 1
                                    ];
                                  setSelectedPickupPoint(
                                    pickupStop?.location || trip.fromLocation,
                                  );
                                  setSelectedDropoffPoint(
                                    dropoffStop?.location || trip.toLocation,
                                  );
                                }}
                              >
                                <div className="trip-option-header">
                                  <div className="trip-time">
                                    <strong>{trip.departureTime}</strong>
                                    {trip.arrivalTime && (
                                      <span> - {trip.arrivalTime}</span>
                                    )}
                                  </div>
                                  <span
                                    className={`trip-type ${trip.direction === "return" ? "return-badge" : "outbound-badge"}`}
                                  >
                                    {trip.direction === "return"
                                      ? "RETURN"
                                      : "OUTBOUND"}
                                  </span>
                                </div>
                                <div className="trip-option-details">
                                  <div className="trip-route">
                                    {trip.fromLocation} &rarr; {trip.toLocation}
                                  </div>
                                  {/* Always show driver/vehicle info for this trip */}
                                  <div
                                    className="trip-assignment-details"
                                    style={{
                                      fontSize: "12px",
                                      marginTop: "8px",
                                      padding: "8px 10px",
                                      backgroundColor:
                                        selectedTrip?._id === trip._id
                                          ? "#ecfdf5"
                                          : "#f8fafc",
                                      borderRadius: "6px",
                                      border: `1px solid ${selectedTrip?._id === trip._id ? "#10b981" : "#e2e8f0"}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: "28px",
                                          height: "28px",
                                          borderRadius: "50%",
                                          backgroundColor: "#e0f2fe",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {trip.effectiveDriver?.image ? (
                                          <img
                                            src={trip.effectiveDriver.image}
                                            alt="Driver"
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              objectFit: "cover",
                                            }}
                                          />
                                        ) : (
                                          <FaUser
                                            style={{
                                              fontSize: "12px",
                                              color: "#0369a1",
                                            }}
                                          />
                                        )}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: "600",
                                            color: "#1e293b",
                                            fontSize: "12px",
                                          }}
                                        >
                                          {trip.effectiveDriver?.name ||
                                            "Driver Not Assigned"}
                                        </div>
                                        {trip.effectiveDriver?.phoneNumber && (
                                          <div
                                            style={{
                                              fontSize: "10px",
                                              color: "#64748b",
                                            }}
                                          >
                                            {trip.effectiveDriver.phoneNumber}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: "28px",
                                          height: "28px",
                                          borderRadius: "6px",
                                          backgroundColor: "#fef3c7",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {trip.effectiveVehicle?.image ? (
                                          <img
                                            src={trip.effectiveVehicle.image}
                                            alt="Vehicle"
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              objectFit: "cover",
                                            }}
                                          />
                                        ) : (
                                          <FaBus
                                            style={{
                                              fontSize: "12px",
                                              color: "#b45309",
                                            }}
                                          />
                                        )}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: "600",
                                            color: "#1e293b",
                                            fontSize: "12px",
                                          }}
                                        >
                                          {trip.effectiveVehicle
                                            ? `${trip.effectiveVehicle.vehicleType || ""} ${trip.effectiveVehicle.model || ""}`.trim() ||
                                              "Vehicle"
                                            : "Vehicle Not Assigned"}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "10px",
                                            color: "#64748b",
                                            display: "flex",
                                            gap: "8px",
                                          }}
                                        >
                                          {trip.effectiveVehicle
                                            ?.licensePlate && (
                                            <span>
                                              {
                                                trip.effectiveVehicle
                                                  .licensePlate
                                              }
                                            </span>
                                          )}
                                          {trip.effectiveVehicle
                                            ?.vehicleColor && (
                                            <span
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "3px",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  width: "8px",
                                                  height: "8px",
                                                  borderRadius: "50%",
                                                  backgroundColor:
                                                    trip.effectiveVehicle.vehicleColor.toLowerCase(),
                                                  border: "1px solid #d1d5db",
                                                }}
                                              />
                                              {
                                                trip.effectiveVehicle
                                                  .vehicleColor
                                              }
                                            </span>
                                          )}
                                          {trip.effectiveVehicle
                                            ?.seatingCapacity && (
                                            <span>
                                              {
                                                trip.effectiveVehicle
                                                  .seatingCapacity
                                              }{" "}
                                              seats
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="trip-stops">
                                    {trip.stopPoints
                                      ?.slice(0, 3)
                                      .map((stop, idx) => (
                                        <span key={idx} className="stop-point">
                                          {stop.location} ({stop.time})
                                        </span>
                                      ))}
                                    {trip.stopPoints?.length > 3 && (
                                      <span className="more-stops">
                                        +{trip.stopPoints.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="trip-seats">
                                  {(() => {
                                    const tripKey = `${trip.departureTime}_${trip.direction}`;
                                    const seatInfo =
                                      tripSeatAvailability[tripKey];
                                    // Prefer real-time per-trip seat data. When it
                                    // is unavailable, fall back to THIS trip's own
                                    // assigned vehicle capacity (each schedule may
                                    // use a different vehicle), not the route-wide
                                    // number.
                                    const seatsAvailable =
                                      seatInfo?.availableSeats ??
                                      trip.effectiveVehicle?.seatingCapacity ??
                                      trip.seatingCapacity ??
                                      route.availableSeats ??
                                      route.totalSeats ??
                                      0;
                                    const hasEnoughSeats =
                                      seatsAvailable >= numberOfSeats;
                                    return (
                                      <div
                                        className={`seat-info ${hasEnoughSeats ? "available" : "limited"}`}
                                      >
                                        <span className="seat-count">
                                          {seatsAvailable} seats available
                                        </span>
                                        {!hasEnoughSeats && (
                                          <span className="seat-warning">
                                            Not enough seats
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="no-trips">
                          {selectedPassType === "ROUND_TRIP"
                            ? "No outbound trips available for this route"
                            : "No trips available in schedule"}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* RETURN TRIP SELECTION FOR ROUND TRIP */}
              {selectedPassType === "ROUND_TRIP" && (
                <div className="trip-selection-card">
                  <div className="trip-selection-header">
                    <h3
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      Select Return Trip (Coming Back)
                      {allSchedules.length > 1 && (
                        <span
                          style={{
                            fontSize: "12px",
                            backgroundColor: "#dbeafe",
                            color: "#1e40af",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {allSchedules.length} schedules
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="trip-selection-body">
                    {loadingSchedule ? (
                      <div className="loading-schedule">
                        <FaSpinner className="spinner" />
                        <p>Loading schedule...</p>
                      </div>
                    ) : (
                      <>
                        {groupedReturnTrips.length > 0 ? (
                          groupedReturnTrips.map(
                            (scheduleGroup, groupIndex) => (
                              <div
                                key={scheduleGroup.scheduleId || groupIndex}
                                className="schedule-group"
                                style={{ marginBottom: "16px" }}
                              >
                                {/* Schedule Header for Return Trips */}
                                {allSchedules.length > 1 && (
                                  <div
                                    className="schedule-header"
                                    style={{
                                      padding: "10px 14px",
                                      backgroundColor: "#fef2f2",
                                      borderRadius: "8px",
                                      marginBottom: "8px",
                                      borderLeft: "4px solid #ef4444",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: "600",
                                          color: "#b91c1c",
                                          fontSize: "14px",
                                        }}
                                      >
                                        {scheduleGroup.scheduleName
                                          ?.replace(/.*to.*-?\s*/, "")
                                          .trim() ||
                                          `Schedule ${groupIndex + 1}`}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          backgroundColor: "#fee2e2",
                                          color: "#b91c1c",
                                          padding: "2px 8px",
                                          borderRadius: "10px",
                                        }}
                                      >
                                        {scheduleGroup.trips.length} return trip
                                        {scheduleGroup.trips.length > 1
                                          ? "s"
                                          : ""}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {/* Return trips within this schedule */}
                                {scheduleGroup.trips.map((trip, index) => (
                                  <div
                                    key={trip._id || index}
                                    className={`trip-option ${selectedReturnTrip?._id === trip._id ? "selected" : ""}`}
                                    onClick={() => {
                                      setSelectedReturnTrip(trip);
                                      const pickupStop = trip.stopPoints?.[0];
                                      const dropoffStop =
                                        trip.stopPoints?.[
                                          trip.stopPoints?.length - 1
                                        ];
                                      setSelectedReturnPickupPoint(
                                        pickupStop?.location ||
                                          trip.fromLocation,
                                      );
                                      setSelectedReturnDropoffPoint(
                                        dropoffStop?.location ||
                                          trip.toLocation,
                                      );
                                    }}
                                  >
                                    <div className="trip-option-header">
                                      <div className="trip-time">
                                        <strong>{trip.departureTime}</strong>
                                      </div>
                                      <span className="trip-type return-badge">
                                        RETURN
                                      </span>
                                    </div>
                                    <div className="trip-option-details">
                                      <div className="trip-route">
                                        {trip.fromLocation} &rarr;{" "}
                                        {trip.toLocation}
                                      </div>
                                      {/* Always show driver/vehicle info for this return trip */}
                                      <div
                                        className="trip-assignment-details"
                                        style={{
                                          fontSize: "12px",
                                          marginTop: "8px",
                                          padding: "8px 10px",
                                          backgroundColor:
                                            selectedReturnTrip?._id === trip._id
                                              ? "#fef2f2"
                                              : "#f8fafc",
                                          borderRadius: "6px",
                                          border: `1px solid ${selectedReturnTrip?._id === trip._id ? "#ef4444" : "#e2e8f0"}`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            marginBottom: "6px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: "28px",
                                              height: "28px",
                                              borderRadius: "50%",
                                              backgroundColor: "#e0f2fe",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              overflow: "hidden",
                                            }}
                                          >
                                            {trip.effectiveDriver?.image ? (
                                              <img
                                                src={trip.effectiveDriver.image}
                                                alt="Driver"
                                                style={{
                                                  width: "100%",
                                                  height: "100%",
                                                  objectFit: "cover",
                                                }}
                                              />
                                            ) : (
                                              <FaUser
                                                style={{
                                                  fontSize: "12px",
                                                  color: "#0369a1",
                                                }}
                                              />
                                            )}
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <div
                                              style={{
                                                fontWeight: "600",
                                                color: "#1e293b",
                                                fontSize: "12px",
                                              }}
                                            >
                                              {trip.effectiveDriver?.name ||
                                                "Driver Not Assigned"}
                                            </div>
                                            {trip.effectiveDriver
                                              ?.phoneNumber && (
                                              <div
                                                style={{
                                                  fontSize: "10px",
                                                  color: "#64748b",
                                                }}
                                              >
                                                {
                                                  trip.effectiveDriver
                                                    .phoneNumber
                                                }
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: "28px",
                                              height: "28px",
                                              borderRadius: "6px",
                                              backgroundColor: "#fef3c7",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              overflow: "hidden",
                                            }}
                                          >
                                            {trip.effectiveVehicle?.image ? (
                                              <img
                                                src={
                                                  trip.effectiveVehicle.image
                                                }
                                                alt="Vehicle"
                                                style={{
                                                  width: "100%",
                                                  height: "100%",
                                                  objectFit: "cover",
                                                }}
                                              />
                                            ) : (
                                              <FaBus
                                                style={{
                                                  fontSize: "12px",
                                                  color: "#b45309",
                                                }}
                                              />
                                            )}
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <div
                                              style={{
                                                fontWeight: "600",
                                                color: "#1e293b",
                                                fontSize: "12px",
                                              }}
                                            >
                                              {trip.effectiveVehicle
                                                ? `${trip.effectiveVehicle.vehicleType || ""} ${trip.effectiveVehicle.model || ""}`.trim() ||
                                                  "Vehicle"
                                                : "Vehicle Not Assigned"}
                                            </div>
                                            <div
                                              style={{
                                                fontSize: "10px",
                                                color: "#64748b",
                                                display: "flex",
                                                gap: "8px",
                                              }}
                                            >
                                              {trip.effectiveVehicle
                                                ?.licensePlate && (
                                                <span>
                                                  {
                                                    trip.effectiveVehicle
                                                      .licensePlate
                                                  }
                                                </span>
                                              )}
                                              {trip.effectiveVehicle
                                                ?.vehicleColor && (
                                                <span
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "3px",
                                                  }}
                                                >
                                                  <span
                                                    style={{
                                                      width: "8px",
                                                      height: "8px",
                                                      borderRadius: "50%",
                                                      backgroundColor:
                                                        trip.effectiveVehicle.vehicleColor.toLowerCase(),
                                                      border:
                                                        "1px solid #d1d5db",
                                                    }}
                                                  />
                                                  {
                                                    trip.effectiveVehicle
                                                      .vehicleColor
                                                  }
                                                </span>
                                              )}
                                              {trip.effectiveVehicle
                                                ?.seatingCapacity && (
                                                <span>
                                                  {
                                                    trip.effectiveVehicle
                                                      .seatingCapacity
                                                  }{" "}
                                                  seats
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="trip-stops">
                                        {trip.stopPoints
                                          ?.slice(0, 3)
                                          .map((stop, idx) => (
                                            <span
                                              key={idx}
                                              className="stop-point"
                                            >
                                              {stop.location} ({stop.time})
                                            </span>
                                          ))}
                                        {trip.stopPoints?.length > 3 && (
                                          <span className="more-stops">
                                            +{trip.stopPoints.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="trip-seats">
                                      {(() => {
                                        const tripKey = `${trip.departureTime}_${trip.direction}`;
                                        const seatInfo =
                                          tripSeatAvailability[tripKey];
                                        // Prefer real-time per-trip seat data, then
                                        // fall back to THIS trip's own assigned
                                        // vehicle capacity (return trips can use a
                                        // different vehicle than outbound).
                                        const seatsAvailable =
                                          seatInfo?.availableSeats ??
                                          trip.effectiveVehicle
                                            ?.seatingCapacity ??
                                          trip.seatingCapacity ??
                                          route.availableSeats ??
                                          route.totalSeats ??
                                          0;
                                        const hasEnoughSeats =
                                          seatsAvailable >= numberOfSeats;
                                        return (
                                          <div
                                            className={`seat-info ${hasEnoughSeats ? "available" : "limited"}`}
                                          >
                                            <span className="seat-count">
                                              {seatsAvailable} seats available
                                            </span>
                                            {!hasEnoughSeats && (
                                              <span className="seat-warning">
                                                Not enough seats
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ),
                          )
                        ) : (
                          <div className="no-trips">
                            No return trips available
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* PASS TYPE SELECTION */}
              <div className="pass-type-card">
                <div className="pass-type-header">
                  <h3>Select Pass Type</h3>
                </div>
                <div className="pass-type-body">
                  <div className="pass-type-options">
                    <label className="pass-type-option">
                      <input
                        type="radio"
                        name="passType"
                        value="ONE_WAY"
                        checked={selectedPassType === "ONE_WAY"}
                        onChange={(e) => {
                          setSelectedPassType(e.target.value);
                          // Reset return trip when switching to ONE_WAY
                          setSelectedReturnTrip(null);
                          setSelectedReturnPickupPoint("");
                          setSelectedReturnDropoffPoint("");
                        }}
                      />
                      <div className="pass-type-content">
                        <div className="pass-type-title">
                          One Way Monthly Pass
                        </div>
                        <div className="pass-type-price">
                          {currency}{" "}
                          {getMonthlyPriceFor("ONE_WAY").toFixed(
                            currencyDecimals,
                          )}
                          /month
                        </div>
                        <div className="pass-type-subprice">
                          {currency}{" "}
                          {getPassTypeAmount("ONE_WAY").toFixed(
                            currencyDecimals,
                          )}{" "}
                          for {effectiveDuration} month
                          {effectiveDuration !== 1 ? "s" : ""}
                        </div>
                        <div className="pass-type-description">
                          Travel in one direction only (e.g., morning to work)
                        </div>
                      </div>
                    </label>

                    <label
                      className={`pass-type-option ${returnTrips.length === 0 ? "disabled" : ""}`}
                    >
                      <input
                        type="radio"
                        name="passType"
                        value="ROUND_TRIP"
                        checked={selectedPassType === "ROUND_TRIP"}
                        disabled={returnTrips.length === 0}
                        onChange={(e) => {
                          if (returnTrips.length === 0) {
                            return; // Don't allow selection if no return trips
                          }
                          setSelectedPassType(e.target.value);
                          // Reset trips when switching to ROUND_TRIP
                          setSelectedTrip(null);
                          setSelectedReturnTrip(null);
                          setSelectedPickupPoint("");
                          setSelectedDropoffPoint("");
                          setSelectedReturnPickupPoint("");
                          setSelectedReturnDropoffPoint("");
                        }}
                      />
                      <div className="pass-type-content">
                        <div className="pass-type-title">
                          Round Trip Monthly Pass
                          {returnTrips.length === 0 && (
                            <span
                              style={{
                                display: "block",
                                fontSize: "10px",
                                color: "#ef4444",
                                fontWeight: "500",
                                marginTop: "4px",
                              }}
                            >
                              (No return trips available)
                            </span>
                          )}
                        </div>
                        <div className="pass-type-price">
                          {currency}{" "}
                          {getMonthlyPriceFor("ROUND_TRIP").toFixed(
                            currencyDecimals,
                          )}
                          /month
                        </div>
                        <div className="pass-type-subprice">
                          {currency}{" "}
                          {getPassTypeAmount("ROUND_TRIP").toFixed(
                            currencyDecimals,
                          )}{" "}
                          for {effectiveDuration} month
                          {effectiveDuration !== 1 ? "s" : ""}
                        </div>
                        <div className="pass-type-description">
                          Travel both directions (e.g., morning to work +
                          evening back home)
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* PICKUP/DROPOFF POINTS */}
              {selectedTrip && (
                <div className="points-selection-card">
                  <div className="points-selection-header">
                    <h3>
                      {selectedPassType === "ROUND_TRIP"
                        ? "Outbound Boarding Points"
                        : "Select Boarding Points"}
                    </h3>
                  </div>
                  <div className="points-selection-body">
                    <div className="point-selector">
                      <label>Pickup Point</label>
                      <select
                        value={selectedPickupPoint}
                        onChange={(e) => setSelectedPickupPoint(e.target.value)}
                        className="point-select"
                      >
                        <option value="">Select pickup point</option>
                        {getPickupPoints().map((point, index) => (
                          <option key={index} value={point.location}>
                            {point.location}
                            {point.time ? ` (${point.time})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="point-selector">
                      <label>Dropoff Point</label>
                      <select
                        value={selectedDropoffPoint}
                        onChange={(e) =>
                          setSelectedDropoffPoint(e.target.value)
                        }
                        className="point-select"
                      >
                        <option value="">Select dropoff point</option>
                        {getDropoffPoints().map((point, index) => (
                          <option key={index} value={point.location}>
                            {point.location}
                            {point.time ? ` (${point.time})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* RETURN TRIP POINTS FOR ROUND TRIP */}
              {selectedPassType === "ROUND_TRIP" && selectedReturnTrip && (
                <div className="points-selection-card">
                  <div className="points-selection-header">
                    <h3>Return Boarding Points</h3>
                  </div>
                  <div className="points-selection-body">
                    <div className="point-selector">
                      <label>Pickup Point</label>
                      <select
                        value={selectedReturnPickupPoint}
                        onChange={(e) =>
                          setSelectedReturnPickupPoint(e.target.value)
                        }
                        className="point-select"
                      >
                        <option value="">Select pickup point</option>
                        {getReturnPickupPoints().map((point, index) => (
                          <option key={index} value={point.location}>
                            {point.location}
                            {point.time ? ` (${point.time})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="point-selector">
                      <label>Dropoff Point</label>
                      <select
                        value={selectedReturnDropoffPoint}
                        onChange={(e) =>
                          setSelectedReturnDropoffPoint(e.target.value)
                        }
                        className="point-select"
                      >
                        <option value="">Select dropoff point</option>
                        {getReturnDropoffPoints().map((point, index) => (
                          <option key={index} value={point.location}>
                            {point.location}
                            {point.time ? ` (${point.time})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TRAVEL DAYS (LOCKED TO ROUTE AVAILABILITY) */}
              <div className="days-selection-card">
                <div className="days-selection-header">
                  <h3>
                    <FaCalendarAlt style={{ marginRight: 8 }} />
                    Route Travel Days
                  </h3>
                  <span className="days-count">
                    {routeDaysPerWeek} days/week
                  </span>
                </div>
                <div className="days-selection-body">
                  <div className="days-grid">
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((day) => {
                      const isAllowed = routeAllowedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`day-chip ${isAllowed ? "selected" : "disabled"}`}
                          disabled
                          title={
                            isAllowed
                              ? "This route operates on this day"
                              : "Route not available on this day"
                          }
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      marginTop: "12px",
                      fontSize: "13px",
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    This monthly pass covers all {routeDaysPerWeek} operating
                    days per week for this route. The pass price always includes
                    the route&apos;s full weekly schedule, even if you travel on
                    fewer days.
                  </p>
                </div>
              </div>

              {/* PASS DURATION */}
              <div className="duration-card">
                <div className="duration-header">
                  <h3>
                    <FaCalendarAlt style={{ marginRight: "8px" }} />
                    Pass Duration
                  </h3>
                </div>
                <div className="duration-body">
                  {/* Quick Duration Presets */}
                  <div
                    className="duration-presets"
                    style={{ marginBottom: "16px" }}
                  >
                    <label
                      style={{
                        marginBottom: "8px",
                        display: "block",
                        fontWeight: "500",
                      }}
                    >
                      Quick Select
                    </label>
                    <div
                      style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                    >
                      {[
                        { months: 1, label: "1 Month" },
                        { months: 2, label: "2 Months" },
                        { months: 3, label: "3 Months" },
                        { months: 6, label: "6 Months" },
                        { months: 12, label: "12 Months" },
                      ].map(({ months, label }) => (
                        <button
                          key={months}
                          type="button"
                          onClick={() => handleDurationChange(months)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border:
                              passDuration === months
                                ? "2px solid #10b981"
                                : "1px solid #e5e7eb",
                            backgroundColor:
                              passDuration === months ? "#ecfdf5" : "#fff",
                            color:
                              passDuration === months ? "#059669" : "#374151",
                            cursor: "pointer",
                            fontWeight: passDuration === months ? "600" : "400",
                            transition: "all 0.2s",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Flexible month stepper — pick ANY number of months
                        (2, 4, 5, 7, 8 ... or more). Minimum is 1 month. */}
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#374151",
                          fontWeight: "500",
                        }}
                      >
                        Or choose number of months:
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleDurationChange(Math.max(1, passDuration - 1))
                          }
                          disabled={passDuration <= 1}
                          aria-label="Decrease months"
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            backgroundColor:
                              passDuration <= 1 ? "#f3f4f6" : "#fff",
                            color: "#374151",
                            cursor:
                              passDuration <= 1 ? "not-allowed" : "pointer",
                            fontSize: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FaMinus />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={passDuration}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val))
                              handleDurationChange(
                                Math.min(60, Math.max(1, val)),
                              );
                          }}
                          style={{
                            width: "64px",
                            height: "36px",
                            textAlign: "center",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleDurationChange(passDuration + 1)}
                          aria-label="Increase months"
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            backgroundColor: "#fff",
                            color: "#374151",
                            cursor: "pointer",
                            fontSize: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <FaPlus />
                        </button>
                        <span style={{ fontSize: "13px", color: "#6b7280" }}>
                          month{passDuration !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div
                    className="custom-date-range"
                    style={{
                      backgroundColor: "#f9fafb",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <label
                      style={{
                        marginBottom: "12px",
                        display: "block",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Custom Date Range
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={passStartDate}
                          min={getMinDate()}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setPassStartDate(newStart);
                            // Re-anchor the end date so the pass keeps its
                            // selected month count from the new start date
                            // (minimum 1 month, calendar-accurate).
                            const startObj = new Date(newStart);
                            if (!isNaN(startObj.getTime())) {
                              const months = Math.max(1, passDuration);
                              const newEnd = computeEndDateForMonths(
                                startObj,
                                months,
                              );
                              setPassEndDate(formatLocalDate(newEnd));
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          value={passEndDate}
                          min={formatLocalDate(
                            computeEndDateForMonths(new Date(passStartDate), 1),
                          )}
                          onChange={(e) => {
                            const chosenEnd = e.target.value;
                            // Enforce a minimum of one full calendar month. If
                            // the user picks an earlier date, snap to the
                            // 1-month minimum end date.
                            const minEnd = computeEndDateForMonths(
                              new Date(passStartDate),
                              1,
                            );
                            const chosenObj = new Date(chosenEnd);
                            if (
                              isNaN(chosenObj.getTime()) ||
                              chosenObj < minEnd
                            ) {
                              setPassEndDate(formatLocalDate(minEnd));
                            } else {
                              setPassEndDate(chosenEnd);
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                          }}
                        />
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginTop: "4px",
                          }}
                        >
                          Minimum pass duration is 1 month.
                        </p>
                      </div>
                    </div>

                    {/* Duration Summary */}
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px",
                        backgroundColor: "#ecfdf5",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          Duration:{" "}
                        </span>
                        <span style={{ fontWeight: "600", color: "#059669" }}>
                          {effectiveDuration} month
                          {effectiveDuration !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          Travel Days:{" "}
                        </span>
                        <span style={{ fontWeight: "600", color: "#059669" }}>
                          {actualTravelDays} days
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="seats-selector">
                <label>Number of Seats</label>
                <div className="seats-control">
                  <button
                    className="seats-btn"
                    onClick={handleDecreaseSeats}
                    disabled={numberOfSeats <= 1}
                  >
                    <FaMinus />
                  </button>
                  <span className="seats-count">{numberOfSeats}</span>
                  <button
                    className="seats-btn"
                    onClick={handleIncreaseSeats}
                    disabled={numberOfSeats >= 1}
                  >
                    <FaPlus />
                  </button>
                </div>
                <span className="seats-available">1 seat per user</span>
              </div>

              <div className="notes-input">
                <label>Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>

              <div className="price-breakdown">
                <div className="price-row">
                  <span>Pass Type</span>
                  <span>
                    {selectedPassType === "ONE_WAY"
                      ? "One Way Monthly"
                      : "Round Trip Monthly"}
                  </span>
                </div>
                <div className="price-row">
                  <span>Monthly Price</span>
                  <span>
                    {currency} {monthlyPrice.toFixed(currencyDecimals)}/month
                  </span>
                </div>
                <div className="price-row">
                  <span>Pass Period</span>
                  <span>
                    {new Date(passStartDate).toLocaleDateString()} -{" "}
                    {new Date(passEndDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="price-row">
                  <span>Total Travel Days</span>
                  <span>
                    {actualTravelDays} days ({routeDaysPerWeek} days/week)
                  </span>
                </div>
                <div className="price-row">
                  <span>Number of seats</span>
                  <span>x {numberOfSeats}</span>
                </div>
                <div className="price-row">
                  <span>Duration</span>
                  <span>
                    {effectiveDuration} month
                    {effectiveDuration !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* {!isCorporate && (
                  <>
                    <div className="price-row sub">
                      <span>Admin Commission (20%)</span>
                      <span>{currency} {adminCommission}</span>
                    </div>
                    <div className="price-row sub">
                      <span>Driver Earnings (80%)</span>
                      <span>{currency} {driverEarnings}</span>
                    </div>
                  </>
                )} */}
                <div className="price-row total">
                  <span>
                    Total Amount ({effectiveDuration} month
                    {effectiveDuration !== 1 ? "s" : ""})
                  </span>
                  <span>
                    {currency} {totalAmount}
                  </span>
                </div>
              </div>

              {isCorporate && (
                <div className="corporate-notice">
                  <FaCheck className="notice-icon" />
                  <span>
                    As a corporate employee, no payment is required. Your
                    company covers the cost.
                  </span>
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleContinueToPayment}
                  disabled={
                    loading ||
                    isProcessing ||
                    (outboundTrips.length > 0 && !selectedTrip) ||
                    (selectedPassType === "ROUND_TRIP" &&
                      returnTrips.length === 0) ||
                    (selectedPassType === "ROUND_TRIP" && !selectedReturnTrip)
                  }
                  title={
                    outboundTrips.length > 0 && !selectedTrip
                      ? "Please select a trip time to continue."
                      : selectedPassType === "ROUND_TRIP" &&
                          returnTrips.length === 0
                        ? "No return trips available for this route. Please select One-Way Monthly Pass instead."
                        : selectedPassType === "ROUND_TRIP" &&
                            !selectedReturnTrip
                          ? "Please select a return trip to continue."
                          : ""
                  }
                >
                  {loading || isProcessing ? (
                    <>
                      <FaSpinner className="spinner" /> Processing...
                    </>
                  ) : selectedPassType === "ROUND_TRIP" &&
                    returnTrips.length === 0 ? (
                    "No Return Trips Available"
                  ) : isCorporate ? (
                    "Confirm Booking"
                  ) : (
                    "Continue to Payment"
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content step-payment">
              <div className="payment-amount-display">
                <span className="amount-label">Amount to Pay</span>
                <span className="amount-value">
                  {currency} {totalAmount}
                </span>
              </div>

              {/* <div className="commission-info">
                <div className="commission-row">
                  <span>Admin Commission (20%)</span>
                  <span>{currency} {adminCommission}</span>
                </div>
                <div className="commission-row highlight">
                  <span>Driver Earnings (80%)</span>
                  <span>{currency} {driverEarnings}</span>
                </div>
              </div> */}

              <div className="payment-methods">
                <h3>Choose Payment Method</h3>
                {loadingPaymentSettings ? (
                  <div className="loading-payment-settings">
                    <FaSpinner className="spinner" /> Loading payment options...
                  </div>
                ) : (
                  <div className="payment-options">
                    {/* Online Payment Methods - Only show if enabled by admin.
                        The online gateway is country specific:
                          - UAE routes (AED) -> Stripe (Credit/Debit Card)
                          - Kuwait routes (KWD) -> Tap Payments
                        so a UAE commuter never sees Tap and a Kuwait commuter
                        never sees Stripe. */}
                    {onlinePaymentsEnabled && (
                      <>
                        {onlineGateway === "STRIPE" && (
                          <div
                            className={`payment-option ${paymentMethod === "STRIPE" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                            onClick={() =>
                              !isProcessing &&
                              handleSelectPaymentMethod("STRIPE")
                            }
                          >
                            <div className="option-icon">
                              <FaCreditCard />
                            </div>
                            <div className="option-info">
                              <span className="option-title">
                                Credit/Debit Card
                              </span>
                              <span className="option-desc">
                                Pay securely with Stripe
                              </span>
                            </div>
                            {paymentMethod === "STRIPE" && isProcessing && (
                              <FaSpinner className="processing-spinner" />
                            )}
                          </div>
                        )}

                        {onlineGateway === "TAP" && (
                          <div
                            className={`payment-option ${paymentMethod === "TAP" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                            onClick={() =>
                              !isProcessing && handleSelectPaymentMethod("TAP")
                            }
                          >
                            <div className="option-icon">
                              <FaUniversity />
                            </div>
                            <div className="option-info">
                              <span className="option-title">Tap Payments</span>
                              <span className="option-desc">
                                Card, Apple Pay, Google Pay
                              </span>
                            </div>
                            {paymentMethod === "TAP" && isProcessing && (
                              <FaSpinner className="processing-spinner" />
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Cash Payment - Always available */}
                    <div
                      className={`payment-option ${paymentMethod === "CASH" ? "selected" : ""} ${isProcessing ? "disabled" : ""}`}
                      onClick={() =>
                        !isProcessing && handleSelectPaymentMethod("CASH")
                      }
                    >
                      <div className="option-icon">
                        <FaMoneyBillWave />
                      </div>
                      <div className="option-info">
                        <span className="option-title">Cash Payment</span>
                        <span className="option-desc">
                          Pay to driver on ride
                        </span>
                      </div>
                      {paymentMethod === "CASH" && isProcessing && (
                        <FaSpinner className="processing-spinner" />
                      )}
                    </div>

                    {/* Wallet Payment - available when balance covers the amount */}
                    {(() => {
                      const amountDue = Number.parseFloat(totalAmount) || 0;
                      const hasEnough = walletBalance >= amountDue;
                      const walletDisabled = isProcessing || !hasEnough;
                      return (
                        <div
                          className={`payment-option ${paymentMethod === "WALLET" ? "selected" : ""} ${walletDisabled ? "disabled" : ""}`}
                          onClick={() =>
                            !walletDisabled &&
                            handleSelectPaymentMethod("WALLET")
                          }
                        >
                          <div className="option-icon">
                            <FaWallet />
                          </div>
                          <div className="option-info">
                            <span className="option-title">Wallet Balance</span>
                            <span className="option-desc">
                              {hasEnough
                                ? `Pay using your wallet (${currency} ${walletBalance.toFixed(2)} available)`
                                : `Insufficient balance (${currency} ${walletBalance.toFixed(2)} available)`}
                            </span>
                          </div>
                          {paymentMethod === "WALLET" && isProcessing && (
                            <FaSpinner className="processing-spinner" />
                          )}
                        </div>
                      );
                    })()}

                    {/* Message when online payments are disabled */}
                    {!onlinePaymentsEnabled && (
                      <div className="payment-disabled-notice">
                        <span className="notice-icon">ℹ️</span>
                        <span>
                          Online payment methods are currently unavailable.
                          Please use cash payment.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content step-success">
              <div className="success-icon">
                <FaCheck />
              </div>
              <h3>
                {isCorporate ? "Booking Confirmed!" : "Request Submitted!"}
              </h3>
              <p className="success-message">
                {isCorporate
                  ? "Your corporate booking has been confirmed. Your company has been notified."
                  : paymentMethod === "CASH"
                    ? "Your request has been sent to the operator and is awaiting approval. Please pay the driver when you board once it is confirmed."
                    : paymentMethod === "WALLET"
                      ? "Your request has been submitted and the amount deducted from your wallet. It is now awaiting the operator's approval, and you'll be notified once it is confirmed (or refunded if declined)."
                      : "Your payment was received and your request is awaiting the operator's approval. You'll be notified once it is confirmed."}
              </p>

              <div className="booking-confirmation-details">
                <div className="detail-row">
                  <span className="detail-label">Booking ID</span>
                  <span className="detail-value">
                    {currentBooking?._id || "Generating..."}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pickup</span>
                  <span className="detail-value">{route.fromLocation}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Dropoff</span>
                  <span className="detail-value">{route.toLocation}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Seats</span>
                  <span className="detail-value">{numberOfSeats}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total Amount</span>
                  <span className="detail-value">
                    {currency} {totalAmount}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Payment Method</span>
                  <span className="detail-value">
                    {isCorporate ? "Corporate" : paymentMethod}
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-primary" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
