"use client"

import { useState, useEffect } from "react"
import "./account.css"
import api from "../../../../utils/api"

function Account() {
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    licenseNumber: ""
  })
  const [preferences, setPreferences] = useState({
    newTripAlerts: true,
    dailyEarnings: true,
    promotionalOffers: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfileData()
  }, [])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/b2c-partner/profile')
      setProfileData(response.data.profile)
      setPreferences(response.data.preferences || {
        newTripAlerts: true,
        dailyEarnings: true,
        promotionalOffers: false,
      })
    } catch (error) {
      console.error("Error fetching profile data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put('/b2c-partner/profile', {
        profile: profileData,
        preferences
      })
      alert("Profile updated successfully!")
    } catch (error) {
      console.error("Error updating profile:", error)
      alert("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="account">
        <div className="loading">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="account">
      <div className="account-content">
        {/* Driver Profile */}
        <div className="account-section">
          <div className="section-header">
            <div className="header-icon driver-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle
                  cx="10"
                  cy="8"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M2 18C2 14.5 5.5 12 10 12C14.5 12 18 14.5 18 18"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <h2 className="section-title">Partner Profile</h2>
          </div>

          <div className="profile-grid">
            <div className="profile-field">
              <label className="field-label">Full Name</label>
              <input
                type="text"
                className="field-input"
                value={profileData.fullName}
                onChange={(e) => handleProfileChange('fullName', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="profile-field">
              <label className="field-label">Email</label>
              <input
                type="email"
                className="field-input"
                value={profileData.email}
                onChange={(e) => handleProfileChange('email', e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <div className="profile-field">
              <label className="field-label">Phone</label>
              <input
                type="tel"
                className="field-input"
                value={profileData.phone}
                onChange={(e) => handleProfileChange('phone', e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="profile-field">
              <label className="field-label">Company Name</label>
              <input
                type="text"
                className="field-input"
                value={profileData.company}
                onChange={(e) => handleProfileChange('company', e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div className="profile-field">
              <label className="field-label">License Number</label>
              <input
                type="text"
                className="field-input"
                value={profileData.licenseNumber}
                onChange={(e) => handleProfileChange('licenseNumber', e.target.value)}
                placeholder="Enter license number"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="account-section">
          <div className="section-header">
            <div className="header-icon notification-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2C6.13 2 3 5.13 3 9V14L1 16V17H19V16L17 14V9C17 5.13 13.87 2 10 2Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M8 18H12"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="section-title">Notification Preferences</h2>
          </div>

          <div className="preferences-list">
            <div className="preference-item">
              <div className="preference-info">
                <h4>New Trip Alerts</h4>
                <p>Get notified when new trips are booked</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.newTripAlerts}
                  onChange={() => handleToggle("newTripAlerts")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Daily Earnings Summary</h4>
                <p>Receive daily earnings reports</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.dailyEarnings}
                  onChange={() => handleToggle("dailyEarnings")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Promotional Offers</h4>
                <p>Receive special offers and promotions</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.promotionalOffers}
                  onChange={() => handleToggle("promotionalOffers")}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="account-actions">
          <button 
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Account
