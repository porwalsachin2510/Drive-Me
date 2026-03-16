"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CommuteSearchForm from "../../../Components/CommutersSearchForm/Commute-search-form";
import FeaturedRoutes from "../../../Components/FeaturedRoutes/FeaturedRoutes";
import AvailableSection from "../../../Components/AvailableSection/AvailableSection";
import RouteRequest from "../../../Components/RouteRequest/RouteRequest";
import CampaignBanner from "../../../Components/CampaignBanner/CampaignBanner";
import { useNavigate } from "react-router-dom";
import {
  isServiceAvailable,
  getDisplayCountry,
} from "../../../utils/helperutility";
import "./commuterhomepage.css";
// import { selectUserRole } from "../../Redux/selectors/authSelectors";

// import { useSelector } from "react-redux";

import api from "../../../utils/api";

export default function CommuterHomePage() {
  //   const userRole = useSelector(selectUserRole);

  //   if (userRole === "CORPORATE") {
  //     navigate("/corporate");
  //   }
  //   const [activeTab, setActiveTab] = useState("commuters");
  //   const [corporateStep, setCorporateStep] = useState("choose"); // "choose" or specific service
  //   const [selectedService, setSelectedService] = useState(null); // "passenger", "goods", "managed"
  //   const [errors, setErrors] = useState({});

  // START: NEW STATE FOR ROUTES AND LOADING
  const [firstloadroutes, setFirstLoadRoutes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({});
  // const [queryparam, setQueryParam] = useState();
  // const [userType, setUserType] = useState(null);
  // const [companyName, setCompanyName] = useState(null);
  const [currentFilterType, setCurrentFilterType] = useState("all");
  // END: NEW STATE FOR ROUTES AND LOADING

  const [userNationality, setUserNationality] = useState(null);
  const [showRouteRequest, setShowRouteRequest] = useState(false);

  const navigate = useNavigate();
  const hasDetectedRef = useRef(false);

  const availableSectionRef = useRef(null);

  useEffect(() => {
    const detectUserLocation = async () => {
      // Prevent duplicate execution (StrictMode safe)
      if (hasDetectedRef.current) return;

      try {
        const response = await api.get("/location/detect", {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        });

        if (response.data.success) {
          const countryName = response.data.nationality;

          let nationality = countryName;

          if (countryName === "Kuwait") {
            nationality = "Kuwait";
          } else if (countryName === "United Arab Emirates") {
            nationality = "UAE";
          }

          setUserNationality(nationality);
          hasDetectedRef.current = true;
        }
      } catch (error) {
        console.error("Error detecting location:", error);
        // Default to Kuwait if error occurs so routes still load
        setUserNationality("Kuwait");
        hasDetectedRef.current = true;
      }
    };

    detectUserLocation();
  }, []);

  //   const [formData, setFormData] = useState({
  //     // Commuters
  //     pickupLocation: "",
  //     dropoffLocation: "",
  //     workCategory: "Select Category",
  //     tripType: "Round Trip",
  //     startDate: "",
  //     shiftType: "Full Day",
  //     pickupTime: "",

  //     // Corporate - Passenger Vehicles
  //     vehicleType: "Any Type",
  //     minSeats: "",
  //     workingDays: "Select",
  //     workCategory2: "Select Category",
  //     startDate2: "",
  //     monthlyBudget: "Flexible",

  //     // Corporate - Goods Carrier
  //     vehicleType2: "Any Type",
  //     capacity: "",
  //     startDate3: "",
  //     monthlyBudget2: "Flexible",

  //     // Corporate - Managed Services
  //     vehicleType3: "Any Type",
  //     minSeats2: "",
  //     workingDays2: "Select",
  //     workCategory3: "Select Category",
  //     startDate4: "",
  //     monthlyBudget3: "Flexible",

  //     // Rental Preferences & Special Requirements
  //     rentalPreference: "with-driver",
  //     specialRequirements: [],
  //   });

  const fetchRoutes = useCallback(
    async (params = {}) => {
      try {
        if (!userNationality) {
          return;
        }

        setLoading(true);

        // Check if user has a valid auth token
        const token =
          localStorage.getItem("token") ||
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("token="))
            ?.split("=")[1];

        const queryParams = new URLSearchParams();
        if (params.pickupLocation)
          queryParams.append("pickupLocation", params.pickupLocation);
        if (params.dropoffLocation)
          queryParams.append("dropoffLocation", params.dropoffLocation);
        if (params.filterType)
          queryParams.append("filterType", params.filterType);
        if (params.workCategory)
          queryParams.append("workCategory", params.workCategory);
        if (params.tripType) queryParams.append("tripType", params.tripType);
        if (params.startDate) queryParams.append("startDate", params.startDate);
        if (params.selectedDays)
          queryParams.append(
            "selectedDays",
            JSON.stringify(params.selectedDays)
          );
        if (userNationality) {
          queryParams.append("nationality", userNationality);
        }

        // Use public search if not authenticated, otherwise use authenticated search
        const endpoint = token
          ? `/commute/search?${queryParams.toString()}`
          : `/commute/public-search?${queryParams.toString()}`;

        const response = await api.get(endpoint, {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        });

        if (response.data.success) {
          if (params.filterType === "matched") {
            setRoutes(response.data.routes);
          } else {
            setFirstLoadRoutes(response.data.routes);
          }
        }
      } catch (error) {
        console.error("Error fetching routes:", error);

        if (error.response?.status === 401) {
          // Token expired or invalid - try public search as fallback
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation) queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation) queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType) queryParams.append("filterType", params.filterType);
            if (params.selectedDays) queryParams.append("selectedDays", JSON.stringify(params.selectedDays));
            if (userNationality) queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(`/commute/public-search?${queryParams.toString()}`);
            if (fallbackResponse.data.success) {
              if (params.filterType === "matched") {
                setRoutes(fallbackResponse.data.routes);
              } else {
                setFirstLoadRoutes(fallbackResponse.data.routes);
              }
            }
          } catch (fallbackError) {
            console.error("Public search fallback also failed:", fallbackError);
          }
        } else if (error.response?.status === 403) {
          // Try public search for non-commuter users
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation) queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation) queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType) queryParams.append("filterType", params.filterType);
            if (userNationality) queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(`/commute/public-search?${queryParams.toString()}`);
            if (fallbackResponse.data.success) {
              if (params.filterType === "matched") {
                setRoutes(fallbackResponse.data.routes);
              } else {
                setFirstLoadRoutes(fallbackResponse.data.routes);
              }
            }
          } catch (fallbackError) {
            console.error("Public search fallback also failed:", fallbackError);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [userNationality]
  );

  useEffect(() => {
    if (userNationality) {
      fetchRoutes({ filterType: "all" });
      setCurrentFilterType("all");
    }
  }, [fetchRoutes, userNationality]);

  const handleSearch = (searchData) => {
    setSearchParams(searchData);
    setCurrentFilterType("matched");

    fetchRoutes({
      ...searchData,
      filterType: "matched",
    });

    setTimeout(() => {
      if (availableSectionRef.current) {
        availableSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 300);
  };

  const handleFilterChange = (filterData) => {
    // If clicking "matched" without search params, just update UI state
    if (
      filterData.filterType === "matched" &&
      !searchParams.pickupLocation &&
      !searchParams.dropoffLocation
    ) {
      setCurrentFilterType("matched");
      return;
    }

    setCurrentFilterType(filterData.filterType);

    let params;
    if (filterData.filterType === "all") {
      // For "all" routes: fetch without search location filters
      params = {
        filterType: "all",
        selectedFilter: filterData.selectedFilter || "All",
      };
    } else {
      // For "matched" routes: include search params
      params = {
        ...searchParams,
        ...filterData,
      };
    }

    fetchRoutes(params);
  };

  const featuredRoutes = firstloadroutes.slice(0, 6);

  // eslint-disable-next-line no-unused-vars
  const goToSearchFleetPage = () => {
    navigate("/search-fleet", {
      state: { username: "Sachin", age: 22 }, // sending data
    });
  };

  //   const validateCorporateForm = () => {
  //     const newErrors = {};

  //     if (selectedService === "passenger") {
  //       if (formData.vehicleType === "Any Type")
  //         newErrors.vehicleType = "Please select a vehicle type";
  //       if (!formData.minSeats) newErrors.minSeats = "Min seats is required";
  //       if (formData.workingDays === "Select")
  //         newErrors.workingDays = "Please select working days";
  //       if (!formData.startDate2) newErrors.startDate2 = "Date is required";
  //     } else if (selectedService === "goods") {
  //       if (formData.vehicleType2 === "Any Type")
  //         newErrors.vehicleType2 = "Please select a vehicle type";
  //       if (!formData.capacity) newErrors.capacity = "Capacity is required";
  //       if (!formData.startDate3) newErrors.startDate3 = "Date is required";
  //     } else if (selectedService === "managed") {
  //       if (formData.vehicleType3 === "Any Type")
  //         newErrors.vehicleType3 = "Please select a vehicle type";
  //       if (!formData.minSeats2) newErrors.minSeats2 = "Min seats is required";
  //       if (formData.workingDays2 === "Select")
  //         newErrors.workingDays2 = "Please select working days";
  //       if (!formData.startDate4) newErrors.startDate4 = "Date is required";
  //     }

  //     setErrors(newErrors);
  //     return Object.keys(newErrors).length === 0;
  //   };

  //   const handleInputChange = (e) => {
  //     const { name, value } = e.target;
  //     setFormData((prev) => ({ ...prev, [name]: value }));
  //     if (errors[name]) {
  //       setErrors((prev) => ({ ...prev, [name]: "" }));
  //     }
  //   };

  //   const handleSelectChange = (e) => {
  //     const { name, value } = e.target;
  //     setFormData((prev) => ({ ...prev, [name]: value }));
  //     if (errors[name]) {
  //       setErrors((prev) => ({ ...prev, [name]: "" }));
  //     }
  //   };

  //   const toggleSpecialRequirement = (req) => {
  //     setFormData((prev) => ({
  //       ...prev,
  //       specialRequirements: prev.specialRequirements.includes(req)
  //         ? prev.specialRequirements.filter((r) => r !== req)
  //         : [...prev.specialRequirements, req],
  //     }));
  //   };

  //   const handleSearchFleet = (e) => {
  //     e.preventDefault();
  //     if (validateCorporateForm()) {
  //       const selectedServiceLabel =
  //         selectedService === "passenger"
  //           ? "Passenger Vehicles"
  //           : selectedService === "goods"
  //           ? "Goods Carrier"
  //           : "Managed Services";
  //       alert(`${selectedServiceLabel} form is valid! Searching fleet...`);
  //     }
  //   };

  // ============ COMMUTERS VIEW ============

  return (
    <div className="homepage">
      <div className="commuters-container">
        <div className="page-title">
          <h1>Smart Mobility, Made for the GCC</h1>
          <p>
            Connect with fellow commuters or professional transportation
            services for <br />a stress-free journey.
          </p>
          {userNationality && (
            <>
              {isServiceAvailable(userNationality) ? (
                <p className="location-indicator available">
                  📍 Showing routes for:{" "}
                  <strong>{getDisplayCountry(userNationality)}</strong>
                </p>
              ) : (
                <div className="location-indicator unavailable">
                  🚫 Our service is currently not available in{" "}
                  <span className="country-highlight">{userNationality}</span>.
                  <p className="expansion-text">
                    We are expanding soon to more countries.
                  </p>
                  <button
                    className="notify-btn"
                    onClick={() => setShowRouteRequest(true)}
                  >
                    Request This Route
                  </button>
                </div>
              )}
            </>
          )}

          {userNationality === null && (
            <p className="location-indicator available">
              📍
              <strong>Location Not Found</strong>
            </p>
          )}
        </div>

        <CommuteSearchForm onSearch={handleSearch} onRequestRoute={() => setShowRouteRequest(true)} />

        {/* Campaign Banner - Active advertisements */}
        <CampaignBanner placement="banner" />

        <FeaturedRoutes routes={featuredRoutes} loading={loading} />

        <div ref={availableSectionRef}>
          <AvailableSection
            routes={currentFilterType === "matched" ? routes : firstloadroutes}
            loading={loading}
            onFilterChange={handleFilterChange}
            searchParams={searchParams}
            currentFilterType={currentFilterType}
          />
        </div>
      </div>

      <RouteRequest
        isOpen={showRouteRequest}
        onClose={() => setShowRouteRequest(false)}
        searchParams={searchParams}
        onRequestSubmitted={() => {
          // Refresh routes or show success message
          console.log('Route request submitted');
        }}
      />
    </div>
  );
}
