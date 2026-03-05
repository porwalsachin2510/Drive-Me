"use client";

import { useState } from "react";
import "./addvehiclemodal.css";

function AddVehicleModal({ onClose }) {
  const [formData, setFormData] = useState({
    vehicleModel: "",
    licensePlate: "",
    year: new Date().getFullYear().toString(),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Register New Vehicle</h2>
          <button className="modal-close" onClick={onClose}>
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

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="vehicleModel" className="form-label">
              Vehicle Model
            </label>
            <input
              type="text"
              id="vehicleModel"
              name="vehicleModel"
              placeholder="e.g. Toyota Camry"
              value={formData.vehicleModel}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="licensePlate" className="form-label">
                License Plate
              </label>
              <input
                type="text"
                id="licensePlate"
                name="licensePlate"
                placeholder="40-1234"
                value={formData.licensePlate}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="year" className="form-label">
                Year
              </label>
              <input
                type="number"
                id="year"
                name="year"
                placeholder="2023"
                value={formData.year}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-submit">
              Submit for Verification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddVehicleModal;
