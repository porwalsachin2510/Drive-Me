/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSocket } from "../../../hooks/useSocket";
import api from "../../../utils/api";
import "./EmployeeTripBooking.css";
import { notify } from "../../../utils/toast";

function EmployeeTripBooking() {
  const user = useSelector((state) => state.auth.user);
  const socket = useSocket();
  const [trips, setTrips] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [monthlyPasses, setMonthlyPasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("my-trips"); // Default to assigned trips for corporate employees
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingTrip, setTrackingTrip] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeId, setRouteId] = useState(localStorage.getItem("routeId") || "");
  const [formattedLastLogin, setFormattedLastLogin] = useState("");
  const [bookingData, setBookingData] = useState({
    pickupPoint: "",
    pickupTime: "",
    seatNumber: 1,
    useMonthlyPass: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [tripsPerPage] = useState(9); // 3x3 grid

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Format last login time
  useEffect(() => {
    if (user?.lastLogin) {
      const loginDate = new Date(user.lastLogin);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateString = "";

      if (loginDate.toDateString() === today.toDateString()) {
        dateString = "Today";
      } else if (loginDate.toDateString() === yesterday.toDateString()) {
        dateString = "Yesterday";
      } else {
        dateString = loginDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      const timeString = loginDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      setFormattedLastLogin(`${dateString}, ${timeString}`);
    }
  }, [user?.lastLogin]);

  const getRoleDisplayName = (role) => {
    const roleMap = {
      ADMIN: "Admin",
      COMMUTER: "Commuter",
      CORPORATE: "Corporate",
      B2C_PARTNER: "B2C Partner",
      B2B_PARTNER: "B2B Partner",
      CORPORATE_DRIVER: "Corporate Driver",
      B2B_PARTNER_DRIVER: "B2B Partner Driver",
      CORPORATE_EMPLOYEE: "Corporate Employee",
      B2C_PARTNER_DRIVER: "B2C Partner Driver",
    };
    return roleMap[role] || role;
  };

  // Fetch the employee's assigned route to get routeId on mount
  useEffect(() => {
    const fetchEmployeeRoute = async () => {
      try {
        const response = await api.get("/corporate-employee-users/route");
        if (response.data?.data?.route?._id) {
          const id = response.data.data.route._id;
          setRouteId(id);
          localStorage.setItem("routeId", id);
        }
      } catch (err) {
        console.error("Error fetching employee route:", err);
      }
    };

    if (!routeId) {
      fetchEmployeeRoute();
    }
  }, []);

  useEffect(() => {
    if (activeTab === "my-trips") {
      fetchMyScheduledTrips(); // Corporate-assigned trips
    } else if (activeTab === "my-bookings") {
      fetchMyBookings();
    } else if (activeTab === "monthly-pass") {
      fetchMonthlyPasses();
    }
  }, [activeTab, routeId]);

  // Fetch corporate-assigned trips for this employee (auto-generated trips)
  const fetchMyScheduledTrips = async () => {
    try {
      setLoading(true);

      // Use the corporate employee dashboard API which returns upcoming trips and todayTrips
      const response = await api.get("/corporate-employee-users/dashboard");
      const dashboardData = response.data?.data;

      // Get todayTrips and upcomingTrips - these are pre-assigned corporate trips
      const todayTrips = dashboardData?.todayTrips || [];
      const upcomingTrips =
        dashboardData?.upcomingTrips || dashboardData?.bookings || [];

      // Merge and deduplicate by _id
      const allTrips = [...todayTrips, ...upcomingTrips];
      const uniqueTrips = allTrips
        .filter(
          (trip, index, self) =>
            index === self.findIndex((t) => t._id === trip._id),
        )
        .filter((trip) =>
          ["SCHEDULED", "IN_PROGRESS", "Scheduled", "Confirmed"].includes(
            trip.status,
          ),
        );

      // Filter to only show trips from today onwards (no past trips in scheduled)
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const filteredTrips = uniqueTrips.filter((trip) => {
        const tripDate = new Date(trip.tripDate || trip.date);
        return tripDate >= todayStart; // Show all future trips, not just 7 days
      });

      // Sort by date and time (morning trips before evening trips on same day)
      filteredTrips.sort((a, b) => {
        const dateA = new Date(a.tripDate || a.date);
        const dateB = new Date(b.tripDate || b.date);
        const dateCompare = dateA - dateB;
        if (dateCompare !== 0) return dateCompare;
        // Same day - sort by startTime
        const timeA = a.startTime || "00:00";
        const timeB = b.startTime || "00:00";
        return timeA.localeCompare(timeB);
      });

      // Also try to get route stop points for display
      try {
        const routeResponse = await api.get("/corporate-employee-users/route");
        const routeData = routeResponse.data?.data;
        if (routeData?.route?.stopPoints) {
          const enrichedTrips = filteredTrips.map((trip) => ({
            ...trip,
            stopPoints:
              trip.stopPoints ||
              trip.routeId?.stopPoints ||
              routeData.route.stopPoints ||
              [],
            routeStopPoints: routeData.route.stopPoints || [],
            isCorporateAssigned: true, // Mark as corporate-assigned
          }));
          setTrips(enrichedTrips);
        } else {
          setTrips(
            filteredTrips.map((t) => ({ ...t, isCorporateAssigned: true })),
          );
        }
      } catch {
        setTrips(
          filteredTrips.map((t) => ({ ...t, isCorporateAssigned: true })),
        );
      }
    } catch (error) {
      console.error("Error fetching corporate trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Trip History = finished trips (completed or cancelled). The backend
  // getMyBookings endpoint defaults to only SCHEDULED/IN_PROGRESS, so we MUST
  // request the history statuses explicitly via ?status=COMPLETED,CANCELLED.
  const isHistoryStatus = (status) =>
    ["COMPLETED", "CANCELLED"].includes((status || "").toUpperCase());

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      // Ask the server for finished trips only (already status-filtered + sorted newest-first)
      const response = await api.get(
        "/trips/my-bookings?status=COMPLETED,CANCELLED",
      );
      const bookingsData =
        response.data?.data?.bookings || response.data?.data || [];

      const historyTrips = (
        Array.isArray(bookingsData) ? bookingsData : []
      ).filter((trip) => isHistoryStatus(trip.status));

      // Fallback to the dashboard travel history if the bookings endpoint is empty
      if (historyTrips.length === 0) {
        try {
          const dashResponse = await api.get(
            "/corporate-employee-users/dashboard",
          );
          const historyFromDash = (
            dashResponse.data?.data?.travelHistory || []
          ).filter((trip) => isHistoryStatus(trip.status));
          setMyBookings(historyFromDash);
          return;
        } catch {
          // ignore and fall through to setting the (empty) history list
        }
      }

      setMyBookings(historyTrips);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      // Fallback to dashboard travel history for completed/cancelled trips
      try {
        const response = await api.get("/corporate-employee-users/dashboard");
        const dashboardData = response.data?.data;
        const historyTrips = (dashboardData?.travelHistory || []).filter(
          (trip) => isHistoryStatus(trip.status),
        );
        setMyBookings(historyTrips);
      } catch {
        setMyBookings([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyPasses = async () => {
    try {
      setLoading(true);
      // Try to fetch actual monthly passes from the corporate employee endpoint
      try {
        const passResponse = await api.get(
          "/corporate-employee-users/monthly-passes",
        );
        if (passResponse.data?.data?.length > 0) {
          setMonthlyPasses(passResponse.data.data);
          return;
        }
      } catch (err) {
        console.log("No monthly passes found, using route info");
      }

      // Fallback: Show contract-based info from route assignment
      const response = await api.get("/corporate-employee-users/route");
      const routeData = response.data?.data;
      if (routeData?.route) {
        // Create a pass-like object from the route assignment
        setMonthlyPasses([
          {
            _id: routeData.route._id || "corporate-pass",
            status: "ACTIVE",
            passType: "CORPORATE",
            fromLocation: routeData.route.fromLocation,
            toLocation: routeData.route.toLocation,
            pickupLocation: routeData.pickupStop,
            dropoffLocation: routeData.dropoffStop,
            shiftType: routeData.shiftType,
            vehicle: routeData.vehicle,
            driver: routeData.driver,
            subscriptionType: "COMPANY_PAID",
          },
        ]);
      } else {
        setMonthlyPasses([]);
      }
    } catch (error) {
      console.error("Error fetching pass info:", error);
      setMonthlyPasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookTrip = (trip) => {
    setSelectedTrip(trip);
    setBookingData({
      pickupPoint: "",
      pickupTime: "",
      seatNumber: 1,
      useMonthlyPass: false, // Always false - corporate employees don't need monthly passes
    });
    setShowBookingModal(true);
  };

  // Get pickup options for a trip
  const getPickupOptions = (trip) => {
    const options = [];
    const stopPoints =
      trip.stopPoints || trip.routeStopPoints || trip.routeId?.stopPoints || [];

    // Add stop points
    stopPoints.forEach((stop) => {
      if (stop.location) {
        options.push({ location: stop.location, time: stop.time || "" });
      }
    });

    // Always add from/to as fallback options if no stop points or they don't include from/to
    const fromLoc = trip.fromLocation;
    const toLoc = trip.toLocation;

    if (fromLoc && !options.find((o) => o.location === fromLoc)) {
      options.unshift({
        location: fromLoc,
        time: trip.startTime || "",
        label: "Start",
      });
    }
    if (toLoc && !options.find((o) => o.location === toLoc)) {
      options.push({ location: toLoc, time: trip.endTime || "", label: "End" });
    }

    return options;
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post(`/trips/${selectedTrip._id}/book`, bookingData);
      setShowBookingModal(false);
      fetchMyBookings();
      notify("Seat booked successfully!");
    } catch (error) {
      console.error("Error booking seat:", error);
      notify(error.response?.data?.message || "Failed to book seat");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (tripId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      // Use the trip cancel endpoint which removes the employee from the passengers array
      await api.delete(`/trips/${tripId}/cancel`);
      fetchMyBookings();
      notify("Booking cancelled successfully!");
    } catch (error) {
      console.error("Error canceling booking:", error);
      notify(error.response?.data?.message || "Failed to cancel booking");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "SCHEDULED":
        return "#10b981";
      case "IN_PROGRESS":
        return "#3b82f6";
      case "COMPLETED":
        return "#6b7280";
      case "CANCELLED":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPassStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return "#10b981";
      case "EXPIRED":
        return "#ef4444";
      case "SUSPENDED":
        return "#f59e0b";
      case "CANCELLED":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  // Socket listener for driver location updates
  useEffect(() => {
    if (!socket?.socket) return;

    const handleLocationUpdate = (data) => {
      if (trackingTrip && data.driverId) {
        setDriverLocation({
          lat: data.location?.lat || data.lat,
          lng: data.location?.lng || data.lng,
          timestamp: data.timestamp,
        });
      }
    };

    // Handle real-time trip started notification
    const handleTripStarted = (data) => {
      // Update the trip status in the trips list
      setTrips((prev) =>
        prev.map((trip) =>
          trip._id === data.tripId || trip._id === data.data?.tripId
            ? { ...trip, status: "IN_PROGRESS" }
            : trip,
        ),
      );
      // Also refresh trips to get latest data
      fetchMyScheduledTrips();
    };

    // Handle real-time trip completed notification
    const handleTripCompleted = (data) => {
      // Update the trip status
      setTrips((prev) =>
        prev.map((trip) =>
          trip._id === data.tripId || trip._id === data.data?.tripId
            ? { ...trip, status: "COMPLETED" }
            : trip,
        ),
      );
      // Close tracking modal if this trip was being tracked
      if (
        trackingTrip &&
        (trackingTrip._id === data.tripId ||
          trackingTrip._id === data.data?.tripId)
      ) {
        // Stop tracking inline instead of calling handleStopTracking to avoid initialization issues
        if (socket?.socket && trackingTrip?._id) {
          socket.socket.emit("leave_booking_room", trackingTrip._id);
        }
        setShowTrackingModal(false);
        setTrackingTrip(null);
        setDriverLocation(null);
      }
    };

    socket.socket.on("driver-location-update", handleLocationUpdate);
    socket.socket.on("location-update", handleLocationUpdate);
    socket.socket.on("TRIP_STARTED", handleTripStarted);
    socket.socket.on("trip-started", handleTripStarted);
    socket.socket.on("RIDE_COMPLETED", handleTripCompleted);
    socket.socket.on("trip-completed", handleTripCompleted);

    return () => {
      socket.socket.off("driver-location-update", handleLocationUpdate);
      socket.socket.off("location-update", handleLocationUpdate);
      socket.socket.off("TRIP_STARTED", handleTripStarted);
      socket.socket.off("trip-started", handleTripStarted);
      socket.socket.off("RIDE_COMPLETED", handleTripCompleted);
      socket.socket.off("trip-completed", handleTripCompleted);
    };
  }, [socket, trackingTrip]);

  // Track Driver handler - fetch fresh trip data to get resolved driver name
  const handleTrackDriver = useCallback(
    async (trip) => {
      setTrackingTrip(trip);
      setDriverLocation(null);
      setShowTrackingModal(true);

      // Join booking room for this trip to receive location updates
      if (socket?.socket && trip._id) {
        socket.socket.emit("join_booking_room", trip._id);
      }

      // Fetch fresh trip data from my-bookings to get properly resolved driver name
      if (!trip.driverName || trip.driverName === "Not assigned") {
        try {
          const response = await api.get("/trips/my-bookings");
          const bookings = response.data?.data?.bookings || [];
          const freshTrip = bookings.find((b) => b._id === trip._id);
          if (
            freshTrip &&
            freshTrip.driverName &&
            freshTrip.driverName !== "Not assigned"
          ) {
            setTrackingTrip((prev) => ({
              ...prev,
              driverName: freshTrip.driverName,
              driverContact: freshTrip.driverContact,
              vehicleName: freshTrip.vehicleName || prev.vehicleName,
              vehicleNumber: freshTrip.vehicleNumber || prev.vehicleNumber,
            }));
          }
        } catch (e) {
          // Fallback: also try dashboard API
          try {
            const dashResponse = await api.get(
              "/corporate-employee-users/dashboard",
            );
            const dashData = dashResponse.data?.data;
            const allTrips = [
              ...(dashData?.todayTrips || []),
              ...(dashData?.upcomingTrips || dashData?.bookings || []),
            ];
            const freshTrip = allTrips.find((t) => t._id === trip._id);
            if (
              freshTrip &&
              freshTrip.driverName &&
              freshTrip.driverName !== "Not assigned"
            ) {
              setTrackingTrip((prev) => ({
                ...prev,
                driverName: freshTrip.driverName,
                driverContact: freshTrip.driverContact,
                vehicleName: freshTrip.vehicleName || prev.vehicleName,
                vehicleNumber: freshTrip.vehicleNumber || prev.vehicleNumber,
              }));
            }
          } catch (e2) {
            console.log(e2);
          }
        }
      }
    },
    [socket],
  );

  // Stop tracking
  const handleStopTracking = useCallback(() => {
    if (socket?.socket && trackingTrip?._id) {
      socket.socket.emit("leave_booking_room", trackingTrip._id);
    }
    setShowTrackingModal(false);
    setTrackingTrip(null);
    setDriverLocation(null);
  }, [socket, trackingTrip]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No token found, redirecting to login");
        navigate("/login");
        return;
      }

      dispatch(logout());

      // Call backend logout endpoint to clear cookies and session
      await api.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      // Clear frontend storage
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      console.log("User logged out successfully");

      // Redirect to login page
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login regardless of error
      navigate("/login");
    }
  };

  const userName = user?.fullName || "User";
  const userRole = user?.role || "ADMIN";

  return (
    <div className="employee-trip-booking">
      <div className="employee-trip-booking-header">
        <div className="employee-trip-booking-header-top">
          <h2>Trip Booking</h2>

          <div className="employee-trip-booking-header-top-inside">
            {/* User Info Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#202124",
                  }}
                >
                  {getRoleDisplayName(userRole)}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#5f6368",
                    marginTop: "4px",
                  }}
                >
                  Last login: {formattedLastLogin || "Never"}
                </div>
              </div>
            </div>
            <button className="employee-trip-logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div className="employee-trip-booking-tab-navigation">
          <button
            className={`employee-trip-booking-tab-btn ${activeTab === "my-trips" ? "active" : ""}`}
            onClick={() => setActiveTab("my-trips")}
          >
            My Scheduled Trips
          </button>
          <button
            className={`employee-trip-booking-tab-btn ${activeTab === "my-bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("my-bookings")}
          >
            Trip History
          </button>
          <button
            className={`employee-trip-booking-tab-btn ${activeTab === "monthly-pass" ? "active" : ""}`}
            onClick={() => setActiveTab("monthly-pass")}
          >
            Transport Info
          </button>
        </div>
      </div>

      {loading ? (
        <div className="employee-trip-booking-loading">Loading...</div>
      ) : (
        <div className="employee-trip-booking-tab-content">
          {/* My Scheduled Trips - Corporate-assigned trips */}
          {activeTab === "my-trips" && (
            <div className="employee-trip-booking-my-trips">
              <div className="employee-trip-booking-info-banner">
                <div className="info-icon">i</div>
                <p>
                  These trips have been scheduled by your company. You are
                  automatically booked on these trips.
                </p>
              </div>
              {trips.length === 0 ? (
                <div className="employee-trip-booking-no-data">
                  <p>No scheduled trips found.</p>
                  <p className="employee-trip-booking-no-data-hint">
                    Contact your transport coordinator if you believe this is an
                    error.
                  </p>
                </div>
              ) : (
                <>
                  <div className="employee-trip-booking-trips-grid">
                    {trips
                      .slice(
                        (currentPage - 1) * tripsPerPage,
                        currentPage * tripsPerPage,
                      )
                      .map((trip) => (
                        <div
                          key={trip._id}
                          className="employee-trip-booking-trip-card corporate-assigned"
                        >
                          <div className="employee-trip-booking-corporate-badge">
                            Corporate Transport
                          </div>
                          <div className="employee-trip-booking-trip-route">
                            <h3>
                              {trip.fromLocation} &rarr; {trip.toLocation}
                            </h3>
                            <span
                              className="employee-trip-booking-trip-status"
                              style={{
                                backgroundColor: getStatusColor(trip.status),
                              }}
                            >
                              {trip.status === "SCHEDULED" ||
                              trip.status === "Scheduled"
                                ? "Confirmed"
                                : trip.status}
                            </span>
                          </div>

                          <div className="employee-trip-booking-trip-info">
                            <p>
                              <strong>Date:</strong>{" "}
                              {formatDate(trip.tripDate || trip.date)}
                            </p>
                            <p>
                              <strong>Departure:</strong> {trip.startTime}{" "}
                              {trip.endTime ? `- Arrival: ${trip.endTime}` : ""}
                            </p>
                            <p>
                              <strong>Direction:</strong>{" "}
                              {trip.direction === "FORWARD"
                                ? "To Office"
                                : trip.direction === "RETURN"
                                  ? "To Home"
                                  : trip.tripType || "One Way"}
                            </p>
                            <p>
                              <strong>Vehicle:</strong>{" "}
                              {trip.vehicleName ||
                                trip.vehicleNumber ||
                                trip.vehicleId?.vehicleName ||
                                "Will be assigned"}
                            </p>
                            <p>
                              <strong>Driver:</strong>{" "}
                              {trip.driverName &&
                              trip.driverName !== "Not assigned"
                                ? trip.driverName
                                : trip.driverId?.fullName ||
                                  trip.driverId?.name ||
                                  "Will be assigned"}
                            </p>
                          </div>

                          <div className="employee-trip-booking-trip-route-stops">
                            <h4>Your Pickup/Dropoff Points</h4>
                            <div className="employee-trip-booking-stops-list">
                              {(() => {
                                // Use pre-computed myPickupStop/myDropoffStop from backend if available
                                // These are calculated based on passenger record or employee's assigned stops
                                let pickupStop = trip.myPickupStop;
                                let dropoffStop = trip.myDropoffStop;

                                // Fallback: try to find from passengers array if not pre-computed
                                if (!pickupStop || !dropoffStop) {
                                  const extractId = (id) => {
                                    if (!id) return null;
                                    if (typeof id === "string") return id;
                                    if (id.$oid) return id.$oid;
                                    if (id._id) return extractId(id._id);
                                    return id.toString?.() || null;
                                  };

                                  const userId = extractId(user?._id);
                                  const myPassenger = (
                                    trip.passengers || []
                                  ).find((p) => {
                                    const pId = extractId(p.passengerId);
                                    const eId = extractId(p.employeeId);
                                    return pId === userId || eId === userId;
                                  });

                                  if (myPassenger) {
                                    pickupStop =
                                      pickupStop || myPassenger.pickupStop;
                                    dropoffStop =
                                      dropoffStop || myPassenger.dropoffStop;
                                  }
                                }

                                // Final fallback based on trip direction
                                if (!pickupStop || !dropoffStop) {
                                  if (trip.direction === "FORWARD") {
                                    pickupStop =
                                      pickupStop ||
                                      trip.pickupLocation ||
                                      trip.fromLocation;
                                    dropoffStop =
                                      dropoffStop ||
                                      trip.dropoffLocation ||
                                      trip.toLocation;
                                  } else if (trip.direction === "RETURN") {
                                    pickupStop =
                                      pickupStop || trip.fromLocation;
                                    dropoffStop =
                                      dropoffStop || trip.toLocation;
                                  } else {
                                    pickupStop =
                                      pickupStop || trip.fromLocation;
                                    dropoffStop =
                                      dropoffStop || trip.toLocation;
                                  }
                                }

                                // Get pickup time from stop points
                                let pickupTime = null;
                                if (pickupStop && trip.stopPoints?.length) {
                                  const stopInfo = trip.stopPoints.find(
                                    (s) => s.location === pickupStop,
                                  );
                                  pickupTime =
                                    stopInfo?.scheduledTime || stopInfo?.time;
                                }
                                // For FORWARD trips, if pickup is the route start, use startTime
                                if (
                                  !pickupTime &&
                                  trip.direction === "FORWARD" &&
                                  pickupStop === trip.fromLocation
                                ) {
                                  pickupTime = trip.startTime;
                                }
                                // For RETURN trips, use startTime if pickup is fromLocation (office)
                                if (
                                  !pickupTime &&
                                  trip.direction === "RETURN" &&
                                  pickupStop === trip.fromLocation
                                ) {
                                  pickupTime = trip.startTime;
                                }
                                pickupTime = pickupTime || trip.startTime;

                                return (
                                  <div className="employee-trip-booking-stop-item highlight">
                                    <span className="employee-trip-booking-stop-location">
                                      <strong>Pickup:</strong> {pickupStop}{" "}
                                      {pickupTime ? `(${pickupTime})` : ""}
                                    </span>
                                    <span className="employee-trip-booking-stop-arrow">
                                      &rarr;
                                    </span>
                                    <span className="employee-trip-booking-stop-location">
                                      <strong>Dropoff:</strong> {dropoffStop}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="employee-trip-booking-trip-actions">
                            {(trip.status === "IN_PROGRESS" ||
                              trip.status === "In Progress") && (
                              <button
                                className="employee-trip-booking-track-btn"
                                onClick={() => handleTrackDriver(trip)}
                              >
                                Track Driver
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Pagination Controls */}
                  {trips.length > tripsPerPage && (
                    <div className="employee-trip-booking-pagination">
                      <button
                        className="employee-trip-booking-pagination-btn"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      <span className="employee-trip-booking-pagination-info">
                        Page {currentPage} of{" "}
                        {Math.ceil(trips.length / tripsPerPage)} ({trips.length}{" "}
                        trips)
                      </span>
                      <button
                        className="employee-trip-booking-pagination-btn"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(
                              prev + 1,
                              Math.ceil(trips.length / tripsPerPage),
                            ),
                          )
                        }
                        disabled={
                          currentPage === Math.ceil(trips.length / tripsPerPage)
                        }
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "my-bookings" && (
            <div className="employee-trip-booking-my-bookings">
              {myBookings.length === 0 ? (
                <div className="employee-trip-booking-no-data">
                  <p>No completed trips found.</p>
                  <p className="employee-trip-booking-no-data-hint">
                    Your completed trips will appear here after they are
                    finished.
                  </p>
                </div>
              ) : (
                <div className="employee-trip-booking-bookings-grid">
                  {myBookings.map((booking) => (
                    <div
                      key={booking._id}
                      className="employee-trip-booking-booking-card"
                    >
                      <div className="employee-trip-booking-booking-route">
                        <h3>
                          {booking.fromLocation} → {booking.toLocation}
                        </h3>
                        <span
                          className="employee-trip-booking-booking-status"
                          style={{
                            backgroundColor: getStatusColor(booking.status),
                          }}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <div className="employee-trip-booking-booking-details">
                        <p>
                          <strong>Date:</strong>{" "}
                          {formatDate(booking.tripDate || booking.date)}
                        </p>
                        <p>
                          <strong>Time:</strong>{" "}
                          {booking.startTime ||
                            booking.pickupTime ||
                            "See schedule"}
                        </p>
                        <p>
                          <strong>Direction:</strong>{" "}
                          {booking.direction === "FORWARD"
                            ? "To Office"
                            : booking.direction === "RETURN"
                              ? "To Home"
                              : booking.tripType || "One Way"}
                        </p>
                        <p>
                          <strong>Vehicle:</strong>{" "}
                          {booking.vehicleName ||
                            booking.vehicle?.vehicleName ||
                            booking.vehicle?.model ||
                            "Company Vehicle"}
                        </p>
                        <p>
                          <strong>Driver:</strong>{" "}
                          {booking.driverName &&
                          booking.driverName !== "Not assigned"
                            ? booking.driverName
                            : booking.driverId?.fullName ||
                              booking.driverId?.name ||
                              "Company Driver"}
                        </p>
                        <p>
                          <strong>Pickup Point:</strong>{" "}
                          {booking.pickupPoint &&
                          booking.pickupPoint !== "Not specified"
                            ? booking.pickupPoint
                            : booking.pickupStop ||
                              booking.pickupLocation ||
                              booking.fromLocation ||
                              "See schedule"}
                        </p>
                        <p>
                          <strong>Dropoff Point:</strong>{" "}
                          {booking.dropoffStop ||
                            booking.dropoffLocation ||
                            booking.toLocation ||
                            "See schedule"}
                        </p>
                      </div>

                      <div className="employee-trip-booking-booking-actions">
                        {booking.status === "SCHEDULED" && (
                          <button
                            className="employee-trip-booking-cancel-btn"
                            onClick={() => handleCancelBooking(booking._id)}
                          >
                            Cancel Booking
                          </button>
                        )}
                        {booking.status === "IN_PROGRESS" && (
                          <button
                            className="employee-trip-booking-track-btn"
                            onClick={() => handleTrackDriver(booking)}
                            style={{
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              padding: "8px 16px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: "600",
                            }}
                          >
                            Track Driver
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "monthly-pass" && (
            <div className="employee-trip-booking-monthly-passes">
              {monthlyPasses.length === 0 ? (
                <div className="employee-trip-booking-no-data">
                  <p>
                    No monthly passes found. Contact your corporate admin for a
                    pass.
                  </p>
                </div>
              ) : (
                <div className="employee-trip-booking-passes-grid">
                  {monthlyPasses.map((pass) => (
                    <div
                      key={pass._id}
                      className="employee-trip-booking-pass-card"
                    >
                      <div className="employee-trip-booking-pass-header">
                        <h3>
                          {pass.fromLocation || pass.routeId?.fromLocation} →{" "}
                          {pass.toLocation || pass.routeId?.toLocation}
                        </h3>
                        <span
                          className="employee-trip-booking-pass-status"
                          style={{
                            backgroundColor: getPassStatusColor(pass.status),
                          }}
                        >
                          {pass.status}
                        </span>
                      </div>

                      <div className="employee-trip-booking-pass-details">
                        {pass.passType === "CORPORATE" ? (
                          <>
                            <p>
                              <strong>Type:</strong> Corporate Transport Pass
                            </p>
                            <p>
                              <strong>Subscription:</strong>{" "}
                              {pass.subscriptionType || "Company Paid"}
                            </p>
                            <p>
                              <strong>Pickup:</strong>{" "}
                              {pass.pickupLocation || "Not set"}
                            </p>
                            <p>
                              <strong>Dropoff:</strong>{" "}
                              {pass.dropoffLocation || "Not set"}
                            </p>
                            <p>
                              <strong>Shift:</strong>{" "}
                              {pass.shiftType || "Full Day"}
                            </p>
                            {pass.vehicle && (
                              <p>
                                <strong>Vehicle:</strong>{" "}
                                {pass.vehicle.vehicleName ||
                                  `${pass.vehicle.make || ""} ${pass.vehicle.model || ""}`}
                              </p>
                            )}
                            {pass.driver && (
                              <p>
                                <strong>Driver:</strong>{" "}
                                {pass.driver.fullName || "Not assigned"}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p>
                              <strong>Valid From:</strong>{" "}
                              {pass.validFrom
                                ? new Date(pass.validFrom).toLocaleDateString()
                                : "N/A"}
                            </p>
                            <p>
                              <strong>Valid To:</strong>{" "}
                              {pass.validTo
                                ? new Date(pass.validTo).toLocaleDateString()
                                : "N/A"}
                            </p>
                            <p>
                              <strong>Total Trips:</strong>{" "}
                              {pass.totalTrips || "Unlimited"}
                            </p>
                            <p>
                              <strong>Used Trips:</strong> {pass.usedTrips || 0}
                            </p>
                            <p>
                              <strong>Remaining:</strong>{" "}
                              {pass.remainingTrips || "N/A"}
                            </p>
                            <p>
                              <strong>Pickup Point:</strong>{" "}
                              {pass.preferredPickupPoint || "Not set"}
                            </p>
                            <p>
                              <strong>Amount:</strong> {pass.currency || ""}{" "}
                              {pass.totalAmount || "Company Paid"}
                            </p>
                            <p>
                              <strong>Payment:</strong>{" "}
                              {pass.paymentStatus || "Company Paid"}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showBookingModal && selectedTrip && (
        <div className="employee-trip-booking-modal-overlay">
          <div className="employee-trip-booking-modal">
            <div className="employee-trip-booking-modal-header">
              <h3>
                Book Seat - {selectedTrip.fromLocation} →{" "}
                {selectedTrip.toLocation}
              </h3>
              <button
                className="employee-trip-booking-close-btn"
                onClick={() => setShowBookingModal(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleBookingSubmit}
              className="employee-trip-booking-modal-form"
            >
              <div className="employee-trip-booking-trip-summary">
                <p>
                  <strong>Date:</strong> {formatDate(selectedTrip.tripDate)}
                </p>
                <p>
                  <strong>Time:</strong> {selectedTrip.startTime} -{" "}
                  {selectedTrip.endTime}
                </p>
                <p>
                  <strong>Available Seats:</strong>{" "}
                  {selectedTrip.availableSeats}
                </p>
              </div>

              <div className="employee-trip-booking-form-group">
                <label>Pickup Point</label>
                <select
                  value={bookingData.pickupPoint}
                  onChange={(e) =>
                    setBookingData((prev) => ({
                      ...prev,
                      pickupPoint: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select pickup point</option>
                  {getPickupOptions(selectedTrip).map((opt, index) => (
                    <option key={index} value={opt.location}>
                      {opt.location} {opt.time ? `(${opt.time})` : ""}{" "}
                      {opt.label ? `- ${opt.label}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="employee-trip-booking-form-group">
                <label>Seat Number</label>
                <input
                  type="number"
                  min="1"
                  max={selectedTrip.totalSeats}
                  value={bookingData.seatNumber}
                  onChange={(e) =>
                    setBookingData((prev) => ({
                      ...prev,
                      seatNumber: parseInt(e.target.value),
                    }))
                  }
                  required
                />
              </div>

              <div className="employee-trip-booking-modal-actions">
                <button
                  type="button"
                  className="employee-trip-booking-cancel-btn"
                  onClick={() => setShowBookingModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="employee-trip-booking-submit-btn"
                  disabled={loading}
                >
                  {loading ? "Booking..." : "Book Seat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Tracking Modal */}
      {showTrackingModal && trackingTrip && (
        <div className="employee-trip-booking-modal-overlay">
          <div
            className="employee-trip-booking-modal"
            style={{ maxWidth: "800px", width: "95%" }}
          >
            <div className="employee-trip-booking-modal-header">
              <h3>
                Track Driver - {trackingTrip.fromLocation} →{" "}
                {trackingTrip.toLocation}
              </h3>
              <button
                className="employee-trip-booking-close-btn"
                onClick={handleStopTracking}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "16px" }}>
              <div style={{ marginBottom: "16px" }}>
                <p>
                  <strong>Driver:</strong>{" "}
                  {trackingTrip.driverName &&
                  trackingTrip.driverName !== "Not assigned"
                    ? trackingTrip.driverName
                    : trackingTrip.driverId?.fullName ||
                      trackingTrip.driverId?.name ||
                      (trackingTrip.driverId
                        ? "Loading driver info..."
                        : "Not assigned")}
                </p>
                <p>
                  <strong>Vehicle:</strong>{" "}
                  {trackingTrip.vehicleName &&
                  trackingTrip.vehicleName !== "Not assigned"
                    ? `${trackingTrip.vehicleName}${trackingTrip.vehicleNumber && trackingTrip.vehicleNumber !== "Not assigned" ? ` (${trackingTrip.vehicleNumber})` : ""}`
                    : trackingTrip.vehicleNumber &&
                        trackingTrip.vehicleNumber !== "Not assigned"
                      ? trackingTrip.vehicleNumber
                      : "Not assigned"}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    style={{
                      color: driverLocation ? "#10b981" : "#f59e0b",
                      fontWeight: "bold",
                    }}
                  >
                    {driverLocation
                      ? "Online - Sharing Location"
                      : "Waiting for driver location..."}
                  </span>
                </p>
              </div>

              <div
                style={{
                  height: "400px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "2px solid #e0e0e0",
                  position: "relative",
                  background: "#f8f9fa",
                }}
              >
                {driverLocation ? (
                  <>
                    <iframe
                      title="Live Driver Tracking Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLocation.lng - 0.005},${driverLocation.lat - 0.005},${driverLocation.lng + 0.005},${driverLocation.lat + 0.005}&layer=mapnik&mlat=${driverLocation.lat}&mlon=${driverLocation.lng}&zoom=16`}
                      style={{ border: 0 }}
                      allowFullScreen
                    />
                    {/* Vehicle Icon Overlay - centered on driver location */}
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
                          width: "44px",
                          height: "44px",
                          backgroundColor: "#3b82f6",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 12px rgba(59, 130, 246, 0.5)",
                          border: "3px solid white",
                          animation: "driverPulse 2s infinite",
                        }}
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="white"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                        </svg>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          top: "-28px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "#10b981",
                          color: "white",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "10px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                      >
                        En Route
                      </div>
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        backgroundColor: "rgba(40, 167, 69, 0.9)",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        zIndex: 1000,
                      }}
                    >
                      LIVE TRACKING
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
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="white"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                      </svg>
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                      Waiting for Driver Location...
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
                      Your driver will appear here once they start sharing their
                      location
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeTripBooking;
