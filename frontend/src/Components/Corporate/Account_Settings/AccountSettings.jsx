import React, { useState } from "react";
import api from "../../../utils/api";
import "./accountsettings.css";

const AccountSettings = () => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    try {
      setSaving(true);
      const response = await api.put("/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.data.success) {
        setMessage({ type: "success", text: "Password changed successfully" });
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setShowPasswordForm(false), 2000);
      } else {
        setMessage({ type: "error", text: response.data.message || "Failed to change password" });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to change password" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    if (confirmed) {
      console.log("Delete account confirmed");
    }
  };

  return (
    <div className="account-settings">
      <div className="security-section">
        <h2 className="security-title">Security</h2>
        <p className="security-description">
          Manage your account security settings.
        </p>

        {message.text && (
          <div className={`settings-message ${message.type}`}>
            {message.type === "success" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="password-form">
            <h3 className="password-form-title">Change Password</h3>
            <div className="password-form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            <div className="password-form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password (min 6 characters)"
                autoComplete="new-password"
              />
            </div>
            <div className="password-form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            <div className="password-form-actions">
              <button type="button" className="cancel-btn" onClick={() => { setShowPasswordForm(false); setMessage({ type: "", text: "" }); }}>
                Cancel
              </button>
              <button type="submit" className="submit-password-btn" disabled={saving}>
                {saving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-actions">
            <button
              className="setting-btn change-password-btn"
              onClick={() => setShowPasswordForm(true)}
            >
              <span className="btn-text">Change Password</span>
              <svg className="settings-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>

            <button
              className="setting-btn delete-account-btn"
              onClick={handleDeleteAccount}
            >
              <span className="btn-text">Delete Account</span>
              <svg className="settings-icon delete-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
