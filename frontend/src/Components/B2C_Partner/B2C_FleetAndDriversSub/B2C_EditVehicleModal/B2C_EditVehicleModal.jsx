"use client";

import { useState, useEffect } from "react";
import "./b2c_editvehiclemodal.css";
import api from "../../../../utils/api";
import { notify } from "../../../../utils/toast";

function B2C_EditVehicleModal({ vehicle, isOpen, onClose, onVehicleUpdated }) {
  const [formData, setFormData] = useState({
    model: "",
    licensePlate: "",
    vehicleType: "CAR",
    year: "",
    seatingCapacity: "",
    vehicleColor: "",
    insuranceExpiry: "",
    registrationExpiry: "",
    status: "Active",
    features: [],
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data when vehicle prop changes
  useEffect(() => {
    if (vehicle) {
      console.log("Initializing edit modal with vehicle:", vehicle);
      setFormData({
        model: vehicle.vehicleName || vehicle.model || "",
        licensePlate: vehicle.licensePlate || vehicle.registrationNumber || "",
        vehicleType: vehicle.vehicleType || "CAR",
        year: vehicle.year ? String(vehicle.year) : "",
        seatingCapacity: vehicle.seatingCapacity
          ? String(vehicle.seatingCapacity)
          : "",
        vehicleColor: vehicle.vehicleColor || "",
        insuranceExpiry: vehicle.insuranceExpiry
          ? new Date(vehicle.insuranceExpiry).toISOString().split("T")[0]
          : "",
        registrationExpiry: vehicle.registrationExpiry
          ? new Date(vehicle.registrationExpiry).toISOString().split("T")[0]
          : "",
        status: vehicle.status || "Active",
        features: Array.isArray(vehicle.features) ? vehicle.features : [],
      });
      setImages([]); // Reset new images when modal opens
    }
  }, [vehicle]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFeatureChange = (e) => {
    const value = e.target.value;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newFeature = value.trim();
      if (newFeature && !formData.features.includes(newFeature)) {
        setFormData((prev) => ({
          ...prev,
          features: [...prev.features, newFeature],
        }));
        e.target.value = "";
      }
    }
  };

  const removeFeature = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages((prev) => [...prev, ...files]);
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.model.trim()) {
      newErrors.model = "Vehicle model is required";
    }
    if (!formData.licensePlate.trim()) {
      newErrors.licensePlate = "License plate is required";
    }
    if (!formData.year) {
      newErrors.year = "Year is required";
    }
    if (!formData.seatingCapacity) {
      newErrors.seatingCapacity = "Seating capacity is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("Edit Vehicle - Form Data:", formData);
    console.log("Edit Vehicle - New Images:", images);
    console.log("Edit Vehicle - Vehicle ID:", vehicle._id);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      // Add all form fields
      Object.keys(formData).forEach((key) => {
        if (key !== "features") {
          formDataToSend.append(key, formData[key]);
          console.log(`Adding field ${key}:`, formData[key]);
        } else {
          formDataToSend.append("features", JSON.stringify(formData[key]));
          console.log("Adding features:", JSON.stringify(formData[key]));
        }
      });

      // Add new images
      images.forEach((image, index) => {
        formDataToSend.append(`images`, image);
        console.log(`Adding image ${index}:`, image.name);
      });

      console.log("Sending FormData to backend...");

      const response = await api.put(
        `/b2c-partner/vehicles/${vehicle._id}`,
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      console.log("Backend response:", response.data);

      if (response.data.success) {
        notify("Vehicle updated successfully!");
        if (onVehicleUpdated) {
          onVehicleUpdated(response.data.vehicle);
        }
        onClose();
      } else {
        throw new Error(response.data.message || "Failed to update vehicle");
      }
    } catch (error) {
      console.error("Error updating vehicle:", error);
      notify(
        `Failed to update vehicle: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="b2c-edit-vehicle-modal-overlay">
      <div className="b2c-edit-vehicle-modal">
        <div className="b2c-edit-vehicle-modal-header">
          <h2>Edit Vehicle</h2>
          <button className="b2c-edit-vehicle-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="b2c-edit-vehicle-form">
          <div className="b2c-edit-vehicle-form-grid">
            {/* Vehicle Model */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Vehicle Model *</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className={errors.model ? "error" : ""}
                placeholder="e.g., Toyota Camry"
              />
              {errors.model && (
                <span className="b2c-edit-vehicle-error">{errors.model}</span>
              )}
            </div>

            {/* License Plate */}
            <div className="b2c-edit-vehicle-form-group">
              <label>License Plate *</label>
              <input
                type="text"
                name="licensePlate"
                value={formData.licensePlate}
                onChange={handleChange}
                className={errors.licensePlate ? "error" : ""}
                placeholder="e.g., KWT 1234"
              />
              {errors.licensePlate && (
                <span className="b2c-edit-vehicle-error">
                  {errors.licensePlate}
                </span>
              )}
            </div>

            {/* Vehicle Type */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Vehicle Type</label>
              <select
                name="vehicleType"
                value={formData.vehicleType}
                onChange={handleChange}
              >
                <option value="CAR">Car</option>
                <option value="SUV">SUV</option>
                <option value="VAN">Van</option>
                <option value="BUS">Bus</option>
                <option value="MINIBUS">Minibus</option>
              </select>
            </div>

            {/* Year */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Year *</label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className={errors.year ? "error" : ""}
                min="2000"
                max={new Date().getFullYear() + 1}
              />
              {errors.year && (
                <span className="b2c-edit-vehicle-error">{errors.year}</span>
              )}
            </div>

            {/* Seating Capacity */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Seating Capacity *</label>
              <input
                type="number"
                name="seatingCapacity"
                value={formData.seatingCapacity}
                onChange={handleChange}
                className={errors.seatingCapacity ? "error" : ""}
                min="1"
                max="50"
              />
              {errors.seatingCapacity && (
                <span className="b2c-edit-vehicle-error">
                  {errors.seatingCapacity}
                </span>
              )}
            </div>

            {/* Vehicle Color */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Vehicle Color</label>
              <input
                type="text"
                name="vehicleColor"
                value={formData.vehicleColor}
                onChange={handleChange}
                placeholder="e.g., White"
              />
            </div>

            {/* Insurance Expiry */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Insurance Expiry</label>
              <input
                type="date"
                name="insuranceExpiry"
                value={formData.insuranceExpiry}
                onChange={handleChange}
              />
            </div>

            {/* Registration Expiry */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Registration Expiry</label>
              <input
                type="date"
                name="registrationExpiry"
                value={formData.registrationExpiry}
                onChange={handleChange}
              />
            </div>

            {/* Status */}
            <div className="b2c-edit-vehicle-form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Features */}
          <div className="b2c-edit-vehicle-form-group">
            <label>Features</label>
            <input
              type="text"
              placeholder="Type features and press Enter or comma (e.g., AC, GPS, USB)"
              onKeyDown={handleFeatureChange}
              className="b2c-edit-vehicle-features-input"
            />
            <div className="b2c-edit-vehicle-features-list">
              {formData.features.map((feature, index) => (
                <span key={index} className="b2c-edit-vehicle-feature-tag">
                  {feature}
                  <button type="button" onClick={() => removeFeature(index)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="b2c-edit-vehicle-form-group">
            <label>Vehicle Images</label>

            {/* Current Images */}
            {vehicle && vehicle.images && vehicle.images.length > 0 && (
              <div className="b2c-edit-vehicle-current-images">
                <h4>Current Images ({vehicle.images.length})</h4>
                <div className="b2c-edit-vehicle-current-images-grid">
                  {vehicle.images.map((image, index) => (
                    <div key={index} className="b2c-edit-vehicle-current-image">
                      <img
                        src={image}
                        alt={`Current vehicle image ${index + 1}`}
                        onError={(e) => {
                          e.target.src = `https://via.placeholder.com/80x80/ef4444/ffffff?text=Error`;
                        }}
                      />
                      <span className="b2c-edit-vehicle-image-index">
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Images */}
            <div className="b2c-edit-vehicle-new-images">
              <h4>Add New Images</h4>
              <div className="b2c-edit-vehicle-file-input-wrapper">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="b2c-edit-vehicle-images-input"
                  id="new-images-input"
                />
                <label
                  htmlFor="new-images-input"
                  className="b2c-edit-vehicle-file-input-label"
                >
                  <span className="b2c-edit-vehicle-file-input-icon">📷</span>
                  <span className="b2c-edit-vehicle-file-input-text">
                    {images.length > 0
                      ? `${images.length} images selected`
                      : "Choose images to upload"}
                  </span>
                  <span className="b2c-edit-vehicle-file-input-subtext">
                    Click to browse or drag and drop
                  </span>
                </label>
              </div>
              <div className="b2c-edit-vehicle-images-preview">
                {images.map((image, index) => (
                  <div key={index} className="b2c-edit-vehicle-image-preview">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`New preview ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="b2c-edit-vehicle-remove-image-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {images.length === 0 && (
                <p className="b2c-edit-vehicle-no-new-images">
                  No new images selected. Current images will be preserved.
                </p>
              )}
            </div>
          </div>

          <div className="b2c-edit-vehicle-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="b2c-edit-vehicle-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="b2c-edit-vehicle-submit-btn"
            >
              {loading ? "Updating..." : "Update Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_EditVehicleModal;
