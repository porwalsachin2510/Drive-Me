import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import "./companyprofile.css";

const CompanyProfile = () => {
  const user = useSelector((state) => state.auth.user);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [logoPreview, setLogoPreview] = useState(null);

  const [formData, setFormData] = useState({
    companyName: "",
    website: "",
    address: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get("/users/me");
      if (response.data.success && response.data.user) {
        const u = response.data.user;
        setFormData({
          companyName: u.companyName || u.fullName || "",
          website: u.website || "",
          address: u.companyAddress || "",
          contactPerson: u.contactPerson || u.fullName || "",
          contactEmail: u.contactEmail || u.email || "",
          contactPhone: u.contactPhone || u.whatsappNumber || "",
        });
        if (u.companyLogo) {
          setLogoPreview(u.companyLogo);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setMessage({ type: "error", text: "Failed to load profile data" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image size must be less than 5MB" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("upload_preset", "driveme_uploads");

      const cloudinaryRes = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "driveme"}/image/upload`,
        { method: "POST", body: uploadFormData }
      );
      const cloudinaryData = await cloudinaryRes.json();

      if (cloudinaryData.secure_url) {
        await api.put("/users/profile", { companyLogo: cloudinaryData.secure_url });
        setLogoPreview(cloudinaryData.secure_url);
        setMessage({ type: "success", text: "Logo updated successfully" });
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      setMessage({ type: "error", text: "Failed to upload logo" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      const updatePayload = {
        companyName: formData.companyName,
        website: formData.website,
        companyAddress: formData.address,
        contactPerson: formData.contactPerson,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
      };

      const response = await api.put("/users/profile", updatePayload);
      if (response.data.success) {
        setMessage({ type: "success", text: "Profile updated successfully" });
      } else {
        setMessage({ type: "error", text: response.data.message || "Update failed" });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to update profile" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    }
  };

  const userInitial = (formData.companyName || "C")[0]?.toUpperCase();

  if (loading) {
    return (
      <div className="company-profile">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="company-profile">
      {message.text && (
        <div className={`profile-message ${message.type}`}>
          {message.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="profile-container">
        <div className="left-section">
          <div className="logo-section">
            <div className="logo-circle" onClick={handleLogoClick} style={{ cursor: "pointer" }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Company Logo" className="logo-image" />
              ) : (
                <span className="logo-initial">{userInitial}</span>
              )}
              {uploading && <div className="logo-uploading-overlay"><div className="mini-spinner"></div></div>}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoChange}
              accept="image/*"
              style={{ display: "none" }}
            />
            <button className="update-logo-btn" onClick={handleLogoClick} disabled={uploading}>
              {uploading ? "Uploading..." : "Update Logo"}
            </button>
          </div>

          <div className="verification-section">
            <div className="verification-header">Verification Status</div>
            <div className="verification-status">
              {user?.tradeLicense ? (
                <>
                  <svg className="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span className="status-text verified">Trade License Verified</span>
                </>
              ) : (
                <>
                  <svg className="pending-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="status-text pending">Pending Verification</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="right-section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyName">Company Name</label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Enter company name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="address">Headquarters Address</label>
              <textarea
                id="address"
                name="address"
                rows="4"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter headquarters address"
              ></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contactPerson">Primary Contact Person</label>
                <input
                  type="text"
                  id="contactPerson"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="Enter contact person name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactEmail">Contact Email</label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="Enter contact email"
                />
              </div>
            </div>

            <div className="form-group half-width">
              <label htmlFor="contactPhone">Contact Phone</label>
              <input
                type="tel"
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="Enter contact phone"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;
