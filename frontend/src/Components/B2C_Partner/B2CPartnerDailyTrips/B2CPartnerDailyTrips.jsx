"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { notify } from "../../../utils/toast";
import { useSelector } from "react-redux";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import { updateB2CDriverLocation } from "../../../services/b2cPartnerService";
import "./B2CPartnerDailyTrips.css";

/**
 * B2CPartnerDailyTrips - Daily trip management for B2C Partner (Self-Driver)
 *
 * This component is for B2C Partners who are driving themselves (isSelfDriver: true).
 * Similar to DriverDailyTrips but specifically for partner's own trips.
 * Allows partners to start/complete their daily trips.
 */
const B2CPartnerDailyTrips = () => {
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({
    todayTrips: 0,
    completedToday: 0,
    totalTrips: 0,
    inProgressTrips: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("today");
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedTrips, setExpandedTrips] = useState(new Set()); // Changed to Set for multiple expanded trips
  const [error, setError] = useState(null);

  // Location sharing state
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const locationIntervalRef = useRef(null);
  const activeTripIdRef = useRef(null); // Use ref to avoid state closure issues

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(
        "[v0] B2C Partner: Fetching self-driver trips with filter:",
        filter,
      );

      // Fetch trips for B2C Partner who is self-driving
      const response = await api.get(
        `/b2c-daily-trips/partner/self-driver-trips?filter=${filter}`,
      );

      console.log(
        "[v0] B2C Partner self-driver trips response:",
        response.data,
      );

      if (response.data.success) {
        setTrips(response.data.data.trips || []);
        setStats(
          response.data.data.stats || {
            todayTrips: 0,
            completedToday: 0,
            totalTrips: 0,
            inProgressTrips: 0,
          },
        );
      } else {
        setError(response.data.message || "Failed to fetch trips");
        setTrips([]);
      }
    } catch (error) {
      console.error(
        "[B2CPartnerDailyTrips] Error fetching trips:",
        error?.response?.data || error.message,
      );
      setError(error?.response?.data?.message || "Failed to fetch trips");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user?.role === "B2C_PARTNER") {
      fetchTrips();
    }
  }, [fetchTrips, user]);

  // Location sharing functions
  const updateLocation = useCallback(
    async (overrideTripId = null) => {
      // Use overrideTripId if provided, else use ref, else use state
      const effectiveTripId =
        overrideTripId || activeTripIdRef.current || activeTrip?._id;

      if (!navigator.geolocation) {
        console.log("[v0] Geolocation not available in this browser");
        return;
      }

      if (!effectiveTripId) {
        console.log("[v0] Cannot update location - no tripId available");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            tripId: effectiveTripId,
          };

          console.log(
            "[v0] Got geolocation - Sending location update for tripId:",
            effectiveTripId,
            "lat:",
            locationData.latitude,
            "lng:",
            locationData.longitude,
          );

          // Update location via API (which also broadcasts to passengers)
          try {
            const response = await updateB2CDriverLocation(locationData);
            console.log(
              "[v0] B2C Partner location updated via API:",
              locationData.latitude,
              locationData.longitude,
              "Response:",
              response,
            );

            // Log any booking IDs returned from the API so we know passengers are being notified
            if (response?.data?.broadcastedToBookings) {
              console.log(
                "[v0] Location was broadcast to passenger booking rooms via API",
              );
            }
          } catch (err) {
            console.error("[v0] Error updating location via API:", err);
          }

          // Also emit via socket for real-time updates to both trip room and all booking rooms
          if (socket?.socket) {
            // Emit to driver room and trip room
            socket.socket.emit("driver-location-update", {
              driverId: user?._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              tripId: effectiveTripId,
              timestamp: new Date().toISOString(),
              driverType: "B2C_PARTNER",
              isSelfDriver: true,
            });

            // Also emit b2c-driver-location event for compatibility
            socket.socket.emit("b2c-driver-location", {
              driverId: user?._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              tripId: effectiveTripId,
              timestamp: new Date().toISOString(),
            });

            console.log(
              "[v0] B2C Partner location emitted via socket for tripId:",
              effectiveTripId,
            );
          } else {
            console.log(
              "[v0] Socket not connected - cannot emit location via socket",
            );
          }
        },
        (error) => {
          console.error("[v0] Geolocation error:", error);
          let errorMessage = "Failed to get your location. ";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage +=
                "Please allow location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage += "Location request timed out.";
              break;
            default:
              errorMessage += error.message;
          }
          console.error("[v0] Geolocation error message:", errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    },
    [activeTrip, socket, user?._id],
  );

  // Start location sharing with explicit tripId (avoids state closure issues)
  const startLocationSharingWithTrip = useCallback(
    async (tripId) => {
      console.log(
        "[v0] startLocationSharingWithTrip called - tripId:",
        tripId,
        "isSharingLocation:",
        isSharingLocation,
      );

      // Allow restart if tripId is different
      if (isSharingLocation && activeTripIdRef.current === tripId) {
        console.log("[v0] Already sharing location for this trip");
        return;
      }

      // First check if geolocation is available
      if (!navigator.geolocation) {
        notify(
          "Geolocation is not supported by your browser. Please use a modern browser with location services.",
        );
        return;
      }

      // Request location permission first
      try {
        // Try to get permission using the Permissions API if available
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({
            name: "geolocation",
          });
          console.log(
            "[v0] Geolocation permission status:",
            permissionStatus.state,
          );

          if (permissionStatus.state === "denied") {
            notify(
              "Location permission is denied. Please enable location access in your browser settings to share your location with passengers.",
            );
            return;
          }
        }
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // Permissions API not supported, will try geolocation directly
        console.log(
          "[v0] Permissions API not supported, proceeding with geolocation request",
        );
      }

      console.log(
        "[v0] Starting location sharing for B2C Partner with tripId:",
        tripId,
      );

      // Clear any existing interval
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }

      // Store tripId in ref for immediate access
      activeTripIdRef.current = tripId;

      setIsSharingLocation(true);

      // Get initial location with explicit tripId
      console.log("[v0] Calling updateLocation with tripId:", tripId);
      updateLocation(tripId);

      // Update location every 5 seconds
      locationIntervalRef.current = setInterval(() => {
        updateLocation(activeTripIdRef.current);
      }, 5000);

      // Join driver room for socket
      if (socket?.socket) {
        socket.socket.emit("join-driver-room", user?._id);
        console.log("[v0] Joined driver room:", user?._id);
      } else {
        console.log("[v0] Socket not available - cannot join driver room");
      }
    },
    [isSharingLocation, updateLocation, socket, user?._id],
  );

  const stopLocationSharing = useCallback(() => {
    if (!isSharingLocation) return;

    setIsSharingLocation(false);
    activeTripIdRef.current = null; // Clear ref
    console.log("[v0] Stopping location sharing for B2C Partner");

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setActiveTrip(null);
  }, [isSharingLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const handleStartTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      console.log("[v0] B2C Partner: Starting trip:", tripId);

      const response = await api.put(
        `/b2c-daily-trips/partner/start/${tripId}`,
      );
      console.log("[v0] Start trip response:", response.data);

      // IMPORTANT: Fetch fresh trips first to get the updated status
      await fetchTrips();

      // Find the trip with updated data
      // Use a small delay to ensure state is updated
      setTimeout(() => {
        const freshTrips = trips;
        const startedTrip = freshTrips.find((t) => t._id === tripId);
        if (startedTrip) {
          console.log(
            "[v0] Setting active trip for location sharing:",
            startedTrip._id,
          );
          setActiveTrip(startedTrip);
        }
      }, 100);

      // Start location sharing with the tripId directly (don't rely on activeTrip state)
      startLocationSharingWithTrip(tripId);
    } catch (error) {
      console.error(
        "[B2CPartnerDailyTrips] Error starting trip:",
        error?.response?.data || error.message,
      );
      notify(error?.response?.data?.message || "Failed to start trip");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteTrip = async (tripId) => {
    try {
      setActionLoading(tripId);
      console.log("[v0] B2C Partner: Completing trip:", tripId);

      const response = await api.put(
        `/b2c-daily-trips/partner/complete/${tripId}`,
      );
      console.log("[v0] Complete trip response:", response.data);

      // Stop location sharing when trip is completed
      stopLocationSharing();

      await fetchTrips();
    } catch (error) {
      console.error(
        "[B2CPartnerDailyTrips] Error completing trip:",
        error?.response?.data || error.message,
      );
      notify(error?.response?.data?.message || "Failed to complete trip");
    } finally {
      setActionLoading(null);
    }
  };

  const togglePassengerList = (tripId) => {
    setExpandedTrips((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const getStatusLabel = (status) => {
    const map = {
      Scheduled: "Scheduled",
      "In Progress": "In Progress",
      Completed: "Completed",
      Cancelled: "Cancelled",
      Delayed: "Delayed",
    };
    return map[status] || status || "Scheduled";
  };

  const getStatusClass = (status) => {
    const map = {
      Scheduled: "status-scheduled",
      "In Progress": "status-inprogress",
      Completed: "status-completed",
      Cancelled: "status-cancelled",
      Delayed: "status-delayed",
    };
    return map[status] || "status-scheduled";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dateNum: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    };
  };

  const isToday = (dateString) => {
    const tripDate = new Date(dateString);
    const today = new Date();
    return tripDate.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <div className="b2c-partner-daily-trips-container">
        <div className="b2c-partner-daily-trips-loading">
          <div className="b2c-partner-daily-trips-spinner"></div>
          <p>Loading trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-partner-daily-trips-container">
      {/* Header */}
      <div className="b2c-partner-daily-trips-header">
        <div className="b2c-partner-daily-trips-title">
          <h2>Daily Trip Management</h2>
          <p className="b2c-partner-daily-trips-subtitle">
            Manage your self-driving trips - Start or complete trips for all
            passengers at once
          </p>
        </div>
        <div
          className={`b2c-partner-self-driver-badge ${isSharingLocation ? "sharing" : ""}`}
        >
          {isSharingLocation ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Sharing Location
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Self-Driver Mode
            </>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="b2c-partner-daily-trips-stats">
        <div className="b2c-partner-stat-card">
          <span className="b2c-partner-stat-value">{stats.todayTrips}</span>
          <span className="b2c-partner-stat-label">Today</span>
        </div>
        <div className="b2c-partner-stat-card">
          <span className="b2c-partner-stat-value stat-blue">
            {stats.inProgressTrips}
          </span>
          <span className="b2c-partner-stat-label">In Progress</span>
        </div>
        <div className="b2c-partner-stat-card">
          <span className="b2c-partner-stat-value stat-green">
            {stats.completedToday}
          </span>
          <span className="b2c-partner-stat-label">Completed</span>
        </div>
        <div className="b2c-partner-stat-card">
          <span className="b2c-partner-stat-value stat-purple">
            {stats.totalTrips}
          </span>
          <span className="b2c-partner-stat-label">Total</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="b2c-partner-filter-tabs">
        <button
          className={`b2c-partner-filter-btn ${filter === "today" ? "active" : ""}`}
          onClick={() => setFilter("today")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Today ({stats.todayTrips})
        </button>
        <button
          className={`b2c-partner-filter-btn ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Upcoming
        </button>
        <button
          className={`b2c-partner-filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          All Trips
        </button>
        <button
          className="b2c-partner-refresh-btn"
          onClick={fetchTrips}
          title="Refresh trips"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="b2c-partner-daily-trips-error">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{error}</p>
          <button onClick={fetchTrips}>Try Again</button>
        </div>
      )}

      {/* Trips List */}
      {trips.length === 0 && !error ? (
        <div className="b2c-partner-daily-trips-empty">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="9" y1="16" x2="15" y2="16" />
          </svg>
          <h3>No {filter === "today" ? "trips for today" : "trips"} found</h3>
          <p>
            Your self-driving trips will appear here once passengers book your
            routes
          </p>
        </div>
      ) : (
        <div className="b2c-partner-daily-trips-list">
          {trips.map((trip) => {
            const dateInfo = formatDate(trip.tripDate);
            const tripIsToday = isToday(trip.tripDate);
            const tripStatus = trip.status || "Scheduled";
            const statusClass = getStatusClass(tripStatus);
            const isExpanded = expandedTrips.has(trip._id);

            return (
              <div
                key={trip._id}
                className={`b2c-partner-trip-card ${tripIsToday ? "today-highlight" : ""}`}
              >
                {/* Trip Header */}
                <div className="b2c-partner-trip-header">
                  <div className="b2c-partner-trip-date-section">
                    <div className="b2c-partner-trip-date-block">
                      <span className="b2c-partner-trip-day">
                        {dateInfo.day}
                      </span>
                      <span className="b2c-partner-trip-date-num">
                        {dateInfo.dateNum}
                      </span>
                      <span className="b2c-partner-trip-month">
                        {dateInfo.month}
                      </span>
                    </div>
                  </div>

                  <div className="b2c-partner-trip-info-section">
                    <div className="b2c-partner-trip-route">
                      <span className="b2c-partner-trip-from">
                        {trip.fromLocation}
                      </span>
                      <span className="b2c-partner-trip-arrow">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </span>
                      <span className="b2c-partner-trip-to">
                        {trip.toLocation}
                      </span>
                    </div>
                    <div className="b2c-partner-trip-meta">
                      <span className="b2c-partner-trip-time">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {trip.startTime}
                      </span>
                      <span className="b2c-partner-trip-type">
                        {trip.tripType || "ONE WAY"}
                      </span>
                      <span className="b2c-partner-trip-seats">
                        <svg
                          width="12"
                          height="12"
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
                        {trip.bookedSeats}/{trip.totalSeats} seats
                      </span>
                    </div>
                  </div>

                  <div className="b2c-partner-trip-status-section">
                    <span
                      className={`b2c-partner-trip-status-pill ${statusClass}`}
                    >
                      {getStatusLabel(tripStatus)}
                    </span>
                  </div>
                </div>

                {/* Passengers Summary */}
                <div
                  className="b2c-partner-trip-passengers-summary"
                  onClick={() => togglePassengerList(trip._id)}
                >
                  <div className="b2c-partner-passengers-count">
                    <span className="b2c-partner-count-number">
                      {trip.passengerCount || 0}
                    </span>
                    <span className="b2c-partner-count-label">
                      {trip.passengerCount === 1 ? "Passenger" : "Passengers"}
                    </span>
                  </div>
                  <div className="b2c-partner-passengers-preview">
                    {trip.passengers &&
                      trip.passengers.slice(0, 3).map((passenger, idx) => (
                        <div
                          key={passenger._id || idx}
                          className="b2c-partner-passenger-avatar"
                        >
                          {passenger.profileImage ? (
                            <img
                              src={passenger.profileImage}
                              alt={passenger.fullName}
                            />
                          ) : (
                            <span>{passenger.fullName?.charAt(0) || "?"}</span>
                          )}
                        </div>
                      ))}
                    {trip.passengerCount > 3 && (
                      <div className="b2c-partner-passenger-avatar more">
                        +{trip.passengerCount - 3}
                      </div>
                    )}
                  </div>
                  <button className="b2c-partner-expand-btn">
                    {isExpanded ? (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                        Hide
                      </>
                    ) : (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        View All
                      </>
                    )}
                  </button>
                </div>

                {/* Expanded Passenger List */}
                {isExpanded && (
                  <div className="b2c-partner-trip-passengers-list">
                    {!trip.passengers || trip.passengers.length === 0 ? (
                      <div className="b2c-partner-no-passengers">
                        No passengers booked yet
                      </div>
                    ) : (
                      trip.passengers.map((passenger, idx) => (
                        <div
                          key={passenger._id || idx}
                          className="b2c-partner-passenger-item"
                        >
                          <div className="b2c-partner-passenger-avatar-large">
                            {passenger.profileImage ? (
                              <img
                                src={passenger.profileImage}
                                alt={passenger.fullName}
                              />
                            ) : (
                              <span>
                                {passenger.fullName?.charAt(0) || "?"}
                              </span>
                            )}
                          </div>
                          <div className="b2c-partner-passenger-info">
                            <span className="b2c-partner-passenger-name">
                              {passenger.fullName}
                            </span>
                            <span className="b2c-partner-passenger-contact">
                              {passenger.phone ||
                                passenger.email ||
                                "No contact"}
                            </span>
                          </div>
                          <div className="b2c-partner-passenger-booking-type">
                            <span
                              className={`b2c-partner-booking-type-badge ${passenger.bookingType === "Monthly Pass" ? "monthly" : "onetime"}`}
                            >
                              {passenger.bookingType}
                            </span>
                            <span className="b2c-partner-seats-info">
                              {passenger.seats} seat(s)
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Action Buttons - Only show for today's trips */}
                {tripIsToday && (
                  <div className="b2c-partner-trip-actions">
                    {tripStatus === "Scheduled" && (
                      <button
                        className="b2c-partner-btn-start-trip"
                        onClick={() => handleStartTrip(trip._id)}
                        disabled={actionLoading === trip._id}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        {actionLoading === trip._id
                          ? "Starting..."
                          : `Start Trip (${trip.passengerCount || 0} passengers)`}
                      </button>
                    )}
                    {tripStatus === "In Progress" && (
                      <button
                        className="b2c-partner-btn-complete-trip"
                        onClick={() => handleCompleteTrip(trip._id)}
                        disabled={actionLoading === trip._id}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {actionLoading === trip._id
                          ? "Completing..."
                          : `Complete Trip (${trip.passengerCount || 0} passengers)`}
                      </button>
                    )}
                    {tripStatus === "Completed" && (
                      <div className="b2c-partner-trip-completed-info">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Trip completed at{" "}
                        {trip.actualEndTime
                          ? new Date(trip.actualEndTime).toLocaleTimeString()
                          : "N/A"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default B2CPartnerDailyTrips;
