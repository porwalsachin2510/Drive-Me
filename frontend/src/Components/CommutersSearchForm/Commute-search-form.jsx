import { useState } from "react";
import "./commute-search-form.css";

export default function CommuteSearchForm({ onSearch, onRequestRoute }) {
  const [formData, setFormData] = useState({
    pickupLocation: "",
    dropoffLocation: "",
    workCategory: "",
    tripType: "Round Trip",
    startDate: "",
    shiftType: "Full Day",
    pickupTime: "",
  });

  const [selectedDays, setSelectedDays] = useState([]);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
    if (errors.selectedDays) {
      setErrors((prev) => ({
        ...prev,
        selectedDays: undefined,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = "Pickup location is required";
    }
    if (!formData.dropoffLocation.trim()) {
      newErrors.dropoffLocation = "Drop-off location is required";
    }
    if (!formData.startDate.trim()) {
      newErrors.startDate = "Start date is required";
    }
    if (!formData.pickupTime.trim()) {
      newErrors.pickupTime = "Pickup time is required";
    }
    if (selectedDays.length === 0) {
      newErrors.selectedDays = "Please select at least one day";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearchCommute = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // START: CALL PARENT COMPONENT'S onSearch FUNCTION WITH SEARCH PARAMS
      if (onSearch) {
        onSearch({
          ...formData,
          selectedDays,
          filterType: "matched", // INDICATE THIS IS A MATCHED SEARCH
        });
      }
      // END: CALL PARENT COMPONENT'S onSearch FUNCTION

    }
  };

  return (
    <div className="commute-search-form-container">
      <form
        className="drivemego-commute-search-form"
        onSubmit={handleSearchCommute}
      >
        {/* Location Fields */}
        <div className="commute-search-form-location-grid">
          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label commute-search-form-location-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-teal"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z"
                  strokeWidth="2"
                />
              </svg>
              PICKUP LOCATION
            </label>
            <div className="commute-search-form-input-wrapper">
              <input
                type="text"
                name="pickupLocation"
                placeholder="Enter home location (Google Places)"
                value={formData.pickupLocation}
                onChange={handleInputChange}
                className={`commute-search-form-form-input ${
                  errors.pickupLocation ? "commute-search-form-input-error" : ""
                }`}
              />
            </div>
            {errors.pickupLocation && (
              <span className="commute-search-form-error-message">
                {errors.pickupLocation}
              </span>
            )}
          </div>

          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label commute-search-form-location-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-teal"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z"
                  strokeWidth="2"
                />
              </svg>
              DROP-OFF LOCATION
            </label>
            <div className="commute-search-form-input-wrapper">
              <input
                type="text"
                name="dropoffLocation"
                placeholder="Enter work location (Google Places)"
                value={formData.dropoffLocation}
                onChange={handleInputChange}
                className={`commute-search-form-form-input ${
                  errors.dropoffLocation
                    ? "commute-search-form-input-error"
                    : ""
                }`}
              />
            </div>
            {errors.dropoffLocation && (
              <span className="commute-search-form-error-message">
                {errors.dropoffLocation}
              </span>
            )}
          </div>
        </div>

        {/* Form Fields Grid */}
        <div className="commute-search-form-form-fields-grid">
          {/* Work Category */}
          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-red"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="2" />
              </svg>
              Work Category
            </label>
            <select
              name="workCategory"
              value={formData.workCategory}
              onChange={handleSelectChange}
              className="commute-search-form-form-select"
            >
              <option value="">Select Category</option>
              <option value="Office Staff">Office Staff</option>
              <option value="Medical or Hospital">Medical/Hospital</option>
              <option value="Education or School">Education/School</option>
              <option value="Construction">Construction</option>
              <option value="Retail or Mall">Retail/Mall</option>
            </select>
          </div>

          {/* Pickup Time */}
          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-red"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <polyline
                  points="12 6 12 12 16 14"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              Pickup Time
            </label>
            <div className="commute-search-form-input-wrapper">
              <input
                type="time"
                name="pickupTime"
                placeholder="--:--"
                value={formData.pickupTime}
                onChange={handleInputChange}
                className={`commute-search-form-form-input commute-search-form-time-input ${
                  errors.pickupTime ? "commute-search-form-input-error" : ""
                }`}
              />
            </div>
            {errors.pickupTime && (
              <span className="commute-search-form-error-message">
                {errors.pickupTime}
              </span>
            )}
          </div>

          {/* Shift Type */}
          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-blue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="1"
                  strokeWidth="2"
                  fill="currentColor"
                />
              </svg>
              Shift Type
            </label>
            <select
              name="shiftType"
              value={formData.shiftType}
              onChange={handleSelectChange}
              className="commute-search-form-form-select"
            >
              <option value="Full Day">Full Day</option>
              <option value="Morning Shift">Morning Shift</option>
              <option value="Evening Shift">Evening Shift</option>
              <option value="Night Shift">Night Shift</option>
            </select>
          </div>
        </div>

        {/* Second Row */}
        <div className="commute-search-form-form-fields-grid">
          {/* Trip Type */}
          <div className="commute-search-form-form-group">
            <label className="form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-red"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 2L19 8v8c0 4-7 6-7 6s-7-2-7-6V8l7-6z"
                  strokeWidth="2"
                />
              </svg>
              Trip Type
            </label>
            <select
              name="tripType"
              value={formData.tripType}
              onChange={handleSelectChange}
              className="commute-search-form-form-select"
            >
              <option value="Round Trip">Round Trip</option>
              <option value="One Way">One Way</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-red"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  strokeWidth="2"
                />
                <polyline
                  points="16 2 16 6 8 6 8 2"
                  strokeWidth="2"
                  fill="none"
                />
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
              </svg>
              Start Date
            </label>
            <div className="commute-search-form-input-wrapper">
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                placeholder="dd-mm-yyyy"
                className={`commute-search-form-form-input commute-search-form-date-input ${
                  errors.startDate ? "commute-search-form-input-error" : ""
                }`}
              />
            </div>
            {errors.startDate && (
              <span className="commute-search-form-error-message">
                {errors.startDate}
              </span>
            )}
          </div>
        </div>

        {/* Days Needed */}
        <div className="commute-search-form-form-group">
          <label className="commute-search-form-form-label">
            <svg
              className="commute-search-form-label-icon commute-search-form-red"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
              <polyline
                points="16 2 16 6 8 6 8 2"
                strokeWidth="2"
                fill="none"
              />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
            </svg>
            Days Needed (On/Off)
          </label>
          <div className="commute-search-form-days-container">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
              <button
                key={day}
                type="button"
                className={`commute-search-form-day-button ${
                  selectedDays.includes(day)
                    ? "commute-search-form-selected"
                    : ""
                }`}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
          {errors.selectedDays && (
            <span className="commute-search-form-error-message">
              {errors.selectedDays}
            </span>
          )}
        </div>

        {/* Button Section */}
        <div className="commute-search-form-button-section">
          <button type="submit" className="commute-search-form-search-button">
            <span className="commute-search-form-search-icon">🔍</span>
            Search Commutes
          </button>
          <button
            type="button"
            className="commute-search-form-request-button"
            onClick={onRequestRoute}
          >
            {"Can't find a route? Request one"}
          </button>
        </div>
      </form>
    </div>
  );
}
