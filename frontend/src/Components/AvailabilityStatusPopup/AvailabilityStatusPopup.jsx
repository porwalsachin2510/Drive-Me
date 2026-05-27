"use client";

import { useState } from "react";
import "./AvailabilityStatusPopup.css";

function AvailabilityStatusPopup({
  isOpen,
  onClose,
  currentStatus,
  assignedSchedules = [],
  completedTripsToday = [],
  nextScheduledTrip = null,
  onConfirmAvailable,
  loading = false,
  userType = "driver", // "driver" or "partner"
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatTime = (time) => {
    if (!time) return "N/A";
    // Handle time strings that may already include AM/PM
    const cleanTime = time.replace(/\s*(AM|PM)/gi, "").trim();
    // Convert 24h to 12h format
    const parts = cleanTime.split(":");
    if (parts.length < 2) return time; // Return as-is if invalid format
    const hours = parts[0];
    const minutes = parts[1];
    const hour = parseInt(hours);
    if (isNaN(hour)) return time; // Return as-is if invalid
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate time until next trip
  const getTimeUntilNextTrip = () => {
    if (!nextScheduledTrip) return null;

    const now = new Date();
    const timeStr = nextScheduledTrip.departureTime || "00:00";

    // Handle AM/PM format (e.g., "1:00 PM", "4:00 AM")
    const cleanTime = timeStr.replace(/\s*(AM|PM)/gi, "").trim();
    const parts = cleanTime.split(":");
    if (parts.length < 2) return null;

    let hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);

    // Check for AM/PM in original string
    const isPM = /PM/i.test(timeStr);
    const isAM = /AM/i.test(timeStr);

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const tripTime = new Date();
    tripTime.setHours(hours, minutes, 0, 0);

    const diffMs = tripTime - now;
    if (diffMs < 0) return null;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes} minutes`;
  };

  const timeUntilNext = getTimeUntilNextTrip();
  const hasCompletedTrips = completedTripsToday.length > 0;
  const hasUpcomingTrips = nextScheduledTrip !== null;
  // FIXED: Allow "Mark as Available" if:
  // 1. Has completed trips today AND has time until next trip (availability window), OR
  // 2. Has completed trips today AND no more upcoming trips (all done for the day)
  // 3. No incomplete trips currently in progress (this is checked on backend)
  const canBeAvailable = hasCompletedTrips; // Simplified - backend handles all the validation

  const handleConfirm = async () => {
    if (!onConfirmAvailable) return;
    setIsSubmitting(true);
    try {
      await onConfirmAvailable();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDriverOrSelfDriver = userType === "driver" || userType === "partner";
  const displayName = userType === "partner" ? "You (Self-Driver)" : "You";

  return (
    <div className="availability-popup-overlay" onClick={onClose}>
      <div className="availability-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          className={`availability-popup-header ${currentStatus === "busy" ? "busy" : currentStatus === "available" ? "available" : "offline"}`}
        >
          <div className="status-icon">
            {currentStatus === "busy" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            ) : currentStatus === "available" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
            )}
          </div>
          <h2>
            {currentStatus === "busy"
              ? "You are Currently Busy"
              : currentStatus === "available"
                ? "You are Available"
                : "You are Offline"}
          </h2>
          <p>
            {currentStatus === "busy"
              ? "You have assigned schedules. See details below."
              : currentStatus === "available"
                ? "Ready to receive new schedule assignments"
                : "You are not accepting new assignments"}
          </p>
          <button className="close-icon-btn" onClick={onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="availability-popup-body">
          {/* Assigned Schedules Section */}
          {assignedSchedules.length > 0 && (
            <div className="schedule-section">
              <h4>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Assigned Schedules ({assignedSchedules.length})
              </h4>
              <div className="schedule-list">
                {assignedSchedules.map((schedule, index) => (
                  <div key={schedule._id || index} className="schedule-card">
                    <div className="schedule-time">
                      <span className="time-badge">
                        {formatTime(schedule.departureTime)}
                      </span>
                      <span className="trip-type-badge">
                        {schedule.tripType || "One Way"}
                      </span>
                    </div>
                    <div className="schedule-route">
                      <span className="from">
                        {schedule.fromLocation || schedule.route?.fromLocation}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                      <span className="to">
                        {schedule.toLocation || schedule.route?.toLocation}
                      </span>
                    </div>
                    {schedule.scheduleName && (
                      <div className="schedule-name">
                        {schedule.scheduleName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Trips Today */}
          {completedTripsToday.length > 0 && (
            <div className="completed-section">
              <h4>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Completed Today ({completedTripsToday.length})
              </h4>
              <div className="completed-list">
                {completedTripsToday.map((trip, index) => (
                  <div key={trip._id || index} className="completed-card">
                    <div className="completed-info">
                      <span className="completed-time">
                        {formatTime(trip.departureTime)}
                      </span>
                      <span className="completed-route">
                        {trip.fromLocation} to {trip.toLocation}
                      </span>
                    </div>
                    <span className="completed-badge">Completed</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Scheduled Trip */}
          {nextScheduledTrip && (
            <div className="next-trip-section">
              <h4>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Next Scheduled Trip
              </h4>
              <div className="next-trip-card">
                <div className="next-trip-time">
                  <span className="big-time">
                    {formatTime(nextScheduledTrip.departureTime)}
                  </span>
                  {timeUntilNext && (
                    <span className="time-until">in {timeUntilNext}</span>
                  )}
                </div>
                <div className="next-trip-route">
                  <span>
                    {nextScheduledTrip.fromLocation ||
                      nextScheduledTrip.route?.fromLocation}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                  <span>
                    {nextScheduledTrip.toLocation ||
                      nextScheduledTrip.route?.toLocation}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Availability Window Message */}
          {currentStatus === "busy" &&
            hasCompletedTrips &&
            hasUpcomingTrips &&
            timeUntilNext && (
              <div className="availability-window-message">
                <div className="window-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="window-content">
                  <h5>Availability Window</h5>
                  <p>
                    You have completed your previous trip and have{" "}
                    <strong>{timeUntilNext}</strong> until your next scheduled
                    trip. You can mark yourself as <strong>Available</strong>{" "}
                    during this time to receive additional schedule assignments.
                  </p>
                </div>
              </div>
            )}

          {/* Cannot be Available Message */}
          {currentStatus === "busy" && !hasCompletedTrips && (
            <div className="cannot-available-message">
              <div className="message-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div className="message-content">
                <h5>Cannot Change Status</h5>
                <p>
                  You need to complete your current assigned trips before you
                  can mark yourself as Available for new assignments.
                </p>
              </div>
            </div>
          )}

          {/* All Trips Completed Today */}
          {currentStatus === "busy" &&
            hasCompletedTrips &&
            !hasUpcomingTrips && (
              <div className="all-completed-message">
                <div className="message-icon success">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div className="message-content">
                  <h5>All Trips Completed!</h5>
                  <p>
                    You have completed all your scheduled trips for today. You
                    can now mark yourself as <strong>Available</strong> to
                    receive new schedule assignments.
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="availability-popup-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isSubmitting || loading}
          >
            Close
          </button>
          {(canBeAvailable || (hasCompletedTrips && !hasUpcomingTrips)) &&
            currentStatus === "busy" && (
              <button
                className="confirm-btn"
                onClick={handleConfirm}
                disabled={isSubmitting || loading}
              >
                {isSubmitting || loading ? (
                  <>
                    <svg
                      className="spinner"
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Mark as Available
                  </>
                )}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

export default AvailabilityStatusPopup;
