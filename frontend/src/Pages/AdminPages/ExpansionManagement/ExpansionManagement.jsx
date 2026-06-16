"use client";

import React, { useEffect, useState } from "react";
import api from "../../../utils/api";
import "./expansionmanagement.css";

export default function ExpansionManagement() {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [waitlistUsers, setWaitlistUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [status, setStatus] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Load all countries with pending notifications.
  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const res = await api.get("/expansion-waitlist/admin/countries");
      if (res.data?.success) {
        setCountries(res.data.countries || []);
      }
    } catch (err) {
      setStatus("error: " + err.message);
      console.error("[v0] Failed to load countries:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load waitlist users for selected country.
  const loadWaitlistForCountry = async (country) => {
    try {
      setLoading(true);
      setSelectedCountry(country);
      const res = await api.get(
        `/expansion-waitlist/admin/country/${encodeURIComponent(country)}?notified=false`,
      );
      if (res.data?.success) {
        setWaitlistUsers(res.data.entries || []);
        setStatus("");
      }
    } catch (err) {
      setStatus("error: " + err.message);
      console.error("[v0] Failed to load waitlist:", err);
    } finally {
      setLoading(false);
    }
  };

  // Send notifications to all users in selected country.
  const handleSendNotifications = async () => {
    if (!selectedCountry) {
      setStatus("error: Please select a country first");
      return;
    }

    // Validate: Message must not be empty
    if (!customMessage || customMessage.trim() === "") {
      setStatus("error: Please enter a message or use the default template");
      return;
    }

    const confirmSend = window.confirm(
      `Send notifications to all ${waitlistUsers.length} users in ${selectedCountry}?`,
    );
    if (!confirmSend) return;

    try {
      setNotifying(true);
      const res = await api.post("/expansion-waitlist/admin/notify", {
        country: selectedCountry,
        subject: `Drive Me Go is now available in ${selectedCountry}!`,
        template: customMessage.trim(),
      });

      if (res.data?.success) {
        setStatus(
          `Sent: ${res.data.sent}, Failed: ${res.data.failed}, Total: ${res.data.total}`,
        );
        setCustomMessage("");
        setShowMessageModal(false);
        // Refresh the list.
        await loadCountries();
        setSelectedCountry(null);
        setWaitlistUsers([]);
      }
    } catch (err) {
      setStatus("error sending notifications: " + err.message);
      console.error("[v0] Failed to send notifications:", err);
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="expansion-mgmt-container">
      <div className="expansion-mgmt-header">
        <h1>Expansion Management</h1>
        <p>
          Manage waitlist signups and send notifications when services launch
        </p>
      </div>

      {status && (
        <div
          className={`expansion-mgmt-alert ${status.includes("error") ? "error" : "success"}`}
        >
          {status}
        </div>
      )}

      <div className="expansion-mgmt-layout">
        {/* Countries Panel */}
        <div className="expansion-mgmt-panel">
          <h2>Countries with Pending Users</h2>
          <div className="expansion-mgmt-countries-list">
            {loading && !countries.length ? (
              <p className="expansion-mgmt-loading">Loading countries...</p>
            ) : countries.length === 0 ? (
              <p className="expansion-mgmt-empty">
                No countries with pending notifications.
              </p>
            ) : (
              countries.map((c) => (
                <button
                  key={c.country}
                  className={`expansion-mgmt-country-btn ${
                    selectedCountry === c.country ? "active" : ""
                  }`}
                  onClick={() => loadWaitlistForCountry(c.country)}
                >
                  <span>{c.country}</span>
                  <span className="expansion-mgmt-badge">{c.pendingCount}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Waitlist Panel */}
        <div className="expansion-mgmt-panel">
          <h2>
            {selectedCountry
              ? `Waitlist for ${selectedCountry}`
              : "Select a country"}
          </h2>

          {selectedCountry && (
            <>
              <div className="expansion-mgmt-actions">
                <button
                  className="expansion-mgmt-btn-primary"
                  onClick={() => {
                    // Pre-fill with default template when opening modal
                    setCustomMessage(
                      `Great news! Drive Me Go is now live in {country}!\n\nYou've been waiting for this moment, and we're thrilled to bring reliable, affordable commuting to your region.\n\nStart booking your commute today and enjoy:\n✓ Verified drivers and trusted partners\n✓ Affordable monthly passes\n✓ Routes built for your city\n\nVisit Drive Me Go now and book your first ride!\n\nBest regards,\nThe Drive Me Go Team`,
                    );
                    setShowMessageModal(true);
                  }}
                  disabled={waitlistUsers.length === 0 || notifying}
                >
                  {notifying ? "Sending..." : "Send Notifications"}
                </button>
              </div>

              <div className="expansion-mgmt-users-list">
                {loading ? (
                  <p className="expansion-mgmt-loading">Loading users...</p>
                ) : waitlistUsers.length === 0 ? (
                  <p className="expansion-mgmt-empty">
                    No pending users for {selectedCountry}.
                  </p>
                ) : (
                  <>
                    <p className="expansion-mgmt-count">
                      {waitlistUsers.length} user
                      {waitlistUsers.length !== 1 ? "s" : ""} waiting
                    </p>
                    <table className="expansion-mgmt-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Signed Up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitlistUsers.map((user) => (
                          <tr key={user._id}>
                            <td>{user.email}</td>
                            <td>
                              {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString()
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom Message Modal */}
      {showMessageModal && (
        <div className="expansion-mgmt-modal-overlay">
          <div className="expansion-mgmt-modal">
            <div className="expansion-mgmt-modal-header">
              <h3>Customize Notification Message</h3>
              <button
                className="expansion-mgmt-modal-close"
                onClick={() => {
                  setShowMessageModal(false);
                  setCustomMessage("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="expansion-mgmt-modal-body">
              <label>Email Body (HTML):</label>
              <textarea
                className="expansion-mgmt-textarea"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`Drive Me Go is now live in {country}!\n\n[Your message here]\n\nBest regards,\nDrive Me Go Team`}
                rows={8}
              />
              <p className="expansion-mgmt-help-text">
                Use {"{country}"} as placeholder for the country name
              </p>
            </div>

            <div className="expansion-mgmt-modal-footer">
              <button
                className="expansion-mgmt-btn-cancel"
                onClick={() => {
                  setShowMessageModal(false);
                  setCustomMessage("");
                }}
              >
                Cancel
              </button>
              <button
                className="expansion-mgmt-btn-primary"
                onClick={handleSendNotifications}
                disabled={notifying}
              >
                {notifying
                  ? "Sending to " + waitlistUsers.length + " users..."
                  : "Send Notifications"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
