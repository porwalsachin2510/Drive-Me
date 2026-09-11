import { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Navigation,
  ArrowLeftRight,
  CalendarDays,
  Search,
  ChevronDown,
  ShieldCheck,
  BadgeCheck,
  Repeat2,
  Sparkles,
} from "lucide-react";
import GooglePlacesAutocomplete from "../GooglePlacesAutocomplete/GooglePlacesAutocomplete";
import "./commute-search-form.css";

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_LABEL = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

// Human summary of the selected days for the collapsed "Commute days" cell.
function summariseDays(days) {
  if (!days.length) return "Select days";
  if (days.length === 7) return "All days";
  const isWeekdays =
    days.length === 5 && WEEKDAYS.every((d) => days.includes(d));
  if (isWeekdays) return "Mon – Fri";
  // Keep the chips in canonical week order regardless of click order.
  return ALL_DAYS.filter((d) => days.includes(d))
    .map((d) => DAY_LABEL[d])
    .join(", ");
}

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

  // Preselect the most common commute pattern (Mon–Fri) so the form is usable
  // in one tap, mirroring how flight widgets default to a sensible trip type.
  const [selectedDays, setSelectedDays] = useState(WEEKDAYS);
  const [dayPreset, setDayPreset] = useState("weekdays");
  const [errors, setErrors] = useState({});
  const [showDayPicker, setShowDayPicker] = useState(false);

  const dayCellRef = useRef(null);

  // Close the day popover when clicking anywhere outside of it.
  useEffect(() => {
    if (!showDayPicker) return undefined;
    const handleClickOutside = (event) => {
      if (dayCellRef.current && !dayCellRef.current.contains(event.target)) {
        setShowDayPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDayPicker]);

  const handleLocationChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePlaceSelect = (field, place) => {
    const coordField =
      field === "pickupLocation" ? "pickupCoordinates" : "dropoffCoordinates";
    setFormData((prev) => ({
      ...prev,
      [field]: place.description || place.formattedAddress || place.name,
      [coordField]: place.location || null,
    }));
  };

  const clearDayError = () => {
    if (errors.selectedDays) {
      setErrors((prev) => ({ ...prev, selectedDays: undefined }));
    }
  };

  const toggleDay = (day) => {
    setDayPreset("custom");
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    clearDayError();
  };

  const applyPreset = (preset) => {
    setDayPreset(preset);
    clearDayError();
    if (preset === "weekdays") {
      setSelectedDays(WEEKDAYS);
      setShowDayPicker(false);
    } else if (preset === "all") {
      setSelectedDays(ALL_DAYS);
      setShowDayPicker(false);
    } else {
      // Custom — open the picker so the commuter can choose.
      setShowDayPicker(true);
    }
  };

  // Swap pickup <-> drop-off (text + resolved coordinates), the way ride/flight
  // apps flip origin and destination in a single tap.
  const swapLocations = () => {
    setFormData((prev) => ({
      ...prev,
      pickupLocation: prev.dropoffLocation,
      dropoffLocation: prev.pickupLocation,
      pickupCoordinates: prev.dropoffCoordinates,
      dropoffCoordinates: prev.pickupCoordinates,
    }));
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
    if (validateForm() && onSearch) {
      onSearch({
        pickupLocation: formData.pickupLocation,
        dropoffLocation: formData.dropoffLocation,
        pickupCoordinates: formData.pickupCoordinates,
        dropoffCoordinates: formData.dropoffCoordinates,
        selectedDays,
        filterType: "matched",
      });
    }
  };

  return (
    <div className="cmf-widget">
      {/* Widget header — this is the commuter homepage, so a clear title beats
          product tabs. */}
      <div className="cmf-head">
        <div className="cmf-head-text">
          <h2 className="cmf-head-title">Find your daily commute</h2>
          <p className="cmf-head-sub">
            Set your route and days — we&apos;ll match you with verified everyday
            rides.
          </p>
        </div>
        <span className="cmf-head-badge">
          <ShieldCheck size={15} strokeWidth={2.4} />
          Verified providers
        </span>
      </div>

      <form className="cmf-body" onSubmit={handleSearchCommute}>
        {/* Trip-preference row: day presets on the left, country on the right */}
        <div className="cmf-prefs">
          <div className="cmf-radios" role="radiogroup" aria-label="Commute days">
            {[
              { id: "weekdays", label: "Weekdays" },
              { id: "all", label: "All Days" },
              { id: "custom", label: "Custom Days" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={dayPreset === opt.id}
                className={`cmf-radio ${dayPreset === opt.id ? "cmf-radio-on" : ""}`}
                onClick={() => applyPreset(opt.id)}
              >
                <span className="cmf-radio-dot" />
                {opt.label}
              </button>
            ))}
          </div>

          {userCountry && (
            <span className="cmf-country-pill">
              <MapPin size={14} strokeWidth={2.4} />
              {userCountry}
            </span>
          )}
        </div>

        {/* Segmented search bar */}
        <div className="cmf-bar">
          {/* PICKUP */}
          <div
            className={`cmf-cell cmf-cell-pickup ${errors.pickupLocation ? "cmf-cell-error" : ""}`}
          >
            <span className="cmf-cell-label">
              <MapPin size={13} strokeWidth={2.4} className="cmf-ic-teal" />
              Pickup
            </span>
            <GooglePlacesAutocomplete
              name="pickupLocation"
              value={formData.pickupLocation}
              onChange={(value) => handleLocationChange("pickupLocation", value)}
              onPlaceSelect={(place) =>
                handlePlaceSelect("pickupLocation", place)
              }
              placeholder="Where do you board?"
              country={userCountry}
              error={!!errors.pickupLocation}
              inputClassName="cmf-seg-input"
            />
            <span className="cmf-cell-hint">
              E.g. Salmiya, Habibganj ISBT, Electronic City
            </span>
          </div>

          {/* SWAP */}
          <button
            type="button"
            className="cmf-swap"
            onClick={swapLocations}
            aria-label="Swap pickup and drop-off"
            title="Swap locations"
          >
            <ArrowLeftRight size={17} strokeWidth={2.2} />
          </button>

          {/* DROP-OFF */}
          <div
            className={`cmf-cell cmf-cell-drop ${errors.dropoffLocation ? "cmf-cell-error" : ""}`}
          >
            <span className="cmf-cell-label">
              <Navigation size={13} strokeWidth={2.4} className="cmf-ic-navy" />
              Drop-off
            </span>
            <GooglePlacesAutocomplete
              name="dropoffLocation"
              value={formData.dropoffLocation}
              onChange={(value) =>
                handleLocationChange("dropoffLocation", value)
              }
              onPlaceSelect={(place) =>
                handlePlaceSelect("dropoffLocation", place)
              }
              placeholder="Where are you headed?"
              country={userCountry}
              error={!!errors.dropoffLocation}
              inputClassName="cmf-seg-input"
            />
            <span className="cmf-cell-hint">
              E.g. Kuwait City, New Market Bus Stop, Wilson Garden
            </span>
          </div>

          {/* COMMUTE DAYS */}
          <div
            ref={dayCellRef}
            className={`cmf-cell cmf-cell-days ${errors.selectedDays ? "cmf-cell-error" : ""}`}
          >
            <span className="cmf-cell-label">
              <CalendarDays size={13} strokeWidth={2.4} className="cmf-ic-navy" />
              Commute days
            </span>
            <button
              type="button"
              className="cmf-days-trigger"
              onClick={() => setShowDayPicker((s) => !s)}
              aria-haspopup="true"
              aria-expanded={showDayPicker}
            >
              <span className="cmf-days-value">
                {summariseDays(selectedDays)}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={2.2}
                className={`cmf-days-caret ${showDayPicker ? "cmf-days-caret-open" : ""}`}
              />
            </button>
            <span className="cmf-cell-hint">
              {selectedDays.length
                ? `${selectedDays.length} day${selectedDays.length > 1 ? "s" : ""} a week`
                : "Pick the days you travel"}
            </span>

            {showDayPicker && (
              <div className="cmf-day-pop" role="dialog" aria-label="Choose commute days">
                <div className="cmf-day-pop-head">
                  <strong>Select commute days</strong>
                  <button
                    type="button"
                    className="cmf-day-pop-clear"
                    onClick={() => {
                      setSelectedDays([]);
                      setDayPreset("custom");
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="cmf-day-grid">
                  {ALL_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`cmf-day-pill ${selectedDays.includes(day) ? "cmf-day-pill-on" : ""}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="cmf-day-pop-foot">
                  <button
                    type="button"
                    className="cmf-day-quick"
                    onClick={() => applyPreset("weekdays")}
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    className="cmf-day-quick"
                    onClick={() => applyPreset("all")}
                  >
                    All days
                  </button>
                  <button
                    type="button"
                    className="cmf-day-done"
                    onClick={() => setShowDayPicker(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inline validation messages */}
        {(errors.pickupLocation ||
          errors.dropoffLocation ||
          errors.selectedDays) && (
          <div className="cmf-errors">
            {errors.pickupLocation && <span>{errors.pickupLocation}</span>}
            {errors.dropoffLocation && <span>{errors.dropoffLocation}</span>}
            {errors.selectedDays && <span>{errors.selectedDays}</span>}
          </div>
        )}

        {/* Action bar */}
        <div className="cmf-actions">
          <div className="cmf-trust">
            <span className="cmf-trust-chip">
              <ShieldCheck size={15} strokeWidth={2.2} />
              Verified providers
            </span>
            <span className="cmf-trust-chip">
              <BadgeCheck size={15} strokeWidth={2.2} />
              Fixed monthly pass
            </span>
            <span className="cmf-trust-chip cmf-trust-hide-sm">
              <Repeat2 size={15} strokeWidth={2.2} />
              Same ride, daily
            </span>
          </div>

          <div className="cmf-action-btns">
            <button
              type="button"
              className="cmf-request"
              onClick={onRequestRoute}
            >
              <Sparkles size={15} strokeWidth={2.2} />
              Request a route
            </button>
            <button type="submit" className="cmf-search">
              <Search size={19} strokeWidth={2.4} />
              Search Commutes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
