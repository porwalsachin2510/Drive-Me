"use client";

import { useState, useEffect } from "react";
import "./b2c_addvehiclemodal.css";
import api from "../../../../utils/api";

function B2C_AddVehicleModal({ onClose }) {
  const [formData, setFormData] = useState({
    vehicleType: "",
    model: "",
    year: new Date().getFullYear().toString(),
    seatingCapacity: "",
    licensePlate: "",
    vehicleColor: "",
    insuranceExpiry: "",
    registrationExpiry: "",
    features: [],
    images: [],
    status: "Active",
    tags: [], // Selected tag IDs for vehicle
  });

  const [newFeature, setNewFeature] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [groupedTags, setGroupedTags] = useState({});

  // Fetch vehicle-related tags on mount
  useEffect(() => {
    fetchVehicleTags();
  }, []);

  const fetchVehicleTags = async () => {
    try {
      const response = await api.get("/admin/tags/by-category", {
        params: { context: "vehicle" },
      });
      setAvailableTags(response.data.tags || []);
      setGroupedTags(response.data.groupedTags || {});
    } catch (error) {
      console.error("Error fetching vehicle tags:", error);
    }
  };

  const handleTagToggle = (tagId) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  const vehicleTypes = [
    "Sedan",
    "SUV",
    "Van",
    "Minibus",
    "Bus",
    "Pickup Truck",
    "Other",
  ];

  const commonFeatures = [
    "Air Conditioning",
    "GPS Tracking",
    "WiFi",
    "USB Charging",
    "Audio System",
    "Safety Belts",
    "First Aid Kit",
    "Fire Extinguisher",
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFeatureToggle = (feature) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const handleAddCustomFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, newFeature.trim()],
      }));
      setNewFeature("");
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      fileName: file.name,
    }));

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...newImages].slice(0, 10), // Max 10 images
    }));
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeFeature = (feature) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create FormData for file upload
      const submitFormData = new FormData();

      // Add basic vehicle data
      submitFormData.append("vehicleType", formData.vehicleType);
      submitFormData.append("model", formData.model);
      submitFormData.append("year", formData.year);
      submitFormData.append("seatingCapacity", formData.seatingCapacity);
      submitFormData.append("licensePlate", formData.licensePlate);
      submitFormData.append("vehicleColor", formData.vehicleColor);
      submitFormData.append("insuranceExpiry", formData.insuranceExpiry);
      submitFormData.append("registrationExpiry", formData.registrationExpiry);
      submitFormData.append("status", formData.status || "Active");

      // Add features as JSON string
      submitFormData.append("features", JSON.stringify(formData.features));

      // Add tags as JSON string
      submitFormData.append("tags", JSON.stringify(formData.tags));

      // Add images
      formData.images.forEach((image, index) => {
        if (image.file) {
          submitFormData.append("images", image.file);
        }
      });

      console.log("Submitting vehicle data with FormData:", submitFormData);

      const response = await api.post("/b2c-partner/vehicles", submitFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        console.log("Vehicle created successfully:", response.data.vehicle);
        alert("Vehicle added successfully!");
        onClose();
        // Optionally trigger a refresh of parent component
        if (window.onVehicleAdded) {
          window.onVehicleAdded();
        } else {
          window.location.reload();
        }
      } else {
        throw new Error(response.data.message || "Failed to add vehicle");
      }
    } catch (error) {
      console.error("Error adding vehicle:", error);
      alert(
        `Failed to add vehicle: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="b2c-modal-overlay">
      <div className="b2c-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-modal-header">
          <h2 className="b2c-modal-title">Add New Vehicle</h2>
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
            <h3 className="b2c-section-title">Basic Information</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="vehicleType" className="b2c-form-label">
                  Vehicle Type *
                </label>
                <select
                  id="vehicleType"
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="b2c-form-group">
                <label htmlFor="model" className="b2c-form-label">
                  Model *
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  placeholder="e.g. Toyota Camry"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="year" className="b2c-form-label">
                  Year *
                </label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  placeholder="2023"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="seatingCapacity" className="b2c-form-label">
                  Seating Capacity *
                </label>
                <input
                  type="number"
                  id="seatingCapacity"
                  name="seatingCapacity"
                  placeholder="4"
                  value={formData.seatingCapacity}
                  onChange={handleChange}
                  required
                  min="1"
                  max="50"
                  className="b2c-form-input"
                />
              </div>
            </div>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="licensePlate" className="b2c-form-label">
                  License Plate *
                </label>
                <input
                  type="text"
                  id="licensePlate"
                  name="licensePlate"
                  placeholder="e.g. ABC-1234"
                  value={formData.licensePlate}
                  onChange={handleChange}
                  required
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="vehicleColor" className="b2c-form-label">
                  Color
                </label>
                <input
                  type="text"
                  id="vehicleColor"
                  name="vehicleColor"
                  placeholder="e.g. White"
                  value={formData.vehicleColor}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Documents & Expiry</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="insuranceExpiry" className="b2c-form-label">
                  Insurance Expiry Date
                </label>
                <input
                  type="date"
                  id="insuranceExpiry"
                  name="insuranceExpiry"
                  value={formData.insuranceExpiry}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>

              <div className="b2c-form-group">
                <label htmlFor="registrationExpiry" className="b2c-form-label">
                  Registration Expiry Date
                </label>
                <input
                  type="date"
                  id="registrationExpiry"
                  name="registrationExpiry"
                  value={formData.registrationExpiry}
                  onChange={handleChange}
                  className="b2c-form-input"
                />
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Vehicle Status</h3>

            <div className="b2c-form-row">
              <div className="b2c-form-group">
                <label htmlFor="status" className="b2c-form-label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="b2c-form-input"
                >
                  <option value="Active">Active</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Features</h3>

            <div className="b2c-features-grid">
              {commonFeatures.map((feature) => (
                <label key={feature} className="b2c-feature-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.features.includes(feature)}
                    onChange={() => handleFeatureToggle(feature)}
                  />
                  <span className="b2c-checkmark"></span>
                  {feature}
                </label>
              ))}
            </div>

            <div className="b2c-custom-feature">
              <input
                type="text"
                placeholder="Add custom feature"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(), handleAddCustomFeature())
                }
                className="b2c-form-input"
              />
              <button
                type="button"
                onClick={handleAddCustomFeature}
                className="b2c-add-feature-btn"
              >
                Add
              </button>
            </div>

            {formData.features.length > 0 && (
              <div className="b2c-selected-features">
                <h4>Selected Features:</h4>
                <div className="b2c-features-tags">
                  {formData.features.map((feature) => (
                    <span key={feature} className="b2c-feature-tag">
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className="b2c-remove-feature"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vehicle Tags Section */}
          {availableTags.length > 0 && (
            <div className="b2c-form-section">
              <h3 className="b2c-section-title">Vehicle Tags</h3>
              <p className="b2c-section-description">
                Select tags to categorize your vehicle and help with search
                visibility
              </p>

              {Object.entries(groupedTags).map(([category, tags]) => (
                <div key={category} className="b2c-tag-category-group">
                  <span className="b2c-tag-category-label">
                    {category.charAt(0).toUpperCase() + category.slice(1)} Tags:
                  </span>
                  <div className="b2c-tags-selector">
                    {tags.map((tag) => (
                      <button
                        key={tag._id}
                        type="button"
                        className={`b2c-tag-btn ${formData.tags.includes(tag._id) ? "selected" : ""}`}
                        onClick={() => handleTagToggle(tag._id)}
                        style={{
                          backgroundColor: formData.tags.includes(tag._id)
                            ? tag.color
                            : "#f3f4f6",
                          color: formData.tags.includes(tag._id)
                            ? tag.textColor
                            : "#374151",
                          borderColor: tag.color,
                        }}
                        title={tag.description || tag.label}
                      >
                        {tag.icon && (
                          <span className="b2c-tag-icon">{tag.icon}</span>
                        )}
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="b2c-form-section">
            <h3 className="b2c-section-title">Vehicle Images</h3>

            <div className="b2c-image-upload">
              {formData.images.length === 0 ? (
                <label className="b2c-image-upload-box">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <div className="b2c-upload-content">
                    <div className="b2c-upload-icon">📷</div>
                    <p>Click to upload vehicle images</p>
                    <span>Max 10 images, JPG/PNG</span>
                  </div>
                </label>
              ) : (
                <>
                  <div className="b2c-images-grid">
                    {formData.images.map((image, index) => (
                      <div key={index} className="b2c-image-item">
                        <img
                          src={image.preview}
                          alt={`Vehicle ${index + 1}`}
                          className="b2c-image-thumbnail"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="b2c-remove-image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {formData.images.length < 10 && (
                      <label className="b2c-add-more-image">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageChange}
                          style={{ display: "none" }}
                        />
                        <div className="b2c-add-more-content">
                          <span>+</span>
                        </div>
                      </label>
                    )}
                  </div>
                  <p className="b2c-image-count">
                    {formData.images.length}/10 images uploaded
                  </p>
                </>
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
              {loading ? "Adding Vehicle..." : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2C_AddVehicleModal;
