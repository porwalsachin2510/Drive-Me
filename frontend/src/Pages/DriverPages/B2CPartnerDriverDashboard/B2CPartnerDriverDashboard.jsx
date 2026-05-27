/* eslint-disable no-unused-vars */
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../Redux/slices/authSlice";
import { useSocket } from "../../../hooks/useSocket";
import {
  getPartnerDriverBookings,
  getPartnerBookings,
  startB2CTrip,
  completeB2CTrip,
  acceptBooking,
  rejectBooking,
  completeBooking,
} from "../../../Redux/slices/bookingSlice";
import DriverDailyTrips from "../../../Components/DriverDailyTrips/DriverDailyTrips";
import DashboardLayout from "../../../Components/DashboardLayout/DashboardLayout";
import DriverRatings from "../../../Components/DriverRatings/DriverRatings";
import AvailabilityStatusPopup from "../../../Components/AvailabilityStatusPopup/AvailabilityStatusPopup";
import api from "../../../utils/api";
import "./B2CPartnerDriverDashboard.css";

function B2CPartnerDriverDashboard() {
  const { user } = useSelector((state) => state.auth);
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const socket = useSocket();
  const dispatch = useDispatch();

  const driverBookings =
    useSelector((state) => state.booking.driverBookings) || [];

  const [liveLocation, setLiveLocation] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ACCEPTED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("bookings");
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const locationIntervalRef = useRef(null);

  // Driver availability state
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);

  // Availability popup state
  const [showAvailabilityPopup, setShowAvailabilityPopup] = useState(false);
  const [detailedAvailabilityInfo, setDetailedAvailabilityInfo] = useState({
    assignedSchedules: [],
    completedTripsToday: [],
    nextScheduledTrip: null,
    userType: "driver",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const navigate = useNavigate();

  // Fetch driver availability status on mount with silent polling
  useEffect(() => {
    const fetchAvailabilityStatus = async () => {
      try {
        setLoadingAvailability(true);
        const response = await api.get("/b2c-daily-trips/driver/availability");
        if (response.data.success) {
          setAvailabilityStatus(
            response.data.availability?.status || "available",
          );
        }
      } catch (error) {
        console.error("Error fetching availability status:", error);
      } finally {
        setLoadingAvailability(false);
      }
    };

    // Check and auto-update availability if user has scheduled trips today
    const checkAndAutoUpdateAvailability = async () => {
      try {
        const response = await api.get(
          "/b2c-daily-trips/driver/check-availability",
        );
        if (response.data.success && response.data.data) {
          const { currentStatus, statusUpdated, message } = response.data.data;
          if (statusUpdated) {
            console.log("[v0] Auto-updated availability status:", message);
            setAvailabilityStatus(currentStatus);
          }
        }
      } catch (error) {
        console.error("[v0] Error checking availability:", error);
      }
    };

    // Silent version for polling
    const fetchAvailabilityStatusSilent = async () => {
      try {
        const response = await api.get("/b2c-daily-trips/driver/availability");
        if (response.data.success) {
          setAvailabilityStatus(
            response.data.availability?.status || "available",
          );
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
      }
    };

    fetchAvailabilityStatus();
     // Also check and auto-update availability based on scheduled trips
    checkAndAutoUpdateAvailability();
    // Silent polling: refresh availability status every 5 seconds
    const pollInterval = setInterval(fetchAvailabilityStatusSilent, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Fetch detailed availability info for popup
  const fetchDetailedAvailabilityInfo = async () => {
    try {
      const response = await api.get(
        "/b2c-daily-trips/driver/availability/detailed",
      );
      if (response.data.success) {
        setDetailedAvailabilityInfo({
          assignedSchedules: response.data.assignedSchedules || [],
          completedTripsToday: response.data.completedTripsToday || [],
          nextScheduledTrip: response.data.nextScheduledTrip || null,
          userType: response.data.userType || "driver",
        });
        setAvailabilityStatus(response.data.currentStatus || "available");
      }
    } catch (error) {
      console.error("Error fetching detailed availability info:", error);
    }
  };

  const handleAvailabilityChange = async (newStatus) => {
    // If trying to set "available" and current status is "busy", show the popup first
    if (newStatus === "available" && availabilityStatus === "busy") {
      // Fetch detailed info and show popup
      await fetchDetailedAvailabilityInfo();
      setShowAvailabilityPopup(true);
      return;
    }

    try {
      setUpdatingAvailability(true);
      const response = await api.put(
        "/b2c-daily-trips/driver/availability/status",
        {
          status: newStatus,
        },
      );
      if (response.data.success) {
        setAvailabilityStatus(newStatus);
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update availability status";
      const hasIncomplete =
        error.response?.data?.hasIncompleteTrips ||
        error.response?.data?.hasInProgressTrip ||
        false;

      // Show popup instead of alert for better UX
      if (hasIncomplete) {
        await fetchDetailedAvailabilityInfo();
        setShowAvailabilityPopup(true);
      } else {
        alert(errorMessage);
      }
    } finally {
      setUpdatingAvailability(false);
    }
  };

  // Handle confirm available from popup
  const handleConfirmAvailableFromPopup = async () => {
    try {
      setUpdatingAvailability(true);
      const response = await api.put(
        "/b2c-daily-trips/driver/availability/status",
        {
          status: "available",
        },
      );
      if (response.data.success) {
        setAvailabilityStatus("available");
        setShowAvailabilityPopup(false);
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update availability status";
      alert(errorMessage);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const getAvailabilityStatusColor = (status) => {
    switch (status) {
      case "available":
        return "#10b981";
      case "busy":
        return "#ef4444";
      case "offline":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getAvailabilityStatusLabel = (status) => {
    switch (status) {
      case "available":
        return "Available";
      case "busy":
        return "Busy";
      case "offline":
        return "Offline";
      default:
        return "Unknown";
    }
  };

  useEffect(() => {
    if (user?.role === "B2C_PARTNER_DRIVER") {
      dispatch(getPartnerDriverBookings({ status: "ALL" }));
    } else {
      navigate("/");
    }
  }, [dispatch, user, navigate]);

  const memoizedDriverBookings = useMemo(
    () => driverBookings,
    [JSON.stringify(driverBookings)],
  );

  const initialFilterStatus = useMemo(() => {
    if (memoizedDriverBookings && memoizedDriverBookings.length > 0) {
      const statuses = memoizedDriverBookings.map((b) => b.bookingStatus);
      const hasInProgress = statuses.includes("IN_PROGRESS");
      const hasAccepted = statuses.includes("ACCEPTED");
      const hasPending = statuses.includes("PENDING");

      if (hasInProgress) return "IN_PROGRESS";
      if (hasAccepted) return "ACCEPTED";
      if (hasPending) return "PENDING";
      return "ALL";
    }
    return "ACCEPTED";
  }, [memoizedDriverBookings]);

  const hasSetInitialFilter = useRef(false);
  useEffect(() => {
    if (!hasSetInitialFilter.current && memoizedDriverBookings.length > 0) {
      setFilterStatus(initialFilterStatus);
      hasSetInitialFilter.current = true;
    }
  }, [memoizedDriverBookings, initialFilterStatus]);

  const handleAccept = (bookingId) => {
    dispatch(acceptBooking(bookingId)).then(() => {
      dispatch(getPartnerDriverBookings({ status: filterStatus }));
    });
  };

  const handleRejectClick = (booking) => {
    setSelectedBooking(booking);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => {
    if (selectedBooking) {
      dispatch(
        rejectBooking({
          bookingId: selectedBooking._id,
          rejectionReason,
        }),
      ).then(() => {
        dispatch(getPartnerDriverBookings({ status: filterStatus }));
        setShowRejectModal(false);
        setSelectedBooking(null);
        setRejectionReason("");
      });
    }
  };

  const handleComplete = async (bookingId) => {
    try {
      await dispatch(completeBooking(bookingId)).unwrap();
      dispatch(getPartnerBookings({ status: filterStatus }));
    } catch (error) {
      console.error("Error completing booking:", error);
    }
  };

  const updateLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            driverId: user?.driverId || user?._id,
            timestamp: new Date().toISOString(),
            driverType: user?.role,
          };

          // Emit via socket for real-time updates
          if (socket && socket.socket) {
            const locationData = {
              bookingId: activeTrip?._id,
              driverId: user?.driverId || user?._id,
              userId: user?._id,
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              timestamp: new Date().toISOString(),
              driverType: user?.role,
            };

            socket.socket.emit("driver-location-update", locationData);
          }

          // Also update via API to store in database and broadcast to booking rooms
          try {
            await api.post("/b2c-daily-trips/driver/update-location", {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              tripId: activeTrip?._id,
            });
            console.log("[v0] B2C Partner Driver location updated via API");
          } catch (err) {
            console.error("[v0] Error updating location via API:", err);
          }

          setLiveLocation(location);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    }
  }, [socket, user?._id, user?.driverId, user?.role, activeTrip?._id]);

  const startAutomaticLocationSharing = useCallback(() => {
    if (isSharingLocation) return;

    setIsSharingLocation(true);

    updateLocation();

    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, 5000);

    if (socket && socket.socket) {
      socket.socket.emit("join-driver-room", user._id);
    }
  }, [isSharingLocation, socket, user._id, updateLocation]);

  const stopAutomaticLocationSharing = useCallback(() => {
    if (!isSharingLocation) return;

    setIsSharingLocation(false);

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    setActiveTrip(null);
  }, [isSharingLocation]);

  const startTrip = async (bookingId) => {
    try {
      const result = await dispatch(startB2CTrip(bookingId)).unwrap();

      await dispatch(getPartnerDriverBookings({ status: filterStatus }));

      const booking = driverBookings.find((b) => b._id === bookingId);
      setActiveTrip(booking);
      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    } catch (error) {
      console.error("Error starting trip:", error);
    }
  };

  const completeTrip = async (bookingId) => {
    try {
      const result = await dispatch(completeB2CTrip(bookingId)).unwrap();

      await dispatch(getPartnerDriverBookings({ status: filterStatus }));

      const remainingTrips = partnerBookings.filter(
        (booking) =>
          booking._id !== bookingId &&
          (booking.bookingStatus === "ACCEPTED" ||
            booking.bookingStatus === "IN_PROGRESS"),
      );

      if (remainingTrips.length === 0) {
        stopAutomaticLocationSharing();
      } else {
        setActiveTrip(remainingTrips[0]);
      }
    } catch (error) {
      console.error("Error completing trip:", error);
    }
  };

  useEffect(() => {
    if (!socket || !socket.socket) return;

    socket.socket.on("new-b2c-booking", (booking) => {
      dispatch(getPartnerBookings({ status: filterStatus }));

      if (!isSharingLocation) {
        startAutomaticLocationSharing();
      }
    });

    socket.socket.on("location-update", (location) => {
      // Handle location update
    });

    return () => {
      socket.socket.off("new-b2c-booking");
      socket.socket.off("location-update");
    };
  }, [
    socket,
    isSharingLocation,
    startAutomaticLocationSharing,
    dispatch,
    filterStatus,
  ]);

  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  // Helper function to get passenger name from booking
  const getPassengerName = (booking) => {
    // Check populated passengerId object first
    if (booking.passengerId?.fullName) return booking.passengerId.fullName;
    if (booking.passengerId?.name) return booking.passengerId.name;
    // Fallback to booking level fields
    if (booking.passengerName) return booking.passengerName;
    if (booking.driverName) return booking.driverName;
    return "Unknown Passenger";
  };

  // Helper function to get passenger phone from booking
  const getPassengerPhone = (booking) => {
    // Check populated passengerId object first
    if (booking.passengerId?.whatsappNumber)
      return booking.passengerId.whatsappNumber;
    if (booking.passengerId?.phone) return booking.passengerId.phone;
    // Fallback to booking level fields
    if (booking.driverPhoneNumber) return booking.driverPhoneNumber;
    return "No phone";
  };

  // Filter, search, and sort bookings
  const filteredBookings = useMemo(() => {
    let bookings = Array.isArray(driverBookings) ? [...driverBookings] : [];

    // Filter by status
    if (filterStatus !== "ALL") {
      bookings = bookings.filter(
        (booking) => booking.bookingStatus === filterStatus,
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      bookings = bookings.filter((booking) => {
        const passengerName = getPassengerName(booking).toLowerCase();
        const pickup = (booking.pickupLocation || "").toLowerCase();
        const dropoff = (booking.dropoffLocation || "").toLowerCase();
        const bookingId = (booking._id || "").toLowerCase();
        return (
          passengerName.includes(query) ||
          pickup.includes(query) ||
          dropoff.includes(query) ||
          bookingId.includes(query)
        );
      });
    }

    // Sort
    bookings.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case "createdAt":
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case "passengerName":
          aVal = getPassengerName(a).toLowerCase();
          bVal = getPassengerName(b).toLowerCase();
          break;
        case "pickupLocation":
          aVal = (a.pickupLocation || "").toLowerCase();
          bVal = (b.pickupLocation || "").toLowerCase();
          break;
        case "paymentAmount":
          aVal = a.paymentAmount || 0;
          bVal = b.paymentAmount || 0;
          break;
        default:
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
      }
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return bookings;
  }, [driverBookings, filterStatus, searchQuery, sortField, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return "sort";
    return sortOrder === "asc" ? "sort-up" : "sort-down";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#ffc107";
      case "ACCEPTED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      case "COMPLETED":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };

  const bookingStats = useMemo(() => {
    const bookingsArr = Array.isArray(driverBookings) ? driverBookings : [];
    const totalBookings = bookingsArr.length;
    const completedBookings = bookingsArr.filter(
      (b) => b.bookingStatus === "COMPLETED",
    ).length;
    const acceptedBookings = bookingsArr.filter((b) =>
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(b.bookingStatus),
    ).length;
    const pendingBookings = bookingsArr.filter(
      (b) => b.bookingStatus === "PENDING",
    ).length;
    const rejectedBookings = bookingsArr.filter(
      (b) => b.bookingStatus === "REJECTED",
    ).length;
    const totalDecisions = acceptedBookings + rejectedBookings;
    const acceptanceRate =
      totalDecisions > 0
        ? Math.round((acceptedBookings / totalDecisions) * 100)
        : 100;
    return {
      totalBookings,
      completedBookings,
      acceptanceRate,
      pendingBookings,
      acceptedBookings,
    };
  }, [driverBookings]);

  if (loading) {
    return (
      <DashboardLayout
        activeTab={activeMainTab}
        setActiveTab={setActiveMainTab}
      >
        <div className="drivemego-btoc-dd-loading">Loading bookings...</div>
      </DashboardLayout>
    );
  }

  const renderContent = () => {
    switch (activeMainTab) {
      case "bookings":
        return (
          <div className="drivemego-btoc-dd-tab-content">
            <div className="drivemego-btoc-dd-tab-header">
              <h2>Booking Management</h2>
            </div>

            <div className="drivemego-btoc-dd-stats-row">
              <div className="drivemego-btoc-dd-stat-card">
                <span className="drivemego-btoc-dd-stat-value">
                  {bookingStats.totalBookings}
                </span>
                <span className="drivemego-btoc-dd-stat-label">
                  Total Bookings
                </span>
              </div>
              <div className="drivemego-btoc-dd-stat-card">
                <span className="drivemego-btoc-dd-stat-value">
                  {bookingStats.acceptedBookings}
                </span>
                <span className="drivemego-btoc-dd-stat-label">Accepted</span>
              </div>
              <div className="drivemego-btoc-dd-stat-card">
                <span className="drivemego-btoc-dd-stat-value">
                  {bookingStats.completedBookings}
                </span>
                <span className="drivemego-btoc-dd-stat-label">Completed</span>
              </div>
            </div>

            {/* Driver Availability Toggle */}
            <div
              className="drivemego-btoc-dd-availability-section"
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor:
                      getAvailabilityStatusColor(availabilityStatus),
                    boxShadow: `0 0 8px ${getAvailabilityStatusColor(availabilityStatus)}50`,
                  }}
                />
                <div>
                  <h4
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    Your Availability Status
                  </h4>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      margin: "2px 0 0 0",
                    }}
                  >
                    {loadingAvailability
                      ? "Loading..."
                      : availabilityStatus === "available"
                        ? "You are visible for new trip assignments"
                        : availabilityStatus === "busy"
                          ? "You are marked as busy - no new assignments"
                          : "You are offline - no new assignments"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {["available", "busy", "offline"].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleAvailabilityChange(status)}
                    disabled={updatingAvailability || loadingAvailability}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      border:
                        availabilityStatus === status
                          ? "2px solid"
                          : "1px solid #e2e8f0",
                      borderColor:
                        availabilityStatus === status
                          ? getAvailabilityStatusColor(status)
                          : "#e2e8f0",
                      backgroundColor:
                        availabilityStatus === status
                          ? `${getAvailabilityStatusColor(status)}15`
                          : "#fff",
                      color:
                        availabilityStatus === status
                          ? getAvailabilityStatusColor(status)
                          : "#64748b",
                      cursor: updatingAvailability ? "wait" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {getAvailabilityStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters and Search Section */}
            <div className="drivemego-btoc-dd-table-controls">
              <div className="drivemego-btoc-dd-search-box">
                <svg
                  className="drivemego-btoc-dd-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by passenger, location, or booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="drivemego-btoc-dd-search-input"
                />
                {searchQuery && (
                  <button
                    className="drivemego-btoc-dd-search-clear"
                    onClick={() => setSearchQuery("")}
                  >
                    x
                  </button>
                )}
              </div>

              <div className="drivemego-btoc-dd-filter-group">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="drivemego-btoc-dd-status-filter"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="drivemego-btoc-dd-per-page-select"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>

            {/* Results Summary */}
            <div className="drivemego-btoc-dd-results-summary">
              Showing {paginatedBookings.length} of {filteredBookings.length}{" "}
              bookings
              {searchQuery && (
                <span className="drivemego-btoc-dd-search-term">
                  {" "}
                  matching &quot;{searchQuery}&quot;
                </span>
              )}
            </div>

            {/* Bookings Table */}
            <div className="drivemego-btoc-dd-table-wrapper">
              {paginatedBookings.length === 0 ? (
                <div className="drivemego-btoc-dd-empty-state">
                  <svg
                    className="drivemego-btoc-dd-empty-icon-svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    <path d="M9 12h6M9 16h6" />
                  </svg>
                  <h3>No bookings found</h3>
                  <p>No bookings match your current filters</p>
                </div>
              ) : (
                <table className="drivemego-btoc-dd-bookings-table">
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleSort("createdAt")}
                        className="drivemego-btoc-dd-th-sortable"
                      >
                        <span>Booking ID</span>
                        <span
                          className={`drivemego-btoc-dd-sort-icon ${getSortIcon("createdAt")}`}
                        ></span>
                      </th>
                      <th
                        onClick={() => handleSort("passengerName")}
                        className="drivemego-btoc-dd-th-sortable"
                      >
                        <span>Passenger</span>
                        <span
                          className={`drivemego-btoc-dd-sort-icon ${getSortIcon("passengerName")}`}
                        ></span>
                      </th>
                      <th
                        onClick={() => handleSort("pickupLocation")}
                        className="drivemego-btoc-dd-th-sortable"
                      >
                        <span>Route</span>
                        <span
                          className={`drivemego-btoc-dd-sort-icon ${getSortIcon("pickupLocation")}`}
                        ></span>
                      </th>
                      <th>Seats</th>
                      <th
                        onClick={() => handleSort("paymentAmount")}
                        className="drivemego-btoc-dd-th-sortable"
                      >
                        <span>Amount</span>
                        <span
                          className={`drivemego-btoc-dd-sort-icon ${getSortIcon("paymentAmount")}`}
                        ></span>
                      </th>
                      <th>Status</th>
                      <th>Date</th>
                      {filterStatus === "PENDING" && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.map((booking) => (
                      <tr
                        key={booking._id}
                        className="drivemego-btoc-dd-table-row"
                      >
                        <td className="drivemego-btoc-dd-td-id">
                          <span className="drivemego-btoc-dd-booking-id-text">
                            #{booking._id.slice(-8)}
                          </span>
                        </td>
                        <td className="drivemego-btoc-dd-td-passenger">
                          <div className="drivemego-btoc-dd-passenger-info">
                            <span className="drivemego-btoc-dd-passenger-name">
                              {getPassengerName(booking)}
                            </span>
                            <span className="drivemego-btoc-dd-passenger-phone">
                              {getPassengerPhone(booking)}
                            </span>
                          </div>
                        </td>
                        <td className="drivemego-btoc-dd-td-route">
                          <div className="drivemego-btoc-dd-route-cell">
                            <span className="drivemego-btoc-dd-route-from">
                              {booking.pickupLocation || "N/A"}
                            </span>
                            <span className="drivemego-btoc-dd-route-arrow-cell">
                              -
                            </span>
                            <span className="drivemego-btoc-dd-route-to">
                              {booking.dropoffLocation || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="drivemego-btoc-dd-td-seats">
                          <span className="drivemego-btoc-dd-seats-badge">
                            {booking.numberOfSeats || 1}
                          </span>
                        </td>
                        <td className="drivemego-btoc-dd-td-amount">
                          <span className="drivemego-btoc-dd-amount-text">
                            {booking.paymentAmount?.toLocaleString() || "0"}{" "}
                            {booking.currency || "AED"}
                          </span>
                        </td>
                        <td className="drivemego-btoc-dd-td-status">
                          <span
                            className={`drivemego-btoc-dd-status-pill status-${booking.bookingStatus?.toLowerCase()}`}
                          >
                            {booking.bookingStatus}
                          </span>
                        </td>
                        <td className="drivemego-btoc-dd-td-date">
                          <span className="drivemego-btoc-dd-date-text">
                            {formatDate(booking.createdAt)}
                          </span>
                        </td>
                        {filterStatus === "PENDING" && (
                          <td className="drivemego-btoc-dd-td-actions">
                            {booking.bookingStatus === "PENDING" && (
                              <div className="drivemego-btoc-dd-action-buttons">
                                <button
                                  className="drivemego-btoc-dd-btn-accept"
                                  onClick={() => handleAccept(booking._id)}
                                  title="Accept Booking"
                                >
                                  Accept
                                </button>
                                <button
                                  className="drivemego-btoc-dd-btn-reject"
                                  onClick={() => handleRejectClick(booking)}
                                  title="Reject Booking"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="drivemego-btoc-dd-pagination">
                <button
                  className="drivemego-btoc-dd-page-btn"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </button>
                <button
                  className="drivemego-btoc-dd-page-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  Prev
                </button>

                <div className="drivemego-btoc-dd-page-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`drivemego-btoc-dd-page-num ${currentPage === pageNum ? "active" : ""}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="drivemego-btoc-dd-page-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
                <button
                  className="drivemego-btoc-dd-page-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </button>

                <span className="drivemego-btoc-dd-page-info">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}

            {showRejectModal && selectedBooking && (
              <div className="drivemego-btoc-dd-modal-overlay">
                <div className="drivemego-btoc-dd-modal">
                  <div className="drivemego-btoc-dd-modal-header">
                    <h3>Reject Booking</h3>
                    <button
                      className="drivemego-btoc-dd-modal-close"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      x
                    </button>
                  </div>
                  <div className="drivemego-btoc-dd-modal-body">
                    <p>Are you sure you want to reject this booking?</p>
                    <div className="drivemego-btoc-dd-form-group">
                      <label>Reason for rejection:</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="drivemego-btoc-dd-modal-actions">
                    <button
                      className="drivemego-btoc-dd-action-btn cancel"
                      onClick={() => {
                        setShowRejectModal(false);
                        setSelectedBooking(null);
                        setRejectionReason("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="drivemego-btoc-dd-action-btn reject"
                      onClick={handleRejectSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Reject Booking
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "daily-trips":
        return (
          <DriverDailyTrips
            isSharingLocation={isSharingLocation}
            onTripStatusChange={(status, tripId) => {
              dispatch(getPartnerDriverBookings({ status: "ALL" }));
            }}
            onTripStart={(tripId) => {
              if (!isSharingLocation) {
                startAutomaticLocationSharing();
              }
            }}
            onTripComplete={(tripId) => {
              stopAutomaticLocationSharing();
            }}
          />
        );

      case "location":
        return (
          <div className="drivemego-btoc-dd-tab-content">
            <h2>Live Location Tracking</h2>
            <div className="drivemego-btoc-dd-location-section">
              <div className="drivemego-btoc-dd-location-status-card">
                <div
                  className={`drivemego-btoc-dd-location-indicator ${isSharingLocation ? "active" : ""}`}
                >
                  <span className="drivemego-btoc-dd-location-icon">
                    Location
                  </span>
                  <span>
                    {isSharingLocation
                      ? "Actively sharing location"
                      : "Not sharing location"}
                  </span>
                </div>
                {liveLocation && (
                  <div className="drivemego-btoc-dd-location-coords">
                    <p>
                      <strong>Latitude:</strong> {liveLocation.lat?.toFixed(6)}
                    </p>
                    <p>
                      <strong>Longitude:</strong> {liveLocation.lng?.toFixed(6)}
                    </p>
                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {new Date(liveLocation.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {activeTrip && (
                  <div className="drivemego-btoc-dd-active-trip">
                    <strong>Active Trip:</strong> {activeTrip.pickupLocation} -{" "}
                    {activeTrip.dropoffLocation}
                  </div>
                )}
              </div>

              <div className="drivemego-btoc-dd-location-map">
                {liveLocation ? (
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${liveLocation.lng - 0.01},${liveLocation.lat - 0.01},${liveLocation.lng + 0.01},${liveLocation.lat + 0.01}&layer=mapnik&marker=${liveLocation.lat},${liveLocation.lng}`}
                    className="drivemego-btoc-dd-map-iframe"
                    width="100%"
                    height="400"
                    frameBorder="0"
                    allowFullScreen
                    title="Driver Live Location"
                  />
                ) : (
                  <div className="drivemego-btoc-dd-no-location">
                    <p>No location data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case "ratings":
        return <DriverRatings />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout activeTab={activeMainTab} setActiveTab={setActiveMainTab}>
      {renderContent()}

      {/* Availability Status Popup */}
      <AvailabilityStatusPopup
        isOpen={showAvailabilityPopup}
        onClose={() => setShowAvailabilityPopup(false)}
        currentStatus={availabilityStatus}
        assignedSchedules={detailedAvailabilityInfo.assignedSchedules}
        completedTripsToday={detailedAvailabilityInfo.completedTripsToday}
        nextScheduledTrip={detailedAvailabilityInfo.nextScheduledTrip}
        onConfirmAvailable={handleConfirmAvailableFromPopup}
        loading={updatingAvailability}
        userType={detailedAvailabilityInfo.userType}
      />
    </DashboardLayout>
  );
}

export default B2CPartnerDriverDashboard;
