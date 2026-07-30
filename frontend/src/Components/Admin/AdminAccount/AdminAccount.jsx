"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "../../../Redux/slices/authSlice";
import api from "../../../utils/api";
import "../../B2C_Partner/Tabs/Account/account.css";
import { notify } from "../../../utils/toast";

function AdminAccount() {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);

  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    role: "ADMIN",
    profileImage: null,
  });
  const [preferences, setPreferences] = useState({
    systemAlerts: true,
    paymentAlerts: true,
    promotionalOffers: false,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/profile");
      if (response.data.success) {
        setProfileData(response.data.profile);
        setPreferences(
          response.data.preferences || {
            systemAlerts: true,
            paymentAlerts: true,
            promotionalOffers: false,
          },
        );
      }
    } catch (error) {
      console.error("Error fetching admin profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncReduxUser = (profile) => {
    if (!authUser) return;
    dispatch(
      setUser({
        ...authUser,
        fullName: profile.fullName ?? authUser.fullName,
        email: profile.email ?? authUser.email,
        whatsappNumber: profile.phone ?? authUser.whatsappNumber,
        profileImage: profile.profileImage ?? authUser.profileImage,
      }),
    );
  };

  const handleProfileChange = (field, value) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("profileImage", file);

      const response = await api.put("/admin/profile/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        const nextProfile = {
          ...profileData,
          profileImage: response.data.profileImage,
        };
        setProfileData(nextProfile);
        setImagePreview(null);
        syncReduxUser(nextProfile);
        notify("Profile image updated successfully!");
      }
    } catch (error) {
      console.error("Error uploading profile image:", error);
      notify(error.response?.data?.message || "Failed to upload profile image");
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.put("/admin/profile", {
        profile: profileData,
        preferences,
      });
      if (response.data.success) {
        setProfileData((prev) => ({ ...prev, ...response.data.profile }));
        if (response.data.preferences)
          setPreferences(response.data.preferences);
        syncReduxUser(response.data.profile);
        notify("Profile updated successfully!");
      }
    } catch (error) {
      console.error("Error updating admin profile:", error);
      notify(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      notify("Please fill in all password fields");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notify("New password and confirmation do not match");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await api.put("/admin/profile/password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.data.success) {
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        notify("Password changed successfully!");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      notify(error.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="drivemego-btoc-at-account">
        <div className="drivemego-btoc-at-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="drivemego-btoc-at-account">
      <div className="drivemego-btoc-at-account-content">
        {/* Admin Profile */}
        <div className="drivemego-btoc-at-account-section">
          <div className="drivemego-btoc-at-section-header">
            <div className="drivemego-btoc-at-header-icon drivemego-btoc-at-driver-icon">
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
            <h2 className="drivemego-btoc-at-section-title">Admin Profile</h2>
          </div>

          {/* Profile Image */}
          <div
            className="drivemego-btoc-at-profile-image-section"
            style={{
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div style={{ position: "relative" }}>
              {uploadingImage ? (
                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span>Uploading...</span>
                </div>
              ) : (
                <img
                  src={
                    imagePreview ||
                    profileData.profileImage ||
                    "/default-avatar.png"
                  }
                  alt="Admin profile"
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #00A699",
                    background: "#f0f0f0",
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/default-avatar.png";
                  }}
                />
              )}
            </div>
            <div>
              <label
                htmlFor="adminProfileImageUpload"
                style={{
                  padding: "8px 16px",
                  background: "#00A699",
                  color: "white",
                  borderRadius: "6px",
                  cursor: uploadingImage ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  display: "inline-block",
                  opacity: uploadingImage ? 0.7 : 1,
                }}
              >
                {uploadingImage ? "Uploading..." : "Change Photo"}
              </label>
              <input
                type="file"
                id="adminProfileImageUpload"
                accept="image/*"
                onChange={handleProfileImageChange}
                style={{ display: "none" }}
                disabled={uploadingImage}
              />
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                Recommended: Square image, at least 200x200px
              </p>
            </div>
          </div>

          <div className="drivemego-btoc-at-profile-grid">
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">Full Name</label>
              <input
                type="text"
                className="drivemego-btoc-at-field-input"
                value={profileData.fullName || ""}
                onChange={(e) =>
                  handleProfileChange("fullName", e.target.value)
                }
                placeholder="Enter your full name"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">Email</label>
              <input
                type="email"
                className="drivemego-btoc-at-field-input"
                value={profileData.email || ""}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">Phone</label>
              <input
                type="tel"
                className="drivemego-btoc-at-field-input"
                value={profileData.phone || ""}
                onChange={(e) => handleProfileChange("phone", e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">Country</label>
              <input
                type="text"
                className="drivemego-btoc-at-field-input"
                value={profileData.country || ""}
                onChange={(e) => handleProfileChange("country", e.target.value)}
                placeholder="Enter your country"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">Role</label>
              <input
                type="text"
                className="drivemego-btoc-at-field-input"
                value={profileData.role || "ADMIN"}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="drivemego-btoc-at-account-section">
          <div className="drivemego-btoc-at-section-header">
            <div className="drivemego-btoc-at-header-icon drivemego-btoc-at-prefs-icon">
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
            <h2 className="drivemego-btoc-at-section-title">
              Notification Preferences
            </h2>
          </div>

          <div className="drivemego-btoc-at-preferences-list">
            <div className="drivemego-btoc-at-preference-item">
              <div className="drivemego-btoc-at-preference-info">
                <h4 className="drivemego-btoc-at-pref-label">System Alerts</h4>
                <p>Get notified about important system events</p>
              </div>
              <label className="drivemego-btoc-at-toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.systemAlerts}
                  onChange={() => handleToggle("systemAlerts")}
                />
                <span className="drivemego-btoc-at-slider"></span>
              </label>
            </div>

            <div className="drivemego-btoc-at-preference-item">
              <div className="drivemego-btoc-at-preference-info">
                <h4 className="drivemego-btoc-at-pref-label">Payment Alerts</h4>
                <p>Receive alerts for payments and settlements</p>
              </div>
              <label className="drivemego-btoc-at-toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.paymentAlerts}
                  onChange={() => handleToggle("paymentAlerts")}
                />
                <span className="drivemego-btoc-at-slider"></span>
              </label>
            </div>

            <div className="drivemego-btoc-at-preference-item">
              <div className="drivemego-btoc-at-preference-info">
                <h4 className="drivemego-btoc-at-pref-label">
                  Promotional Offers
                </h4>
                <p>Receive product updates and promotions</p>
              </div>
              <label className="drivemego-btoc-at-toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.promotionalOffers}
                  onChange={() => handleToggle("promotionalOffers")}
                />
                <span className="drivemego-btoc-at-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="drivemego-btoc-at-security-actions">
          <button
            className="drivemego-btoc-at-save-changes-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Change Password */}
        <div className="drivemego-btoc-at-account-section">
          <div className="drivemego-btoc-at-section-header">
            <div className="drivemego-btoc-at-header-icon drivemego-btoc-at-security-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect
                  x="4"
                  y="9"
                  width="12"
                  height="8"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M6.5 9V6.5C6.5 4.57 8.07 3 10 3C11.93 3 13.5 4.57 13.5 6.5V9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <h2 className="drivemego-btoc-at-section-title">Change Password</h2>
          </div>

          <div className="drivemego-btoc-at-profile-grid">
            <div
              className="drivemego-btoc-at-profile-field"
              style={{ gridColumn: "1 / -1" }}
            >
              <label className="drivemego-btoc-at-field-label">
                Current Password
              </label>
              <input
                type="password"
                className="drivemego-btoc-at-field-input"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  handlePasswordChange("currentPassword", e.target.value)
                }
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">
                New Password
              </label>
              <input
                type="password"
                className="drivemego-btoc-at-field-input"
                value={passwordData.newPassword}
                onChange={(e) =>
                  handlePasswordChange("newPassword", e.target.value)
                }
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
            <div className="drivemego-btoc-at-profile-field">
              <label className="drivemego-btoc-at-field-label">
                Confirm New Password
              </label>
              <input
                type="password"
                className="drivemego-btoc-at-field-input"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  handlePasswordChange("confirmPassword", e.target.value)
                }
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#888", margin: "12px 0" }}>
            Password must be at least 8 characters and include uppercase,
            lowercase, a number, and a special character.
          </p>

          <div className="drivemego-btoc-at-security-actions">
            <button
              className="drivemego-btoc-at-save-changes-btn"
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAccount;
