import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { logout } from "../../../Redux/slices/authSlice";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import api from "../../../utils/api";
import EmployeeLiveTracking from "../../../Components/CorporateEmployee/EmployeeLiveTracking/EmployeeLiveTracking";
import "./corporateemployeedashboard.css";
import io from "socket.io-client";
import {
  fetchEmployeeTrips,
  fetchAssignedRoute,
  fetchNoShowHistory,
  fetchNotifications,
  setDriverLocation,
  addNotification,
  updateTripStatus,
  selectEmployeeTrips,
  selectTripsLoading,
  selectTripsError,
  selectAssignedRoute,
  selectNotifications,
  selectNoShowHistory,
  selectDriverLocation,
  selectTravelHistory,
  selectTodayTrips,
  selectVehicleInfo,
  selectBookings,
} from "../../../Redux/slices/corporateEmployeeSlice";
import { notify } from "../../../utils/toast";

export default function CorporateEmployeeDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const userId = useSelector((state) => state.auth.userId);
  const user = useSelector((state) => state.auth.user);

  // Redux selectors
  const upcomingTripsRedux = useSelector(selectEmployeeTrips);
  const tripsLoading = useSelector(selectTripsLoading);
  const tripsError = useSelector(selectTripsError);
  const assignedBus = useSelector(selectAssignedRoute);
  const notifications = useSelector(selectNotifications);
  const noShowHistory = useSelector(selectNoShowHistory);
  const driverLocation = useSelector(selectDriverLocation);
  const travelHistory = useSelector(selectTravelHistory);
  const todayTripsRedux = useSelector(selectTodayTrips);
  const vehicleInfo = useSelector(selectVehicleInfo);
  const bookings = useSelector(selectBookings);

  // Use todayTrips from redux, fallback to upcomingTrips
  const todayTrips =
    todayTripsRedux?.length > 0 ? todayTripsRedux : upcomingTripsRedux;

  const [activeTab, setActiveTab] = useState("corporate");
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("trip-info");
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState(null);

  const handleLogout = async () => {
    try {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        await api.post(
          "/auth/logout",
          {},
          {
            headers: { Authorization: `Bearer ${storedToken}` },
            withCredentials: true,
          },
        );
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      dispatch(logout());
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const fetchEmployeeDashboardData = async () => {
    try {
      setError(null);

      // Get today's date for API calls
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];

      // Dispatch Redux actions to fetch all data
      await Promise.all([
        dispatch(fetchEmployeeTrips({ employeeId: userId, date: dateStr })),
        dispatch(fetchAssignedRoute(userId)),
        dispatch(fetchNoShowHistory()),
        dispatch(fetchNotifications(userId)),
      ]);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to load dashboard data. Please try again.");
      setLoading(false);
    }
  };

  const subscribeToRealTimeUpdates = () => {
    try {
      const backendURL =
        process.env.REACT_APP_API_URL || "http://localhost:3000";
      const newSocket = io(backendURL, {
        auth: { token },
      });

      newSocket.on("connect", () => {
        console.log("Connected to socket server");
        newSocket.emit("join-notification-room", userId);
      });

      newSocket.on("location-update", (locationData) => {
        console.log("Received driver location update:", locationData);
        dispatch(setDriverLocation(locationData));
      });

      newSocket.on("trip-update", (tripData) => {
        console.log("Trip update received:", tripData);
        dispatch(
          updateTripStatus({
            tripId: tripData.tripId,
            status: tripData.status,
          }),
        );
      });

      newSocket.on("notification", (notificationData) => {
        console.log("Received notification:", notificationData);
        dispatch(addNotification(notificationData));
      });

      newSocket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (error) {
      console.error("Error setting up socket connection:", error);
    }
  };

  useEffect(() => {
    if (token && userId) {
      fetchEmployeeDashboardData();
      subscribeToRealTimeUpdates();
    }
    return () => {
      if (socket) socket.disconnect();
    };
  }, [token, userId]);

  // Live auto-refresh: silently refresh trips/route/notifications in the
  // background (no full-page spinner) and instantly on relevant socket events.
  const silentRefreshDashboard = useCallback(() => {
    if (!token || !userId) return;
    const dateStr = new Date().toISOString().split("T")[0];
    dispatch(fetchEmployeeTrips({ employeeId: userId, date: dateStr }));
    dispatch(fetchAssignedRoute(userId));
    dispatch(fetchNoShowHistory());
    dispatch(fetchNotifications(userId));
  }, [dispatch, token, userId]);

  useAutoRefresh(silentRefreshDashboard, {
    interval: 15000,
    enabled: !!(token && userId),
    socketEvents: [
      "trip-assigned",
      "newTripAssigned",
      "trip-started",
      "trip-completed",
      "new-notification",
    ],
  });

  const handleBookTrip = async (tripId) => {
    try {
      // For corporate trips, employees are pre-assigned by the corporate admin
      // This is a confirmation/check-in action
      notify(
        "Trip is already assigned to you. Please check in 15 minutes before departure.",
      );
      fetchEmployeeDashboardData();
    } catch (error) {
      console.error("Error handling trip:", error);
    }
  };

  const handleCancelBooking = async (tripId) => {
    if (
      window.confirm("Are you sure you want to cancel this trip assignment?")
    ) {
      try {
        // Cancel booking through trip endpoint
        const response = await api.delete(`/trips/${tripId}/cancel`);
        if (response.data.success) {
          notify("Trip assignment cancelled successfully!");
          fetchEmployeeDashboardData();
        } else {
          notify(response.data.message || "Failed to cancel trip");
        }
      } catch (error) {
        console.error("Error cancelling trip:", error);
        notify(
          `Error cancelling trip: ${error.response?.data?.message || error.message}`,
        );
      }
    }
  };

  return (
    <div className="corporate-employee-dashboard">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="corporate-employee-dashboard-with-tabs-container">
        <div className="corporate-employee-dashboard-with-tabs-header">
          <div className="corporate-employee-dashboard-with-tabs-header-left">
            <h1>Welcome, {user?.fullName || "Employee"}</h1>
            <p>Corporate Employee Transportation Dashboard</p>
          </div>
          <div className="corporate-employee-dashboard-with-tabs-header-right">
            <button
              className="corporate-employee-dashboard-with-tabs-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="corporate-employee-dashboard-with-tabs-error-banner">
            <p>{error}</p>
            <button onClick={fetchEmployeeDashboardData}>Retry</button>
          </div>
        )}

        {loading || tripsLoading ? (
          <div className="corporate-employee-dashboard-with-tabs-loading-container">
            <div className="corporate-employee-dashboard-with-tabs-spinner"></div>
            <p>Loading your dashboard...</p>
          </div>
        ) : (
          <div className="corporate-employee-dashboard-with-tabs-content">
            <div className="corporate-employee-dashboard-with-tabs-tabs">
              <button
                className={`corporate-employee-dashboard-with-tabs-tab-btn ${activeSection === "trip-info" ? "active" : ""}`}
                onClick={() => setActiveSection("trip-info")}
              >
                Trip Info
              </button>
              <button
                className={`corporate-employee-dashboard-with-tabs-tab-btn ${activeSection === "track" ? "active" : ""}`}
                onClick={() => setActiveSection("track")}
              >
                Track My Ride
              </button>
              <button
                className={`corporate-employee-dashboard-with-tabs-tab-btn ${activeSection === "bookings" ? "active" : ""}`}
                onClick={() => setActiveSection("bookings")}
              >
                My Bookings
              </button>
              <button
                className={`corporate-employee-dashboard-with-tabs-tab-btn ${activeSection === "history" ? "active" : ""}`}
                onClick={() => setActiveSection("history")}
              >
                History
              </button>
              <button
                className={`corporate-employee-dashboard-with-tabs-tab-btn ${activeSection === "notifications" ? "active" : ""}`}
                onClick={() => setActiveSection("notifications")}
              >
                Notifications
              </button>
            </div>

            {/* Assigned Bus Card */}
            {activeSection === "trip-info" && (
              <div className="corporate-employee-dashboard-with-tabs-section-content">
                <div className="corporate-employee-dashboard-with-tabs-assigned-bus-card">
                  <h2>Your Assigned Bus Route</h2>
                  {assignedBus?.route ? (
                    <div className="corporate-employee-dashboard-with-tabs-bus-details">
                      <div className="corporate-employee-dashboard-with-tabs-route-info">
                        <div className="corporate-employee-dashboard-with-tabs-route-item">
                          <label>From:</label>
                          <span>
                            {assignedBus.route?.fromLocation || "Loading..."}
                          </span>
                        </div>
                        <div className="corporate-employee-dashboard-with-tabs-route-item">
                          <label>To:</label>
                          <span>
                            {assignedBus.route?.toLocation || "Loading..."}
                          </span>
                        </div>
                        <div className="corporate-employee-dashboard-with-tabs-route-item">
                          <label>Pickup Stop:</label>
                          <span>
                            {assignedBus.pickupStop || "Not assigned"}
                          </span>
                        </div>
                        <div className="corporate-employee-dashboard-with-tabs-route-item">
                          <label>Dropoff Stop:</label>
                          <span>
                            {assignedBus.dropoffStop || "Not assigned"}
                          </span>
                        </div>
                        <div className="corporate-employee-dashboard-with-tabs-route-item">
                          <label>Shift Type:</label>
                          <span>{assignedBus.shiftType || "Full Day"}</span>
                        </div>
                      </div>

                      <div className="corporate-employee-dashboard-with-tabs-driver-info">
                        <h3>Driver Information</h3>
                        <div className="corporate-employee-dashboard-with-tabs-driver-details">
                          <p>
                            <strong>Name:</strong>{" "}
                            {assignedBus.driver?.fullName || "To be assigned"}
                          </p>
                          <p>
                            <strong>Phone:</strong>{" "}
                            {assignedBus.driver?.phone || "N/A"}
                          </p>
                          <p>
                            <strong>Email:</strong>{" "}
                            {assignedBus.driver?.email || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="corporate-employee-dashboard-with-tabs-vehicle-info">
                        <h3>Vehicle Information</h3>
                        <div className="corporate-employee-dashboard-with-tabs-vehicle-details">
                          <p>
                            <strong>Vehicle:</strong>{" "}
                            {assignedBus.vehicle
                              ? assignedBus.vehicle.vehicleName ||
                                `${assignedBus.vehicle.make || ""} ${assignedBus.vehicle.model || ""}`.trim() ||
                                "N/A"
                              : "Not assigned"}
                          </p>
                          <p>
                            <strong>Type:</strong>{" "}
                            {assignedBus.vehicle?.vehicleCategory ||
                              assignedBus.vehicle?.vehicleType ||
                              "N/A"}
                          </p>
                          <p>
                            <strong>Registration:</strong>{" "}
                            {assignedBus.vehicle?.registrationNumber ||
                              assignedBus.vehicle?.licensePlate ||
                              "N/A"}
                          </p>
                          <p>
                            <strong>Capacity:</strong>{" "}
                            {assignedBus.vehicle?.capacity || "N/A"} seats
                          </p>
                        </div>
                      </div>

                      {assignedBus.route?.stopPoints &&
                        assignedBus.route.stopPoints.length > 0 && (
                          <div className="corporate-employee-dashboard-with-tabs-stop-points-info">
                            <h3>Stop Points</h3>
                            <div className="corporate-employee-dashboard-with-tabs-stop-points-list">
                              {assignedBus.route.stopPoints.map(
                                (stop, index) => (
                                  <div
                                    key={index}
                                    className="corporate-employee-dashboard-with-tabs-stop-point-item"
                                  >
                                    <span className="corporate-employee-dashboard-with-tabs-stop-location">
                                      {stop.location}
                                    </span>
                                    <span className="corporate-employee-dashboard-with-tabs-stop-time">
                                      {stop.time || "Time not set"}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="corporate-employee-dashboard-with-tabs-no-bus-assigned">
                      <p>
                        No bus route assigned yet. Please contact your manager.
                      </p>
                    </div>
                  )}
                </div>

                <div className="corporate-employee-dashboard-with-tabs-today-trips-card">
                  <h2>Your Assigned Trips Today</h2>
                  {todayTrips.length > 0 ? (
                    <div className="corporate-employee-dashboard-with-tabs-trips-list">
                      {todayTrips.map((trip) => (
                        <div
                          key={trip._id}
                          className="corporate-employee-dashboard-with-tabs-trip-item"
                        >
                          <div className="corporate-employee-dashboard-with-tabs-trip-timing">
                            <span className="corporate-employee-dashboard-with-tabs-trip-time">
                              {trip.startTime}
                            </span>
                            <span className="corporate-employee-dashboard-with-tabs-trip-route">
                              {trip.fromLocation} → {trip.toLocation}
                            </span>
                            {trip.currentLocation && (
                              <span className="corporate-employee-dashboard-with-tabs-trip-location">
                                Driver Location:{" "}
                                {trip.currentLocation.lat?.toFixed(2)},{" "}
                                {trip.currentLocation.lng?.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-trip-details">
                            <span>
                              Status: <strong>{trip.status}</strong>
                            </span>
                            <span>
                              Pickup: {trip.pickupPoint || trip.fromLocation}
                            </span>
                            {trip.driverInfo && (
                              <span>Driver: {trip.driverInfo.name}</span>
                            )}
                          </div>
                          <button
                            className="corporate-employee-dashboard-with-tabs-book-btn"
                            onClick={() => handleBookTrip(trip._id)}
                          >
                            Check In
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="corporate-employee-dashboard-with-tabs-no-trips">
                      <p>No trips assigned for today</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Bookings */}
            {activeSection === "track" && (
              <div className="corporate-employee-dashboard-with-tabs-section-content">
                <EmployeeLiveTracking />
              </div>
            )}

            {activeSection === "bookings" && (
              <div className="corporate-employee-dashboard-with-tabs-section-content">
                <div className="corporate-employee-dashboard-with-tabs-bookings-card">
                  <h2>My Upcoming Bookings</h2>
                  {bookings?.length > 0 || upcomingTripsRedux?.length > 0 ? (
                    <div className="corporate-employee-dashboard-with-tabs-bookings-list">
                      {(bookings?.length > 0
                        ? bookings
                        : upcomingTripsRedux
                      ).map((booking) => (
                        <div
                          key={booking._id}
                          className="corporate-employee-dashboard-with-tabs-booking-item"
                        >
                          <div className="corporate-employee-dashboard-with-tabs-booking-date">
                            {new Date(
                              booking.tripDate || booking.date,
                            ).toLocaleDateString()}
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-booking-info">
                            <span className="corporate-employee-dashboard-with-tabs-booking-time">
                              {booking.startTime || "TBD"}
                            </span>
                            <span className="corporate-employee-dashboard-with-tabs-booking-route">
                              {booking.fromLocation || "Unknown"} →{" "}
                              {booking.toLocation || "Unknown"}
                            </span>
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-booking-seat">
                            <span>
                              Vehicle:{" "}
                              {booking.vehicleName ||
                                vehicleInfo?.vehicleName ||
                                "Assigned"}
                            </span>
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-booking-status">
                            <span
                              className={`corporate-employee-dashboard-with-tabs-status-badge ${booking.status?.toLowerCase()}`}
                            >
                              {booking.status}
                            </span>
                          </div>
                          <button
                            className="corporate-employee-dashboard-with-tabs-cancel-btn"
                            onClick={() => handleCancelBooking(booking._id)}
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="corporate-employee-dashboard-with-tabs-no-bookings">
                      <p>No bookings yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Travel History */}
            {activeSection === "history" && (
              <div className="corporate-employee-dashboard-with-tabs-section-content">
                <div className="corporate-employee-dashboard-with-tabs-history-card">
                  <h2>Travel History</h2>
                  {travelHistory && travelHistory.length > 0 ? (
                    <div className="corporate-employee-dashboard-with-tabs-history-list">
                      {travelHistory.map((trip) => (
                        <div
                          key={trip._id}
                          className="corporate-employee-dashboard-with-tabs-history-item"
                        >
                          <div className="corporate-employee-dashboard-with-tabs-history-date">
                            {new Date(
                              trip.travelDate || trip.tripDate || trip.date,
                            ).toLocaleDateString()}
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-history-info">
                            <span>
                              {trip.route ||
                                `${trip.fromLocation || "Unknown"} → ${trip.toLocation || "Unknown"}`}
                            </span>
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-history-reason">
                            <span>Status: {trip.status || "Completed"}</span>
                            {trip.attendance && (
                              <span> | Attendance: {trip.attendance}</span>
                            )}
                            {trip.startTime && (
                              <span> | Time: {trip.startTime}</span>
                            )}
                            {trip.vehicleName &&
                              trip.vehicleName !== "Not assigned" && (
                                <span> | Vehicle: {trip.vehicleName}</span>
                              )}
                            {trip.driverName &&
                              trip.driverName !== "Not assigned" && (
                                <span> | Driver: {trip.driverName}</span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="corporate-employee-dashboard-with-tabs-no-history">
                      <p>No travel history</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeSection === "notifications" && (
              <div className="corporate-employee-dashboard-with-tabs-section-content">
                <div className="corporate-employee-dashboard-with-tabs-notifications-card">
                  <h2>Recent Notifications</h2>
                  {notifications.length > 0 ? (
                    <div className="corporate-employee-dashboard-with-tabs-notifications-list">
                      {notifications.map((notif) => (
                        <div
                          key={notif._id}
                          className="corporate-employee-dashboard-with-tabs-notification-item"
                        >
                          <div className="corporate-employee-dashboard-with-tabs-notification-type">
                            <span
                              className={`corporate-employee-dashboard-with-tabs-type-badge ${notif.type?.toLowerCase()}`}
                            >
                              {notif.type}
                            </span>
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-notification-content">
                            <h4>{notif.title}</h4>
                            <p>{notif.message}</p>
                          </div>
                          <div className="corporate-employee-dashboard-with-tabs-notification-date">
                            {new Date(notif.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="corporate-employee-dashboard-with-tabs-no-notifications">
                      <p>No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
