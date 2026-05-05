"use client";

import { useState } from "react";
import api from "../../utils/api";
import "./SuspendedAccountModal.css";

function SuspendedAccountModal({ suspensionDetails, onClose }) {
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const {
    reason,
    // eslint-disable-next-line no-unused-vars
    suspendedAt,
    suspensionEndDate,
    remainingDays,
    durationDays,
    adminEmail,
    userName,
    userEmail,
  } = suspensionDetails;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSendAppeal = async (e) => {
    e.preventDefault();

    if (!appealMessage.trim()) {
      setError("Please enter a message to send to the admin.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await api.post("/auth/suspension-appeal", {
        userEmail,
        userName,
        message: appealMessage,
        adminEmail,
      });

      if (response.data.success) {
        setSent(true);
        setShowAppealForm(false);
      } else {
        setError(
          response.data.message || "Failed to send appeal. Please try again.",
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send appeal. Please try again later.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="suspended-modal-overlay">
      <div className="suspended-modal">
        <div className="suspended-modal-header">
          <div className="warning-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
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
          <h2>Account Suspended</h2>
          <p>Your account has been temporarily suspended</p>
        </div>

        <div className="suspended-modal-body">
          <div className="suspension-details">
            <div className="detail-card">
              <div className="detail-icon reason">
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="detail-content">
                <span className="detail-label">Reason for Suspension</span>
                <span className="detail-value">{reason}</span>
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-icon duration">
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
              <div className="detail-content">
                <span className="detail-label">Suspension Duration</span>
                <span className="detail-value">{durationDays} days</span>
                {remainingDays && remainingDays > 0 && (
                  <span className="detail-sub">
                    {remainingDays} days remaining
                  </span>
                )}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-icon date">
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
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div className="detail-content">
                <span className="detail-label">Suspension Ends On</span>
                <span className="detail-value">
                  {formatDate(suspensionEndDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="improvement-message">
            <h4>How to get your account reactivated?</h4>
            <ul>
              <li>Review our Terms and Conditions carefully</li>
              <li>Reflect on the reason for your suspension</li>
              <li>If you believe this was an error, contact our admin team</li>
              <li>
                Demonstrate that you understand and will follow our guidelines
              </li>
            </ul>
          </div>

          {sent ? (
            <div className="appeal-success">
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
              <div>
                <h4>Appeal Sent Successfully!</h4>
                <p>
                  Our admin team will review your request and contact you via
                  email at <strong>{userEmail}</strong>
                </p>
              </div>
            </div>
          ) : showAppealForm ? (
            <form className="appeal-form" onSubmit={handleSendAppeal}>
              <h4>Send Appeal to Admin</h4>
              <p className="form-hint">
                Explain why you believe your account should be reactivated and
                how you will prevent future issues.
              </p>

              <textarea
                value={appealMessage}
                onChange={(e) => setAppealMessage(e.target.value)}
                placeholder="Dear Admin,

I am writing to appeal my account suspension. I understand that my account was suspended due to [reason]. 

I would like to explain that...

I assure you that I will follow all platform guidelines going forward and this situation will not repeat.

Thank you for considering my appeal."
                rows={8}
              />

              {error && <div className="appeal-error">{error}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowAppealForm(false)}
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="send-btn"
                  disabled={sending || !appealMessage.trim()}
                >
                  {sending ? "Sending..." : "Send Appeal"}
                </button>
              </div>
            </form>
          ) : (
            <div className="contact-admin">
              <h4>Need to contact admin?</h4>
              <p>
                You can send an appeal to our admin team to request early
                reactivation of your account.
              </p>
              <div className="admin-contact-info">
                <span className="admin-email">
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
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  {adminEmail}
                </span>
              </div>
              <button
                className="appeal-btn"
                onClick={() => setShowAppealForm(true)}
              >
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
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                Send Appeal to Admin
              </button>
            </div>
          )}
        </div>

        <div className="suspended-modal-footer">
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuspendedAccountModal;
