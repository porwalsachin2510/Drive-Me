"use client";

import { useState, useEffect } from "react";
import "./settings.css";
import api from "../../../utils/api";

export default function Settings() {
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phone: "",
    language: "en",
    currency: "KWD"
  });
  
  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    marketingEmails: false,
    tripReminders: true,
    promotionalOffers: true
  });

  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/commuter/profile');
      setProfileData(response.data.profile);
      setPreferences(response.data.preferences || {
        pushNotifications: true,
        marketingEmails: false,
        tripReminders: true,
        promotionalOffers: true
      });
    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await api.put('/commuter/profile', {
        profile: profileData,
        preferences
      });
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      alert("New password and confirmation don't match");
      return;
    }

    if (passwords.new.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    try {
      setSaving(true);
      await api.put('/commuter/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      alert("Password changed successfully!");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error) {
      console.error("Error changing password:", error);
      alert("Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-section">
        <h2>Settings</h2>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h2>Settings</h2>

      <div className="settings-container">
        {/* Profile Information */}
        <div className="settings-group">
          <div className="settings-header">
            <h3>👤 Profile Information</h3>
            <p>Update your personal information</p>
          </div>
          
          <div className="settings-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={profileData.fullName}
                onChange={(e) => handleProfileChange('fullName', e.target.value)}
                className="form-input"
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => handleProfileChange('email', e.target.value)}
                className="form-input"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => handleProfileChange('phone', e.target.value)}
                className="form-input"
                placeholder="Enter your phone number"
              />
            </div>
          </div>
        </div>

        {/* Regional Preferences */}
        <div className="settings-group">
          <div className="settings-header">
            <h3>🌐 Regional Preferences</h3>
            <p>Customize your language and currency</p>
          </div>
          
          <div className="settings-form">
            <div className="form-group">
              <label>Language</label>
              <select
                value={profileData.language}
                onChange={(e) => handleProfileChange('language', e.target.value)}
                className="form-select"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="ur">Urdu</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Currency</label>
              <select
                value={profileData.currency}
                onChange={(e) => handleProfileChange('currency', e.target.value)}
                className="form-select"
              >
                <option value="KWD">Kuwaiti Dinar (KWD)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="settings-group">
          <div className="settings-header">
            <h3>🔔 Notification Preferences</h3>
            <p>Control how you receive notifications</p>
          </div>
          
          <div className="preferences-list">
            <div className="preference-item">
              <div className="preference-info">
                <h4>Push Notifications</h4>
                <p>Receive push notifications on your device</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.pushNotifications}
                  onChange={() => handlePreferenceToggle('pushNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Marketing Emails</h4>
                <p>Receive promotional offers and updates</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.marketingEmails}
                  onChange={() => handlePreferenceToggle('marketingEmails')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Trip Reminders</h4>
                <p>Get notified before your scheduled trips</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.tripReminders}
                  onChange={() => handlePreferenceToggle('tripReminders')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Promotional Offers</h4>
                <p>Receive notifications about special offers</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.promotionalOffers}
                  onChange={() => handlePreferenceToggle('promotionalOffers')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="settings-group">
          <div className="settings-header">
            <h3>🔒 Security Settings</h3>
            <p>Update your password and security preferences</p>
          </div>
          
          <div className="settings-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                name="current"
                value={passwords.current}
                onChange={handlePasswordChange}
                className="form-input"
                placeholder="Enter current password"
              />
            </div>
            
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="new"
                value={passwords.new}
                onChange={handlePasswordChange}
                className="form-input"
                placeholder="Enter new password"
              />
            </div>
            
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirm"
                value={passwords.confirm}
                onChange={handlePasswordChange}
                className="form-input"
                placeholder="Confirm new password"
              />
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="settings-actions">
          <button
            className="save-profile-btn"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile Changes"}
          </button>
          
          <button
            className="change-password-btn"
            onClick={handleChangePassword}
            disabled={saving || !passwords.current || !passwords.new}
          >
            {saving ? "Updating..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
