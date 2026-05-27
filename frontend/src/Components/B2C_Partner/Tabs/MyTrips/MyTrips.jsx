"use client";

import { useState, useEffect } from "react";
import BookingTable from "../../BookingTable/BookingTable";
import MyTripsHistory from "../../MyTripsSub/MyTripsHistory/MyTripsHistory";
import AvailabilityStatusPopup from "../../../../Components/AvailabilityStatusPopup/AvailabilityStatusPopup";
import api from "../../../../utils/api";
import "./mytrips.css";

/**
 * MyTrips - Main trips management tab for B2C Partner
 * Now uses table-based booking view (like B2C_PARTNER_DRIVER Bookings Tab)
 * with sub-tabs for All Bookings and History
 */
function MyTrips() {
  const [subTab, setSubTab] = useState("all");

  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [hasIncompleteTrips, setHasIncompleteTrips] = useState(false);
  const [incompleteTripsCount, setIncompleteTripsCount] = useState(0);

  // Availability popup state
  const [showAvailabilityPopup, setShowAvailabilityPopup] = useState(false);
  const [detailedAvailabilityInfo, setDetailedAvailabilityInfo] = useState({
    assignedSchedules: [],
    completedTripsToday: [],
    nextScheduledTrip: null,
    userType: "partner",
  });

  // Fetch current availability status on mount
  useEffect(() => {
    fetchAvailabilityStatus();
    // Also check and auto-update availability based on scheduled trips
    checkAndAutoUpdateAvailability();
    // Silent polling: refresh availability status every 5 seconds
    const pollInterval = setInterval(() => {
      fetchAvailabilityStatusSilent();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Check and auto-update availability if user has scheduled trips today
  const checkAndAutoUpdateAvailability = async () => {
    try {
      const response = await api.get(
        "/b2c-daily-trips/driver/check-availability",
      );
      if (response.data.success && response.data.data) {
        const { currentStatus, statusUpdated, scheduledTripsToday, message } =
          response.data.data;
        if (statusUpdated) {
          console.log("[v0] Auto-updated availability status:", message);
          setAvailabilityStatus(currentStatus);
        }
      }
    } catch (error) {
      console.error("[v0] Error checking availability:", error);
    }
  };

  const fetchAvailabilityStatus = async () => {
    try {
      setLoadingAvailability(true);
      const response = await api.get("/b2c-daily-trips/driver/availability");
      if (response.data.success) {
        setAvailabilityStatus(
          response.data.availability?.status || "available",
        );
        setHasIncompleteTrips(
          response.data.availability?.hasIncompleteTrips || false,
        );
        setIncompleteTripsCount(
          response.data.availability?.incompleteTripsCount || 0,
        );
      }
    } catch (error) {
      console.error("[v0] Error fetching availability status:", error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Silent version for polling (no loading state change)
  const fetchAvailabilityStatusSilent = async () => {
    try {
      const response = await api.get("/b2c-daily-trips/driver/availability");
      if (response.data.success) {
        setAvailabilityStatus(
          response.data.availability?.status || "available",
        );
        setHasIncompleteTrips(
          response.data.availability?.hasIncompleteTrips || false,
        );
        setIncompleteTripsCount(
          response.data.availability?.incompleteTripsCount || 0,
        );
      }
    } catch (error) {
      // Silent fail - don't disrupt user experience
    }
  };

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
          userType: response.data.userType || "partner",
        });
        setAvailabilityStatus(response.data.currentStatus || "available");
      }
    } catch (error) {
      console.error("[v0] Error fetching detailed availability info:", error);
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
      setAvailabilityError(null);
      const response = await api.put(
        "/b2c-daily-trips/driver/availability/status",
        {
          status: newStatus,
        },
      );
      if (response.data.success) {
        setAvailabilityStatus(newStatus);
        setAvailabilityError(null);
      }
    } catch (error) {
      console.error("[v0] Error updating availability:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update availability status";
      const hasIncomplete =
        error.response?.data?.hasIncompleteTrips ||
        error.response?.data?.hasInProgressTrip ||
        false;
      const incompleteCount = error.response?.data?.incompleteTripsCount || 0;

      setAvailabilityError(errorMessage);
      setHasIncompleteTrips(hasIncomplete);
      setIncompleteTripsCount(incompleteCount);

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
      console.error("[v0] Error updating availability:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update availability status";
      alert(errorMessage);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const renderSubContent = () => {
    switch (subTab) {
      case "all":
        return <BookingTable />;
      case "history":
        return <MyTripsHistory />;
      default:
        return <BookingTable />;
    }
  };

  const getStatusColor = (status) => {
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

  const getStatusLabel = (status) => {
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

  return (
    <div className="my-trips">
      {/* Driver Availability Toggle */}
      <div
        className="driver-availability-section"
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: getStatusColor(availabilityStatus),
              boxShadow: `0 0 8px ${getStatusColor(availabilityStatus)}50`,
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
                    ? getStatusColor(status)
                    : "#e2e8f0",
                backgroundColor:
                  availabilityStatus === status
                    ? `${getStatusColor(status)}15`
                    : "#fff",
                color:
                  availabilityStatus === status
                    ? getStatusColor(status)
                    : "#64748b",
                cursor: updatingAvailability ? "wait" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>
      <div className="trips-sub-tabs">
        <button
          className={`sub-tab-btn ${subTab === "all" ? "active" : ""}`}
          onClick={() => setSubTab("all")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="2"
              y="3"
              width="12"
              height="10"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M5 3V2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M11 3V2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          All Bookings
        </button>

        <button
          className={`sub-tab-btn ${subTab === "history" ? "active" : ""}`}
          onClick={() => setSubTab("history")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 4V8L11 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          History
        </button>
      </div>

      <div className="trips-content">{renderSubContent()}</div>

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
    </div>
  );
}

export default MyTrips;
