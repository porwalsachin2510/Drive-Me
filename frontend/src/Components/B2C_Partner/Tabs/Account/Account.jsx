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
    licenseNumber: "",
    profileImage: null
  })
  const [preferences, setPreferences] = useState({
    newTripAlerts: true,
    dailyEarnings: true,
    promotionalOffers: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)

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

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Show preview immediately
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload to server
    try {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('profileImage', file)

      const response = await api.put('/b2c-partner/profile/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.success) {
        setProfileData(prev => ({
          ...prev,
          profileImage: response.data.profileImage
        }))
        setImagePreview(null)
        alert("Profile image updated successfully!")
      }
    } catch (error) {
      console.error("Error uploading profile image:", error)
      alert("Failed to upload profile image")
      setImagePreview(null)
    } finally {
      setUploadingImage(false)
    }
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

          {/* Profile Image Section */}
          <div className="profile-image-section" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="profile-image-container" style={{ position: 'relative' }}>
              {uploadingImage ? (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span>Uploading...</span>
                </div>
              ) : (
                <img
                  src={imagePreview || profileData.profileImage || '/default-avatar.png'}
                  alt="Profile"
                  style={{ 
                    width: '100px', 
                    height: '100px', 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: '3px solid #e74c3c',
                    background: '#f0f0f0'
                  }}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23e0e0e0" width="100" height="100"/><text x="50" y="55" fill="%23888" font-size="40" text-anchor="middle">?</text></svg>'
                  }}
                />
              )}
            </div>
            <div className="profile-image-actions">
              <label 
                htmlFor="profileImageUpload" 
                style={{ 
                  padding: '8px 16px', 
                  background: '#e74c3c', 
                  color: 'white', 
                  borderRadius: '6px', 
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'inline-block',
                  opacity: uploadingImage ? 0.7 : 1
                }}
              >
                {uploadingImage ? 'Uploading...' : 'Change Photo'}
              </label>
              <input
                type="file"
                id="profileImageUpload"
                accept="image/*"
                onChange={handleProfileImageChange}
                style={{ display: 'none' }}
                disabled={uploadingImage}
              />
              <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                Recommended: Square image, at least 200x200px
              </p>
            </div>
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
