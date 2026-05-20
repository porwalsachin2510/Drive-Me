import { useState, useEffect, useCallback } from "react";
import HistoryTripCard from "../HistoryTripCard/HistoryTripCard";
import api from "../../../../utils/api";
import "./mytripshistory.css";

/**
 * MyTripsHistory - Shows COMPLETED and CANCELLED bookings for B2C Partner
 * Fetches real data from the database
 */
function MyTripsHistory() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0 });
  const [statusFilter, setStatusFilter] = useState("all"); // all, completed, cancelled

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/b2c-bookings/partner/bookings/history?page=${page}&limit=12`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }

      const response = await api.get(url);

      if (response.data.success) {
        setTrips(response.data.data.bookings || []);
        setPagination(response.data.data.pagination);
        setStats(
          response.data.data.stats || { total: 0, completed: 0, cancelled: 0 },
        );
      } else {
        setError(response.data.message || "Failed to fetch history");
        setTrips([]);
      }
    } catch (err) {
      console.error("[MyTripsHistory] Error fetching history:", err);
      setError(
        err?.response?.data?.message || "Failed to fetch booking history",
      );
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && (!pagination || newPage <= pagination.totalPages)) {
      setPage(newPage);
    }
  };

  const handleStatusFilterChange = (newFilter) => {
    setStatusFilter(newFilter);
    setPage(1); // Reset to first page when filter changes
  };

  // Format trip data for HistoryTripCard
  const formatTripForCard = (booking) => ({
    id: booking.tripId || `TRP-${booking._id?.slice(-6) || "000000"}`,
    date: booking.date
      ? new Date(booking.date).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })
      : "N/A",
    time: booking.time || "05:30 AM",
    fare: `${(booking.amount || 0).toLocaleString()} ${booking.currency || "AED"}`,
    pickup: booking.pickup || "N/A",
    dropoff: booking.dropoff || "N/A",
    passenger: booking.passengerName || "N/A",
    status: booking.status || "completed",
    seats: booking.numberOfSeats || 1,
    isMonthlyPass: booking.isMonthlyPass || false,
  });

  if (loading && trips.length === 0) {
    return (
      <div className="history">
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading booking history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history">
      {/* Stats Summary */}
      <div className="history-stats">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item completed">
          <span className="stat-value">{stats.completed}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-item cancelled">
          <span className="stat-value">{stats.cancelled}</span>
          <span className="stat-label">Cancelled</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="history-filters">
        <button
          className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => handleStatusFilterChange("all")}
        >
          All ({stats.total})
        </button>
        <button
          className={`filter-btn ${statusFilter === "completed" ? "active" : ""}`}
          onClick={() => handleStatusFilterChange("completed")}
        >
          Completed ({stats.completed})
        </button>
        <button
          className={`filter-btn ${statusFilter === "cancelled" ? "active" : ""}`}
          onClick={() => handleStatusFilterChange("cancelled")}
        >
          Cancelled ({stats.cancelled})
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="history-error">
          <p>{error}</p>
          <button onClick={fetchHistory}>Try Again</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && trips.length === 0 && (
        <div className="history-empty">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="#e2e8f0" strokeWidth="2" />
            <path
              d="M24 32L30 38L40 26"
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>No booking history</h3>
          <p>Completed and cancelled bookings will appear here</p>
        </div>
      )}

      {/* Trips Grid */}
      {trips.length > 0 && (
        <>
          <div className="trips-grid">
            {trips.map((trip) => (
              <HistoryTripCard key={trip._id} trip={formatTripForCard(trip)} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="history-pagination">
              <button
                className="pagination-btn"
                disabled={!pagination.hasPrev}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                className="pagination-btn"
                disabled={!pagination.hasNext}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Loading overlay for pagination */}
      {loading && trips.length > 0 && (
        <div className="history-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
}

export default MyTripsHistory;
