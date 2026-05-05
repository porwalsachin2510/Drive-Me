// import { useState } from "react";
// import "./commute-search-form.css";

// export default function CommuteSearchForm({ onSearch, onRequestRoute }) {
//   const [formData, setFormData] = useState({
//     pickupLocation: "",
//     dropoffLocation: "",
//   });

//   const [selectedDays, setSelectedDays] = useState([]);
//   const [errors, setErrors] = useState({});

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//     if (errors[name]) {
//       setErrors((prev) => ({
//         ...prev,
//         [name]: undefined,
//       }));
//     }
//   };

//   const toggleDay = (day) => {
//     setSelectedDays((prev) =>
//       prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
//     );
//     if (errors.selectedDays) {
//       setErrors((prev) => ({
//         ...prev,
//         selectedDays: undefined,
//       }));
//     }
//   };

//   const selectAllWeekdays = () => {
//     setSelectedDays(["MON", "TUE", "WED", "THU", "FRI"]);
//     if (errors.selectedDays) {
//       setErrors((prev) => ({
//         ...prev,
//         selectedDays: undefined,
//       }));
//     }
//   };

//   const selectAllDays = () => {
//     setSelectedDays(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
//     if (errors.selectedDays) {
//       setErrors((prev) => ({
//         ...prev,
//         selectedDays: undefined,
//       }));
//     }
//   };

//   const clearDays = () => {
//     setSelectedDays([]);
//   };

//   const validateForm = () => {
//     const newErrors = {};

//     if (!formData.pickupLocation.trim()) {
//       newErrors.pickupLocation = "Pickup location is required";
//     }
//     if (!formData.dropoffLocation.trim()) {
//       newErrors.dropoffLocation = "Drop-off location is required";
//     }
//     if (selectedDays.length === 0) {
//       newErrors.selectedDays = "Please select at least one day";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSearchCommute = (e) => {
//     e.preventDefault();
//     if (validateForm()) {
//       if (onSearch) {
//         onSearch({
//           ...formData,
//           selectedDays,
//           filterType: "matched",
//         });
//       }
//     }
//   };

//   return (
//     <div className="commute-search-form-container">
//       <form
//         className="drivemego-commute-search-form"
//         onSubmit={handleSearchCommute}
//       >
//         {/* Location Fields */}
//         <div className="commute-search-form-location-grid">
//           <div className="commute-search-form-form-group">
//             <label className="commute-search-form-form-label commute-search-form-location-label">
//               <svg
//                 className="commute-search-form-label-icon commute-search-form-teal"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//               >
//                 <path
//                   d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z"
//                   strokeWidth="2"
//                 />
//                 <circle cx="12" cy="10" r="3" strokeWidth="2" fill="none" />
//               </svg>
//               PICKUP LOCATION
//             </label>
//             <div className="commute-search-form-input-wrapper">
//               <input
//                 type="text"
//                 name="pickupLocation"
//                 placeholder="Enter area, stop point, or landmark"
//                 value={formData.pickupLocation}
//                 onChange={handleInputChange}
//                 className={`commute-search-form-form-input ${
//                   errors.pickupLocation ? "commute-search-form-input-error" : ""
//                 }`}
//               />
//             </div>
//             <span className="input-hint">
//               E.g., Salmiya, Habibganj ISBT, Electronic City
//             </span>
//             {errors.pickupLocation && (
//               <span className="commute-search-form-error-message">
//                 {errors.pickupLocation}
//               </span>
//             )}
//           </div>

//           <div className="commute-search-form-form-group">
//             <label className="commute-search-form-form-label commute-search-form-location-label">
//               <svg
//                 className="commute-search-form-label-icon commute-search-form-red"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//               >
//                 <path
//                   d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z"
//                   strokeWidth="2"
//                 />
//                 <circle
//                   cx="12"
//                   cy="10"
//                   r="3"
//                   strokeWidth="2"
//                   fill="currentColor"
//                 />
//               </svg>
//               DROP-OFF LOCATION
//             </label>
//             <div className="commute-search-form-input-wrapper">
//               <input
//                 type="text"
//                 name="dropoffLocation"
//                 placeholder="Enter area, stop point, or landmark"
//                 value={formData.dropoffLocation}
//                 onChange={handleInputChange}
//                 className={`commute-search-form-form-input ${
//                   errors.dropoffLocation
//                     ? "commute-search-form-input-error"
//                     : ""
//                 }`}
//               />
//             </div>
//             <span className="input-hint">
//               E.g., Reggae, New Market Bus Stop, Wilson Garden
//             </span>
//             {errors.dropoffLocation && (
//               <span className="commute-search-form-error-message">
//                 {errors.dropoffLocation}
//               </span>
//             )}
//           </div>
//         </div>

//         {/* Days Needed */}
//         <div className="commute-search-form-form-group commute-search-form-days-section">
//           <div className="commute-search-form-days-header">
//             <label className="commute-search-form-form-label">
//               <svg
//                 className="commute-search-form-label-icon commute-search-form-blue"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//               >
//                 <rect
//                   x="3"
//                   y="4"
//                   width="18"
//                   height="18"
//                   rx="2"
//                   strokeWidth="2"
//                 />
//                 <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
//                 <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
//                 <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
//               </svg>
//               Select Your Commute Days
//             </label>
//             <div className="commute-search-form-days-quick-actions">
//               <button
//                 type="button"
//                 className="commute-search-form-quick-btn"
//                 onClick={selectAllWeekdays}
//               >
//                 Weekdays
//               </button>
//               <button
//                 type="button"
//                 className="commute-search-form-quick-btn"
//                 onClick={selectAllDays}
//               >
//                 All Days
//               </button>
//               {selectedDays.length > 0 && (
//                 <button
//                   type="button"
//                   className="commute-search-form-quick-btn commute-search-form-clear-btn"
//                   onClick={clearDays}
//                 >
//                   Clear
//                 </button>
//               )}
//             </div>
//           </div>
//           <div className="commute-search-form-days-container">
//             {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
//               <button
//                 key={day}
//                 type="button"
//                 className={`commute-search-form-day-button ${
//                   selectedDays.includes(day)
//                     ? "commute-search-form-selected"
//                     : ""
//                 }`}
//                 onClick={() => toggleDay(day)}
//               >
//                 {day}
//               </button>
//             ))}
//           </div>
//           {errors.selectedDays && (
//             <span className="commute-search-form-error-message">
//               {errors.selectedDays}
//             </span>
//           )}
//         </div>

//         {/* Button Section */}
//         <div className="commute-search-form-button-section">
//           <button type="submit" className="commute-search-form-search-button">
//             <svg
//               className="commute-search-form-search-icon-svg"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//             >
//               <circle cx="11" cy="11" r="8" />
//               <path d="M21 21l-4.35-4.35" />
//             </svg>
//             Search Commutes
//           </button>
//           <button
//             type="button"
//             className="commute-search-form-request-button"
//             onClick={onRequestRoute}
//           >
//             {"Can't find a route? Request one"}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }

import { useState } from "react";
import GooglePlacesAutocomplete from "../GooglePlacesAutocomplete/GooglePlacesAutocomplete";
import "./commute-search-form.css";

export default function CommuteSearchForm({
  onSearch,
  onRequestRoute,
  userCountry,
}) {
  const [formData, setFormData] = useState({
    pickupLocation: "",
    dropoffLocation: "",
    pickupCoordinates: null,
    dropoffCoordinates: null,
  });

  const [selectedDays, setSelectedDays] = useState([]);
  const [errors, setErrors] = useState({});

  // Handle location change from autocomplete
  const handleLocationChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  // Handle place selection with coordinates
  const handlePlaceSelect = (field, place) => {
    const coordField =
      field === "pickupLocation" ? "pickupCoordinates" : "dropoffCoordinates";
    setFormData((prev) => ({
      ...prev,
      [field]: place.description || place.formattedAddress || place.name,
      [coordField]: place.location || null,
    }));
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    if (errors.selectedDays) {
      setErrors((prev) => ({
        ...prev,
        selectedDays: undefined,
      }));
    }
  };

  const selectAllWeekdays = () => {
    setSelectedDays(["MON", "TUE", "WED", "THU", "FRI"]);
    if (errors.selectedDays) {
      setErrors((prev) => ({
        ...prev,
        selectedDays: undefined,
      }));
    }
  };

  const selectAllDays = () => {
    setSelectedDays(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    if (errors.selectedDays) {
      setErrors((prev) => ({
        ...prev,
        selectedDays: undefined,
      }));
    }
  };

  const clearDays = () => {
    setSelectedDays([]);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = "Pickup location is required";
    }
    if (!formData.dropoffLocation.trim()) {
      newErrors.dropoffLocation = "Drop-off location is required";
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
      if (onSearch) {
        onSearch({
          pickupLocation: formData.pickupLocation,
          dropoffLocation: formData.dropoffLocation,
          pickupCoordinates: formData.pickupCoordinates,
          dropoffCoordinates: formData.dropoffCoordinates,
          selectedDays,
          filterType: "matched",
        });
      }
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
                <circle cx="12" cy="10" r="3" strokeWidth="2" fill="none" />
              </svg>
              PICKUP LOCATION
            </label>
            <GooglePlacesAutocomplete
              name="pickupLocation"
              value={formData.pickupLocation}
              onChange={(value) =>
                handleLocationChange("pickupLocation", value)
              }
              onPlaceSelect={(place) =>
                handlePlaceSelect("pickupLocation", place)
              }
              placeholder="Enter area, stop point, or landmark"
              country={userCountry}
              error={!!errors.pickupLocation}
              inputClassName={`commute-search-form-form-input ${
                errors.pickupLocation ? "commute-search-form-input-error" : ""
              }`}
            />
            <span className="input-hint">
              E.g., Salmiya, Habibganj ISBT, Electronic City
            </span>
            {errors.pickupLocation && (
              <span className="commute-search-form-error-message">
                {errors.pickupLocation}
              </span>
            )}
          </div>

          <div className="commute-search-form-form-group">
            <label className="commute-search-form-form-label commute-search-form-location-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-red"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="10"
                  r="3"
                  strokeWidth="2"
                  fill="currentColor"
                />
              </svg>
              DROP-OFF LOCATION
            </label>
            <GooglePlacesAutocomplete
              name="dropoffLocation"
              value={formData.dropoffLocation}
              onChange={(value) =>
                handleLocationChange("dropoffLocation", value)
              }
              onPlaceSelect={(place) =>
                handlePlaceSelect("dropoffLocation", place)
              }
              placeholder="Enter area, stop point, or landmark"
              country={userCountry}
              error={!!errors.dropoffLocation}
              inputClassName={`commute-search-form-form-input ${
                errors.dropoffLocation ? "commute-search-form-input-error" : ""
              }`}
            />
            <span className="input-hint">
              E.g., Reggae, New Market Bus Stop, Wilson Garden
            </span>
            {errors.dropoffLocation && (
              <span className="commute-search-form-error-message">
                {errors.dropoffLocation}
              </span>
            )}
          </div>
        </div>

        {/* Days Needed */}
        <div className="commute-search-form-form-group commute-search-form-days-section">
          <div className="commute-search-form-days-header">
            <label className="commute-search-form-form-label">
              <svg
                className="commute-search-form-label-icon commute-search-form-blue"
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
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
                <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
                <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
              </svg>
              Select Your Commute Days
            </label>
            <div className="commute-search-form-days-quick-actions">
              <button
                type="button"
                className="commute-search-form-quick-btn"
                onClick={selectAllWeekdays}
              >
                Weekdays
              </button>
              <button
                type="button"
                className="commute-search-form-quick-btn"
                onClick={selectAllDays}
              >
                All Days
              </button>
              {selectedDays.length > 0 && (
                <button
                  type="button"
                  className="commute-search-form-quick-btn commute-search-form-clear-btn"
                  onClick={clearDays}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
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
            <svg
              className="commute-search-form-search-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
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



