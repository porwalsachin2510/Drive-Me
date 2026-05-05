import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../utils/api";
import "./google-places-autocomplete.css";

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter location",
  country = null,
  inputClassName = "",
  error = false,
  disabled = false,
  icon = null,
  name = "",
}) {
  const [inputValue, setInputValue] = useState(value || "");
  const [predictions, setPredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sessionToken, setSessionToken] = useState(() =>
    generateSessionToken(),
  );

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Generate a random session token for billing optimization
  function generateSessionToken() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search function
  const searchPlaces = useCallback(
    async (query) => {
      if (!query || query.length < 2) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          query,
          sessionToken,
        });

        if (country) {
          params.append("country", country);
        }

        const response = await api.get(
          `/location/places/autocomplete?${params.toString()}`,
        );

        if (response.data.success) {
          setPredictions(response.data.predictions || []);
          setIsOpen(true);
          setSelectedIndex(-1);
        } else {
          setPredictions([]);
        }
      } catch (error) {
        console.error("Error searching places:", error);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    },
    [country, sessionToken],
  );

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Call onChange to update parent state
    if (onChange) {
      onChange(newValue);
    }

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(newValue);
    }, 300);
  };

  // Handle place selection
  const handleSelectPlace = async (prediction) => {
    setInputValue(prediction.description);
    setPredictions([]);
    setIsOpen(false);
    setSelectedIndex(-1);

    // Call onChange with the description
    if (onChange) {
      onChange(prediction.description);
    }

    // Fetch place details if callback provided
    if (onPlaceSelect) {
      try {
        const response = await api.get(
          `/location/places/details/${prediction.placeId}?sessionToken=${sessionToken}`,
        );

        if (response.data.success) {
          onPlaceSelect({
            ...prediction,
            ...response.data.place,
          });
        } else {
          onPlaceSelect(prediction);
        }
      } catch (error) {
        console.error("Error getting place details:", error);
        onPlaceSelect(prediction);
      }
    }

    // Generate new session token for next search
    setSessionToken(generateSessionToken());
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || predictions.length === 0) {
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : predictions.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handleSelectPlace(predictions[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (predictions.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="gpa-container" ref={containerRef}>
      <div className="gpa-input-wrapper">
        {icon && <span className="gpa-input-icon">{icon}</span>}
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`gpa-input ${icon ? "gpa-input-with-icon" : ""} ${error ? "gpa-input-error" : ""} ${inputClassName}`}
          autoComplete="off"
        />
        {loading && (
          <span className="gpa-loading-spinner">
            <svg className="gpa-spinner" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray="31.4 31.4"
              />
            </svg>
          </span>
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <ul className="gpa-dropdown">
          {predictions.map((prediction, index) => (
            <li
              key={prediction.placeId}
              className={`gpa-dropdown-item ${index === selectedIndex ? "gpa-dropdown-item-selected" : ""}`}
              onClick={() => handleSelectPlace(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="gpa-place-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2C7.6 2 4 5.6 4 10c0 5.9 8 13 8 13s8-7.1 8-13c0-4.4-3.6-8-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div className="gpa-place-text">
                <span className="gpa-place-main">{prediction.mainText}</span>
                {prediction.secondaryText && (
                  <span className="gpa-place-secondary">
                    {prediction.secondaryText}
                  </span>
                )}
              </div>
            </li>
          ))}
          <li className="gpa-powered-by">
            <svg className="gpa-google-logo" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Powered by Google</span>
          </li>
        </ul>
      )}
    </div>
  );
}
