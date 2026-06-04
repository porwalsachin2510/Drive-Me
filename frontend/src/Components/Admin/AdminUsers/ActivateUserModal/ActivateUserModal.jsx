"use client";

import { useState } from "react";
import "./ActivateUserModal.css";

function ActivateUserModal({ user, onClose, onConfirm }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if this is a new user (PENDING) or a suspended user being reactivated
  const isNewUser = user.status === "PENDING";
  const actionTitle = isNewUser ? "Activate User" : "Reactivate User";
  const actionButton = isNewUser ? "Activate User" : "Reactivate User";
  const loadingText = isNewUser ? "Activating..." : "Reactivating...";
  const defaultMessage = isNewUser
    ? "Your account has been activated. Welcome to DriveMeGo! You can now log in and start using our services."
    : "Your account has been reactivated. Please ensure you follow our platform guidelines to avoid future suspensions.";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm({
        message: message.trim() || defaultMessage,
        isNewActivation: isNewUser,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="activate-modal-overlay">
      <div className="activate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="activate-modal-header">
          <h2>{actionTitle}</h2>
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

        <div className="activate-modal-body">
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
              <span
                className={`status-badge ${isNewUser ? "pending" : "suspended"}`}
              >
                {user.status}
              </span>
            </div>
          </div>

          {!isNewUser && user.suspensionReason && (
            <div className="suspension-info">
              <h4>Suspension Details</h4>
              <div className="info-row">
                <span className="label">Reason:</span>
                <span className="value">{user.suspensionReason}</span>
              </div>
              <div className="info-row">
                <span className="label">Suspended On:</span>
                <span className="value">{formatDate(user.suspendedAt)}</span>
              </div>
              {user.suspensionEndDate && (
                <div className="info-row">
                  <span className="label">Scheduled End:</span>
                  <span className="value">
                    {formatDate(user.suspensionEndDate)}
                  </span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="section-label">
                Message to User (Optional)
              </label>
              <p className="section-desc">
                This message will be sent to the user via email and
                notification.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter a message to send to the user (optional)..."
                rows={4}
                className="message-textarea"
              />
              <p className="hint-text">
                {isNewUser
                  ? "If left empty, a welcome message will be sent to the new user."
                  : "If left empty, a default message will be sent reminding them to follow platform guidelines."}
              </p>
            </div>

            <div className="activation-preview">
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
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <div>
                <strong>Upon activation:</strong>
                <ul>
                  <li>User will receive an email notification</li>
                  <li>User will be able to log in immediately</li>
                  {!isNewUser && (
                    <li>All suspension records will be cleared</li>
                  )}
                </ul>
              </div>
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
              <button type="submit" className="confirm-btn" disabled={loading}>
                {loading ? loadingText : actionButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ActivateUserModal;
