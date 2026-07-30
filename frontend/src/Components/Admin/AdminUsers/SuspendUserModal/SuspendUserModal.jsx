"use client";

import { useState } from "react";
import "./SuspendUserModal.css";
import { notify } from "../../../../utils/toast";

function SuspendUserModal({ user, onClose, onConfirm }) {
  const [suspensionType, setSuspensionType] = useState("default"); // default or custom
  const [customDays, setCustomDays] = useState(7);
  const [customEndDate, setCustomEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const predefinedReasons = [
    "Violation of platform terms and conditions",
    "Fraudulent activity detected",
    "Multiple customer complaints",
    "Inappropriate behavior with customers",
    "Failure to maintain service standards",
    "Document verification issues",
    "Payment disputes or chargebacks",
    "Other (specify below)",
  ];

  const getEndDate = () => {
    const now = new Date();
    if (suspensionType === "custom" && customEndDate) {
      return new Date(customEndDate);
    }
    const days = suspensionType === "custom" ? customDays : 7;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  };

  const getDurationDays = () => {
    if (suspensionType === "custom" && customEndDate) {
      const now = new Date();
      const end = new Date(customEndDate);
      return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    }
    return suspensionType === "custom" ? customDays : 7;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      notify("Please provide a reason for suspension");
      return;
    }

    const durationDays = getDurationDays();
    if (durationDays <= 0) {
      notify("Please select a valid suspension duration");
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        reason: reason.trim(),
        durationDays: durationDays,
        customEndDate:
          suspensionType === "custom" && customEndDate ? customEndDate : null,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get minimum date for custom date picker (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  return (
    <div className="suspend-modal-overlay" onClick={onClose}>
      <div className="suspend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="suspend-modal-header">
          <h2>Suspend User</h2>
          <button className="close-btn" onClick={onClose}>
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

        <div className="suspend-modal-body">
          <div className="user-info-card">
            <div className="user-avatar">
              {user.profileImage ? (
                <img src={user.profileImage} alt={user.fullName} />
              ) : (
                <div className="avatar-placeholder">
                  {user.fullName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-details">
              <h3>{user.fullName}</h3>
              <p>{user.email}</p>
              <span className="role-badge">
                {user.role?.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="section-label">Suspension Duration</label>

              <div className="duration-options">
                <label
                  className={`duration-option ${suspensionType === "default" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="suspensionType"
                    value="default"
                    checked={suspensionType === "default"}
                    onChange={() => setSuspensionType("default")}
                  />
                  <div className="option-content">
                    <span className="option-title">Default (1 Week)</span>
                    <span className="option-desc">
                      User will be suspended for 7 days
                    </span>
                  </div>
                </label>

                <label
                  className={`duration-option ${suspensionType === "custom" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="suspensionType"
                    value="custom"
                    checked={suspensionType === "custom"}
                    onChange={() => setSuspensionType("custom")}
                  />
                  <div className="option-content">
                    <span className="option-title">Custom Duration</span>
                    <span className="option-desc">
                      Set a specific number of days or end date
                    </span>
                  </div>
                </label>
              </div>

              {suspensionType === "custom" && (
                <div className="custom-duration-inputs">
                  <div className="input-group">
                    <label>Number of Days</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDays}
                      onChange={(e) => {
                        setCustomDays(parseInt(e.target.value) || 1);
                        setCustomEndDate(""); // Clear end date when days change
                      }}
                      placeholder="Enter days"
                    />
                  </div>
                  <div className="or-divider">OR</div>
                  <div className="input-group">
                    <label>Select End Date</label>
                    <input
                      type="date"
                      min={getMinDate()}
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="suspension-preview">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
                <div>
                  <strong>Suspension will end on:</strong>
                  <span>{formatDate(getEndDate())}</span>
                  <span className="duration-text">
                    ({getDurationDays()} days from now)
                  </span>
                </div>
              </div>
            </div>

            <div className="form-section">
              <label className="section-label">Reason for Suspension</label>

              <div className="reason-chips">
                {predefinedReasons.map((r, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`reason-chip ${reason === r ? "selected" : ""}`}
                    onClick={() => setReason(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter detailed reason for suspension..."
                rows={3}
                className="reason-textarea"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="confirm-btn"
                disabled={loading || !reason.trim()}
              >
                {loading
                  ? "Suspending..."
                  : `Suspend for ${getDurationDays()} Days`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SuspendUserModal;
