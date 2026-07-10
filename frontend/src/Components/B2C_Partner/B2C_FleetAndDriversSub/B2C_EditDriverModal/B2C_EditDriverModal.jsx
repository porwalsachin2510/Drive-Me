"use client";

import { useState, useEffect } from "react";
import "../B2C_AddDriverModal/b2c_adddrivermodal.css";
import api from "../../../../utils/api";
import { showSuccess, showError } from "../../../../utils/toast";

function B2C_EditDriverModal({ driver, onClose, onSuccess }) {
  const isSelfDriver = driver?.isSelf;

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

  useEffect(() => {
    if (driver) {
      // Format expiry date for input field
      let formattedExpiry = "";
      const expiryDate =
        driver.licenseExpiry || driver.driverInfo?.licenseExpiry;
      if (expiryDate) {
        const date = new Date(expiryDate);
        if (!isNaN(date.getTime())) {
          formattedExpiry = date.toISOString().split("T")[0];
        }
      }

      // Get license number from multiple possible locations
      const licenseNum =
        driver.licenseNumber || driver.driverInfo?.licenseNumber || "";

      setFormData({
        name: driver.name || driver.fullName || "",
        email: driver.email || "",
        phoneNumber:
          driver.phoneNumber || driver.phone || driver.whatsappNumber || "",
        licenseNumber: licenseNum,
        licenseExpiry: formattedExpiry,
        nationality: driver.nationality || "",
        experience: driver.experience || driver.yearsOfExperience || "",
        address: driver.address || "",
        emergencyContact: driver.emergencyContact?.name || "",
        emergencyPhone: driver.emergencyContact?.phone || "",
        driverImage:
          driver.driverImage?.url || driver.profileImage
            ? {
                preview: driver.driverImage?.url || driver.profileImage,
                isExisting: true,
              }
            : null,
      });
    }
  }, [driver]);

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
          isExisting: false,
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
    setLoading(true);

    try {
      if (isSelfDriver) {
        // Update self driver info in user profile
        const updateData = {
          fullName: formData.name,
          whatsappNumber: formData.phoneNumber,
          nationality: formData.nationality,
          yearsOfExperience: formData.experience,
          driverInfo: {
            licenseNumber: formData.licenseNumber,
            licenseExpiry: formData.licenseExpiry,
            status: driver.status || "AVAILABLE",
          },
        };

        const response = await api.put("/users/profile", updateData);

        if (response.data.success) {
          showSuccess("Profile updated successfully!");
          onSuccess?.();
        } else {
          throw new Error(response.data.message || "Failed to update profile");
        }
      } else {
        // Update assigned driver
        const submitFormData = new FormData();

        submitFormData.append("name", formData.name);
        submitFormData.append("email", formData.email);
        submitFormData.append("phone", formData.phoneNumber);
        submitFormData.append("licenseNumber", formData.licenseNumber);
        submitFormData.append("licenseExpiry", formData.licenseExpiry);
        submitFormData.append("nationality", formData.nationality);
        submitFormData.append("experience", formData.experience);
        submitFormData.append("address", formData.address);
        submitFormData.append(
          "emergencyContactName",
          formData.emergencyContact,
        );
        submitFormData.append("emergencyContactPhone", formData.emergencyPhone);

        // Add driver image if it's a new file
        if (formData.driverImage?.file) {
          submitFormData.append("driverImage", formData.driverImage.file);
        }

        const response = await api.put(
          `/b2c-partner/drivers/${driver._id}`,
          submitFormData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        if (response.data.success) {
          showSuccess("Driver updated successfully!");
          onSuccess?.();
        } else {
          throw new Error(response.data.message || "Failed to update driver");
        }
      }
    } catch (error) {
      console.error("[v0] Error updating driver:", error);
      showError(error, "Failed to update driver. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay" onClick={onClose}>
      <div className="b2c-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">
            {isSelfDriver ? "Edit Your Profile" : "Edit Driver"}
          </h2>
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
                  disabled={isSelfDriver}
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
                  Nationality
                </label>
                <select
                  id="nationality"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
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
                  Years of Experience
                </label>
                <input
                  type="number"
                  id="experience"
                  name="experience"
                  placeholder="5"
                  value={formData.experience}
                  onChange={handleChange}
                  min="0"
                  max="50"
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="licenseNumber" className="b2c-form-label">
                  License Number
                </label>
                <input
                  type="text"
                  id="licenseNumber"
                  name="licenseNumber"
                  placeholder="e.g. UAE-DL-123456"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="licenseExpiry" className="b2c-form-label">
                  License Expiry Date
                </label>
                <input
                  type="date"
                  id="licenseExpiry"
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>

            {!isSelfDriver && (
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
            )}
          </div>

          {!isSelfDriver && (
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
          )}

          {!isSelfDriver && (
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
          )}

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
              {loading ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_EditDriverModal;
