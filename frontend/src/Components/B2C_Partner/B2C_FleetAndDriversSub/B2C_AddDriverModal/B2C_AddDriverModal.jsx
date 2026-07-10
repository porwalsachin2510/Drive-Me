"use client";

import { useState } from "react";
import "./b2c_adddrivermodal.css";
import api from "../../../../utils/api";
import { showSuccess, showError } from "../../../../utils/toast";

function B2C_AddDriverModal({ onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    licenseNumber: "",
    licenseExpiry: "",
    nationality: "",
    experience: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    assignedVehicles: [],
    driverImage: null,
  });
  const [loading, setLoading] = useState(false);

  const nationalities = [
    "Kuwait",
    "UAE",
    "India",
    "Pakistan",
    "Philippines",
    "Bangladesh",
    "Sri Lanka",
    "Nepal",
    "Egypt",
    "Jordan",
    "Lebanon",
    "Saudi Arabia",
    "Qatar",
    "Oman",
    "Bahrain",
    "Other",
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        driverImage: {
          file,
          preview: URL.createObjectURL(file),
          fileName: file.name,
        },
      }));
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({
      ...prev,
      driverImage: null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation with clear toast messages so the user knows
    // exactly what to fix before the request is even sent.
    if (
      formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      showError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      // Create FormData for file upload
      const submitFormData = new FormData();

      // Add basic driver data
      submitFormData.append("fullName", formData.name);
      submitFormData.append("email", formData.email);
      submitFormData.append("phone", formData.phoneNumber);
      submitFormData.append("licenseNumber", formData.licenseNumber);
      submitFormData.append("licenseExpiry", formData.licenseExpiry);
      submitFormData.append("nationality", formData.nationality);
      submitFormData.append("experience", formData.experience);
      submitFormData.append("address", formData.address);
      submitFormData.append("emergencyContact", formData.emergencyContact);
      submitFormData.append("emergencyPhone", formData.emergencyPhone);

      // Add driver image if available
      if (formData.driverImage && formData.driverImage.file) {
        submitFormData.append("driverImage", formData.driverImage.file);
      }

      console.log("Submitting driver data with FormData:", submitFormData);

      const response = await api.post("/b2c-partner/drivers", submitFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        showSuccess("Driver added successfully!");
        onClose();
        // Optionally trigger a refresh of parent component
        if (window.onDriverAdded) {
          window.onDriverAdded();
        } else {
          window.location.reload();
        }
      } else {
        throw new Error(response.data.message || "Failed to add driver");
      }
    } catch (error) {
      console.error("[v0] Error adding driver:", error);
      showError(error, "Failed to add driver. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay">
      <div className="b2c-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">Add New Driver</h2>
          <button className="b2c-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 6L18 18"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2c-modal-form">
          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Personal Information</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="name" className="b2c-form-label">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="e.g. Ahmed Mohammed"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="email" className="b2c-form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="driver@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="phoneNumber" className="b2c-form-label">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="+971 50 123 4567"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="nationality" className="b2c-form-label">
                  Nationality *
                </label>
                <select
                  id="nationality"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select nationality</option>
                  {nationalities.map((nat) => (
                    <option key={nat} value={nat}>
                      {nat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="experience" className="b2c-form-label">
                  Years of Experience *
                </label>
                <input
                  type="number"
                  id="experience"
                  name="experience"
                  placeholder="5"
                  value={formData.experience}
                  onChange={handleChange}
                  required
                  min="0"
                  max="50"
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="licenseNumber" className="b2c-form-label">
                  License Number *
                </label>
                <input
                  type="text"
                  id="licenseNumber"
                  name="licenseNumber"
                  placeholder="e.g. UAE-DL-123456"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="licenseExpiry" className="b2c-form-label">
                  License Expiry Date *
                </label>
                <input
                  type="date"
                  id="licenseExpiry"
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row full">
              <div className="b2c-form-group">
                <label htmlFor="address" className="b2c-form-label">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  placeholder="Enter driver's full address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  className="b2c-form-input"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Emergency Contact</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="emergencyContact" className="b2c-form-label">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  id="emergencyContact"
                  name="emergencyContact"
                  placeholder="e.g. Fatima Ahmed"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="emergencyPhone" className="b2c-form-label">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  id="emergencyPhone"
                  name="emergencyPhone"
                  placeholder="+971 50 987 6543"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Driver Photo</h3>

            <div className="b2c-image-upload">
              {formData.driverImage ? (
                <div className="b2c-driver-image-preview">
                  <img
                    src={formData.driverImage.preview}
                    alt="Driver"
                    className="b2c-driver-thumbnail"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="b2c-remove-image-btn"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <label className="b2c-image-upload-box">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <div className="b2c-upload-content">
                    <div className="b2c-upload-icon">📷</div>
                    <p>Upload Driver Photo</p>
                    <span>JPG/PNG format</span>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="b2c-modal-actions">
            <button
              type="button"
              className="b2c-btn b2c-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="b2c-btn b2c-btn-submit"
              disabled={loading}
            >
              {loading ? "Adding Driver..." : "Add Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_AddDriverModal;
