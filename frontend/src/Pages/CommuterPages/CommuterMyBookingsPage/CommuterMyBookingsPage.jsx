/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useState, useCallback } from "react";
import { notify } from "../../../utils/toast";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getPassengerBookings } from "../../../Redux/slices/bookingSlice";
import { useSocket } from "../../../hooks/useSocket";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { useLocale } from "../../../hooks/useLocale";
import DailyTripsInBooking from "../../../Components/DailyTripsInBooking/DailyTripsInBooking";
import commuterBookingAPI from "../../../services/commuterBookingAPI";
import api from "../../../utils/api";
import "./commutermybookingspage.css";

const CommuterMyBookingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { passengerBookings, loading } = useSelector((state) => state.booking);
  const auth = useSelector((state) => state.auth);
  const { currency: localeCurrency } = useLocale();
  const socket = useSocket();
  const [filterStatus, setFilterStatus] = useState("all");
  const [driverLocations, setDriverLocations] = useState({});
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowBooking, setNoShowBooking] = useState(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [tripStatusMessage, setTripStatusMessage] = useState(null); // Track trip status for tracking modal
  const [noShowCustomReason, setNoShowCustomReason] = useState("");
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [showAutoCancelModal, setShowAutoCancelModal] = useState(false);
  const [autoCancelData, setAutoCancelData] = useState(null);
  const [expandedBookings, setExpandedBookings] = useState(new Set()); // Track which booking cards have expanded Daily Trips

  // Toggle Daily Trips expansion for a specific booking
  const toggleBookingExpansion = useCallback((bookingId) => {
    setExpandedBookings((prev) => {
      const newSet = new Set(prev);
      // Ensure we're using string IDs consistently
      const id = String(bookingId);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Download monthly pass certificate
  const handleDownloadPassCertificate = useCallback(async (passId) => {
    try {
      const response = await api.get(`/monthly-pass/download/${passId}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monthly-pass-${passId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading pass certificate:", error);
      notify("Failed to download pass certificate. Please try again.");
    }
  }, []);

  // Utility functions - declared first
  const getDriverLocation = useCallback(
    (driverId) => {
      return driverLocations[driverId] || null;
    },
    [driverLocations],
  );

  const isDriverOnline = useCallback(
    (driverId) => {
      if (!currentTime || !driverLocations[driverId]) {
        return false;
      }
      const lastUpdate = new Date(
        driverLocations[driverId].timestamp,
      ).getTime();
      const timeDiff = currentTime - lastUpdate;
      return timeDiff < 60000; // Consider online if updated within last 60 seconds
    },
    [currentTime, driverLocations],
  );

  // Update map bounds based on driver location - enhanced for precision
  const updateMapBounds = useCallback((lat, lng) => {
    const padding = 0.005; // ~500m padding for tighter view
    setMapBounds({
      south: lat - padding,
      west: lng - padding,
      north: lat + padding,
      east: lng + padding,
    });
    setMapCenter({ lat, lng });
  }, []);

  // Start real-time tracking for a booking
  const startRealTimeTracking = useCallback(
    async (booking) => {
      setSelectedBooking(booking);
      setShowTracking(true);
      setIsTrackingActive(true);

      // CRITICAL: For ROUND_TRIP bookings, we need to determine which driver to track
      // The correct driver depends on which trip (outbound or return) is currently active
      // We'll pass the bookingId to the API and let it find the correct in-progress trip
      let driverId;

      // For ROUND_TRIP bookings, check if there's return driver info
      if (booking.bookingType === "ROUND_TRIP") {
        // If outbound trip is done (booking completed for outbound) and we're tracking return
        // Use returnDriverId if returnIsSelfDriver is false, else use b2cPartnerId
        if (booking.returnDriverId && !booking.returnIsSelfDriver) {
          // Return trip has a dedicated driver (B2C_PARTNER_DRIVER)
          driverId = booking.returnDriverId?._id || booking.returnDriverId;
          console.log(
            "[v0] ROUND_TRIP: Using return driver (B2C_PARTNER_DRIVER):",
            driverId,
          );
        } else if (booking.returnIsSelfDriver && booking.b2cPartnerId) {
          // Return trip is self-driven by the B2C_PARTNER
          driverId = booking.b2cPartnerId?._id || booking.b2cPartnerId;
          console.log(
            "[v0] ROUND_TRIP: Using return driver (self-driver B2C_PARTNER):",
            driverId,
          );
        } else if (booking.outboundIsSelfDriver && booking.b2cPartnerId) {
          // Outbound trip - self-driven by the B2C_PARTNER
          driverId = booking.b2cPartnerId?._id || booking.b2cPartnerId;
          console.log(
            "[v0] ROUND_TRIP: Using outbound driver (self-driver B2C_PARTNER):",
            driverId,
          );
        } else if (booking.outboundDriverId) {
          // Outbound trip has a dedicated driver
          driverId = booking.outboundDriverId?._id || booking.outboundDriverId;
          console.log("[v0] ROUND_TRIP: Using outbound driver:", driverId);
        } else {
          // Fallback to assignedDriverId or b2cPartnerId
          driverId =
            booking.assignedDriverId?._id ||
            booking.assignedDriverId ||
            booking.b2cPartnerId?._id ||
            booking.b2cPartnerId;
          console.log("[v0] ROUND_TRIP: Using fallback driver:", driverId);
        }
      } else {
        // ONE_WAY trip - use the standard logic
        if (booking.isSelfDriver) {
          driverId = booking.b2cPartnerId?._id || booking.b2cPartnerId;
          console.log(
            "[v0] ONE_WAY: Tracking self-driver (B2C Partner):",
            driverId,
          );
        } else {
          driverId =
            booking.assignedDriverId?._id ||
            booking.assignedDriverId ||
            booking.driverId;
          console.log("[v0] ONE_WAY: Tracking assigned driver:", driverId);
        }
      }

      // IMPORTANT: Join the booking room to receive real-time location updates
      if (socket?.socket) {
        const bookingId = booking._id;
        console.log(
          "[v0] Joining booking room for real-time updates:",
          bookingId,
        );
        socket.socket.emit("join-booking-room", bookingId);
        socket.socket.emit("join_booking_room", bookingId); // Also emit the underscore variant for compatibility
      }

      // Initial map setup
      const driverLoc = getDriverLocation(driverId);
      if (driverLoc) {
        updateMapBounds(driverLoc.lat, driverLoc.lng);
      }

      console.log(
        "[v0] Started real-time tracking for booking:",
        booking._id,
        "driverId:",
        driverId,
      );

      // Request driver location via socket
      if (socket?.socket && driverId) {
        console.log(
          "[v0] Requesting driver location via socket for:",
          driverId,
          "bookingId:",
          booking._id,
        );
        socket.socket.emit("request-driver-location", {
          driverId,
          bookingId: booking._id,
        });
      }

      // Fetch driver location from API
      const fetchDriverLocationFromAPI = async () => {
        try {
          if (driverId) {
            // Pass bookingId to ensure we get the correct trip for this specific booking
            const response = await commuterBookingAPI.getDriverLocation(
              driverId,
              booking._id,
            );
            console.log("[v0] Driver location API response:", response);

            // Check if trip has not started yet (SCHEDULED status)
            if (response.success && response.data) {
              // CRITICAL: Check if tracking is allowed based on booking status
              // If trackingAllowed is false, it means booking is not ACCEPTED yet
              if (response.data.trackingAllowed === false) {
                setTripStatusMessage(
                  response.data.message ||
                    "Tracking is not available for this booking. Please wait for the partner to accept your booking.",
                );
                return false;
              }

              const tripStatus = response.data.tripStatus;
              const isLocationAvailable = response.data.isLocationAvailable;

              if (
                !isLocationAvailable &&
                (tripStatus === "SCHEDULED" || tripStatus === "Scheduled")
              ) {
                // Trip has not started yet
                setTripStatusMessage(
                  response.data.message ||
                    "Trip has not started yet. Driver location will be available once the trip begins.",
                );
                console.log("[v0] Trip not started yet, status:", tripStatus);
                return false; // Return false to indicate location not available
              } else if (
                tripStatus === "In Progress" ||
                tripStatus === "IN_PROGRESS"
              ) {
                // Trip is in progress
                if (response.data.location) {
                  // Location is available
                  setTripStatusMessage(null);
                  const locationData = response.data.location;
                  const lat = locationData.latitude || locationData.lat;
                  const lng = locationData.longitude || locationData.lng;

                  if (lat && lng) {
                    console.log(
                      "[v0] Setting driver location from API:",
                      lat,
                      lng,
                    );
                    setDriverLocations((prev) => ({
                      ...prev,
                      [driverId]: {
                        lat: lat,
                        lng: lng,
                        timestamp: Date.now(),
                      },
                    }));
                    updateMapBounds(lat, lng);
                    return true; // Location available
                  }
                } else {
                  // Trip is in progress but no location yet - driver may not have shared location
                  setTripStatusMessage(
                    "Trip is in progress. Waiting for driver to share location...",
                  );
                }
              } else if (response.data.location) {
                // Location available (other statuses)
                setTripStatusMessage(null);
                const locationData = response.data.location;
                const lat = locationData.latitude || locationData.lat;
                const lng = locationData.longitude || locationData.lng;

                if (lat && lng) {
                  console.log(
                    "[v0] Setting driver location from API:",
                    lat,
                    lng,
                  );
                  setDriverLocations((prev) => ({
                    ...prev,
                    [driverId]: {
                      lat: lat,
                      lng: lng,
                      timestamp: Date.now(),
                    },
                  }));
                  updateMapBounds(lat, lng);
                  return true;
                }
              } else {
                // No location available
                setTripStatusMessage(
                  response.data.message || "Driver location not available",
                );
              }
            }
          }
        } catch (err) {
          console.error("[v0] Error fetching driver location from API:", err);
        }
        return false;
      };

      // Initial fetch
      await fetchDriverLocationFromAPI();
    },
    [getDriverLocation, updateMapBounds, socket],
  );

  // Stop real-time tracking
  const stopRealTimeTracking = useCallback(() => {
    setIsTrackingActive(false);
    setShowTracking(false);
    setSelectedBooking(null);
    setMapCenter(null);
    setMapBounds(null);
    setTripStatusMessage(null); // Clear trip status message
    console.log("Stopped real-time tracking");
  }, []);

  // Poll driver location from API when tracking is active (as fallback for socket updates)
  useEffect(() => {
    if (!isTrackingActive || !selectedBooking) return;

    const fetchDriverLocation = async () => {
      // CRITICAL: For ROUND_TRIP bookings, we need to determine which driver to track
      // The API will find the correct in-progress trip, but we need a driver ID to start with
      let driverId;

      if (selectedBooking.bookingType === "ROUND_TRIP") {
        // For ROUND_TRIP, we'll use the most relevant driver ID
        // The API will determine which trip is actually in progress
        if (
          selectedBooking.returnDriverId &&
          !selectedBooking.returnIsSelfDriver
        ) {
          driverId =
            selectedBooking.returnDriverId?._id ||
            selectedBooking.returnDriverId;
        } else if (
          selectedBooking.returnIsSelfDriver &&
          selectedBooking.b2cPartnerId
        ) {
          driverId =
            selectedBooking.b2cPartnerId?._id || selectedBooking.b2cPartnerId;
        } else if (
          selectedBooking.outboundIsSelfDriver &&
          selectedBooking.b2cPartnerId
        ) {
          driverId =
            selectedBooking.b2cPartnerId?._id || selectedBooking.b2cPartnerId;
        } else if (selectedBooking.outboundDriverId) {
          driverId =
            selectedBooking.outboundDriverId?._id ||
            selectedBooking.outboundDriverId;
        } else {
          driverId =
            selectedBooking.assignedDriverId?._id ||
            selectedBooking.assignedDriverId ||
            selectedBooking.b2cPartnerId?._id ||
            selectedBooking.b2cPartnerId;
        }
      } else {
        // ONE_WAY trip
        if (selectedBooking.isSelfDriver) {
          driverId =
            selectedBooking.b2cPartnerId?._id || selectedBooking.b2cPartnerId;
        } else {
          driverId =
            selectedBooking.assignedDriverId?._id ||
            selectedBooking.assignedDriverId ||
            selectedBooking.driverId;
        }
      }

      if (!driverId) return;

      try {
        const response = await commuterBookingAPI.getDriverLocation(
          driverId,
          selectedBooking._id,
        );

        if (response.success && response.data) {
          // CRITICAL: Check if tracking is allowed based on booking status
          if (response.data.trackingAllowed === false) {
            setTripStatusMessage(
              response.data.message ||
                "Tracking is not available for this booking.",
            );
            return;
          }

          const tripStatus = response.data.tripStatus;
          const isLocationAvailable = response.data.isLocationAvailable;

          if (
            !isLocationAvailable &&
            (tripStatus === "SCHEDULED" || tripStatus === "Scheduled")
          ) {
            setTripStatusMessage(
              response.data.message ||
                "Trip has not started yet. Driver location will be available once the trip begins.",
            );
          } else if (
            tripStatus === "In Progress" ||
            tripStatus === "IN_PROGRESS"
          ) {
            if (response.data.location) {
              setTripStatusMessage(null);
              const locationData = response.data.location;
              const lat = locationData.latitude || locationData.lat;
              const lng = locationData.longitude || locationData.lng;

              if (lat && lng) {
                console.log(
                  "[v0] Polling: Setting driver location from API:",
                  lat,
                  lng,
                );
                setDriverLocations((prev) => ({
                  ...prev,
                  [driverId]: {
                    lat: lat,
                    lng: lng,
                    timestamp: Date.now(),
                  },
                }));
                updateMapBounds(lat, lng);
              }
            } else {
              setTripStatusMessage(
                "Trip is in progress. Waiting for driver to share location...",
              );
            }
          } else if (response.data.location) {
            setTripStatusMessage(null);
            const locationData = response.data.location;
            const lat = locationData.latitude || locationData.lat;
            const lng = locationData.longitude || locationData.lng;

            if (lat && lng) {
              setDriverLocations((prev) => ({
                ...prev,
                [driverId]: {
                  lat: lat,
                  lng: lng,
                  timestamp: Date.now(),
                },
              }));
              updateMapBounds(lat, lng);
            }
          }
        }
      } catch (err) {
        console.error("[v0] Polling: Error fetching driver location:", err);
      }
    };

    // Poll every 5 seconds when tracking is active
    const pollingInterval = setInterval(fetchDriverLocation, 5000);

    return () => clearInterval(pollingInterval);
  }, [isTrackingActive, selectedBooking, updateMapBounds]);

  // Initialize current time and update every second
  useEffect(() => {
    // Set initial time asynchronously to avoid cascading renders
    setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);

    // Update current time every second to check driver online status
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Derive userType directly from passengerBookings instead of storing in state
  const userType =
    passengerBookings.length > 0
      ? passengerBookings[0].userType
      : "NORMAL_PASSENGER";

  useEffect(() => {
    if (auth.user) {
      dispatch(
        getPassengerBookings({
          status: filterStatus !== "all" ? filterStatus : undefined,
        }),
      );
    }
  }, [dispatch, auth.user, filterStatus]);

  // Live auto-refresh: silent background polling + instant refetch on relevant
  // socket events + refetch when the tab regains focus. Replaces manual polling.
  const refreshBookings = useCallback(
    ({ silent } = {}) => {
      if (!auth.user) return;
      dispatch(
        getPassengerBookings({
          status: filterStatus !== "all" ? filterStatus : undefined,
          silent,
        }),
      );
    },
    [dispatch, auth.user, filterStatus],
  );

  useAutoRefresh(refreshBookings, {
    interval: 20000,
    enabled: !!auth.user,
    socketEvents: [
      "booking-accepted",
      "booking-rejected",
      "trip-started",
      "trip-completed",
      "new-notification",
    ],
    deps: [filterStatus],
  });

  // Socket.io connection and enhanced location tracking
  useEffect(() => {
    if (socket.socket && auth.user) {
      // Join notification room
      socket.socket.emit("join-notification-room", auth.user.id);

      // Enhanced location updates with map bounds calculation
      socket.socket.on("location-update", (locationData) => {
        console.log("🚗 Real-time location update:", locationData);

        setDriverLocations((prev) => ({
          ...prev,
          [locationData.driverId]: {
            lat: locationData.lat,
            lng: locationData.lng,
            timestamp: locationData.timestamp,
          },
        }));

        // Update map bounds if tracking is active
        if (
          isTrackingActive &&
          selectedBooking &&
          ((selectedBooking.driverId &&
            selectedBooking.driverId === locationData.driverId) ||
            (selectedBooking.b2cPartnerId &&
              (selectedBooking.b2cPartnerId._id ||
                selectedBooking.b2cPartnerId) === locationData.driverId))
        ) {
          updateMapBounds(locationData.lat, locationData.lng);
        }
      });

      // Listen for booking updates
      socket.socket.on("corporate-booking-confirmed", (data) => {
        console.log("Corporate booking confirmed:", data);
        dispatch(getPassengerBookings());
      });

      // Listen for B2C booking updates
      socket.socket.on("b2c-booking-confirmed", (data) => {
        console.log("B2C booking confirmed:", data);
        dispatch(getPassengerBookings());
      });

      socket.socket.on("b2c-trip-started", (data) => {
        console.log("🚀 B2C Trip started:", data);
        dispatch(getPassengerBookings());

        // Auto-start tracking for active B2C trip
        if (selectedBooking && selectedBooking._id === data.bookingId) {
          setIsTrackingActive(true);
        }
      });

      socket.socket.on("b2c-trip-completed", (data) => {
        console.log("✅ B2C Trip completed:", data);
        dispatch(getPassengerBookings());

        // Stop tracking when B2C trip completes
        if (selectedBooking && selectedBooking._id === data.bookingId) {
          setIsTrackingActive(false);
        }
      });

      socket.socket.on("trip-started", (data) => {
        console.log("🚀 Trip started:", data);
        dispatch(getPassengerBookings());

        // Auto-start tracking for active trip
        if (selectedBooking && selectedBooking._id === data.bookingId) {
          setIsTrackingActive(true);
        }
      });

      socket.socket.on("trip-completed", (data) => {
        console.log("✅ Trip completed:", data);
        dispatch(getPassengerBookings());

        // Stop tracking when trip completes
        if (selectedBooking && selectedBooking._id === data.bookingId) {
          setIsTrackingActive(false);
        }
      });

      // Listen for driver online/offline status
      socket.socket.on("driver-status-change", (data) => {
        console.log("🔄 Driver status changed:", data);
        setDriverLocations((prev) => ({
          ...prev,
          [data.driverId]: {
            ...prev[data.driverId],
            isOnline: data.isOnline,
            lastStatusUpdate: Date.now(),
          },
        }));
      });

      // Listen for B2C driver location updates
      socket.socket.on("driver-location-update", (locationData) => {
        console.log("[v0] B2C Driver location update received:", locationData);

        // Check tripStatus to determine if we should show location or message
        const tripStatus = locationData?.tripStatus;
        const isLocationAvailable = locationData?.isLocationAvailable;

        if (tripStatus === "SCHEDULED" || tripStatus === "Scheduled") {
          // Trip has not started yet - show message, don't update location
          console.log(
            "[v0] Trip not started yet (socket):",
            locationData?.message,
          );
          setTripStatusMessage(
            locationData?.message ||
              "Trip has not started yet. Driver location will be available once the trip begins.",
          );
          return;
        }

        // Check if location data is available before updating
        if (locationData?.location?.lat && locationData?.location?.lng) {
          // Clear any previous trip status message since we have valid location
          setTripStatusMessage(null);

          setDriverLocations((prev) => {
            const updated = {
              ...prev,
              [locationData.driverId]: {
                lat: locationData.location.lat,
                lng: locationData.location.lng,
                timestamp: locationData.timestamp,
              },
            };
            console.log("[v0] Updated driverLocations:", updated);
            return updated;
          });

          // Update map bounds if tracking is active
          if (
            isTrackingActive &&
            selectedBooking &&
            selectedBooking._id === locationData.bookingId
          ) {
            console.log(
              "[v0] Updating map bounds for booking:",
              locationData.bookingId,
            );
            updateMapBounds(
              locationData.location.lat,
              locationData.location.lng,
            );
          }
        } else if (!isLocationAvailable) {
          // No location available - show message if provided
          console.log(
            "[v0] B2C Driver location not available:",
            locationData?.message,
          );
          if (locationData?.message) {
            setTripStatusMessage(locationData.message);
          }
        }
      });

      // Listen for booking auto-cancellation notification
      socket.socket.on("BOOKING_AUTO_CANCELLED", (data) => {
        console.log("Booking auto-cancelled notification received:", data);
        setAutoCancelData(data);
        setShowAutoCancelModal(true);
        // Refresh bookings to reflect the cancellation
        dispatch(getPassengerBookings());
      });

      // Listen for general notifications that include auto-cancellation
      socket.socket.on("notification", (notification) => {
        console.log("Notification received:", notification);
        if (notification.type === "BOOKING_AUTO_CANCELLED") {
          setAutoCancelData(notification.data || notification);
          setShowAutoCancelModal(true);
          dispatch(getPassengerBookings());
        }
      });

      return () => {
        if (socket.socket) {
          socket.socket.off("location-update");
          socket.socket.off("corporate-booking-confirmed");
          socket.socket.off("b2c-booking-confirmed");
          socket.socket.off("b2c-trip-started");
          socket.socket.off("b2c-trip-completed");
          socket.socket.off("trip-started");
          socket.socket.off("trip-completed");
          socket.socket.off("driver-status-change");
          socket.socket.off("driver-location-update");
          socket.socket.off("BOOKING_AUTO_CANCELLED");
          socket.socket.off("notification");
        }
      };
    }
  }, [
    socket,
    auth.user,
    dispatch,
    isTrackingActive,
    selectedBooking,
    updateMapBounds,
  ]);

  // Join booking rooms for confirmed bookings
  useEffect(() => {
    if (socket.socket && passengerBookings.length > 0) {
      passengerBookings.forEach((booking) => {
        if (
          ["ACCEPTED", "ACTIVE", "IN_PROGRESS", "CONFIRMED"].includes(
            booking.bookingStatus,
          ) &&
          booking._id
        ) {
          socket.joinBookingRoom(booking._id);
          console.log(
            "🗺️ Joined booking room:",
            booking._id,
            "Status:",
            booking.bookingStatus,
          );
        }
      });
    }
  }, [socket, passengerBookings]);

  // Poll driver location via API when tracking is active (as fallback to socket)
  useEffect(() => {
    if (!isTrackingActive || !selectedBooking) return;

    const pollDriverLocation = async () => {
      try {
        const driverId = selectedBooking.isSelfDriver
          ? selectedBooking.b2cPartnerId?._id || selectedBooking.b2cPartnerId
          : selectedBooking.assignedDriverId?._id ||
            selectedBooking.assignedDriverId ||
            selectedBooking.driverId;

        if (!driverId) return;

        console.log(
          "[v0] Polling driver location via API for driverId:",
          driverId,
        );
        // Pass bookingId to ensure we get the correct trip for this specific booking
        const response = await commuterBookingAPI.getDriverLocation(
          driverId,
          selectedBooking._id,
        );
        console.log("[v0] Driver location API poll response:", response);

        if (response.success && response.data) {
          const tripStatus = response.data.tripStatus;
          const isLocationAvailable = response.data.isLocationAvailable;

          if (
            !isLocationAvailable &&
            (tripStatus === "SCHEDULED" || tripStatus === "Scheduled")
          ) {
            // Trip has not started yet
            setTripStatusMessage(
              response.data.message ||
                "Trip has not started yet. Driver location will be available once the trip begins.",
            );
          } else if (response.data.location) {
            // Trip is in progress, clear the message and update location
            setTripStatusMessage(null);
            const locationData = response.data.location;
            const lat = locationData.latitude || locationData.lat;
            const lng = locationData.longitude || locationData.lng;

            if (lat && lng) {
              console.log("[v0] Got driver location from API poll:", lat, lng);
              setDriverLocations((prev) => ({
                ...prev,
                [driverId]: {
                  lat: lat,
                  lng: lng,
                  timestamp: Date.now(),
                },
              }));
              if (isTrackingActive) {
                updateMapBounds(lat, lng);
              }
            }
          } else {
            // No location available
            setTripStatusMessage(
              response.data.message || "Driver location not available",
            );
          }
        }
      } catch (err) {
        console.error("[v0] Error polling driver location:", err);
      }
    };

    // Poll immediately when tracking starts
    pollDriverLocation();

    // Poll every 5 seconds as a fallback (more frequent for better UX)
    const pollInterval = setInterval(() => {
      pollDriverLocation();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isTrackingActive, selectedBooking, driverLocations, updateMapBounds]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      // A new booking is awaiting the B2C partner's approval.
      PENDING: { color: "#d69e2e", label: "Pending Approval" },
      // Legacy "CONFIRMED" also represents the awaiting-approval state, so it must
      // read as pending — NOT confirmed — until the partner actually accepts it.
      CONFIRMED: { color: "#d69e2e", label: "Pending Approval" },
      // The partner has accepted the booking: this is the real "Confirmed" state.
      ACCEPTED: { color: "#38a169", label: "Confirmed" },
      COMPLETED: { color: "#3182ce", label: "Completed" },
      REJECTED: { color: "#e53e3e", label: "Rejected" },
      CANCELLED: { color: "#718096", label: "Cancelled" },
      IN_PROGRESS: { color: "#d69e2e", label: "In Progress" },
      ACTIVE: { color: "#38a169", label: "Active" },
    };
    return statusConfig[status] || { color: "#718096", label: status };
  };

  const handleTrackingClick = (booking) => {
    startRealTimeTracking(booking);
  };

  const handleNoShowClick = (booking) => {
    setNoShowBooking(booking);
    setNoShowReason("");
    setNoShowCustomReason("");
    setShowNoShowModal(true);
  };

  // Navigate to booking details page
  const handleViewDetails = (booking) => {
    navigate(`/commuter/my-bookings/${booking._id}`);
  };

  // Handle auto-cancel modal close and redirect to home page
  const handleAutoCancelRedirect = () => {
    setShowAutoCancelModal(false);
    setAutoCancelData(null);
    navigate("/"); // Redirect to CommuterHomePage
  };

  // Close auto-cancel modal without redirect
  const handleAutoCancelClose = () => {
    setShowAutoCancelModal(false);
    setAutoCancelData(null);
  };

  const handleSubmitNoShow = async () => {
    if (!noShowReason) {
      notify("Please select a reason for no-show");
      return;
    }
    if (noShowReason === "OTHER" && !noShowCustomReason.trim()) {
      notify("Please provide a custom reason");
      return;
    }
    try {
      setNoShowLoading(true);
      await commuterBookingAPI.markNoShow({
        tripId: noShowBooking.tripId || null,
        bookingId: noShowBooking._id,
        monthlyPassId:
          noShowBooking.monthlyPassId || noShowBooking.monthlyPass?._id,
        reason: noShowReason,
        customReason: noShowReason === "OTHER" ? noShowCustomReason : null,
        date: new Date().toISOString(),
      });
      notify("No-show marked successfully. Your seat has been released.");
      setShowNoShowModal(false);
      setNoShowBooking(null);
      dispatch(getPassengerBookings());
    } catch (error) {
      notify(error.response?.data?.message || "Failed to mark no-show");
    } finally {
      setNoShowLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  // Parse location string to coordinates (handle both coordinates and city names)
  const parseLocation = (locationStr) => {
    if (!locationStr) return null;

    // Check if it's already in coordinate format (lat,lng)
    const parts = locationStr.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { lat, lng };
      }
    }

    // If it's a city name, use geocoding (fallback to common coordinates)
    return getCityCoordinates(locationStr);
  };

  // Get coordinates for common cities (fallback geocoding)
  const getCityCoordinates = (cityName) => {
    const cityCoordinates = {
      Nagda: { lat: 23.4638, lng: 75.4247 },
      Ujjain: { lat: 23.1826, lng: 75.7772 },
      Indore: { lat: 22.7196, lng: 75.8577 },
      Bhopal: { lat: 23.2599, lng: 77.4126 },
      Delhi: { lat: 28.7041, lng: 77.1025 },
      Mumbai: { lat: 19.076, lng: 72.8777 },
      Bangalore: { lat: 12.9716, lng: 77.5946 },
      Chennai: { lat: 13.0827, lng: 80.2707 },
      Kolkata: { lat: 22.5726, lng: 88.3639 },
      Hyderabad: { lat: 17.385, lng: 78.4867 },
      Pune: { lat: 18.5204, lng: 73.8567 },
      Jaipur: { lat: 26.9124, lng: 75.7873 },
      Lucknow: { lat: 26.8467, lng: 80.9462 },
      Ahmedabad: { lat: 23.0225, lng: 72.5714 },
      Surat: { lat: 21.1702, lng: 72.8311 },
      Kanpur: { lat: 26.4499, lng: 80.3319 },
      Nagpur: { lat: 21.1458, lng: 79.0882 },
      Patna: { lat: 25.5941, lng: 85.1376 },
      Agra: { lat: 27.1767, lng: 78.0081 },
      Varanasi: { lat: 25.3176, lng: 82.9739 },
    };

    // Try exact match first
    const normalizedName = cityName.toLowerCase().trim();
    let coordinates = cityCoordinates[cityName];

    // If not found, try partial match
    if (!coordinates) {
      const cityKey = Object.keys(cityCoordinates).find(
        (key) =>
          key.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(key.toLowerCase()),
      );
      coordinates = cityCoordinates[cityKey];
    }

    return coordinates || { lat: 20.5937, lng: 78.9629 }; // Default to India center
  };

  // Calculate ETA based on distance and average speed (40 km/h in city)
  const calculateETA = (distance) => {
    const avgSpeed = 40; // km/h
    const timeInHours = distance / avgSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);

    if (timeInMinutes < 60) {
      return `${timeInMinutes} minutes`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const minutes = timeInMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  // Get formatted location address with reverse geocoding
  const getFormattedLocation = (locationStr) => {
    if (!locationStr) return "Unknown Location";

    // If it's coordinates, try to reverse geocode to city name
    const coords = parseLocation(locationStr);
    if (coords && coords.lat && coords.lng) {
      // Check if it's a known city
      const cityKey = Object.keys({
        Nagda: { lat: 23.4638, lng: 75.4247 },
        Ujjain: { lat: 23.1826, lng: 75.7772 },
        Indore: { lat: 22.7196, lng: 75.8577 },
        Bhopal: { lat: 23.2599, lng: 77.4126 },
        Delhi: { lat: 28.7041, lng: 77.1025 },
        Mumbai: { lat: 19.076, lng: 72.8777 },
        Bangalore: { lat: 12.9716, lng: 77.5946 },
        Chennai: { lat: 13.0827, lng: 80.2707 },
        Kolkata: { lat: 22.5726, lng: 88.3639 },
        Hyderabad: { lat: 17.385, lng: 78.4867 },
        Pune: { lat: 18.5204, lng: 73.8567 },
        Jaipur: { lat: 26.9124, lng: 75.7873 },
        Lucknow: { lat: 26.8467, lng: 80.9462 },
        Ahmedabad: { lat: 23.0225, lng: 72.5714 },
        Surat: { lat: 21.1702, lng: 72.8311 },
        Kanpur: { lat: 26.4499, lng: 80.3319 },
        Nagpur: { lat: 21.1458, lng: 79.0882 },
        Patna: { lat: 25.5941, lng: 85.1376 },
        Agra: { lat: 27.1767, lng: 78.0081 },
        Varanasi: { lat: 25.3176, lng: 82.9739 },
      }).find((key) => {
        const cityCoords = {
          Nagda: { lat: 23.4638, lng: 75.4247 },
          Ujjain: { lat: 23.1826, lng: 75.7772 },
          Indore: { lat: 22.7196, lng: 75.8577 },
          Bhopal: { lat: 23.2599, lng: 77.4126 },
          Delhi: { lat: 28.7041, lng: 77.1025 },
          Mumbai: { lat: 19.076, lng: 72.8777 },
          Bangalore: { lat: 12.9716, lng: 77.5946 },
          Chennai: { lat: 13.0827, lng: 80.2707 },
          Kolkata: { lat: 22.5726, lng: 88.3639 },
          Hyderabad: { lat: 17.385, lng: 78.4867 },
          Pune: { lat: 18.5204, lng: 73.8567 },
          Jaipur: { lat: 26.9124, lng: 75.7873 },
          Lucknow: { lat: 26.8467, lng: 80.9462 },
          Ahmedabad: { lat: 23.0225, lng: 72.5714 },
          Surat: { lat: 21.1702, lng: 72.8311 },
          Kanpur: { lat: 26.4499, lng: 80.3319 },
          Nagpur: { lat: 21.1458, lng: 79.0882 },
          Patna: { lat: 25.5941, lng: 85.1376 },
          Agra: { lat: 27.1767, lng: 78.0081 },
          Varanasi: { lat: 25.3176, lng: 82.9739 },
        }[key];
        return (
          cityCoords &&
          Math.abs(cityCoords.lat - coords.lat) < 0.5 &&
          Math.abs(cityCoords.lng - coords.lng) < 0.5
        );
      });

      if (cityKey) {
        return cityKey;
      }

      // If no city match, try to get area/region information
      return getLocationDescription(coords.lat, coords.lng);
    }

    // If it's a city name, return it as is
    return locationStr;
  };

  // Get location description based on coordinates
  const getLocationDescription = (lat, lng) => {
    // Simple reverse geocoding based on coordinate ranges
    // This is a simplified version - in production you'd use a proper geocoding API

    // Major regions in India
    if (lat > 28 && lat < 30 && lng > 76 && lng < 78) return "Delhi NCR";
    if (lat > 19 && lat < 20 && lng > 72 && lng < 73) return "Mumbai Area";
    if (lat > 12 && lat < 14 && lng > 77 && lng < 78) return "Bangalore Area";
    if (lat > 13 && lat < 14 && lng > 80 && lng < 81) return "Chennai Area";
    if (lat > 22 && lat < 23 && lng > 88 && lng < 89) return "Kolkata Area";
    if (lat > 17 && lat < 18 && lng > 78 && lng < 79) return "Hyderabad Area";
    if (lat > 18 && lat < 19 && lng > 73 && lng < 74) return "Pune Area";
    if (lat > 26 && lat < 27 && lng > 75 && lng < 76) return "Jaipur Area";
    if (lat > 26 && lat < 27 && lng > 80 && lng < 81) return "Lucknow Area";
    if (lat > 23 && lat < 24 && lng > 72 && lng < 73) return "Ahmedabad Area";
    if (lat > 21 && lat < 22 && lng > 72 && lng < 73) return "Surat Area";
    if (lat > 26 && lat < 27 && lng > 80 && lng < 81) return "Kanpur Area";
    if (lat > 21 && lat < 22 && lng > 79 && lng < 80) return "Nagpur Area";
    if (lat > 25 && lat < 26 && lng > 85 && lng < 86) return "Patna Area";
    if (lat > 27 && lat < 28 && lng > 77 && lng < 79) return "Agra Area";
    if (lat > 25 && lat < 26 && lng > 82 && lng < 83) return "Varanasi Area";

    // Madhya Pradesh regions
    if (lat > 23 && lat < 24 && lng > 75 && lng < 76) return "Ujjain Area";
    if (lat > 23 && lat < 24 && lng > 75 && lng < 76) return "Nagda Area";
    if (lat > 22 && lat < 23 && lng > 75 && lng < 77) return "Indore Area";
    if (lat > 23 && lat < 24 && lng > 77 && lng < 78) return "Bhopal Area";

    // Default to general area
    if (lat > 20 && lat < 30 && lng > 70 && lng < 90) return "Central India";
    if (lat > 8 && lat < 20 && lng > 70 && lng < 80) return "West India";
    if (lat > 20 && lat < 30 && lng > 80 && lng < 90) return "East India";
    if (lat > 10 && lat < 20 && lng > 77 && lng < 85) return "South India";
    if (lat > 25 && lat < 35 && lng > 70 && lng < 80) return "North India";

    return "India";
  };

  //     const handleTrackingClick = (booking) => {
  //       console.log("Booking", booking);
  //     setSelectedBooking(booking);
  //     setShowTracking(true);
  //   };

  return (
    <div className="cmbp-my-bookings-page">
      <div className="cmbp-bookings-container">
        <div className="cmbp-bookings-header">
          <h1>My Bookings</h1>
          <p>
            {userType === "CORPORATE_EMPLOYEE"
              ? "Your company-sponsored ride bookings"
              : "View and manage your ride bookings"}
          </p>
        </div>

        <div className="cmbp-filter-section">
          <button
            className={`cmbp-filter-btn ${filterStatus === "all" ? "cmbp-active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All Bookings
          </button>
          <button
            className={`cmbp-filter-btn ${filterStatus === "PENDING" ? "cmbp-active" : ""}`}
            onClick={() => setFilterStatus("PENDING")}
          >
            Pending Approval
          </button>
          <button
            className={`cmbp-filter-btn ${filterStatus === "ACCEPTED" ? "cmbp-active" : ""}`}
            onClick={() => setFilterStatus("ACCEPTED")}
          >
            Confirmed
          </button>
          <button
            className={`cmbp-filter-btn ${filterStatus === "COMPLETED" ? "cmbp-active" : ""}`}
            onClick={() => setFilterStatus("COMPLETED")}
          >
            Completed
          </button>
        </div>

        {loading ? (
          <div className="cmbp-loading-state">
            <p>Loading your bookings...</p>
          </div>
        ) : passengerBookings.length === 0 ? (
          <div className="cmbp-empty-state">
            <p>No bookings found</p>
            <p className="cmbp-empty-subtitle">
              {userType === "CORPORATE_EMPLOYEE"
                ? "Your company has not assigned any rides yet"
                : "Start booking a ride to see them here"}
            </p>
          </div>
        ) : (
          <div className="cmbp-bookings-grid">
            {passengerBookings.map((booking, bookingIndex) => {
              // Stable unique identifier for this card. Falls back to index so
              // that even if a booking is missing _id, each card still gets a
              // distinct expand key (prevents all cards toggling together).
              const bookingKey = String(
                booking._id || booking.bookingId || `idx-${bookingIndex}`,
              );
              const statusConfig = getStatusBadge(booking.bookingStatus);
              const statusClass =
                booking.bookingStatus?.toLowerCase().replace("_", "-") ||
                "pending";

              // Get driver info
              const driverId =
                booking.assignedDriverId ||
                booking.b2cPartnerId?._id ||
                booking.b2cPartnerId;
              const driverName =
                booking.driverInfo?.name ||
                booking.driverName ||
                (booking.isSelfDriver
                  ? booking.b2cPartnerId?.fullName
                  : null) ||
                booking.b2cPartnerId?.fullName ||
                "Not Assigned";
              const isOnline = isDriverOnline(driverId);

              // Get vehicle info
              const vehicleModel =
                booking.vehicleInfo?.model ||
                booking.vehicleModel ||
                booking.routeId?.assignedVehicle?.model ||
                "N/A";
              const vehiclePlate =
                booking.vehicleInfo?.licensePlate ||
                booking.vehiclePlate ||
                booking.routeId?.assignedVehicle?.licensePlate;

              // Get route info
              const fromLocation =
                booking.type === "CORPORATE"
                  ? booking.routeId?.fromLocation || booking.pickupLocation
                  : booking.pickupLocation || "N/A";
              const toLocation =
                booking.type === "CORPORATE"
                  ? booking.routeId?.toLocation || booking.dropoffLocation
                  : booking.dropoffLocation || "N/A";

              // Get amount
              const amount =
                booking.paymentAmount ||
                booking.totalAmount ||
                booking.price ||
                0;
              const currency = booking.currency || localeCurrency;

              return (
                <div key={bookingKey} className="cmbp-booking-card">
                  {/* Card Header with Gradient */}
                  <div className="cmbp-card-header">
                    <div className="cmbp-card-header-content">
                      <div className="cmbp-route-info">
                        <div className="cmbp-route-display">
                          <span
                            className="cmbp-route-from"
                            title={fromLocation}
                          >
                            {fromLocation}
                          </span>
                          <span className="cmbp-route-arrow">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </span>
                          <span className="cmbp-route-to" title={toLocation}>
                            {toLocation}
                          </span>
                        </div>
                        <div className="cmbp-booking-date-badge">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="18"
                              rx="2"
                              ry="2"
                            />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {formatDate(booking.travelDate || booking.createdAt)}
                        </div>
                      </div>
                      <span className={`cmbp-status-chip ${statusClass}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="cmbp-card-body">
                    {/* Quick Info Row */}
                    <div className="cmbp-quick-info">
                      <div className="cmbp-info-item">
                        <div className="cmbp-info-icon driver">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div className="cmbp-info-text">
                          <span className="cmbp-info-label">Driver</span>
                          <span
                            className={`cmbp-info-value ${isOnline ? "online" : "offline"}`}
                          >
                            {driverName}
                            {driverId && (
                              <span style={{ marginLeft: 6, fontSize: 10 }}>
                                {isOnline ? "●" : "○"}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="cmbp-info-item">
                        <div className="cmbp-info-icon vehicle">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10H8s-2.7.6-4.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2" />
                            <circle cx="7" cy="17" r="2" />
                            <circle cx="17" cy="17" r="2" />
                          </svg>
                        </div>
                        <div className="cmbp-info-text">
                          <span className="cmbp-info-label">Vehicle</span>
                          <span className="cmbp-info-value">
                            {vehicleModel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compact Details Row */}
                    <div className="cmbp-compact-details">
                      <div className="cmbp-detail-chip">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M7 15h0M2 9h20" />
                        </svg>
                        <strong>{booking.paymentMethod || "Wallet"}</strong>
                      </div>
                      <div className="cmbp-detail-chip">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <strong>{booking.numberOfSeats || 1}</strong> seat
                        {(booking.numberOfSeats || 1) > 1 ? "s" : ""}
                      </div>
                      <div className="cmbp-amount-display">
                        {amount.toFixed(2)}
                        <span className="cmbp-amount-currency">{currency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="cmbp-card-actions">
                    {/* CRITICAL: Track button visibility logic:
                        1. Booking must be ACCEPTED or IN_PROGRESS (not PENDING, CONFIRMED, or COMPLETED)
                        2. Trip must be IN_PROGRESS - checked via multiple sources:
                           - outboundTripStatus/returnTripStatus fields
                           - hasActiveTripInProgress flag (computed by backend from actual trip data)
                        - For ONE_WAY: Show only if outboundTripStatus is IN_PROGRESS
                        - For ROUND_TRIP: Show if outboundTripStatus OR returnTripStatus is IN_PROGRESS */}
                    {(() => {
                      // First check: Booking must be ACCEPTED or IN_PROGRESS status
                      // PENDING/CONFIRMED means waiting for partner acceptance - no tracking yet
                      // COMPLETED means all trips done - no tracking needed
                      const bookingIsTrackable = [
                        "ACCEPTED",
                        "IN_PROGRESS",
                      ].includes(booking.bookingStatus);

                      if (!bookingIsTrackable) {
                        return null; // Don't show track button if booking not accepted/in_progress
                      }

                      // Second check: At least one trip must be IN_PROGRESS
                      // Check via booking-level fields AND backend-computed hasActiveTripInProgress
                      const outboundStatus =
                        booking.outboundTripStatus || "SCHEDULED";
                      const returnStatus =
                        booking.returnTripStatus || "SCHEDULED";
                      const isRoundTrip = booking.bookingType === "ROUND_TRIP";

                      // Show track button ONLY when trip is IN_PROGRESS
                      // NOT before trip starts (SCHEDULED) and NOT after trip completes (COMPLETED)
                      const outboundInProgress =
                        outboundStatus === "IN_PROGRESS";
                      const returnInProgress =
                        isRoundTrip && returnStatus === "IN_PROGRESS";

                      // CRITICAL: Also check hasActiveTripInProgress which is computed by backend
                      // from the actual trip data (more reliable than booking-level fields)
                      const showTrack =
                        outboundInProgress ||
                        returnInProgress ||
                        booking.hasActiveTripInProgress;

                      return showTrack ? (
                        <button
                          className="cmbp-action-btn track"
                          onClick={() => handleTrackingClick(booking)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                          </svg>
                          Track
                        </button>
                      ) : null;
                    })()}
                    {booking.monthlyPassId && (
                      <button
                        className="cmbp-action-btn download"
                        onClick={() =>
                          handleDownloadPassCertificate(booking.monthlyPassId)
                        }
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Pass
                      </button>
                    )}
                    <button
                      className="cmbp-action-btn primary"
                      onClick={() => handleViewDetails(booking)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Details
                    </button>
                  </div>

                  {/* Daily Trips Toggle (Collapsible) */}
                  {(booking.bookingStatus === "CONFIRMED" ||
                    booking.bookingStatus === "IN_PROGRESS" ||
                    booking.bookingStatus === "ACTIVE" ||
                    booking.bookingStatus === "ACCEPTED") && (
                    <DailyTripsInBooking
                      booking={booking}
                      userRole={userType}
                      isExpanded={expandedBookings.has(bookingKey)}
                      onToggleExpand={() => toggleBookingExpansion(bookingKey)}
                      onTripStatusChange={(status, tripId) => {
                        dispatch(getPassengerBookings());
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showTracking && selectedBooking && (
        <div
          className="cmbp-tracking-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="cmbp-tracking-modal"
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "800px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div
              className="cmbp-tracking-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3>🗺️ Driver Tracking</h3>
              <button
                onClick={() => setShowTracking(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              className="cmbp-tracking-info"
              style={{ marginBottom: "20px" }}
            >
              <p>
                <strong>Route:</strong>{" "}
                {(() => {
                  const modalRoute =
                    selectedBooking.type === "CORPORATE"
                      ? `${selectedBooking.routeId?.fromLocation || selectedBooking.pickupLocation} → ${selectedBooking.routeId?.toLocation || selectedBooking.dropoffLocation}`
                      : `${selectedBooking.pickupLocation} → ${selectedBooking.dropoffLocation}`;

                  return modalRoute;
                })()}
              </p>
              <p>
                <strong>Driver:</strong>{" "}
                {selectedBooking.driverInfo?.name ||
                  selectedBooking.driverName ||
                  (selectedBooking.isSelfDriver
                    ? "Self"
                    : selectedBooking.b2cPartnerId?.fullName) ||
                  "Assigned Driver"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {(() => {
                  // Determine driver ID based on isSelfDriver flag
                  let driverId;
                  if (selectedBooking.type === "B2C") {
                    if (selectedBooking.isSelfDriver) {
                      driverId =
                        selectedBooking.b2cPartnerId?._id ||
                        selectedBooking.b2cPartnerId;
                    } else {
                      driverId =
                        selectedBooking.assignedDriverId ||
                        selectedBooking.b2cPartnerId?._id ||
                        selectedBooking.b2cPartnerId;
                    }
                  } else {
                    driverId = selectedBooking.driverId;
                  }

                  const online = driverId && isDriverOnline(driverId);

                  return (
                    <span
                      style={{
                        color: online ? "#28a745" : "#ffc107",
                        fontWeight: "bold",
                      }}
                    >
                      {online ? "🟢 Driver Online" : "🟡 Driver Offline"}
                    </span>
                  );
                })()}
              </p>
            </div>

            {/* Enhanced Real-Time Map */}
            <div
              className="cmbp-map-container"
              style={{
                height: "450px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "2px solid #e0e0e0",
                position: "relative",
                background: "#f8f9fa",
              }}
            >
              {(() => {
                // For B2C bookings, determine driverId based on isSelfDriver flag
                let driverId;
                if (selectedBooking.type === "B2C") {
                  if (selectedBooking.isSelfDriver) {
                    // When isSelfDriver is true, the B2C_PARTNER is the driver
                    driverId =
                      selectedBooking.b2cPartnerId?._id ||
                      selectedBooking.b2cPartnerId;
                  } else {
                    // When isSelfDriver is false, use assignedDriverId (B2C_PARTNER_DRIVER)
                    driverId =
                      selectedBooking.assignedDriverId ||
                      selectedBooking.b2cPartnerId?._id ||
                      selectedBooking.b2cPartnerId;
                  }
                } else {
                  driverId = selectedBooking.driverId;
                }
                return driverId && getDriverLocation(driverId) ? (
                  <>
                    {/* Enhanced Real-Time Map with Driver Icon */}
                    <iframe
                      title="Live Driver Tracking Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds ? `${mapBounds.west},${mapBounds.south},${mapBounds.east},${mapBounds.north}` : `${getDriverLocation(driverId).lng - 0.005},${getDriverLocation(driverId).lat - 0.005},${getDriverLocation(driverId).lng + 0.005},${getDriverLocation(driverId).lat + 0.005}`}&layer=mapnik&mlat=${getDriverLocation(driverId).lat}&mlon=${getDriverLocation(driverId).lng}&zoom=18`}
                      style={{ border: 0 }}
                      allowFullScreen
                    />

                    {/* Uber/Ola Style Driver Icon Overlay */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 1000,
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          backgroundColor: "#007bff",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 10px rgba(0, 123, 255, 0.5)",
                          border: "3px solid white",
                          animation: isTrackingActive
                            ? "driverPulse 2s infinite"
                            : "none",
                        }}
                      >
                        <span style={{ fontSize: "20px", color: "white" }}>
                          🚗
                        </span>
                      </div>
                      {selectedBooking.bookingStatus === "IN_PROGRESS" && (
                        <div
                          style={{
                            position: "absolute",
                            top: "-25px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            backgroundColor: "#28a745",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: "600",
                            whiteSpace: "nowrap",
                          }}
                        >
                          En Route
                        </div>
                      )}
                    </div>

                    {/* Real-time Status Badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        backgroundColor: isTrackingActive
                          ? "rgba(40, 167, 69, 0.9)"
                          : "rgba(255, 193, 7, 0.9)",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        zIndex: 1000,
                        animation: isTrackingActive
                          ? "pulse 2s infinite"
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "white",
                          animation: isTrackingActive
                            ? "blink 1s infinite"
                            : "none",
                        }}
                      />
                      {isTrackingActive ? "LIVE TRACKING" : "TRACKING PAUSED"}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      height: "100%",
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      color: "white",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "48px",
                        marginBottom: "16px",
                        animation: "float 3s ease-in-out infinite",
                      }}
                    >
                      ����️
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                      {tripStatusMessage
                        ? "Trip Not Started Yet"
                        : driverId
                          ? selectedBooking.bookingStatus === "ACCEPTED"
                            ? "Trip Not Started Yet"
                            : "Waiting for Driver Location..."
                          : "No Driver Assigned Yet"}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        opacity: 0.9,
                        textAlign: "center",
                        maxWidth: "300px",
                      }}
                    >
                      {tripStatusMessage
                        ? tripStatusMessage
                        : driverId
                          ? selectedBooking.bookingStatus === "ACCEPTED"
                            ? "The driver has not started the trip yet. Location tracking will be available once the driver starts the trip."
                            : "Your driver will appear here once they start sharing their location"
                          : "Driver assignment information will appear here once confirmed"}
                    </p>
                  </div>
                );
              })()}

              {/* Map Info Overlay */}
              {(() => {
                // For B2C bookings, determine driverId based on isSelfDriver flag
                let driverId;
                if (selectedBooking.type === "B2C") {
                  if (selectedBooking.isSelfDriver) {
                    driverId =
                      selectedBooking.b2cPartnerId?._id ||
                      selectedBooking.b2cPartnerId;
                  } else {
                    driverId =
                      selectedBooking.assignedDriverId ||
                      selectedBooking.b2cPartnerId?._id ||
                      selectedBooking.b2cPartnerId;
                  }
                } else {
                  driverId = selectedBooking.driverId;
                }

                return (
                  driverId &&
                  getDriverLocation(driverId) && (
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "12px",
                        zIndex: 1000,
                        maxWidth: "300px",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                      }}
                    >
                      {(() => {
                        const driverLoc = getDriverLocation(driverId);
                        const pickupLoc =
                          selectedBooking.type === "CORPORATE"
                            ? parseLocation(
                                selectedBooking.routeId?.fromLocation,
                              )
                            : parseLocation(selectedBooking.pickupLocation);

                        if (driverLoc && pickupLoc) {
                          const distance = calculateDistance(
                            driverLoc.lat,
                            driverLoc.lng,
                            pickupLoc.lat,
                            pickupLoc.lng,
                          );
                          const eta = calculateETA(distance);

                          console.log("Calculated Distance:", distance);
                          console.log("Calculated ETA:", eta);

                          return (
                            <div
                              style={{
                                marginBottom: "8px",
                                paddingBottom: "8px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: "600",
                                  marginBottom: "4px",
                                  color: "#28a745",
                                }}
                              >
                                📏 Distance & Arrival Time
                              </div>
                              <div style={{ fontSize: "11px", color: "#666" }}>
                                <div style={{ marginBottom: "2px" }}>
                                  <strong>Distance from pickup:</strong>{" "}
                                  {distance.toFixed(1)} km
                                </div>
                                <div style={{ marginBottom: "2px" }}>
                                  <strong>Estimated arrival:</strong> {eta}
                                </div>
                                <div
                                  style={{
                                    backgroundColor:
                                      distance < 2
                                        ? "#d4edda"
                                        : distance < 5
                                          ? "#fff3cd"
                                          : "#f8d7da",
                                    color:
                                      distance < 2
                                        ? "#155724"
                                        : distance < 5
                                          ? "#856404"
                                          : "#721c24",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    fontWeight: "600",
                                    display: "inline-block",
                                    marginTop: "4px",
                                  }}
                                >
                                  {distance < 2
                                    ? "🟢 Very Close"
                                    : distance < 5
                                      ? "🟡 On the Way"
                                      : "🔴 Far"}
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          console.log(
                            "Cannot calculate distance - missing locations",
                          );
                          return (
                            <div
                              style={{
                                marginBottom: "8px",
                                paddingBottom: "8px",
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: "600",
                                  marginBottom: "4px",
                                  color: "#dc3545",
                                }}
                              >
                                ⚠️ Location Information
                              </div>
                              <div style={{ fontSize: "11px", color: "#666" }}>
                                <div style={{ marginBottom: "2px" }}>
                                  Driver Location:{" "}
                                  {driverLoc ? "Available" : "Not Available"}
                                </div>
                                <div style={{ marginBottom: "2px" }}>
                                  Pickup Location:{" "}
                                  {pickupLoc ? "Available" : "Not Available"}
                                </div>
                                <div
                                  style={{
                                    backgroundColor: "#f8d7da",
                                    color: "#721c24",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    fontWeight: "600",
                                    display: "inline-block",
                                    marginTop: "4px",
                                  }}
                                >
                                  📍 Cannot calculate distance
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })()}

                      {/* Route Information */}
                      <div style={{ marginBottom: "8px" }}>
                        <div
                          style={{
                            fontWeight: "600",
                            marginBottom: "4px",
                            color: "#007bff",
                          }}
                        >
                          🛣️ Route Information
                        </div>
                        <div style={{ fontSize: "11px", color: "#666" }}>
                          <div style={{ marginBottom: "2px" }}>
                            <strong>Pickup:</strong>{" "}
                            {selectedBooking.type === "CORPORATE"
                              ? selectedBooking.routeId?.fromLocation
                              : selectedBooking.pickupLocation}
                          </div>
                          <div>
                            <strong>Dropoff:</strong>{" "}
                            {selectedBooking.type === "CORPORATE"
                              ? selectedBooking.routeId?.toLocation
                              : selectedBooking.dropoffLocation}
                          </div>
                        </div>
                      </div>

                      {/* Driver Status */}
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#666",
                          marginTop: "4px",
                        }}
                      >
                        <div
                          style={{
                            color:
                              (selectedBooking.driverId &&
                                isDriverOnline(selectedBooking.driverId)) ||
                              (selectedBooking.b2cPartnerId &&
                                isDriverOnline(
                                  selectedBooking.b2cPartnerId._id ||
                                    selectedBooking.b2cPartnerId,
                                ))
                                ? "#28a745"
                                : "#ffc107",
                            fontWeight: "600",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            border: `1px solid ${
                              (selectedBooking.driverId &&
                                isDriverOnline(selectedBooking.driverId)) ||
                              (selectedBooking.b2cPartnerId &&
                                isDriverOnline(
                                  selectedBooking.b2cPartnerId._id ||
                                    selectedBooking.b2cPartnerId,
                                ))
                                ? "rgba(40, 167, 69, 0.2)"
                                : "rgba(255, 193, 7, 0.2)"
                            }`,
                            backgroundColor:
                              (selectedBooking.driverId &&
                                isDriverOnline(selectedBooking.driverId)) ||
                              (selectedBooking.b2cPartnerId &&
                                isDriverOnline(
                                  selectedBooking.b2cPartnerId._id ||
                                    selectedBooking.b2cPartnerId,
                                ))
                                ? "rgba(40, 167, 69, 0.1)"
                                : "rgba(255, 193, 7, 0.1)",
                            display: "inline-block",
                          }}
                        >
                          {(selectedBooking.driverId &&
                            isDriverOnline(selectedBooking.driverId)) ||
                          (selectedBooking.b2cPartnerId &&
                            isDriverOnline(
                              selectedBooking.b2cPartnerId._id ||
                                selectedBooking.b2cPartnerId,
                            ))
                            ? "🟢 Online"
                            : "🟡 Offline"}
                        </div>
                      </div>
                    </div>
                  )
                );
              })()}

              <button
                className="cmbp-track-btn"
                onClick={() => startRealTimeTracking(selectedBooking)}
                style={{
                  background:
                    "linear-gradient(135deg, #007bff 0%, #0056b3 100%)",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(0, 123, 255, 0.3)",
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(0, 123, 255, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 2px 8px rgba(0, 123, 255, 0.3)";
                }}
              >
                🗺️ Track Driver
              </button>

              <button
                onClick={() => stopRealTimeTracking()}
                style={{
                  background:
                    "linear-gradient(135deg, #dc3545 0%, #c82333 100%)",
                  color: "white",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  transition: "all 0.3s ease",
                  boxShadow: "0 2px 8px rgba(220, 53, 69, 0.3)",
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(220, 53, 69, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 2px 8px rgba(220, 53, 69, 0.3)";
                }}
              >
                🛑 Stop Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No-Show Modal */}
      {showNoShowModal && noShowBooking && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "480px",
              width: "90%",
            }}
          >
            <h3 style={{ marginBottom: "8px", fontSize: "18px" }}>
              Mark No-Show
            </h3>
            <p
              style={{
                color: "#6c757d",
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              {
                "Can't make it today? Mark no-show to release your seat for other passengers."
              }
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "8px",
                  fontSize: "14px",
                }}
              >
                Reason
              </label>
              <select
                value={noShowReason}
                onChange={(e) => setNoShowReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">Select a reason</option>
                <option value="SICK_LEAVE">Sick Leave</option>
                <option value="PERSONAL_WORK">Personal Work</option>
                <option value="EMERGENCY">Emergency</option>
                <option value="VACATION">Vacation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {noShowReason === "OTHER" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "8px",
                    fontSize: "14px",
                  }}
                >
                  Please specify
                </label>
                <textarea
                  value={noShowCustomReason}
                  onChange={(e) => setNoShowCustomReason(e.target.value)}
                  placeholder="Describe your reason..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dee2e6",
                    fontSize: "14px",
                    minHeight: "80px",
                    resize: "vertical",
                  }}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowNoShowModal(false);
                  setNoShowBooking(null);
                }}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNoShow}
                disabled={noShowLoading}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "8px",
                  backgroundColor: "#ff6b35",
                  color: "white",
                  cursor: noShowLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  opacity: noShowLoading ? 0.7 : 1,
                }}
              >
                {noShowLoading ? "Submitting..." : "Confirm No-Show"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Cancellation Modal */}
      {showAutoCancelModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Warning Icon */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "12px",
              }}
            >
              Booking Auto-Cancelled
            </h2>

            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                marginBottom: "8px",
                lineHeight: "1.6",
              }}
            >
              Your booking has been automatically cancelled because{" "}
              <strong style={{ color: "#374151" }}>
                {autoCancelData?.partnerName || "the B2C Partner"}
              </strong>{" "}
              did not accept it within 24 hours.
            </p>

            {autoCancelData?.pickupLocation &&
              autoCancelData?.dropoffLocation && (
                <div
                  style={{
                    backgroundColor: "#f9fafb",
                    padding: "16px",
                    borderRadius: "12px",
                    marginTop: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                    <strong>Route:</strong> {autoCancelData.pickupLocation} →{" "}
                    {autoCancelData.dropoffLocation}
                  </p>
                  {autoCancelData?.bookingId && (
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#9ca3af",
                        margin: "8px 0 0 0",
                      }}
                    >
                      Booking ID: #
                      {autoCancelData.bookingId.toString().slice(-8)}
                    </p>
                  )}
                </div>
              )}

            <div
              style={{
                backgroundColor: "#d1fae5",
                padding: "16px",
                borderRadius: "12px",
                marginBottom: "24px",
              }}
            >
              <p style={{ fontSize: "14px", color: "#065f46", margin: 0 }}>
                <strong>Good news!</strong> You can now book with another B2C
                Partner for the same route.
              </p>
            </div>

            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <button
                onClick={handleAutoCancelClose}
                style={{
                  padding: "12px 24px",
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  backgroundColor: "white",
                  color: "#374151",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#f3f4f6";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "white";
                }}
              >
                Stay Here
              </button>
              <button
                onClick={handleAutoCancelRedirect}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "600",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow =
                    "0 4px 12px rgba(102, 126, 234, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }}
              >
                Find New Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommuterMyBookingsPage;
