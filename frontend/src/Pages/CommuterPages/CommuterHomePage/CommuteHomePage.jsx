// "use client";

// import { useState, useEffect, useRef, useCallback } from "react";
// import CommuteSearchForm from "../../../Components/CommutersSearchForm/Commute-search-form";
// import FeaturedRoutes from "../../../Components/FeaturedRoutes/FeaturedRoutes";
// import AvailableSection from "../../../Components/AvailableSection/AvailableSection";
// import RouteRequest from "../../../Components/RouteRequest/RouteRequest";
// import Navbar from "../../../Components/Navbar/Navbar";
// import CampaignBanner from "../../../Components/CampaignBanner/CampaignBanner";
// import { useNavigate } from "react-router-dom";
// import {
//   isServiceAvailable,
//   getDisplayCountry,
// } from "../../../utils/helperutility";
// import "./commuterhomepage.css";

// import api from "../../../utils/api";

// export default function CommuterHomePage() {
//   const [firstloadroutes, setFirstLoadRoutes] = useState([]);
//   const [routes, setRoutes] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [searchParams, setSearchParams] = useState({});

//   const [currentFilterType, setCurrentFilterType] = useState("all");

//   const [userNationality, setUserNationality] = useState(null);
//   const [showRouteRequest, setShowRouteRequest] = useState(false);

//   const [activeTab, setActiveTab] = useState(() => {
//     return localStorage.getItem("activeTab") || "commuters";
//   });

//   // Update localStorage when activeTab changes
//   useEffect(() => {
//     localStorage.setItem("activeTab", activeTab);
//   }, [activeTab]);
  
//   const navigate = useNavigate();
//   const hasDetectedRef = useRef(false);

//   const availableSectionRef = useRef(null);

//   useEffect(() => {
//     const detectUserLocation = async () => {
//       if (hasDetectedRef.current) return;

//       try {
//         const response = await api.get("/location/detect", {
//           withCredentials: true,
//           headers: { "Content-Type": "application/json" },
//         });

//         if (response.data.success) {
//           const countryName = response.data.nationality;

//           let nationality = countryName;

//           if (countryName === "Kuwait") {
//             nationality = "Kuwait";
//           } else if (countryName === "United Arab Emirates") {
//             nationality = "UAE";
//           }

//           setUserNationality(nationality);
//           hasDetectedRef.current = true;
//         }
//       } catch (error) {
//         console.error("Error detecting location:", error);
//         setUserNationality("Kuwait");
//         hasDetectedRef.current = true;
//       }
//     };

//     detectUserLocation();
//   }, []);

//   const fetchRoutes = useCallback(
//     async (params = {}) => {
//       try {
//         if (!userNationality) {
//           return;
//         }

//         setLoading(true);

//         const token =
//           localStorage.getItem("token") ||
//           document.cookie
//             .split("; ")
//             .find((row) => row.startsWith("token="))
//             ?.split("=")[1];

//         const queryParams = new URLSearchParams();
//         if (params.pickupLocation)
//           queryParams.append("pickupLocation", params.pickupLocation);
//         if (params.dropoffLocation)
//           queryParams.append("dropoffLocation", params.dropoffLocation);
//         if (params.filterType)
//           queryParams.append("filterType", params.filterType);
//         if (params.workCategory)
//           queryParams.append("workCategory", params.workCategory);
//         if (params.tripType) queryParams.append("tripType", params.tripType);
//         if (params.startDate) queryParams.append("startDate", params.startDate);
//         if (params.selectedDays)
//           queryParams.append(
//             "selectedDays",
//             JSON.stringify(params.selectedDays),
//           );
//         if (userNationality) {
//           queryParams.append("nationality", userNationality);
//         }

//         const endpoint = token
//           ? `/commute/search?${queryParams.toString()}`
//           : `/commute/public-search?${queryParams.toString()}`;

//         const response = await api.get(endpoint, {
//           withCredentials: true,
//           headers: { "Content-Type": "application/json" },
//         });

//         if (response.data.success) {
//           if (params.filterType === "matched") {
//             setRoutes(response.data.routes);
//           } else {
//             setFirstLoadRoutes(response.data.routes);
//           }
//         }
//       } catch (error) {
//         console.error("Error fetching routes:", error);

//         if (error.response?.status === 401) {
//           try {
//             const queryParams = new URLSearchParams();
//             if (params.pickupLocation)
//               queryParams.append("pickupLocation", params.pickupLocation);
//             if (params.dropoffLocation)
//               queryParams.append("dropoffLocation", params.dropoffLocation);
//             if (params.filterType)
//               queryParams.append("filterType", params.filterType);
//             if (params.selectedDays)
//               queryParams.append(
//                 "selectedDays",
//                 JSON.stringify(params.selectedDays),
//               );
//             if (userNationality)
//               queryParams.append("nationality", userNationality);

//             const fallbackResponse = await api.get(
//               `/commute/public-search?${queryParams.toString()}`,
//             );
//             if (fallbackResponse.data.success) {
//               if (params.filterType === "matched") {
//                 setRoutes(fallbackResponse.data.routes);
//               } else {
//                 setFirstLoadRoutes(fallbackResponse.data.routes);
//               }
//             }
//           } catch (fallbackError) {
//             console.error("Public search fallback also failed:", fallbackError);
//           }
//         } else if (error.response?.status === 403) {
//           try {
//             const queryParams = new URLSearchParams();
//             if (params.pickupLocation)
//               queryParams.append("pickupLocation", params.pickupLocation);
//             if (params.dropoffLocation)
//               queryParams.append("dropoffLocation", params.dropoffLocation);
//             if (params.filterType)
//               queryParams.append("filterType", params.filterType);
//             if (userNationality)
//               queryParams.append("nationality", userNationality);

//             const fallbackResponse = await api.get(
//               `/commute/public-search?${queryParams.toString()}`,
//             );
//             if (fallbackResponse.data.success) {
//               if (params.filterType === "matched") {
//                 setRoutes(fallbackResponse.data.routes);
//               } else {
//                 setFirstLoadRoutes(fallbackResponse.data.routes);
//               }
//             }
//           } catch (fallbackError) {
//             console.error("Public search fallback also failed:", fallbackError);
//           }
//         }
//       } finally {
//         setLoading(false);
//       }
//     },
//     [userNationality],
//   );

//   useEffect(() => {
//     if (userNationality) {
//       fetchRoutes({ filterType: "all" });
//       setCurrentFilterType("all");
//     }
//   }, [fetchRoutes, userNationality]);

//   const handleSearch = (searchData) => {
//     setSearchParams(searchData);
//     setCurrentFilterType("matched");

//     fetchRoutes({
//       ...searchData,
//       filterType: "matched",
//     });

//     setTimeout(() => {
//       if (availableSectionRef.current) {
//         availableSectionRef.current.scrollIntoView({
//           behavior: "smooth",
//           block: "start",
//         });
//       }
//     }, 300);
//   };

//   const handleFilterChange = (filterData) => {
//     if (
//       filterData.filterType === "matched" &&
//       !searchParams.pickupLocation &&
//       !searchParams.dropoffLocation
//     ) {
//       setCurrentFilterType("matched");
//       return;
//     }

//     setCurrentFilterType(filterData.filterType);

//     let params;
//     if (filterData.filterType === "all") {
//       params = {
//         filterType: "all",
//         selectedFilter: filterData.selectedFilter || "All",
//       };
//     } else {
//       params = {
//         ...searchParams,
//         ...filterData,
//       };
//     }

//     fetchRoutes(params);
//   };

//   const featuredRoutes = firstloadroutes.slice(0, 6);

//   // eslint-disable-next-line no-unused-vars
//   const goToSearchFleetPage = () => {
//     navigate("/search-fleet", {
//       state: { username: "Sachin", age: 22 }, // sending data
//     });
//   };

//   // ============ COMMUTERS VIEW ============

//   return (
//     <div>
//       <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
//       <div className="commuterhomepage-homepage">
//         <div className="commuterhomepage-commuters-container">
//           <div className="commuterhomepage-page-title">
//             <h1>We Are Drive Me Go.</h1>
//             <p>
//               We have the power to move the future not simply by getting from
//               one place to another, but by opening
//               <br />
//               new possibilities Drive Me Go gives you the freedom to go
//               anywhere.
//             </p>
//             {userNationality && (
//               <>
//                 {isServiceAvailable(userNationality) ? (
//                   <p className="commuterhomepage-location-indicator commuterhomepage-available">
//                     📍 Showing routes for:{" "}
//                     <strong>{getDisplayCountry(userNationality)}</strong>
//                   </p>
//                 ) : (
//                   <div className="commuterhomepage-location-indicator commuterhomepage-unavailable">
//                     🚫 Our service is currently not available in{" "}
//                     <span className="commuterhomepage-country-highlight">
//                       {userNationality}
//                     </span>
//                     .
//                     <p className="commuterhomepage-expansion-text">
//                       We are expanding soon to more countries.
//                     </p>
//                     <button
//                       className="commuterhomepage-notify-btn"
//                       onClick={() => setShowRouteRequest(true)}
//                     >
//                       Request This Route
//                     </button>
//                   </div>
//                 )}
//               </>
//             )}

//             {userNationality === null && (
//               <p className="commuterhomepage-location-indicator commuterhomepage-available">
//                 📍
//                 <strong>Location Not Found</strong>
//               </p>
//             )}
//           </div>

//           <CommuteSearchForm
//             onSearch={handleSearch}
//             onRequestRoute={() => setShowRouteRequest(true)}
//           />

//           {/* Campaign Banner - Top Banner (matches Admin placement: "top") */}
//           <CampaignBanner placement="top" />

//           <FeaturedRoutes routes={featuredRoutes} loading={loading} />

//           <div
//             ref={availableSectionRef}
//             className="commuterhomepage-available-section-wrapper"
//           >
//             {/* Sidebar Campaign Banner */}
//             <CampaignBanner placement="sidebar" />
//             <AvailableSection
//               routes={
//                 currentFilterType === "matched" ? routes : firstloadroutes
//               }
//               loading={loading}
//               onFilterChange={handleFilterChange}
//               searchParams={searchParams}
//               currentFilterType={currentFilterType}
//             />
//           </div>

//           {/* Footer Campaign Banner */}
//           <CampaignBanner placement="footer" />

//           {/* Popup Campaign Banner */}
//           <CampaignBanner placement="popup" />
//         </div>

//         <RouteRequest
//           isOpen={showRouteRequest}
//           onClose={() => setShowRouteRequest(false)}
//           searchParams={searchParams}
//           onRequestSubmitted={() => {
//             // Refresh routes or show success message
//             console.log("Route request submitted");
//           }}
//         />
//       </div>
//     </div>
//   );
// }

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CommuteSearchForm from "../../../Components/CommutersSearchForm/Commute-search-form";
import FeaturedRoutes from "../../../Components/FeaturedRoutes/FeaturedRoutes";
import AvailableSection from "../../../Components/AvailableSection/AvailableSection";
import RouteRequest from "../../../Components/RouteRequest/RouteRequest";
import Navbar from "../../../Components/Navbar/Navbar";
import CampaignBanner from "../../../Components/CampaignBanner/CampaignBanner";
import { useNavigate } from "react-router-dom";
import {
  isServiceAvailable,
  getDisplayCountry,
} from "../../../utils/helperutility";
import "./commuterhomepage.css";

import api from "../../../utils/api";

export default function CommuterHomePage() {
  const [firstloadroutes, setFirstLoadRoutes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({});

  const [currentFilterType, setCurrentFilterType] = useState("all");

  const [userNationality, setUserNationality] = useState(null);
  const [showRouteRequest, setShowRouteRequest] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  // Update localStorage when activeTab changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  const navigate = useNavigate();
  const hasDetectedRef = useRef(false);

  const availableSectionRef = useRef(null);

  useEffect(() => {
    const detectUserLocation = async () => {
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
        setUserNationality("Kuwait");
        hasDetectedRef.current = true;
      }
    };

    detectUserLocation();
  }, []);

  const fetchRoutes = useCallback(
    async (params = {}) => {
      try {
        if (!userNationality) {
          return;
        }

        setLoading(true);

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
            JSON.stringify(params.selectedDays),
          );
        if (userNationality) {
          queryParams.append("nationality", userNationality);
        }

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
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation)
              queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation)
              queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType)
              queryParams.append("filterType", params.filterType);
            if (params.selectedDays)
              queryParams.append(
                "selectedDays",
                JSON.stringify(params.selectedDays),
              );
            if (userNationality)
              queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(
              `/commute/public-search?${queryParams.toString()}`,
            );
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
          try {
            const queryParams = new URLSearchParams();
            if (params.pickupLocation)
              queryParams.append("pickupLocation", params.pickupLocation);
            if (params.dropoffLocation)
              queryParams.append("dropoffLocation", params.dropoffLocation);
            if (params.filterType)
              queryParams.append("filterType", params.filterType);
            if (userNationality)
              queryParams.append("nationality", userNationality);

            const fallbackResponse = await api.get(
              `/commute/public-search?${queryParams.toString()}`,
            );
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
    [userNationality],
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
      params = {
        filterType: "all",
        selectedFilter: filterData.selectedFilter || "All",
      };
    } else {
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

  // ============ COMMUTERS VIEW ============

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="commuterhomepage-homepage">
        <div className="commuterhomepage-commuters-container">
          <div className="commuterhomepage-page-title">
            <h1>We Are Drive Me Go.</h1>
            <p>
              We have the power to move the future not simply by getting from
              one place to another, but by opening
              <br />
              new possibilities Drive Me Go gives you the freedom to go
              anywhere.
            </p>
            {userNationality && (
              <>
                {isServiceAvailable(userNationality) ? (
                  <p className="commuterhomepage-location-indicator commuterhomepage-available">
                    📍 Showing routes for:{" "}
                    <strong>{getDisplayCountry(userNationality)}</strong>
                  </p>
                ) : (
                  <div className="commuterhomepage-location-indicator commuterhomepage-unavailable">
                    🚫 Our service is currently not available in{" "}
                    <span className="commuterhomepage-country-highlight">
                      {userNationality}
                    </span>
                    .
                    <p className="commuterhomepage-expansion-text">
                      We are expanding soon to more countries.
                    </p>
                    <button
                      className="commuterhomepage-notify-btn"
                      onClick={() => setShowRouteRequest(true)}
                    >
                      Request This Route
                    </button>
                  </div>
                )}
              </>
            )}

            {userNationality === null && (
              <p className="commuterhomepage-location-indicator commuterhomepage-available">
                📍
                <strong>Location Not Found</strong>
              </p>
            )}
          </div>

          <CommuteSearchForm
            onSearch={handleSearch}
            onRequestRoute={() => setShowRouteRequest(true)}
            userCountry={userNationality}
          />

          {/* Campaign Banner - Top Banner (matches Admin placement: "top") */}
          <CampaignBanner placement="top" />

          <FeaturedRoutes routes={featuredRoutes} loading={loading} />

          <div
            ref={availableSectionRef}
            className="commuterhomepage-available-section-wrapper"
          >
            {/* Sidebar Campaign Banner */}
            <CampaignBanner placement="sidebar" />
            <AvailableSection
              routes={
                currentFilterType === "matched" ? routes : firstloadroutes
              }
              loading={loading}
              onFilterChange={handleFilterChange}
              searchParams={searchParams}
              currentFilterType={currentFilterType}
            />
          </div>

          {/* Footer Campaign Banner */}
          <CampaignBanner placement="footer" />

          {/* Popup Campaign Banner */}
          <CampaignBanner placement="popup" />
        </div>

        <RouteRequest
          isOpen={showRouteRequest}
          onClose={() => setShowRouteRequest(false)}
          searchParams={searchParams}
          userCountry={userNationality}
          onRequestSubmitted={() => {
            // Refresh routes or show success message
            console.log("Route request submitted");
          }}
        />
      </div>
    </div>
  );
}
