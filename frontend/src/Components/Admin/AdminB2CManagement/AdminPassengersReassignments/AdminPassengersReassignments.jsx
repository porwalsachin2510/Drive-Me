"use client";

import { getCurrencyDecimals } from "../../../../config/localeConfig";
import { getActiveCurrency } from "../../../../config/localeConfig";
import { useState, useEffect, useCallback } from "react";
import "./AdminPassengersReassignments.css";
import AdminReassignModal from "../AdminReassignModal/AdminReassignModal";
import api from "../../../../utils/api";

function AdminPassengersReassignments() {
  const [reassignments, setReassignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedReassignment, setSelectedReassignment] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [availableDrivers, setAvailableDrivers] = useState([]);

  const fetchReassignments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/b2c/passenger-reassignments", {
        params: { status: statusFilter !== "all" ? statusFilter : undefined },
      });
      setReassignments(response.data.reassignments || []);
    } catch (error) {
      console.error("Error fetching reassignments:", error);
      setReassignments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchRoutesAndDrivers = useCallback(async (providerId) => {
    try {
      // Fetch available routes for the provider
      const routesRes = await api.get("/admin/b2c/routes");
      const routes = routesRes.data.routes || [];
      // Filter routes by provider if needed
      const providerRoutes = providerId
        ? routes.filter(
            (r) =>
              r.b2cPartnerId === providerId ||
              r.b2cPartnerId?._id === providerId,
          )
        : routes;
      setAvailableRoutes(providerRoutes);
    } catch (error) {
      console.error("Error fetching routes:", error);
      setAvailableRoutes([]);
    }
  }, []);

  useEffect(() => {
    fetchReassignments();
  }, [fetchReassignments]);

  const handleProcessReassignment = async (
    reassignmentId,
    action,
    reason = "",
    additionalData = {},
  ) => {
    try {
      setProcessingId(reassignmentId);
      const response = await api.put(
        `/admin/b2c/passenger-reassignments/${reassignmentId}/process`,
        {
          action,
          reason,
          ...additionalData,
        },
      );

      if (response.data.success) {
        // Show success message
        alert(response.data.message || `Booking ${action} successfully!`);
        // Refresh the list
        fetchReassignments();
        // Close modal if open
        if (showReassignModal) {
          setShowReassignModal(false);
          setSelectedReassignment(null);
        }
      }
    } catch (error) {
      console.error("Error processing reassignment:", error);
      alert(
        error.response?.data?.message ||
          "Error processing booking. Please try again.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = async (reassignment) => {
    setSelectedReassignment(reassignment);
    // Fetch routes for the provider
    await fetchRoutesAndDrivers(reassignment.providerId);
    setShowReassignModal(true);
  };

  const filteredReassignments = reassignments.filter((reassignment) => {
    const term = searchTerm.toLowerCase();
    return (
      (reassignment.passengerName || "").toLowerCase().includes(term) ||
      (reassignment.passengerEmail || "").toLowerCase().includes(term) ||
      (reassignment.routeName || "").toLowerCase().includes(term) ||
      (reassignment.providerName || "").toLowerCase().includes(term) ||
      (reassignment.startPoint || "").toLowerCase().includes(term) ||
      (reassignment.endPoint || "").toLowerCase().includes(term) ||
      (reassignment.pickupLocation || "").toLowerCase().includes(term) ||
      (reassignment.dropoffLocation || "").toLowerCase().includes(term)
    );
  });

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "accepted":
      case "approved":
      case "confirmed":
        return "#28a745";
      case "rejected":
      case "cancelled":
        return "#dc3545";
      case "pending":
        return "#ffc107";
      case "in_progress":
      case "processing":
        return "#17a2b8";
      case "completed":
        return "#6f42c1";
      default:
        return "#6c757d";
    }
  };

  const formatCurrency = (amount, currency = getActiveCurrency()) => {
    const decimals = getCurrencyDecimals(currency);
    return `${currency} ${(amount || 0).toFixed(decimals)}`;
  };

  if (loading) {
    return (
      <div className="ad-dash-passenger-reassignments">
        <div className="loading">Loading passenger bookings...</div>
      </div>
    );
  }

  return (
    <div className="ad-dash-passenger-reassignments">
      <div className="ad-dash-pr-header">
        <div>
          <h3 className="ad-dash-pr-title">Passengers & Bookings</h3>
          <p className="ad-dash-pr-subtitle">
            Manage B2C passenger bookings, approvals, and route assignments.
          </p>
        </div>
        <button
          className="ad-dash-pr-refresh-btn"
          onClick={fetchReassignments}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="ad-dash-pr-filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
        </select>
        <input
          type="text"
          placeholder="Search by passenger, route, or reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="ad-dash-pr-table">
        <table>
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Route</th>
              <th>Provider</th>
              <th>Seats</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Booked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReassignments.map((booking) => (
              <tr key={booking._id}>
                <td>
                  <div className="passenger-info">
                    {booking.passengerImage && (
                      <img
                        src={booking.passengerImage}
                        alt={booking.passengerName}
                        className="passenger-avatar"
                      />
                    )}
                    <div className="passenger-details">
                      <span className="passenger-name">
                        {booking.passengerName}
                      </span>
                      <span className="passenger-email">
                        {booking.passengerEmail}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="route-info">
                    <div className="route-name">
                      {booking.startPoint || booking.pickupLocation || "N/A"}
                    </div>
                    <div className="route-direction">
                      {booking.startPoint || booking.pickupLocation} to{" "}
                      {booking.endPoint || booking.dropoffLocation}
                    </div>
                    {booking.isMonthlyPass && (
                      <span className="monthly-pass-badge">Monthly Pass</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="provider-info">
                    <span className="provider-text">
                      {booking.providerName}
                    </span>
                    {booking.vehicleInfo && (
                      <span className="vehicle-text">
                        {booking.vehicleInfo.model} (
                        {booking.vehicleInfo.licensePlate})
                      </span>
                    )}
                  </div>
                </td>
                <td>{booking.seats || 1}</td>
                <td>
                  <span className="amount-text">
                    {formatCurrency(booking.amount, booking.currency)}
                  </span>
                </td>
                <td>
                  <div className="payment-info">
                    <span className="payment-badge">
                      {booking.paymentMethod || "CASH"}
                    </span>
                    <span
                      className={`payment-status ${(booking.paymentStatus || "").toLowerCase()}`}
                    >
                      {booking.paymentStatus || "PENDING"}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(booking.status),
                    }}
                  >
                    {booking.status}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <span className="request-date">
                      {new Date(
                        booking.bookingDate || booking.createdAt,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="view-btn"
                      onClick={() => handleViewDetails(booking)}
                    >
                      View Details
                    </button>
                    {(booking.status === "PENDING" ||
                      booking.status === "pending") && (
                      <>
                        <button
                          className="approve-btn"
                          onClick={() =>
                            handleProcessReassignment(booking._id, "approve")
                          }
                          disabled={processingId === booking._id}
                        >
                          {processingId === booking._id ? "..." : "Approve"}
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => {
                            const reason = window.prompt(
                              "Enter rejection reason (optional):",
                            );
                            handleProcessReassignment(
                              booking._id,
                              "reject",
                              reason || "",
                            );
                          }}
                          disabled={processingId === booking._id}
                        >
                          {processingId === booking._id ? "..." : "Reject"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredReassignments.length === 0 && (
        <div className="no-reassignments">
          <p>No passenger bookings found</p>
        </div>
      )}

      {/* Booking Details Modal */}
      {showReassignModal && selectedReassignment && (
        <AdminReassignModal
          booking={selectedReassignment}
          availableRoutes={availableRoutes}
          onClose={() => {
            setShowReassignModal(false);
            setSelectedReassignment(null);
          }}
          onProcess={handleProcessReassignment}
          processingId={processingId}
        />
      )}
    </div>
  );
}

export default AdminPassengersReassignments;
