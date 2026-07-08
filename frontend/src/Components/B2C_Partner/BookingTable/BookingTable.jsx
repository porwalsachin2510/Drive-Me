"use client";

import { useLocale } from "../../../hooks/useLocale";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getPartnerBookings,
  acceptBooking,
  rejectBooking,
} from "../../../Redux/slices/bookingSlice";
import PassengerDetailsModal from "../PassengerDetailsModal/PassengerDetailsModal";
import WalletRechargeModal from "../../WalletRechargeModal/WalletRechargeModal";
import api from "../../../utils/api";
import { useSocket } from "../../../hooks/useSocket";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import "./BookingTable.css";

/**
 * BookingTable - Table-based booking management for B2C Partner
 * Shows all bookings in a professional table format with:
 * - Search functionality
 * - Status filtering
 * - Pagination
 * - Sorting
 * - Accept/Reject actions for CONFIRMED bookings
 */
function BookingTable() {
  const dispatch = useDispatch();
  const { partnerBookings, loading } = useSelector((state) => state.booking);
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();
  // Active currency for the logged-in partner's country (e.g. KWD for Kuwait).
  const { currency: activeCurrency } = useLocale();

  // Modal states
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Wallet states for cash booking acceptance
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [pendingAcceptBooking, setPendingAcceptBooking] = useState(null);

  // Table control states
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Fetch bookings on mount
  useEffect(() => {
    if (user?.role === "B2C_PARTNER") {
      dispatch(getPartnerBookings({ status: "ALL" }));
      fetchWalletBalance();
    }
  }, [dispatch, user]);

  // Live auto-refresh: silent background polling + instant refetch on booking
  // socket events keeps the table current without a manual page refresh.
  useAutoRefresh(
    ({ silent } = {}) => {
      if (user?.role === "B2C_PARTNER") {
        dispatch(getPartnerBookings({ status: "ALL", silent }));
        fetchWalletBalance();
      }
    },
    {
      interval: 20000,
      enabled: user?.role === "B2C_PARTNER",
      socketEvents: [
        "passenger-booked",
        "passenger-cancelled",
        "booking-accepted",
        "booking-rejected",
        "new-notification",
      ],
    },
  );

  // Socket listener for real-time updates (e.g., booking cancelled by commuter)
  useEffect(() => {
    if (!socket || !socket.socket) return;

    const handleNotification = (notification) => {
      if (notification.type === "BOOKING_CANCELLED") {
        // Refresh bookings and wallet balance when a booking is cancelled
        dispatch(getPartnerBookings({ status: "ALL" }));
        fetchWalletBalance(); // Commission might have been refunded
      }
    };

    socket.socket.on("notification", handleNotification);

    return () => {
      if (socket.socket) {
        socket.socket.off("notification", handleNotification);
      }
    };
  }, [dispatch, socket]);

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      const response = await api.get("/wallet/balance");
      const balance = response.data.data?.balance || 0;
      setWalletBalance(balance);
    } catch (error) {
      console.error("[v0] Error fetching wallet balance:", error);
      setWalletBalance(0);
    }
  };

  // Helper functions
  const getPassengerName = (booking) => {
    if (booking.passengerId?.fullName) return booking.passengerId.fullName;
    if (booking.passengerId?.name) return booking.passengerId.name;
    if (booking.passengerName) return booking.passengerName;
    return "Unknown Passenger";
  };

  const getPassengerPhone = (booking) => {
    if (booking.passengerId?.whatsappNumber)
      return booking.passengerId.whatsappNumber;
    if (booking.passengerId?.phone) return booking.passengerId.phone;
    return "No phone";
  };

  const getDriverInfo = (booking) => {
    // For ROUND_TRIP bookings, return both outbound and return driver info
    if (booking.bookingType === "ROUND_TRIP") {
      // Get outbound driver name - check populated field, then fallback to name fields
      let outboundDriver = "Not Assigned";
      if (booking.outboundIsSelfDriver) {
        outboundDriver = "Self-Driving";
      } else if (booking.outboundDriverName) {
        outboundDriver = booking.outboundDriverName;
      } else if (
        booking.outboundDriverId?.name ||
        booking.outboundDriverId?.fullName
      ) {
        outboundDriver =
          booking.outboundDriverId?.name || booking.outboundDriverId?.fullName;
      } else if (booking.driverName) {
        outboundDriver = booking.driverName;
      }

      // Get return driver name - check populated field, then fallback to name fields
      let returnDriver = "Not Assigned";
      if (booking.returnIsSelfDriver) {
        returnDriver = "Self-Driving";
      } else if (booking.returnDriverName) {
        returnDriver = booking.returnDriverName;
      } else if (
        booking.returnDriverId?.name ||
        booking.returnDriverId?.fullName
      ) {
        returnDriver =
          booking.returnDriverId?.name || booking.returnDriverId?.fullName;
      }

      return {
        isRoundTrip: true,
        outbound: {
          name: outboundDriver,
          badge: booking.outboundIsSelfDriver
            ? "self-driver"
            : outboundDriver !== "Not Assigned"
              ? "assigned-driver"
              : "",
          time: booking.outboundTripTime || "N/A",
        },
        return: {
          name: returnDriver,
          badge: booking.returnIsSelfDriver
            ? "self-driver"
            : returnDriver !== "Not Assigned"
              ? "assigned-driver"
              : "",
          time: booking.returnTripTime || "N/A",
        },
      };
    }

    // For ONE_WAY bookings, return single driver info
    if (booking.isSelfDriver || booking.outboundIsSelfDriver) {
      return { isRoundTrip: false, name: "Self-Driving", badge: "self-driver" };
    }
    if (booking.outboundDriverName || booking.driverName) {
      return {
        isRoundTrip: false,
        name: booking.outboundDriverName || booking.driverName,
        badge: "assigned-driver",
      };
    }
    return { isRoundTrip: false, name: "Not Assigned", badge: "" };
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

  // Filter, search, and sort bookings
  const filteredBookings = useMemo(() => {
    let bookings = Array.isArray(partnerBookings) ? [...partnerBookings] : [];

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
  }, [partnerBookings, filterStatus, searchQuery, sortField, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, itemsPerPage]);

  // Stats calculations
  const bookingStats = useMemo(() => {
    const bookingsArr = Array.isArray(partnerBookings) ? partnerBookings : [];
    return {
      totalBookings: bookingsArr.length,
      confirmedBookings: bookingsArr.filter(
        (b) => b.bookingStatus === "CONFIRMED",
      ).length,
      acceptedBookings: bookingsArr.filter((b) =>
        ["ACCEPTED", "IN_PROGRESS"].includes(b.bookingStatus),
      ).length,
      completedBookings: bookingsArr.filter(
        (b) => b.bookingStatus === "COMPLETED",
      ).length,
      cancelledBookings: bookingsArr.filter(
        (b) => b.bookingStatus === "CANCELLED",
      ).length,
    };
  }, [partnerBookings]);

  // Handlers
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

  const handleAccept = (booking) => {
    // Check wallet balance for cash bookings before accepting
    if (booking.paymentMethod === "CASH") {
      const adminCommission = booking.adminCommissionAmount || 0;
      const requiredBalance = adminCommission + 50; // 50 AED buffer as per backend

      if (walletBalance < requiredBalance) {
        // Insufficient balance - show warning modal
        setPendingAcceptBooking(booking);
        setShowWalletWarning(true);
        return;
      }
    }

    // Proceed with accepting the booking
    dispatch(acceptBooking(booking._id))
      .then((result) => {
        if (result.meta.requestStatus === "fulfilled") {
          dispatch(getPartnerBookings({ status: "ALL" }));
          fetchWalletBalance(); // Refresh wallet balance after acceptance
        } else if (result.payload?.requiresWalletFunding) {
          // Backend returned wallet funding required error
          setPendingAcceptBooking(booking);
          setShowWalletWarning(true);
        } else {
          alert(
            `Failed to accept booking: ${result.payload?.message || "Unknown error"}`,
          );
        }
      })
      .catch((error) => {
        console.error("[v0] Accept booking error:", error);
        if (error.requiresWalletFunding) {
          setPendingAcceptBooking(booking);
          setShowWalletWarning(true);
        }
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
      )
        .then((result) => {
          if (result.meta.requestStatus === "fulfilled") {
            // Success - refresh bookings
            dispatch(getPartnerBookings({ status: "ALL" }));
            setShowRejectModal(false);
            setSelectedBooking(null);
            setRejectionReason("");
          } else {
            // Error - show alert
            alert(
              `Failed to reject booking: ${result.payload || "Unknown error"}`,
            );
          }
        })
        .catch((err) => {
          alert(`Error rejecting booking: ${err.message}`);
        });
    }
  };

  const handleViewPassenger = (bookingId) => {
    setSelectedBookingId(bookingId);
    setShowPassengerModal(true);
  };

  const refreshBookings = useCallback(() => {
    dispatch(getPartnerBookings({ status: "ALL" }));
  }, [dispatch]);

  if (loading) {
    return (
      <div className="b2c-booking-table-container">
        <div className="b2c-booking-table-loading">
          <div className="b2c-booking-table-spinner"></div>
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="b2c-booking-table-container">
      {/* Header */}
      <div className="b2c-booking-table-header">
        <h2>Booking Management</h2>
        <div className="b2c-booking-table-header-right">
          <div className="b2c-wallet-balance-display">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M16 10h.01" />
            </svg>
            <span>
              Wallet:{" "}
              <strong>
                {walletBalance.toLocaleString()} {activeCurrency}
              </strong>
            </span>
          </div>
          <button
            className="b2c-booking-table-refresh-btn"
            onClick={() => {
              refreshBookings();
              fetchWalletBalance();
            }}
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
      </div>

      {/* Stats Row */}
      <div className="b2c-booking-table-stats">
        <div className="b2c-booking-stat-card">
          <span className="b2c-booking-stat-value">
            {bookingStats.totalBookings}
          </span>
          <span className="b2c-booking-stat-label">Total Bookings</span>
        </div>
        <div className="b2c-booking-stat-card">
          <span className="b2c-booking-stat-value stat-orange">
            {bookingStats.confirmedBookings}
          </span>
          <span className="b2c-booking-stat-label">Confirmed</span>
        </div>
        <div className="b2c-booking-stat-card">
          <span className="b2c-booking-stat-value stat-green">
            {bookingStats.acceptedBookings}
          </span>
          <span className="b2c-booking-stat-label">Accepted</span>
        </div>
        <div className="b2c-booking-stat-card">
          <span className="b2c-booking-stat-value stat-purple">
            {bookingStats.completedBookings}
          </span>
          <span className="b2c-booking-stat-label">Completed</span>
        </div>
        <div className="b2c-booking-stat-card">
          <span className="b2c-booking-stat-value stat-red">
            {bookingStats.cancelledBookings}
          </span>
          <span className="b2c-booking-stat-label">Cancelled</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="b2c-booking-table-controls">
        <div className="b2c-booking-search-box">
          <svg
            className="b2c-booking-search-icon"
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
            className="b2c-booking-search-input"
          />
          {searchQuery && (
            <button
              className="b2c-booking-search-clear"
              onClick={() => setSearchQuery("")}
            >
              x
            </button>
          )}
        </div>

        <div className="b2c-booking-filter-group">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="b2c-booking-status-filter"
          >
            <option value="ALL">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="b2c-booking-per-page-select"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="b2c-booking-results-summary">
        Showing {paginatedBookings.length} of {filteredBookings.length} bookings
        {searchQuery && (
          <span className="b2c-booking-search-term">
            {" "}
            matching &quot;{searchQuery}&quot;
          </span>
        )}
      </div>

      {/* Bookings Table */}
      <div className="b2c-booking-table-wrapper">
        {paginatedBookings.length === 0 ? (
          <div className="b2c-booking-empty-state">
            <svg
              className="b2c-booking-empty-icon"
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
          <table className="b2c-booking-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("createdAt")}
                  className="b2c-th-sortable"
                >
                  <span>Booking ID</span>
                  <span
                    className={`b2c-sort-icon ${getSortIcon("createdAt")}`}
                  ></span>
                </th>
                <th
                  onClick={() => handleSort("passengerName")}
                  className="b2c-th-sortable"
                >
                  <span>Passenger</span>
                  <span
                    className={`b2c-sort-icon ${getSortIcon("passengerName")}`}
                  ></span>
                </th>
                <th
                  onClick={() => handleSort("pickupLocation")}
                  className="b2c-th-sortable"
                >
                  <span>Route</span>
                  <span
                    className={`b2c-sort-icon ${getSortIcon("pickupLocation")}`}
                  ></span>
                </th>
                <th>Driver</th>
                <th>Seats</th>
                <th
                  onClick={() => handleSort("paymentAmount")}
                  className="b2c-th-sortable"
                >
                  <span>Amount</span>
                  <span
                    className={`b2c-sort-icon ${getSortIcon("paymentAmount")}`}
                  ></span>
                </th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((booking) => {
                const driverInfo = getDriverInfo(booking);
                return (
                  <tr key={booking._id}>
                    <td className="b2c-td-id">
                      <span className="b2c-booking-id-badge">
                        #{booking._id.slice(-8)}
                      </span>
                    </td>
                    <td className="b2c-td-passenger">
                      <div className="b2c-passenger-info">
                        <span className="b2c-passenger-name">
                          {getPassengerName(booking)}
                        </span>
                        <span className="b2c-passenger-phone">
                          {getPassengerPhone(booking)}
                        </span>
                      </div>
                    </td>
                    <td className="b2c-td-route">
                      <div className="b2c-route-cell">
                        <span className="b2c-route-from">
                          {booking.pickupLocation || "N/A"}
                        </span>
                        <span className="b2c-route-arrow">-</span>
                        <span className="b2c-route-to">
                          {booking.dropoffLocation || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="b2c-td-driver">
                      {driverInfo.isRoundTrip ? (
                        <div className="b2c-driver-info b2c-driver-roundtrip">
                          <div className="b2c-driver-trip-section">
                            <span className="b2c-trip-label">
                              Outbound ({driverInfo.outbound.time}):
                            </span>
                            <span className="b2c-driver-name">
                              {driverInfo.outbound.name}
                            </span>
                            <span
                              className={`b2c-driver-badge ${driverInfo.outbound.badge}`}
                            >
                              {driverInfo.outbound.badge === "self-driver"
                                ? "Self-Driving"
                                : "Assigned Driver"}
                            </span>
                          </div>
                          <div className="b2c-driver-trip-section b2c-driver-return">
                            <span className="b2c-trip-label">
                              Return ({driverInfo.return.time}):
                            </span>
                            <span className="b2c-driver-name">
                              {driverInfo.return.name}
                            </span>
                            <span
                              className={`b2c-driver-badge ${driverInfo.return.badge}`}
                            >
                              {driverInfo.return.badge === "self-driver"
                                ? "Self-Driving"
                                : "Assigned Driver"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="b2c-driver-info">
                          <span className="b2c-driver-name">
                            {driverInfo.name}
                          </span>
                          {driverInfo.badge && (
                            <span
                              className={`b2c-driver-badge ${driverInfo.badge}`}
                            >
                              {driverInfo.badge === "self-driver"
                                ? "Self-Driving"
                                : "Assigned Driver"}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="b2c-td-seats">
                      <span className="b2c-seats-badge">
                        {booking.numberOfSeats || 1}
                      </span>
                    </td>
                    <td className="b2c-td-amount">
                      <span className="b2c-amount-text">
                        {booking.paymentAmount?.toLocaleString() || "0"}{" "}
                        {booking.currency || activeCurrency}
                      </span>
                    </td>
                    <td className="b2c-td-status">
                      <span
                        className={`b2c-status-pill status-${booking.bookingStatus?.toLowerCase()}`}
                      >
                        {booking.bookingStatus}
                      </span>
                      {/* Show commission refund badge for CANCELLED bookings */}
                      {booking.bookingStatus === "CANCELLED" &&
                        booking.commissionRefunded && (
                          <span className="b2c-commission-refund-badge">
                            Refunded:{" "}
                            {booking.commissionRefundAmount?.toLocaleString() ||
                              0}{" "}
                            {booking.currency || activeCurrency}
                          </span>
                        )}
                    </td>
                    <td className="b2c-td-date">
                      <span className="b2c-date-text">
                        {formatDate(booking.createdAt)}
                      </span>
                    </td>
                    <td className="b2c-td-actions">
                      <div className="b2c-action-buttons">
                        <button
                          className="b2c-btn-view"
                          onClick={() => handleViewPassenger(booking._id)}
                          title="View Details"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M22 12c-2.667 4.667-6 7-10 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7" />
                          </svg>
                        </button>
                        {booking.bookingStatus === "CONFIRMED" &&
                          !booking.acceptedAt && (
                            <>
                              <button
                                className="b2c-btn-accept"
                                onClick={() => handleAccept(booking)}
                                title="Accept Booking"
                              >
                                Accept
                              </button>
                              <button
                                className="b2c-btn-reject"
                                onClick={() => handleRejectClick(booking)}
                                title="Reject Booking"
                              >
                                Reject
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="b2c-booking-pagination">
          <button
            className="b2c-page-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            className="b2c-page-btn"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>

          <div className="b2c-page-numbers">
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
                  className={`b2c-page-num ${currentPage === pageNum ? "active" : ""}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            className="b2c-page-btn"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button
            className="b2c-page-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>

          <span className="b2c-page-info">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="b2c-booking-modal-overlay">
          <div className="b2c-booking-modal">
            <div className="b2c-booking-modal-header">
              <h3>Reject Booking</h3>
              <button
                className="b2c-booking-modal-close"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedBooking(null);
                  setRejectionReason("");
                }}
              >
                x
              </button>
            </div>
            <div className="b2c-booking-modal-body">
              <p>Are you sure you want to reject this booking?</p>
              <div className="b2c-booking-form-group">
                <label>Reason for rejection:</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
            <div className="b2c-booking-modal-actions">
              <button
                className="b2c-booking-btn-cancel"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedBooking(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </button>
              <button
                className="b2c-booking-btn-confirm-reject"
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim()}
              >
                Reject Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger Details Modal */}
      <PassengerDetailsModal
        bookingId={selectedBookingId}
        isOpen={showPassengerModal}
        onClose={() => {
          setShowPassengerModal(false);
          setSelectedBookingId(null);
        }}
      />

      {/* Wallet Warning Modal for Cash Bookings */}
      {showWalletWarning && pendingAcceptBooking && (
        <div className="b2c-booking-modal-overlay">
          <div className="b2c-booking-modal b2c-wallet-warning-modal">
            <div className="b2c-booking-modal-header">
              <h3>Insufficient Wallet Balance</h3>
              <button
                className="b2c-booking-modal-close"
                onClick={() => {
                  setShowWalletWarning(false);
                  setPendingAcceptBooking(null);
                }}
              >
                x
              </button>
            </div>
            <div className="b2c-booking-modal-body">
              <div className="b2c-wallet-warning-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="b2c-wallet-warning-text">
                You need sufficient wallet balance to accept cash bookings. The
                admin commission of{" "}
                <strong>
                  {pendingAcceptBooking?.adminCommissionAmount || 0}{" "}
                  {pendingAcceptBooking?.currency || activeCurrency}
                </strong>{" "}
                will be deducted from your wallet.
              </p>
              <div className="b2c-wallet-info-box">
                <div className="b2c-wallet-info-row">
                  <span>Current Balance:</span>
                  <span className="b2c-wallet-balance">
                    {walletBalance}{" "}
                    {pendingAcceptBooking?.currency || activeCurrency}
                  </span>
                </div>
                <div className="b2c-wallet-info-row">
                  <span>Required Amount:</span>
                  <span className="b2c-wallet-required">
                    {(pendingAcceptBooking?.adminCommissionAmount || 0) + 50}{" "}
                    {pendingAcceptBooking?.currency || activeCurrency}
                  </span>
                </div>
                <div className="b2c-wallet-info-row b2c-wallet-shortage">
                  <span>Shortage:</span>
                  <span>
                    {Math.max(
                      0,
                      (pendingAcceptBooking?.adminCommissionAmount || 0) +
                        50 -
                        walletBalance,
                    )}{" "}
                    {pendingAcceptBooking?.currency || activeCurrency}
                  </span>
                </div>
              </div>
            </div>
            <div className="b2c-booking-modal-actions">
              <button
                className="b2c-booking-btn-cancel"
                onClick={() => {
                  setShowWalletWarning(false);
                  setPendingAcceptBooking(null);
                }}
              >
                Cancel
              </button>
              <button
                className="b2c-booking-btn-recharge"
                onClick={() => {
                  setShowWalletWarning(false);
                  setShowRechargeModal(true);
                }}
              >
                Add Funds to Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Recharge Modal */}
      <WalletRechargeModal
        isOpen={showRechargeModal}
        onClose={() => {
          setShowRechargeModal(false);
          setPendingAcceptBooking(null);
        }}
        onRechargeSuccess={() => {
          setShowRechargeModal(false);
          fetchWalletBalance();
          // After successful recharge, user can try accepting the booking again
        }}
        country={user?.country || "UAE"}
        currency={pendingAcceptBooking?.currency || activeCurrency}
      />
    </div>
  );
}

export default BookingTable;
