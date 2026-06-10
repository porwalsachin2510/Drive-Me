/* eslint-disable no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import "./b2c_addroutemodal.css";
import "./b2c_trip_stops.css";
import api from "../../../../utils/api";
import useCurrency from "../../../../hooks/useCurrency";
import { updateVehicleAvailabilityInStore } from "../../../../Redux/slices/b2cPartnerSlice";

function B2C_AddRouteModal({ onClose }) {
  const dispatch = useDispatch();
  const { formatAmount, getCurrencyDecimals, getCurrencySymbol } =
    useCurrency();
  const [currency, setCurrency] = useState("AED");
  const [decimals, setDecimals] = useState(2);

  // Helper function to get local date string in YYYY-MM-DD format
  // This avoids timezone shift issues that occur with toISOString()
  const getLocalDateString = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // New: Toggle between creating new route or adding schedule to existing route
  const [routeMode, setRouteMode] = useState("new"); // "new" or "existing"
  const [existingRoutes, setExistingRoutes] = useState([]);
  const [selectedExistingRoute, setSelectedExistingRoute] = useState(null);
  const [loadingExistingRoutes, setLoadingExistingRoutes] = useState(false);

  const [formData, setFormData] = useState({
    fromLocation: "",
    toLocation: "",
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    oneWayPrice: "",
    roundTripPrice: "",
    monthlyOneWayPrice: "",
    monthlyRoundTripPrice: "",
    tripTimes: [
      {
        departureTime: "",
        arrivalTime: "",
        tripType: "One Way",
        outboundStopPoints: [], // For One Way or Round Trip outbound journey
        returnStopPoints: [], // Only for Round Trip return journey
        assignedDriver: "", // Per-trip driver assignment (optional)
        assignedVehicle: "", // Per-trip vehicle assignment (optional)
      },
    ],
    vehicleId: "",
    driverId: "",
    routeStartDate: "",
    description: "",
    tags: [], // Selected tag IDs
  });
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [groupedTags, setGroupedTags] = useState({});
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [schedulingConflicts, setSchedulingConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [checkingDriverAvailability, setCheckingDriverAvailability] =
    useState(false);

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const tripTypes = ["One Way", "Round Trip"];

  // Fetch user's country and currency, then fetch vehicles and drivers
  useEffect(() => {
    fetchUserCountryAndAssets();
    fetchExistingRoutes();
  }, []);

  // Silent polling for real-time driver and vehicle availability updates
  useEffect(() => {
    // Poll for driver and vehicle availability every 5 seconds
    const pollAvailability = async () => {
      try {
        const [driversResponse, vehiclesResponse] = await Promise.all([
          api.get("/b2c-partner/drivers"),
          api.get("/b2c-partner/fleet"),
        ]);
        if (driversResponse.data.drivers) {
          setAvailableDrivers(driversResponse.data.drivers);
        }
        if (vehiclesResponse.data.fleet?.vehicles) {
          setAvailableVehicles(vehiclesResponse.data.fleet.vehicles);
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
      }
    };

    // Start polling interval
    const pollInterval = setInterval(pollAvailability, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  // Fetch existing routes for the "Add Schedule to Existing Route" mode
  const fetchExistingRoutes = async () => {
    try {
      setLoadingExistingRoutes(true);
      const response = await api.get("/b2c-schedules/routes");
      setExistingRoutes(response.data.routes || []);
    } catch (error) {
      console.error("Error fetching existing routes:", error);
      setExistingRoutes([]);
    } finally {
      setLoadingExistingRoutes(false);
    }
  };

  // Handle selecting an existing route - auto-populate form data
  const handleSelectExistingRoute = (routeId) => {
    const route = existingRoutes.find((r) => r._id === routeId);
    if (route) {
      setSelectedExistingRoute(route);

      // Auto-populate form data from the selected route
      setFormData((prev) => ({
        ...prev,
        fromLocation: route.fromLocation || "",
        toLocation: route.toLocation || "",
        availableDays: route.schedules?.[0]?.availableDays ||
          route.availableDays || ["MON", "TUE", "WED", "THU", "FRI"],
        oneWayPrice: route.pricing?.oneWayPrice?.toString() || "",
        roundTripPrice: route.pricing?.roundTripPrice?.toString() || "",
        monthlyOneWayPrice: route.pricing?.monthlyOneWayPrice?.toString() || "",
        monthlyRoundTripPrice:
          route.pricing?.monthlyRoundTripPrice?.toString() || "",
        vehicleId: route.assignedVehicle?._id || route.assignedVehicle || "",
        driverId:
          route.assignedDriver?._id ||
          route.driverInfo?._id ||
          route.assignedDriver ||
          "",
        routeStartDate: route.routeStartDate
          ? getLocalDateString(new Date(route.routeStartDate))
          : getLocalDateString(),
        description: route.description || "",
        tags: route.tags?.map((t) => t._id || t) || [],
        totalSeats: route.totalSeats || 0,
        availableSeats: route.availableSeats || 0,
        // Reset trip times for new schedule
        tripTimes: [
          {
            departureTime: "",
            arrivalTime: "",
            tripType: "One Way",
            outboundStopPoints: [],
            returnStopPoints: [],
            assignedDriver: "", // Per-trip driver (optional)
            assignedVehicle: "", // Per-trip vehicle (optional)
          },
        ],
      }));

      // Set currency from route
      if (route.pricing?.currency) {
        setCurrency(route.pricing.currency);
      }
    } else {
      setSelectedExistingRoute(null);
    }
  };

  // Handle route mode change
  const handleRouteModeChange = (mode) => {
    setRouteMode(mode);
    if (mode === "new") {
      // Reset form to blank state
      setSelectedExistingRoute(null);
      setFormData({
        fromLocation: "",
        toLocation: "",
        availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
        oneWayPrice: "",
        roundTripPrice: "",
        monthlyOneWayPrice: "",
        monthlyRoundTripPrice: "",
        tripTimes: [
          {
            departureTime: "",
            arrivalTime: "",
            tripType: "One Way",
            outboundStopPoints: [],
            returnStopPoints: [],
            assignedDriver: "", // Per-trip driver (optional)
            assignedVehicle: "", // Per-trip vehicle (optional)
          },
        ],
        vehicleId: "",
        driverId: "",
        routeStartDate: "",
        description: "",
        tags: [],
      });
    }
  };

  const fetchUserCountryAndAssets = async () => {
    try {
      setLoadingAssets(true);

      // Fetch user's country to get currency
      const userResponse = await api.get("/users/me");
      const userCountry = userResponse.data?.user?.country || "KW";

      // Map country to currency
      const countryToCurrency = {
        UAE: "AED",
        KW: "KWD",
        SA: "SAR",
        BH: "BHD",
        OM: "OMR",
        QA: "QAR",
      };

      const userCurrency = countryToCurrency[userCountry] || "AED";
      const userDecimals = getCurrencyDecimals(userCurrency);

      console.log(
        "[v0] User country:",
        userCountry,
        "Currency:",
        userCurrency,
        "Decimals:",
        userDecimals,
      );

      setCurrency(userCurrency);
      setDecimals(userDecimals);

      // Fetch vehicles, drivers, and tags from B2C partner fleet
      // Use context="route" to get route, promo, and general tags
      const [vehiclesResponse, driversResponse, tagsResponse] =
        await Promise.all([
          api.get("/b2c-partner/fleet"),
          api.get("/b2c-partner/drivers"),
          api.get("/admin/tags/by-category", { params: { context: "route" } }),
        ]);

      setAvailableVehicles(vehiclesResponse.data.fleet?.vehicles || []);
      setAvailableDrivers(driversResponse.data.drivers || []);
      setAvailableTags(tagsResponse.data.tags || []);
      setGroupedTags(tagsResponse.data.groupedTags || {});
    } catch (error) {
      console.error("Error fetching assets:", error);
      // Fallback to empty arrays if API fails
      setAvailableVehicles([]);
      setAvailableDrivers([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle tag selection toggle
  const handleTagToggle = (tagId) => {
    setFormData((prev) => {
      const updatedTags = prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId];
      return { ...prev, tags: updatedTags };
    });
  };

  const handleDayChange = (day) => {
    setFormData((prev) => {
      const updatedDays = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];

      const updatedData = { ...prev, availableDays: updatedDays };

      // Recalculate monthly prices when days change
      if (prev.oneWayPrice || prev.roundTripPrice) {
        const { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth } =
          calculateMonthlyPrices(
            updatedData.oneWayPrice,
            updatedData.roundTripPrice,
            updatedDays,
          );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
        updatedData.workingDaysPerMonth = workingDaysPerMonth;
      }

      // Check for conflicts and refresh driver availability when days change
      setTimeout(() => {
        checkConflicts(
          prev.driverId,
          prev.vehicleId,
          prev.tripTimes,
          updatedDays,
        );
        refreshDriverAvailability(
          prev.tripTimes,
          updatedDays,
          prev.routeStartDate,
        );
      }, 300);

      return updatedData;
    });
  };

  const addStopPoint = () => {
    setFormData((prev) => ({
      ...prev,
      stopPoints: [...prev.stopPoints, { location: "", time: "" }],
    }));
  };

  const updateStopPoint = (index, field, value) => {
    setFormData((prev) => {
      const updatedStopPoints = [...prev.stopPoints];
      updatedStopPoints[index] = {
        ...updatedStopPoints[index],
        [field]: value,
      };
      return { ...prev, stopPoints: updatedStopPoints };
    });
  };

  const removeStopPoint = (index) => {
    setFormData((prev) => ({
      ...prev,
      stopPoints: prev.stopPoints.filter((_, i) => i !== index),
    }));
  };

  // Track which drivers/vehicles are assigned within the current modal session
  // This prevents the same driver/vehicle from showing as "available" in multiple trips
  const getAssignedDriversInModal = () => {
    const assigned = new Set();
    formData.tripTimes.forEach((tripTime) => {
      if (tripTime.assignedDriver) {
        assigned.add(tripTime.assignedDriver);
      }
    });
    return assigned;
  };

  const getAssignedVehiclesInModal = () => {
    const assigned = new Set();
    formData.tripTimes.forEach((tripTime) => {
      if (tripTime.assignedVehicle) {
        assigned.add(tripTime.assignedVehicle);
      }
    });
    return assigned;
  };

  // Check if a driver is assigned to another trip in this modal
  const isDriverAssignedInOtherTrip = (driverId, currentTripIndex) => {
    return formData.tripTimes.some(
      (tripTime, idx) =>
        idx !== currentTripIndex && tripTime.assignedDriver === driverId,
    );
  };

  // Check if a vehicle is assigned to another trip in this modal
  const isVehicleAssignedInOtherTrip = (vehicleId, currentTripIndex) => {
    return formData.tripTimes.some(
      (tripTime, idx) =>
        idx !== currentTripIndex && tripTime.assignedVehicle === vehicleId,
    );
  };

  // Trip time management functions
  const addTripTime = () => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: [
        ...prev.tripTimes,
        {
          departureTime: "",
          arrivalTime: "",
          tripType: "One Way",
          outboundStopPoints: [], // For One Way or Round Trip outbound journey
          returnStopPoints: [], // Only for Round Trip return journey
          assignedDriver: "", // Per-trip driver assignment (optional)
          assignedVehicle: "", // Per-trip vehicle assignment (optional)
        },
      ],
    }));
  };

  const updateTripTime = (index, field, value) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      updatedTripTimes[index] = { ...updatedTripTimes[index], [field]: value };

      // Check conflicts and refresh driver availability when departure time changes
      if (field === "departureTime" && value) {
        // Use setTimeout to debounce the checks
        setTimeout(() => {
          checkConflicts(
            prev.driverId,
            prev.vehicleId,
            updatedTripTimes,
            prev.availableDays,
          );
          refreshDriverAvailability(
            updatedTripTimes,
            prev.availableDays,
            prev.routeStartDate,
          );
        }, 500);
      }

      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  // Stop point management for individual trips
  const addStopPointToTrip = (tripIndex, journeyType) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: [
          ...updatedTripTimes[tripIndex][stopArray],
          { location: "", time: "" },
        ],
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const updateTripStopPoint = (
    tripIndex,
    stopIndex,
    field,
    value,
    journeyType,
  ) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      const updatedStopPoints = [...updatedTripTimes[tripIndex][stopArray]];
      updatedStopPoints[stopIndex] = {
        ...updatedStopPoints[stopIndex],
        [field]: value,
      };
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: updatedStopPoints,
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const removeStopPointFromTrip = (tripIndex, stopIndex, journeyType) => {
    setFormData((prev) => {
      const updatedTripTimes = [...prev.tripTimes];
      const stopArray =
        journeyType === "outbound" ? "outboundStopPoints" : "returnStopPoints";
      updatedTripTimes[tripIndex] = {
        ...updatedTripTimes[tripIndex],
        [stopArray]: updatedTripTimes[tripIndex][stopArray].filter(
          (_, i) => i !== stopIndex,
        ),
      };
      return { ...prev, tripTimes: updatedTripTimes };
    });
  };

  const removeTripTime = (index) => {
    setFormData((prev) => ({
      ...prev,
      tripTimes: prev.tripTimes.filter((_, i) => i !== index),
    }));
  };

  // Refresh driver availability based on trip times and available days
  const refreshDriverAvailability = async (
    tripTimes,
    availableDays,
    routeStartDate,
  ) => {
    const validTripTimes = tripTimes.filter((t) => t.departureTime);
    if (validTripTimes.length === 0) return;

    setCheckingDriverAvailability(true);
    try {
      const response = await api.post("/b2c-partner/drivers/availability", {
        tripTimes: validTripTimes.map((t) => ({
          departureTime: t.departureTime,
          arrivalTime: t.arrivalTime,
          tripType: t.tripType,
        })),
        availableDays:
          availableDays.length > 0
            ? availableDays
            : ["MON", "TUE", "WED", "THU", "FRI"],
        routeStartDate: routeStartDate || getLocalDateString(),
      });

      if (response.data.success && response.data.drivers) {
        setAvailableDrivers(response.data.drivers);
      }
    } catch (error) {
      console.error("Error refreshing driver availability:", error);
    } finally {
      setCheckingDriverAvailability(false);
    }
  };

  // Check for scheduling conflicts (supports per-trip driver/vehicle)
  const checkConflicts = async (
    driverId,
    vehicleId,
    tripTimes,
    availableDays,
  ) => {
    // Only check if we have driver or vehicle (default or per-trip) and at least one trip time
    const validTripTimes = tripTimes.filter((t) => t.departureTime);
    const hasAnyDriver =
      driverId || validTripTimes.some((t) => t.assignedDriver);
    const hasAnyVehicle =
      vehicleId || validTripTimes.some((t) => t.assignedVehicle);

    if ((!hasAnyDriver && !hasAnyVehicle) || validTripTimes.length === 0) {
      setSchedulingConflicts([]);
      return;
    }

    setCheckingConflicts(true);
    try {
      // Include per-trip driver/vehicle assignments in the conflict check
      const tripTimesWithAssignments = validTripTimes.map((t) => ({
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        tripType: t.tripType,
        assignedDriver: t.assignedDriver || null,
        assignedVehicle: t.assignedVehicle || null,
      }));

      const response = await api.post("/b2c-schedules/check-conflicts", {
        driverId: driverId || null,
        vehicleId: vehicleId || null,
        tripTimes: tripTimesWithAssignments,
        availableDays:
          availableDays.length > 0
            ? availableDays
            : ["MON", "TUE", "WED", "THU", "FRI"],
      });

      if (response.data.hasConflicts) {
        setSchedulingConflicts(response.data.conflicts);
      } else {
        setSchedulingConflicts([]);
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
      setSchedulingConflicts([]);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Handle vehicle selection change - update seats automatically
  const handleVehicleChange = (e) => {
    const selectedVehicleId = e.target.value;
    const selectedVehicle = availableVehicles.find(
      (v) => v._id === selectedVehicleId,
    );

    setFormData((prev) => {
      const newFormData = {
        ...prev,
        vehicleId: selectedVehicleId,
        // Auto-populate seats from vehicle
        totalSeats: selectedVehicle?.seatingCapacity || 0,
        availableSeats: selectedVehicle?.seatingCapacity || 0,
      };

      // Check conflicts with new vehicle
      checkConflicts(
        prev.driverId,
        selectedVehicleId,
        prev.tripTimes,
        prev.availableDays,
      );

      return newFormData;
    });
  };

  // Handle driver selection change
  const handleDriverChange = (e) => {
    const selectedDriverId = e.target.value;

    setFormData((prev) => {
      const newFormData = {
        ...prev,
        driverId: selectedDriverId,
      };

      // Check conflicts with new driver
      checkConflicts(
        selectedDriverId,
        prev.vehicleId,
        prev.tripTimes,
        prev.availableDays,
      );

      return newFormData;
    });
  };

  // Auto-calculate monthly prices based on reference prices
  const calculateMonthlyPrices = (
    oneWayPrice,
    roundTripPrice,
    availableDays,
  ) => {
    // Calculate working days based on available days selection
    const daysPerWeek = availableDays.length;
    const weeksPerMonth = 4.33; // Average weeks in a month
    const workingDaysPerMonth = Math.round(daysPerWeek * weeksPerMonth);

    const monthlyOneWay = oneWayPrice
      ? (parseFloat(oneWayPrice) * workingDaysPerMonth).toFixed(2)
      : "";
    const monthlyRoundTrip = roundTripPrice
      ? (parseFloat(roundTripPrice) * workingDaysPerMonth).toFixed(2)
      : "";

    return { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth };
  };

  // Handle reference price changes - auto-calculate monthly prices
  const handlePriceChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedData = { ...prev, [name]: value };

      // Auto-calculate monthly prices when reference prices change
      if (name === "oneWayPrice" || name === "roundTripPrice") {
        const { monthlyOneWay, monthlyRoundTrip, workingDaysPerMonth } =
          calculateMonthlyPrices(
            name === "oneWayPrice" ? value : updatedData.oneWayPrice,
            name === "roundTripPrice" ? value : updatedData.roundTripPrice,
            updatedData.availableDays,
          );

        updatedData.monthlyOneWayPrice = monthlyOneWay;
        updatedData.monthlyRoundTripPrice = monthlyRoundTrip;
        updatedData.workingDaysPerMonth = workingDaysPerMonth;
      }

      return updatedData;
    });
  };

  // Helper function to update assigned vehicles in Redux after schedule creation
  const updateAssignedVehiclesInRedux = (validTripTimes) => {
    // Collect all unique vehicles assigned in trip times
    const assignedVehicleIds = new Set();

    validTripTimes.forEach((tripTime) => {
      if (tripTime.assignedVehicle) {
        assignedVehicleIds.add(tripTime.assignedVehicle);
      }
    });

    // If a vehicle is assigned to any trip, mark it as busy in Redux
    assignedVehicleIds.forEach((vehicleId) => {
      dispatch(
        updateVehicleAvailabilityInStore({
          vehicleId,
          availabilityStatus: "busy",
        }),
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate at least one trip time is filled
      const validTripTimes = formData.tripTimes.filter(
        (trip) => trip.departureTime,
      );
      if (validTripTimes.length === 0) {
        alert("Please add at least one departure time");
        setLoading(false);
        return;
      }

      // Validate round trip times have return times
      const invalidRoundTrips = validTripTimes.filter(
        (trip) => trip.tripType === "Round Trip" && !trip.arrivalTime,
      );
      if (invalidRoundTrips.length > 0) {
        alert("Round trips must have return times");
        setLoading(false);
        return;
      }

      // Check for scheduling conflicts before creating
      if (formData.driverId || formData.vehicleId) {
        try {
          const conflictCheckResponse = await api.post(
            "/b2c-schedules/check-conflicts",
            {
              driverId: formData.driverId || null,
              vehicleId: formData.vehicleId || null,
              tripTimes: validTripTimes,
              availableDays:
                formData.availableDays.length > 0
                  ? formData.availableDays
                  : ["MON", "TUE", "WED", "THU", "FRI"],
            },
          );

          if (conflictCheckResponse.data.hasConflicts) {
            const conflicts = conflictCheckResponse.data.conflicts;
            const conflictMessages = conflicts
              .map((c) => {
                const resourceType = c.type === "DRIVER" ? "Driver" : "Vehicle";
                return `${resourceType} is already assigned to "${c.existingRoute}" at ${c.conflictingTime} on ${c.overlappingDays?.join(", ")}`;
              })
              .join("\n\n");

            const confirmCreate = window.confirm(
              `Scheduling Conflicts Detected!\n\n${conflictMessages}\n\nDo you still want to continue? The driver/vehicle will be double-booked.`,
            );

            if (!confirmCreate) {
              setLoading(false);
              return;
            }
          }
        } catch (conflictError) {
          console.error("Error checking conflicts:", conflictError);
          // Continue with route creation even if conflict check fails
        }
      }

      // Handle "existing route" mode - just add new schedule to existing route
      if (routeMode === "existing" && selectedExistingRoute) {
        // For existing route, we just add a new schedule
        const scheduleData = {
          routeId: selectedExistingRoute._id,
          scheduleName: `${selectedExistingRoute.fromLocation} to ${selectedExistingRoute.toLocation} - New Schedule`,
          tripTimes: validTripTimes,
          availableDays:
            formData.availableDays.length > 0
              ? formData.availableDays
              : ["MON", "TUE", "WED", "THU", "FRI"],
          assignedVehicle:
            formData.vehicleId ||
            selectedExistingRoute.assignedVehicle?._id ||
            selectedExistingRoute.assignedVehicle,
          assignedDriver:
            formData.driverId ||
            selectedExistingRoute.assignedDriver?._id ||
            selectedExistingRoute.driverInfo?._id ||
            selectedExistingRoute.assignedDriver,
          startDate: formData.routeStartDate || getLocalDateString(),
          notes: `Additional schedule for ${selectedExistingRoute.fromLocation} → ${selectedExistingRoute.toLocation}`,
        };

        const scheduleResponse = await api.post(
          "/b2c-schedules/schedules",
          scheduleData,
        );

        if (scheduleResponse.data.success) {
          // Check if it was an update (merged with existing) or new creation
          const isUpdate = scheduleResponse.data.isUpdate;
          alert(
            isUpdate
              ? "New trip times added to existing schedule successfully!"
              : "New schedule added to existing route! Trips will be generated automatically.",
          );

          // Update assigned vehicles in Redux for real-time UI update
          updateAssignedVehiclesInRedux(validTripTimes);

          onClose();
          // Trigger parent refresh
          if (window.onRouteCreated) {
            window.onRouteCreated();
          } else {
            window.location.reload();
          }
        }
        return;
      }

      // Handle "new route" mode - create new route first
      // Calculate seats from first trip's vehicle or use default
      const firstTripVehicle = formData.tripTimes.find(
        (t) => t.assignedVehicle,
      )?.assignedVehicle;
      const vehicleForSeats = availableVehicles.find(
        (v) => v._id === firstTripVehicle,
      );
      const calculatedSeats = vehicleForSeats?.seatingCapacity || 20;

      const routeData = {
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        totalSeats: calculatedSeats,
        availableSeats: calculatedSeats,
        pricing: {
          oneWayPrice: parseFloat(formData.oneWayPrice) || 0,
          roundTripPrice: parseFloat(formData.roundTripPrice) || 0,
          monthlyOneWayPrice: parseFloat(formData.monthlyOneWayPrice) || 0,
          monthlyRoundTripPrice:
            parseFloat(formData.monthlyRoundTripPrice) || 0,
          currency: currency,
        },
        assignedVehicle: formData.vehicleId || null,
        assignedDriver: formData.driverId || null,
        routeStartDate: formData.routeStartDate || getLocalDateString(),
        description: formData.description,
        tags: formData.tags || [], // Include selected tags
      };

      const routeResponse = await api.post("/b2c-schedules/routes", routeData);

      if (routeResponse.data.success) {
        const createdRoute = routeResponse.data.route;

        // Always create schedule with provided trip times
        const scheduleData = {
          routeId: createdRoute._id,
          scheduleName: `${createdRoute.fromLocation} to ${createdRoute.toLocation} Schedule`,
          tripTimes: validTripTimes,
          availableDays:
            formData.availableDays.length > 0
              ? formData.availableDays
              : ["MON", "TUE", "WED", "THU", "FRI"],
          assignedVehicle: formData.vehicleId,
          assignedDriver: formData.driverId,
          startDate: formData.routeStartDate || getLocalDateString(),
          notes: `Auto-created schedule for ${createdRoute.fromLocation} → ${createdRoute.toLocation}`,
        };

        const scheduleResponse = await api.post(
          "/b2c-schedules/schedules",
          scheduleData,
        );

        if (scheduleResponse.data.success) {
          alert(
            "Route and Schedule created successfully! Trips will be generated automatically.",
          );

          // Update assigned vehicles in Redux for real-time UI update
          updateAssignedVehiclesInRedux(validTripTimes);
        }

        onClose();
        // Trigger parent refresh
        if (window.onRouteCreated) {
          window.onRouteCreated();
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Error creating route:", error);

      // Handle specific conflict errors from backend
      if (error.response?.data?.conflictDetails) {
        const conflict = error.response.data.conflictDetails;
        const conflictMessage =
          error.response.data.message ||
          `Scheduling conflict detected! The selected ${conflict.conflictType.includes("DRIVER") ? "driver" : "vehicle"} is already assigned to route "${conflict.existingRoute}" at ${conflict.conflictingTime} on ${conflict.overlappingDays?.join(", ")}. Please choose a different time, ${conflict.conflictType.includes("DRIVER") ? "driver" : "vehicle"}, or days.`;
        alert(conflictMessage);
      } else if (error.response?.data?.message) {
        // Handle other backend validation errors
        alert(error.response.data.message);
      } else {
        alert("Failed to create route. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay">
      <div className="b2c-modal-content">
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">
            {routeMode === "existing"
              ? "Add Schedule to Existing Route"
              : "Add New Route"}
          </h2>
          <button className="b2c-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 6L18 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2c-modal-form">
          {/* Route Mode Selector */}
          <div className="b2c-form-section b2c-route-mode-section">
            <div className="b2c-route-mode-selector">
              <button
                type="button"
                className={`b2c-route-mode-btn ${routeMode === "new" ? "active" : ""}`}
                onClick={() => handleRouteModeChange("new")}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Create New Route
              </button>
              <button
                type="button"
                className={`b2c-route-mode-btn ${routeMode === "existing" ? "active" : ""}`}
                onClick={() => handleRouteModeChange("existing")}
                disabled={existingRoutes.length === 0}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Add to Existing Route ({existingRoutes.length})
              </button>
            </div>
            {routeMode === "existing" && existingRoutes.length === 0 && (
              <p className="b2c-no-routes-message">
                No existing routes found. Please create a new route first.
              </p>
            )}
          </div>

          {/* Existing Route Selector - Only show when in "existing" mode */}
          {routeMode === "existing" && existingRoutes.length > 0 && (
            <div className="b2c-form-section b2c-existing-route-section">
              <h3 className="b2c-section-title">Select Existing Route</h3>
              <p className="b2c-section-description">
                Choose an existing route to add a new schedule/trip time. Route
                details will be auto-filled.
              </p>

              <div className="b2c-form-row">
                <div className="b2c-form-group full-width">
                  <label className="b2c-form-label">Select Route *</label>
                  <select
                    value={selectedExistingRoute?._id || ""}
                    onChange={(e) => handleSelectExistingRoute(e.target.value)}
                    required={routeMode === "existing"}
                    className="b2c-form-input b2c-route-select"
                  >
                    <option value="">-- Select an existing route --</option>
                    {existingRoutes.map((route) => (
                      <option key={route._id} value={route._id}>
                        {route.fromLocation} → {route.toLocation}
                        {route.status !== "Active" ? ` (${route.status})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Route Info Card */}
              {selectedExistingRoute && (
                <div className="b2c-selected-route-card">
                  <div className="b2c-selected-route-header">
                    <div className="b2c-selected-route-locations">
                      <span className="b2c-location-badge from">
                        {selectedExistingRoute.fromLocation}
                      </span>
                      <span className="b2c-route-arrow">→</span>
                      <span className="b2c-location-badge to">
                        {selectedExistingRoute.toLocation}
                      </span>
                    </div>
                    <span
                      className={`b2c-status-badge ${selectedExistingRoute.status?.toLowerCase()}`}
                    >
                      {selectedExistingRoute.status}
                    </span>
                  </div>
                  <div className="b2c-selected-route-details">
                    <div className="b2c-detail-item">
                      <span className="b2c-detail-label">Vehicle:</span>
                      <span className="b2c-detail-value">
                        {selectedExistingRoute.assignedVehicle?.model ||
                          "Not assigned"}
                      </span>
                    </div>
                    <div className="b2c-detail-item">
                      <span className="b2c-detail-label">Driver:</span>
                      <span className="b2c-detail-value">
                        {selectedExistingRoute.driverInfo?.name ||
                          selectedExistingRoute.assignedDriver?.name ||
                          "Self"}
                      </span>
                    </div>
                    <div className="b2c-detail-item">
                      <span className="b2c-detail-label">Price:</span>
                      <span className="b2c-detail-value">
                        {selectedExistingRoute.pricing?.currency || "AED"}{" "}
                        {selectedExistingRoute.pricing?.oneWayPrice || 0} (One
                        Way)
                        {selectedExistingRoute.pricing?.roundTripPrice > 0 &&
                          ` / ${selectedExistingRoute.pricing?.currency || "AED"} ${selectedExistingRoute.pricing?.roundTripPrice} (Round Trip)`}
                      </span>
                    </div>
                  </div>
                  <div className="b2c-selected-route-help">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    >
                      <path
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>
                      Route selected. Now add a new trip time/schedule below.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Basic Route Information - Only show for new routes */}
          {routeMode === "new" && (
            <div className="b2c-form-section">
              <h3 className="b2c-section-title">Basic Route Information</h3>

              <div className="b2c-form-row">
                <div className="b2c-form-group">
                  <label htmlFor="fromLocation" className="b2c-form-label">
                    From Location *
                  </label>
                  <input
                    type="text"
                    id="fromLocation"
                    name="fromLocation"
                    placeholder="e.g. Dubai Marina"
                    value={formData.fromLocation}
                    onChange={handleChange}
                    required
                    className="b2c-form-input"
                  />
                </div>

                <div className="b2c-form-group">
                  <label htmlFor="toLocation" className="b2c-form-label">
                    To Location *
                  </label>
                  <input
                    type="text"
                    id="toLocation"
                    name="toLocation"
                    placeholder="e.g. Abu Dhabi City"
                    value={formData.toLocation}
                    onChange={handleChange}
                    required
                    className="b2c-form-input"
                  />
                </div>
              </div>

              <div className="b2c-form-row">
                <div className="b2c-form-group">
                  <label htmlFor="routeStartDate" className="b2c-form-label">
                    Route Start Date *
                  </label>
                  <input
                    type="date"
                    id="routeStartDate"
                    name="routeStartDate"
                    value={formData.routeStartDate}
                    onChange={handleChange}
                    required
                    className="b2c-form-input"
                  />
                </div>
              </div>

              <div className="b2c-form-row">
                <div className="b2c-form-group">
                  <label className="b2c-form-label">Available Days *</label>
                  <div className="b2c-days-selector">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`b2c-day-btn ${
                          formData.availableDays.includes(day) ? "selected" : ""
                        }`}
                        onClick={() => handleDayChange(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="b2c-form-row full">
                <div className="b2c-form-group">
                  <label htmlFor="description" className="b2c-form-label">
                    Route Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Describe your route, landmarks, etc."
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="b2c-form-input"
                  ></textarea>
                </div>
              </div>

              {/* Route Tags Section - Grouped by Category */}
              {availableTags.length > 0 && (
                <div className="b2c-form-row full">
                  <div className="b2c-form-group">
                    <label className="b2c-form-label">Route Tags</label>
                    <p className="b2c-form-help-text">
                      Select tags to help passengers find your route easily.
                      Tags are organized by category.
                    </p>

                    {Object.entries(groupedTags).map(([category, tags]) => (
                      <div key={category} className="b2c-tag-category-group">
                        <span className="b2c-tag-category-label">
                          {category === "route"
                            ? "Route Tags"
                            : category === "promo"
                              ? "Promotional Tags"
                              : category === "general"
                                ? "General Tags"
                                : category.charAt(0).toUpperCase() +
                                  category.slice(1) +
                                  " Tags"}
                          :
                        </span>
                        <div className="b2c-tags-selector">
                          {tags.map((tag) => (
                            <button
                              key={tag._id}
                              type="button"
                              className={`b2c-tag-btn ${formData.tags.includes(tag._id) ? "selected" : ""}`}
                              onClick={() => handleTagToggle(tag._id)}
                              style={{
                                backgroundColor: formData.tags.includes(tag._id)
                                  ? tag.color
                                  : "#f3f4f6",
                                color: formData.tags.includes(tag._id)
                                  ? tag.textColor
                                  : "#374151",
                                borderColor: tag.color,
                              }}
                              title={tag.description || tag.label}
                            >
                              {tag.icon && (
                                <span className="b2c-tag-icon">{tag.icon}</span>
                              )}
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">
              {routeMode === "existing" ? "New Trip Times" : "Trip Times"}
            </h3>
            <p className="b2c-section-description">
              {routeMode === "existing"
                ? "Add new departure times for this existing route. These will create additional trips that passengers can book."
                : "Add multiple departure times for this route. Each time will create separate trips that passengers can book."}
            </p>

            <div className="b2c-trip-times-container">
              {formData.tripTimes.map((tripTime, index) => (
                <div key={index} className="b2c-trip-time-item">
                  <div className="b2c-trip-time-header">
                    <span className="b2c-trip-time-number">
                      Trip {index + 1}
                    </span>
                    {formData.tripTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTripTime(index)}
                        className="b2c-remove-trip-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="b2c-form-row">
                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Departure Time *</label>
                      <input
                        type="time"
                        value={tripTime.departureTime}
                        onChange={(e) =>
                          updateTripTime(index, "departureTime", e.target.value)
                        }
                        required
                        className="b2c-form-input"
                      />
                    </div>

                    {tripTime.tripType === "Round Trip" && (
                      <div className="b2c-form-group">
                        <label className="b2c-form-label">Return Time *</label>
                        <input
                          type="time"
                          value={tripTime.arrivalTime}
                          onChange={(e) =>
                            updateTripTime(index, "arrivalTime", e.target.value)
                          }
                          required={tripTime.tripType === "Round Trip"}
                          className="b2c-form-input"
                        />
                        <small className="b2c-form-help">
                          Time when bus returns from destination
                        </small>
                      </div>
                    )}

                    <div className="b2c-form-group">
                      <label className="b2c-form-label">Trip Type</label>
                      <select
                        value={tripTime.tripType}
                        onChange={(e) =>
                          updateTripTime(index, "tripType", e.target.value)
                        }
                        className="b2c-form-input"
                      >
                        {tripTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stop Points for this specific trip */}
                  <div className="b2c-trip-stop-points">
                    {/* Outbound Stop Points */}
                    <div className="b2c-journey-stop-points">
                      <div className="b2c-stop-points-header">
                        <h5 className="b2c-stop-points-title">
                          🛑 Outbound Stops: {formData.fromLocation} →{" "}
                          {formData.toLocation}
                        </h5>
                        <button
                          type="button"
                          onClick={() => addStopPointToTrip(index, "outbound")}
                          className="b2c-add-stop-btn"
                        >
                          + Add Outbound Stop
                        </button>
                      </div>

                      {tripTime.outboundStopPoints.length === 0 ? (
                        <p className="b2c-no-stops">
                          No outbound stops. Bus will go directly from{" "}
                          {formData.fromLocation} to {formData.toLocation}.
                        </p>
                      ) : (
                        <div className="b2c-stops-list">
                          {tripTime.outboundStopPoints.map(
                            (stop, stopIndex) => (
                              <div key={stopIndex} className="b2c-stop-item">
                                <div className="b2c-stop-number">
                                  {stopIndex + 1}
                                </div>
                                <div className="b2c-stop-details">
                                  <input
                                    type="text"
                                    placeholder="Stop location (e.g., Dubai Mall)"
                                    value={stop.location}
                                    onChange={(e) =>
                                      updateTripStopPoint(
                                        index,
                                        stopIndex,
                                        "location",
                                        e.target.value,
                                        "outbound",
                                      )
                                    }
                                    className="b2c-stop-location"
                                  />
                                  <input
                                    type="time"
                                    placeholder="Arrival time"
                                    value={stop.time}
                                    onChange={(e) =>
                                      updateTripStopPoint(
                                        index,
                                        stopIndex,
                                        "time",
                                        e.target.value,
                                        "outbound",
                                      )
                                    }
                                    className="b2c-stop-time"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeStopPointFromTrip(
                                      index,
                                      stopIndex,
                                      "outbound",
                                    )
                                  }
                                  className="b2c-remove-stop-btn"
                                >
                                  ×
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    {/* Return Stop Points (only for Round Trip) */}
                    {tripTime.tripType === "Round Trip" && (
                      <div className="b2c-journey-stop-points">
                        <div className="b2c-stop-points-header">
                          <h5 className="b2c-stop-points-title">
                            🔄 Return Stops: {formData.toLocation} →{" "}
                            {formData.fromLocation}
                          </h5>
                          <button
                            type="button"
                            onClick={() => addStopPointToTrip(index, "return")}
                            className="b2c-add-stop-btn"
                          >
                            + Add Return Stop
                          </button>
                        </div>

                        {tripTime.returnStopPoints.length === 0 ? (
                          <p className="b2c-no-stops">
                            No return stops. Bus will go directly from{" "}
                            {formData.toLocation} to {formData.fromLocation}.
                          </p>
                        ) : (
                          <div className="b2c-stops-list">
                            {tripTime.returnStopPoints.map(
                              (stop, stopIndex) => (
                                <div key={stopIndex} className="b2c-stop-item">
                                  <div className="b2c-stop-number">
                                    {stopIndex + 1}
                                  </div>
                                  <div className="b2c-stop-details">
                                    <input
                                      type="text"
                                      placeholder="Stop location (e.g., Sharjah)"
                                      value={stop.location}
                                      onChange={(e) =>
                                        updateTripStopPoint(
                                          index,
                                          stopIndex,
                                          "location",
                                          e.target.value,
                                          "return",
                                        )
                                      }
                                      className="b2c-stop-location"
                                    />
                                    <input
                                      type="time"
                                      placeholder="Arrival time"
                                      value={stop.time}
                                      onChange={(e) =>
                                        updateTripStopPoint(
                                          index,
                                          stopIndex,
                                          "time",
                                          e.target.value,
                                          "return",
                                        )
                                      }
                                      className="b2c-stop-time"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeStopPointFromTrip(
                                        index,
                                        stopIndex,
                                        "return",
                                      )
                                    }
                                    className="b2c-remove-stop-btn"
                                  >
                                    ×
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Per-Trip Driver & Vehicle Assignment */}
                  <div
                    className="b2c-trip-assignment"
                    style={{
                      marginTop: "16px",
                      padding: "12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h5
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#475569",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>📋</span> Trip {index + 1} Assignment *
                    </h5>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "12px",
                      }}
                    >
                      Assign a driver and vehicle for this specific trip time.
                      Drivers/Vehicles: 🟢 available, 🔴 busy, 🟠 offline, 🔵
                      assigned to another trip above.
                    </p>
                    <div
                      className="b2c-form-row"
                      style={{ display: "flex", gap: "12px" }}
                    >
                      <div className="b2c-form-group" style={{ flex: 1 }}>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#475569",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          Driver for Trip {index + 1} *
                        </label>
                        <select
                          value={tripTime.assignedDriver || ""}
                          onChange={(e) =>
                            updateTripTime(
                              index,
                              "assignedDriver",
                              e.target.value,
                            )
                          }
                          className="b2c-form-input"
                          style={{ fontSize: "13px", padding: "8px 10px" }}
                          required
                        >
                          <option value="">Select a driver</option>
                          {availableDrivers.map((driver) => {
                            // Check if this driver is assigned to another trip in this modal
                            const isAssignedInModal =
                              isDriverAssignedInOtherTrip(driver._id, index);

                            // Use the backend-calculated availability status and message
                            const availabilityStatus = isAssignedInModal
                              ? "assigned"
                              : driver.availability?.status ||
                                driver.availabilityStatus ||
                                "available";
                            const availabilityMessage =
                              driver.availability?.message ||
                              driver.availabilityMessage ||
                              "";
                            const availableUntil =
                              driver.availability?.availableUntilDisplay ||
                              driver.availableUntil ||
                              null;

                            const availabilityIcon = isAssignedInModal
                              ? "🔵"
                              : availabilityStatus === "available"
                                ? "🟢"
                                : availabilityStatus === "busy"
                                  ? "🔴"
                                  : availabilityStatus === "offline"
                                    ? "🟠"
                                    : "🟠";
                            // Allow selecting "available" drivers even if they have upcoming trips
                            const isDisabled =
                              isAssignedInModal ||
                              (availabilityStatus !== "available" &&
                                availabilityStatus !== "scheduled");

                            // Build schedule info text - show "Available until X:XX" if applicable
                            // FIXED: Show "Available" even if driver has schedules (without bookings)
                            // The detailed schedule info is shown in the info box when the driver is selected
                            const scheduleCount =
                              driver.assignedScheduleDetails?.length || 0;
                            let statusText = isAssignedInModal
                              ? "- Assigned to Trip Above"
                              : availabilityStatus === "available"
                                ? availableUntil
                                  ? `- Available until ${availableUntil}`
                                  : scheduleCount > 0
                                    ? "- Available"
                                    : ""
                                : availabilityStatus === "scheduled"
                                  ? `- ${availabilityMessage}`
                                  : availabilityStatus === "busy"
                                    ? `- ${availabilityMessage || "Busy"}`
                                    : availabilityStatus === "offline"
                                      ? "- Offline"
                                      : "- Not Available";

                            return (
                              <option
                                key={driver._id}
                                value={driver._id}
                                disabled={isDisabled}
                                style={{
                                  color: isDisabled ? "#94a3b8" : "inherit",
                                }}
                              >
                                {availabilityIcon} {driver.name} (
                                {driver.phoneNumber}) {statusText}
                              </option>
                            );
                          })}
                        </select>
                        {/* Show selected driver's schedule info */}
                        {tripTime.assignedDriver &&
                          (() => {
                            const selectedDriver = availableDrivers.find(
                              (d) => d._id === tripTime.assignedDriver,
                            );
                            if (
                              selectedDriver?.assignedScheduleDetails?.length >
                              0
                            ) {
                              return (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    padding: "8px 10px",
                                    backgroundColor: "#fef3c7",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#92400e",
                                    border: "1px solid #fcd34d",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "600",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Already assigned to{" "}
                                    {
                                      selectedDriver.assignedScheduleDetails
                                        .length
                                    }{" "}
                                    schedule(s):
                                  </div>
                                  {selectedDriver.assignedScheduleDetails
                                    .slice(0, 3)
                                    .map((sched, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          marginLeft: "8px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        • {sched.departureTime}
                                        {sched.arrivalTime
                                          ? ` - ${sched.arrivalTime}`
                                          : ""}
                                        : {sched.routeName}
                                        <span
                                          style={{
                                            color: "#a16207",
                                            marginLeft: "4px",
                                          }}
                                        >
                                          (
                                          {sched.availableDays
                                            ?.slice(0, 3)
                                            .join(", ")}
                                          {sched.availableDays?.length > 3
                                            ? "..."
                                            : ""}
                                          )
                                        </span>
                                      </div>
                                    ))}
                                  {selectedDriver.assignedScheduleDetails
                                    .length > 3 && (
                                    <div
                                      style={{
                                        marginLeft: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      ...and{" "}
                                      {selectedDriver.assignedScheduleDetails
                                        .length - 3}{" "}
                                      more
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
                      <div className="b2c-form-group" style={{ flex: 1 }}>
                        <label
                          style={{
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#475569",
                            marginBottom: "4px",
                            display: "block",
                          }}
                        >
                          Vehicle for Trip {index + 1} *
                        </label>
                        <select
                          value={tripTime.assignedVehicle || ""}
                          onChange={(e) =>
                            updateTripTime(
                              index,
                              "assignedVehicle",
                              e.target.value,
                            )
                          }
                          className="b2c-form-input"
                          style={{ fontSize: "13px", padding: "8px 10px" }}
                          required
                        >
                          <option value="">Select a vehicle</option>
                          {availableVehicles.map((vehicle) => {
                            // Check if this vehicle is assigned to another trip in this modal
                            const isAssignedInModal =
                              isVehicleAssignedInOtherTrip(vehicle._id, index);

                            // Use backend-calculated availability status
                            const vehicleAvailability = isAssignedInModal
                              ? "assigned"
                              : vehicle.availabilityStatus || "available";
                            const vehicleAvailableUntil =
                              vehicle.availableUntil || null;
                            const vehicleAvailabilityMessage =
                              vehicle.availabilityMessage || "";

                            const vehicleIcon = isAssignedInModal
                              ? "🔵"
                              : vehicleAvailability === "available"
                                ? "🟢"
                                : vehicleAvailability === "busy"
                                  ? "🔴"
                                  : vehicleAvailability === "scheduled"
                                    ? "🟠"
                                    : "🟠";
                            // Allow selecting "available" vehicles even if they have upcoming trips
                            const isVehicleDisabled =
                              isAssignedInModal ||
                              (vehicleAvailability !== "available" &&
                                vehicleAvailability !== "scheduled");

                            // Build schedule info text - show "Available until X:XX" if applicable
                            // FIXED: Show "Available" even if vehicle has schedules (without bookings)
                            // The detailed schedule info is shown in the info box when the vehicle is selected
                            const scheduleCount =
                              vehicle.assignedScheduleDetails?.length || 0;
                            const vehicleStatusText = isAssignedInModal
                              ? "- ASSIGNED TO TRIP ABOVE"
                              : vehicleAvailability === "available"
                                ? vehicleAvailableUntil
                                  ? `- Available until ${vehicleAvailableUntil}`
                                  : scheduleCount > 0
                                    ? "- Available"
                                    : ""
                                : vehicleAvailability === "busy"
                                  ? `- ${vehicleAvailabilityMessage || "BUSY"}`
                                  : vehicleAvailability === "scheduled"
                                    ? `- ${vehicleAvailabilityMessage}`
                                    : "";

                            return (
                              <option
                                key={vehicle._id}
                                value={vehicle._id}
                                disabled={isVehicleDisabled}
                                style={{
                                  color: isVehicleDisabled
                                    ? "#94a3b8"
                                    : "inherit",
                                }}
                              >
                                {vehicleIcon} {vehicle.model} (
                                {vehicle.licensePlate}) -{" "}
                                {vehicle.seatingCapacity} seats{" "}
                                {vehicleStatusText}
                              </option>
                            );
                          })}
                        </select>
                        {/* Show selected vehicle's schedule info */}
                        {tripTime.assignedVehicle &&
                          (() => {
                            const selectedVehicle = availableVehicles.find(
                              (v) => v._id === tripTime.assignedVehicle,
                            );
                            if (
                              selectedVehicle?.assignedScheduleDetails?.length >
                              0
                            ) {
                              return (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    padding: "8px 10px",
                                    backgroundColor: "#dbeafe",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#1e40af",
                                    border: "1px solid #93c5fd",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "600",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Already assigned to{" "}
                                    {
                                      selectedVehicle.assignedScheduleDetails
                                        .length
                                    }{" "}
                                    schedule(s):
                                  </div>
                                  {selectedVehicle.assignedScheduleDetails
                                    .slice(0, 3)
                                    .map((sched, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          marginLeft: "8px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        • {sched.departureTime}
                                        {sched.arrivalTime
                                          ? ` - ${sched.arrivalTime}`
                                          : ""}
                                        : {sched.routeName}
                                        <span
                                          style={{
                                            color: "#1d4ed8",
                                            marginLeft: "4px",
                                          }}
                                        >
                                          (
                                          {sched.availableDays
                                            ?.slice(0, 3)
                                            .join(", ")}
                                          {sched.availableDays?.length > 3
                                            ? "..."
                                            : ""}
                                          )
                                        </span>
                                      </div>
                                    ))}
                                  {selectedVehicle.assignedScheduleDetails
                                    .length > 3 && (
                                    <div
                                      style={{
                                        marginLeft: "8px",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      ...and{" "}
                                      {selectedVehicle.assignedScheduleDetails
                                        .length - 3}{" "}
                                      more
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTripTime}
                className="b2c-add-trip-btn"
              >
                + Add Another Trip Time
              </button>
            </div>
          </div>

          {/* Pricing Section - Only for new routes */}
          {routeMode === "new" && (
            <div className="b2c-form-section">
              <h3 className="b2c-section-title">Pricing</h3>
              <p
                className="b2c-section-description"
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                  marginBottom: "12px",
                }}
              >
                Set the pricing for this route. Seat capacity is automatically
                determined by the vehicle assigned to each trip above.
              </p>

              {/* Scheduling Conflict Warning */}
              {schedulingConflicts.length > 0 && (
                <div
                  className="b2c-conflict-warning"
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "8px",
                    padding: "16px",
                    marginTop: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ marginRight: "8px" }}
                    >
                      <path
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        stroke="#dc2626"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span style={{ fontWeight: "600", color: "#dc2626" }}>
                      Scheduling Conflicts Detected
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: "0",
                      paddingLeft: "20px",
                      color: "#7f1d1d",
                    }}
                  >
                    {schedulingConflicts.map((conflict, index) => (
                      <li key={index} style={{ marginBottom: "4px" }}>
                        {conflict.tripIndex && (
                          <span style={{ color: "#ef4444", fontWeight: "600" }}>
                            [Trip {conflict.tripIndex}]{" "}
                          </span>
                        )}
                        <strong>
                          {conflict.type === "DRIVER" ? "Driver" : "Vehicle"}
                        </strong>{" "}
                        is already assigned to{" "}
                        <strong>{conflict.existingRoute}</strong> at{" "}
                        <strong>{conflict.conflictingTime}</strong> on{" "}
                        <strong>{conflict.overlappingDays?.join(", ")}</strong>
                        {conflict.tripTime && (
                          <span> (Your trip at {conflict.tripTime})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p
                    style={{
                      marginTop: "8px",
                      marginBottom: "0",
                      fontSize: "13px",
                      color: "#991b1b",
                    }}
                  >
                    Please change the time, driver, vehicle, or available days
                    to avoid double-booking.
                  </p>
                </div>
              )}

              {checkingConflicts && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "8px",
                    color: "#6b7280",
                  }}
                >
                  Checking for scheduling conflicts...
                </div>
              )}

              {/* Seats Info - Auto-calculated from trip vehicles */}
              {routeMode === "new" && (
                <>
                  <div
                    className="b2c-info-box"
                    style={{
                      backgroundColor: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <p
                      style={{ fontSize: "13px", color: "#1e40af", margin: 0 }}
                    >
                      <strong>Seat Capacity:</strong> The total and available
                      seats are automatically determined by the vehicle assigned
                      to each trip above. Each trip can have a different vehicle
                      with different seating capacity.
                    </p>
                    {formData.tripTimes.some((t) => t.assignedVehicle) && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#3b82f6",
                        }}
                      >
                        {formData.tripTimes.map((trip, idx) => {
                          if (!trip.assignedVehicle) return null;
                          const vehicle = availableVehicles.find(
                            (v) => v._id === trip.assignedVehicle,
                          );
                          return vehicle ? (
                            <div key={idx}>
                              Trip {idx + 1}:{" "}
                              {vehicle.model || vehicle.vehicleName} (
                              {vehicle.licensePlate || vehicle.plateNumber}) -{" "}
                              {vehicle.seatingCapacity} seats
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  <div className="b2c-form-row">
                    <div className="b2c-form-group">
                      <label htmlFor="oneWayPrice" className="b2c-form-label">
                        One Way Price ({getCurrencySymbol(currency)}) *
                      </label>
                      <input
                        type="number"
                        id="oneWayPrice"
                        name="oneWayPrice"
                        placeholder="50.00"
                        value={formData.oneWayPrice}
                        onChange={handlePriceChange}
                        required
                        min="0"
                        step={decimals === 3 ? "0.001" : "0.01"}
                        className="b2c-form-input"
                      />
                      <small className="b2c-form-help">
                        Daily price per trip (used for monthly calculation)
                      </small>
                    </div>

                    <div className="b2c-form-group">
                      <label
                        htmlFor="roundTripPrice"
                        className="b2c-form-label"
                      >
                        Round Trip Price ({getCurrencySymbol(currency)}) *
                      </label>
                      <input
                        type="number"
                        id="roundTripPrice"
                        name="roundTripPrice"
                        placeholder="80.00"
                        value={formData.roundTripPrice}
                        onChange={handlePriceChange}
                        required
                        min="0"
                        step={decimals === 3 ? "0.001" : "0.01"}
                        className="b2c-form-input"
                      />
                      <small className="b2c-form-help">
                        Daily price per round trip (used for monthly
                        calculation)
                      </small>
                    </div>
                  </div>

                  <div className="b2c-form-row">
                    <div className="b2c-form-group">
                      <label
                        htmlFor="monthlyOneWayPrice"
                        className="b2c-form-label"
                      >
                        Monthly Pass (One Way) ({getCurrencySymbol(currency)}) *
                      </label>
                      <input
                        type="number"
                        id="monthlyOneWayPrice"
                        name="monthlyOneWayPrice"
                        placeholder="Auto-calculated"
                        value={formData.monthlyOneWayPrice}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className="b2c-form-input"
                        readonly
                      />
                      <small className="b2c-form-help">
                        Auto-calculated based on daily price and available days
                      </small>
                    </div>

                    <div className="b2c-form-group">
                      <label className="b2c-form-label">
                        Monthly Pass (Round Trip) ({getCurrencySymbol(currency)}
                        ) *
                      </label>
                      <input
                        type="number"
                        id="monthlyRoundTripPrice"
                        name="monthlyRoundTripPrice"
                        placeholder="Auto-calculated"
                        value={formData.monthlyRoundTripPrice}
                        onChange={handleChange}
                        required
                        min="0"
                        step={decimals === 3 ? "0.001" : "0.01"}
                        className="b2c-form-input"
                        readonly
                      />
                      <small className="b2c-form-help">
                        Auto-calculated based on daily price and available days
                      </small>
                    </div>
                  </div>
                </>
              )}

              <div className="b2c-pricing-preview">
                <h4 className="b2c-preview-title">
                  🎫{" "}
                  {routeMode === "existing"
                    ? "New Schedule Summary"
                    : "Monthly Pass Pricing"}
                </h4>
                <div className="b2c-preview-grid">
                  <div className="b2c-preview-item">
                    <span className="b2c-preview-label">Route:</span>
                    <span className="b2c-preview-value">
                      {routeMode === "existing" && selectedExistingRoute
                        ? `${selectedExistingRoute.fromLocation} → ${selectedExistingRoute.toLocation}`
                        : `${formData.fromLocation} → ${formData.toLocation}`}
                    </span>
                  </div>
                  <div className="b2c-preview-item">
                    <span className="b2c-preview-label">Days:</span>
                    <span className="b2c-preview-value">
                      {formData.availableDays.join(", ")}
                    </span>
                  </div>
                  <div className="b2c-preview-item">
                    <span className="b2c-preview-label">Trips per Day:</span>
                    <span className="b2c-preview-value">
                      {formData.tripTimes.filter((t) => t.departureTime).length}
                    </span>
                  </div>
                  <div className="b2c-preview-item">
                    <span className="b2c-preview-label">
                      Total Weekly Trips:
                    </span>
                    <span className="b2c-preview-value">
                      {formData.tripTimes.filter((t) => t.departureTime)
                        .length * formData.availableDays.length}
                    </span>
                  </div>
                </div>

                {formData.tripTimes.filter((t) => t.departureTime).length >
                  0 && (
                  <div className="b2c-trip-times-preview">
                    <h5 className="b2c-preview-subtitle">
                      🕐 Daily Trip Times:
                    </h5>
                    {formData.tripTimes
                      .filter((t) => t.departureTime)
                      .map((trip, index) => (
                        <div key={index} className="b2c-trip-preview">
                          <div className="b2c-trip-header">
                            <span className="b2c-trip-time">
                              {trip.departureTime}
                              {trip.tripType === "Round Trip" &&
                                trip.arrivalTime &&
                                ` - Return ${trip.arrivalTime}`}
                            </span>
                            <span className="b2c-trip-type">
                              {trip.tripType}
                            </span>
                          </div>

                          {/* Outbound Stops Preview */}
                          {trip.outboundStopPoints.length > 0 && (
                            <div className="b2c-trip-stops-preview">
                              <span className="b2c-stops-label">
                                🛑 Outbound:
                              </span>
                              {trip.outboundStopPoints.map(
                                (stop, stopIndex) => (
                                  <span
                                    key={stopIndex}
                                    className="b2c-stop-preview"
                                  >
                                    {stop.location} ({stop.time})
                                  </span>
                                ),
                              )}
                            </div>
                          )}

                          {/* Return Stops Preview */}
                          {trip.tripType === "Round Trip" &&
                            trip.returnStopPoints.length > 0 && (
                              <div className="b2c-trip-stops-preview">
                                <span className="b2c-stops-label">
                                  🔄 Return:
                                </span>
                                {trip.returnStopPoints.map(
                                  (stop, stopIndex) => (
                                    <span
                                      key={stopIndex}
                                      className="b2c-stop-preview"
                                    >
                                      {stop.location} ({stop.time})
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      ))}
                  </div>
                )}

                <div className="b2c-pass-info">
                  <p className="b2c-pass-text">
                    🚌 Passengers get unlimited travel with monthly pass!
                  </p>
                  <p className="b2c-pass-text">
                    💳 No daily tickets, only monthly subscriptions
                  </p>
                  <p className="b2c-pass-text">
                    🔄 Each trip time can be One Way or Round Trip
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="b2c-modal-actions">
            <button
              type="button"
              className="b2c-btn b2c-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2c-btn b2c-btn-submit"
              disabled={
                loading || (routeMode === "existing" && !selectedExistingRoute)
              }
            >
              {loading
                ? routeMode === "existing"
                  ? "Adding Schedule..."
                  : "Adding Route..."
                : routeMode === "existing"
                  ? "Add Schedule"
                  : "Add Route"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_AddRouteModal;
