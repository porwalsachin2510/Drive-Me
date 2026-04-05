/* eslint-disable no-unused-vars */
// "use client";

// import { useState, useEffect } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import { useNavigate } from "react-router-dom";
// import {
//   fetchFleetQuotations,
//   respondToQuotation,
// } from "../../../Redux/slices/quotationSlice";
// import LoadingSpinner from "../../LoadingSpinner/LoadingSpinner";
// import QuotationDetailsModal from "../QuotationDetailsModal/QuotationDetailsModal";
// import QuotationResponseModal from "../QuotationResponseModal/QuotationResponseModal";
// import "./B2B_Quotation.css";

// const B2B_Quotation = () => {
//   const dispatch = useDispatch();
//   // eslint-disable-next-line no-unused-vars
//   const navigate = useNavigate();
//   // eslint-disable-next-line no-unused-vars
//   const { quotations, loading, error } = useSelector(
//     (state) => state.quotation
//   );
//   const [filter, setFilter] = useState("all");
//   const [selectedQuotation, setSelectedQuotation] = useState(null);
//   const [respondModal, setRespondModal] = useState(null);
//   const [responseData, setResponseData] = useState([]);

//   useEffect(() => {
//     dispatch(fetchFleetQuotations());
//   }, [dispatch]);

//   const mapStatus = (status) => {
//     const statusMap = {
//       REQUESTED: "pending",
//       QUOTED: "quoted",
//       REJECTED: "rejected",
//       ACCEPTED: "accepted",
//       NEGOTIATING: "negotiating",
//       EXPIRED: "expired",
//     };
//     return statusMap[status] || status.toLowerCase();
//   };

//   const filteredQuotations =
//     quotations?.filter((q) => {
//       if (filter === "all") return true;
//       return mapStatus(q.status) === filter;
//     }) || [];

//   const stats = {
//     total: quotations?.length || 0,
//     pending: quotations?.filter((q) => q.status === "REQUESTED").length || 0,
//     quoted: quotations?.filter((q) => q.status === "QUOTED").length || 0,
//     rejected: quotations?.filter((q) => q.status === "REJECTED").length || 0,
//   };

//   const handleViewDetails = (quotation) => {
//     setSelectedQuotation(quotation);
//   };

//   const handleRespondClick = (quotation) => {
//     setRespondModal(quotation);

//     const calculateRentalDays = () => {
//       const startDate = quotation.rentalPeriod?.startDate;
//       const endDate = quotation.rentalPeriod?.endDate;

//       if (!startDate || !endDate) {
//         // Fallback to duration-based calculation if dates are missing
//         const duration = Number(quotation.rentalPeriod?.duration) || 1;
//         const durationType = quotation.rentalPeriod?.durationType;

//         if (durationType === "DAILY") {
//           return duration;
//         } else if (durationType === "WEEKLY") {
//           return duration * 7;
//         } else if (durationType === "MONTHLY") {
//           return duration * 30;
//         }
//         return duration;
//       }

//       // Calculate actual days between start and end dates
//       const start = new Date(startDate);
//       const end = new Date(endDate);
//       const diffTime = Math.abs(end - start);
//       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

//       return diffDays;
//     };

//     const rentalDays = calculateRentalDays();

//     // Get requirements from quotation
//     const withDriver = quotation.requirements?.withDriver || false;
//     const fuelIncluded = quotation.requirements?.fuelIncluded || false;

//     const vehiclesData = quotation.vehicles.map((vehicle) => {
//       const quantity = Number(vehicle.quantity) || 1;
//       const pricing = vehicle.vehicleId?.pricing || {};

//       // Get base rates from vehicle pricing
//       const dailyRate = Number(pricing.dailyRate) || 0;
//       const weeklyRate = Number(pricing.weeklyRate) || 0;
//       const monthlyRate = Number(pricing.monthlyRate) || 0;
//       const driverCharges = Number(pricing.driverCharges) || 0;
//       const fuelCharges = Number(pricing.fuelCharges) || 0;

//       // Determine which base rate to use based on durationType
//       let baseRatePerDay = dailyRate;
//       if (quotation.rentalPeriod?.durationType === "WEEKLY") {
//         baseRatePerDay = weeklyRate / 7;
//       } else if (quotation.rentalPeriod?.durationType === "MONTHLY") {
//         baseRatePerDay = monthlyRate / 30;
//       }

//       return {
//         vehicleId: vehicle.vehicleId?._id || vehicle.vehicleId,
//         vehicleName: vehicle.vehicleId?.vehicleName || "Unknown Vehicle",
//         quantity: quantity,
//         rentalDays: rentalDays,
//         withDriver:
//           vehicle.withDriver !== undefined ? vehicle.withDriver : withDriver,
//         withFuel:
//           vehicle.withFuel !== undefined ? vehicle.withFuel : fuelIncluded,
//         // Standard rates from database
//         baseRatePerDay: baseRatePerDay,
//         driverChargesPerDay: driverCharges,
//         fuelChargesPerDay: fuelCharges,
//         // Custom rates (editable by user)
//         customBaseRatePerDay: baseRatePerDay,
//         customDriverChargesPerDay:
//           withDriver || vehicle.withDriver ? driverCharges : 0,
//         customFuelChargesPerDay:
//           fuelIncluded || vehicle.withFuel ? fuelCharges : 0,
//       };
//     });

//     setResponseData(vehiclesData);
//   };

//   const handleSubmitResponse = async (quotationId, approvalData) => {
//     console.log("handleSubmitResponse called with:", {
//       quotationId,
//       approvalData,
//     });

//     const result = await dispatch(
//       respondToQuotation({
//         quotationId,
//         ...approvalData,
//       })
//     );

//     console.log("Dispatch result:", result);

//     if (result.type === "quotation/respondToQuotation/fulfilled") {
//       alert("Quotation response submitted successfully");
//       setRespondModal(null);
//       setResponseData([]);
//       dispatch(fetchFleetQuotations());
//     } else {
//       const errorMessage =
//         result.payload ||
//         result.error?.message ||
//         "Failed to respond to quotation";
//       console.error("Error submitting quotation:", errorMessage);
//       alert(`Error: ${errorMessage}`);
//     }
//   };

//   if (loading && !quotations) return <LoadingSpinner />;

//   return (
//     <div className="b2b-quotation-request-fleet-quotations-page">
//       <div className="b2b-quotation-request-fleet-quotations-container">
//         <div className="b2b-quotation-request-page-header">
//           <h1>Quotation Requests</h1>
//           <p className="b2b-quotation-request-page-subtitle">
//             Manage and respond to customer quotation requests
//           </p>
//         </div>

//         {/* Stats Grid */}
//         <div className="b2b-quotation-request-stats-grid">
//           <div className="b2b-quotation-request-stat-card b2b-quotation-request-total">
//             <div className="b2b-quotation-request-stat-icon">📊</div>
//             <div className="b2b-quotation-request-stat-content">
//               <h3>Total Requests</h3>
//               <p className="b2b-quotation-request-stat-value">{stats.total}</p>
//             </div>
//           </div>
//           <div className="b2b-quotation-request-stat-card b2b-quotation-request-pending">
//             <div className="b2b-quotation-request-stat-icon">⏳</div>
//             <div className="b2b-quotation-request-stat-content">
//               <h3>Pending</h3>
//               <p className="b2b-quotation-request-stat-value">
//                 {stats.pending}
//               </p>
//             </div>
//           </div>
//           <div className="b2b-quotation-request-stat-card b2b-quotation-request-quoted">
//             <div className="b2b-quotation-request-stat-icon">✅</div>
//             <div className="b2b-quotation-request-stat-content">
//               <h3>Quoted</h3>
//               <p className="b2b-quotation-request-stat-value">{stats.quoted}</p>
//             </div>
//           </div>
//           <div className="b2b-quotation-request-stat-card b2b-quotation-request-rejected">
//             <div className="b2b-quotation-request-stat-icon">❌</div>
//             <div className="b2b-quotation-request-stat-content">
//               <h3>Rejected</h3>
//               <p className="b2b-quotation-request-stat-value">
//                 {stats.rejected}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Filter Tabs */}
//         <div className="b2b-quotation-request-filter-tabs">
//           <button
//             className={filter === "all" ? "b2b-quotation-request-active" : ""}
//             onClick={() => setFilter("all")}
//           >
//             All Requests
//           </button>
//           <button
//             className={
//               filter === "pending" ? "b2b-quotation-request-active" : ""
//             }
//             onClick={() => setFilter("pending")}
//           >
//             Pending
//           </button>
//           <button
//             className={
//               filter === "quoted" ? "b2b-quotation-request-active" : ""
//             }
//             onClick={() => setFilter("quoted")}
//           >
//             Quoted
//           </button>
//           <button
//             className={
//               filter === "rejected" ? "b2b-quotation-request-active" : ""
//             }
//             onClick={() => setFilter("rejected")}
//           >
//             Rejected
//           </button>
//         </div>

//         {/* Quotations List */}
//         {filteredQuotations.length === 0 ? (
//           <div className="b2b-quotation-request-no-quotations">
//             <div className="b2b-quotation-request-no-quotations-icon">📋</div>
//             <h2>No Quotation Requests</h2>
//             <p>
//               {filter === "all"
//                 ? "Quotation requests from customers will appear here"
//                 : `No ${filter} quotation requests found`}
//             </p>
//           </div>
//         ) : (
//           <div className="b2b-quotation-request-quotations-list">
//             {filteredQuotations.map((quotation) => {
//               const mappedStatus = mapStatus(quotation.status);
//               const totalVehicles = quotation.vehicles.reduce(
//                 (sum, v) => sum + v.quantity,
//                 0,
//               );

//               return (
//                 <div
//                   key={quotation._id}
//                   className="b2b-quotation-request-quotation-card"
//                 >
//                   <div className="b2b-quotation-request-quotation-card-header">
//                     <div className="b2b-quotation-request-quotation-header-left">
//                       <h3 className="b2b-quotation-request-quotation-number">
//                         #{quotation.quotationNumber}
//                       </h3>
//                       <span
//                         className={`b2b-quotation-request-status-badge ${mappedStatus}`}
//                       >
//                         {mappedStatus}
//                       </span>
//                     </div>
//                     <div className="b2b-quotation-request-quotation-header-right">
//                       <p className="b2b-quotation-request-quotation-date">
//                         Requested on{" "}
//                         {new Date(quotation.requestedAt).toLocaleDateString(
//                           "en-US",
//                           {
//                             year: "numeric",
//                             month: "short",
//                             day: "numeric",
//                           },
//                         )}
//                       </p>
//                     </div>
//                   </div>

//                   <div className="b2b-quotation-request-quotation-card-body">
//                     <div className="b2b-quotation-request-info-row">
//                       <div className="b2b-quotation-request-info-section b2b-quotation-request-customer-info">
//                         <div className="b2b-quotation-request-info-header">
//                           <span className="b2b-quotation-request-info-icon">
//                             👤
//                           </span>
//                           <h4>Customer Details</h4>
//                         </div>
//                         <div className="b2b-quotation-request-info-content">
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Name:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.corporateOwnerId?.fullName || "N/A"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Company:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.corporateOwnerId?.companyName || "N/A"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Email:
//                             </span>
//                             <span className="b2b-quotation-request-value b2b-quotation-request-email">
//                               {quotation.corporateOwnerId?.email || "N/A"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               WhatsApp:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.corporateOwnerId?.whatsappNumber ||
//                                 "N/A"}
//                             </span>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="b2b-quotation-request-info-section b2b-quotation-request-rental-info">
//                         <div className="b2b-quotation-request-info-header">
//                           <span className="b2b-quotation-request-info-icon">
//                             📅
//                           </span>
//                           <h4>Rental Period</h4>
//                         </div>
//                         <div className="b2b-quotation-request-info-content">
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Duration Type:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.rentalPeriod?.durationType || "N/A"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Duration:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.rentalPeriod?.duration || "N/A"}{" "}
//                               {quotation.rentalPeriod?.durationType === "DAILY"
//                                 ? "Days"
//                                 : quotation.rentalPeriod?.durationType ===
//                                     "WEEKLY"
//                                   ? "Weeks"
//                                   : quotation.rentalPeriod?.durationType ===
//                                       "MONTHLY"
//                                     ? "Months"
//                                     : ""}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Start Date:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.rentalPeriod?.startDate
//                                 ? new Date(
//                                     quotation.rentalPeriod.startDate,
//                                   ).toLocaleDateString()
//                                 : "N/A"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               End Date:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.rentalPeriod?.endDate
//                                 ? new Date(
//                                     quotation.rentalPeriod.endDate,
//                                   ).toLocaleDateString()
//                                 : "N/A"}
//                             </span>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="b2b-quotation-request-info-section b2b-quotation-request-requirements-info">
//                         <div className="b2b-quotation-request-info-header">
//                           <span className="b2b-quotation-request-info-icon">
//                             🚗
//                           </span>
//                           <h4>Vehicle Requirements</h4>
//                         </div>
//                         <div className="b2b-quotation-request-info-content">
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Total Vehicles:
//                             </span>
//                             <span className="b2b-quotation-request-value highlight">
//                               {totalVehicles}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Vehicle Types:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.vehicles.length}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               With Driver:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.requirements?.withDriver
//                                 ? "✓ Yes"
//                                 : "✗ No"}
//                             </span>
//                           </div>
//                           <div className="b2b-quotation-request-info-item">
//                             <span className="b2b-quotation-request-label">
//                               Fuel Included:
//                             </span>
//                             <span className="b2b-quotation-request-value">
//                               {quotation.requirements?.fuelIncluded
//                                 ? "✓ Yes"
//                                 : "✗ No"}
//                             </span>
//                           </div>
//                         </div>
//                       </div>
//                     </div>

//                     {quotation.status === "QUOTED" &&
//                       quotation.quotedPrice?.totalAmount && (
//                         <div className="b2b-quotation-request-quoted-price-section">
//                           <div className="b2b-quotation-request-price-summary">
//                             <h4>Your Quotation</h4>
//                             <div className="b2b-quotation-request-total-price">
//                               <span>Total Amount:</span>
//                               <span className="b2b-quotation-request-amount">
//                                 KWD{" "}
//                                 {quotation.quotedPrice.totalAmount.toFixed(2)}
//                               </span>
//                             </div>
//                           </div>
//                           {quotation.responseMessage && (
//                             <div className="b2b-quotation-request-response-note">
//                               <strong>Note:</strong> {quotation.responseMessage}
//                             </div>
//                           )}
//                           {quotation.validUntil && (
//                             <div className="b2b-quotation-request-validity-note">
//                               <strong>Valid Until:</strong>{" "}
//                               {new Date(
//                                 quotation.validUntil,
//                               ).toLocaleDateString()}
//                             </div>
//                           )}
//                         </div>
//                       )}
//                   </div>

//                   <div className="b2b-quotation-request-quotation-card-footer">
//                     <button
//                       className="b2b-quotation-request-btn b2b-quotation-request-btn-primary"
//                       onClick={() => handleViewDetails(quotation)}
//                     >
//                       <span className="b2b-quotation-request-btn-icon">👁️</span>
//                       View Full Details
//                     </button>
//                     {quotation.status === "REQUESTED" && (
//                       <button
//                         className="b2b-quotation-request-btn b2b-quotation-request-btn-success"
//                         onClick={() => handleRespondClick(quotation)}
//                       >
//                         <span className="b2b-quotation-request-btn-icon">
//                           💼
//                         </span>
//                         Provide Quotation
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//         {selectedQuotation && (
//           <QuotationDetailsModal
//             quotation={selectedQuotation}
//             onClose={() => setSelectedQuotation(null)}
//           />
//         )}

//         {respondModal && (
//           <QuotationResponseModal
//             quotation={respondModal}
//             responseData={responseData}
//             setResponseData={setResponseData}
//             onClose={() => {
//               setRespondModal(null);
//               setResponseData([]);
//             }}
//             onSubmit={handleSubmitResponse}
//             loading={loading}
//           />
//         )}
//       </div>
//     </div>
//   );
// };

// export default B2B_Quotation;

"use client";

import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchFleetQuotations,
  respondToQuotation,
} from "../../../Redux/slices/quotationSlice";
import LoadingSpinner from "../../LoadingSpinner/LoadingSpinner";
import QuotationDetailsModal from "../QuotationDetailsModal/QuotationDetailsModal";
import QuotationResponseModal from "../QuotationResponseModal/QuotationResponseModal";
import "./B2B_Quotation.css";

const B2B_Quotation = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { quotations, loading, error } = useSelector(
    (state) => state.quotation,
  );
  const [filter, setFilter] = useState("all");
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [respondModal, setRespondModal] = useState(null);
  const [responseData, setResponseData] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);

  // Advanced filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    dispatch(fetchFleetQuotations());
  }, [dispatch]);

  const mapStatus = (status) => {
    const statusMap = {
      REQUESTED: "pending",
      QUOTED: "quoted",
      REJECTED: "rejected",
      ACCEPTED: "accepted",
      NEGOTIATING: "negotiating",
      EXPIRED: "expired",
    };
    return statusMap[status] || status.toLowerCase();
  };

  // Apply all filters and sorting
  const filteredQuotations = useMemo(() => {
    // Filter by date range
    const filterByDate = (quotation) => {
      if (dateFilter === "all") return true;
      const requestDate = new Date(quotation.requestedAt);
      const now = new Date();
      const diffDays = Math.floor((now - requestDate) / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today":
          return diffDays === 0;
        case "week":
          return diffDays <= 7;
        case "month":
          return diffDays <= 30;
        case "quarter":
          return diffDays <= 90;
        default:
          return true;
      }
    };

    // Filter by search query
    const filterBySearch = (quotation) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        quotation.quotationNumber?.toLowerCase().includes(query) ||
        quotation.corporateOwnerId?.fullName?.toLowerCase().includes(query) ||
        quotation.corporateOwnerId?.companyName
          ?.toLowerCase()
          .includes(query) ||
        quotation.corporateOwnerId?.email?.toLowerCase().includes(query)
      );
    };

    let result =
      quotations?.filter((q) => {
        // Status filter
        if (filter !== "all" && mapStatus(q.status) !== filter) return false;
        // Date filter
        if (!filterByDate(q)) return false;
        // Search filter
        if (!filterBySearch(q)) return false;
        return true;
      }) || [];

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.requestedAt) - new Date(a.requestedAt);
        case "oldest":
          return new Date(a.requestedAt) - new Date(b.requestedAt);
        case "amount-high":
          return (
            (b.quotedPrice?.totalAmount || 0) -
            (a.quotedPrice?.totalAmount || 0)
          );
        case "amount-low":
          return (
            (a.quotedPrice?.totalAmount || 0) -
            (b.quotedPrice?.totalAmount || 0)
          );
        case "vehicles":
          const aVehicles =
            a.vehicles?.reduce((sum, v) => sum + v.quantity, 0) || 0;
          const bVehicles =
            b.vehicles?.reduce((sum, v) => sum + v.quantity, 0) || 0;
          return bVehicles - aVehicles;
        default:
          return 0;
      }
    });

    return result;
  }, [quotations, filter, dateFilter, searchQuery, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuotations = filteredQuotations.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, dateFilter, searchQuery, sortBy]);

  const stats = {
    total: quotations?.length || 0,
    pending: quotations?.filter((q) => q.status === "REQUESTED").length || 0,
    quoted: quotations?.filter((q) => q.status === "QUOTED").length || 0,
    rejected: quotations?.filter((q) => q.status === "REJECTED").length || 0,
    accepted: quotations?.filter((q) => q.status === "ACCEPTED").length || 0,
  };

  // Pagination handlers
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handleViewDetails = (quotation) => {
    setSelectedQuotation(quotation);
  };

  const handleRespondClick = (quotation) => {
    setRespondModal(quotation);

    const calculateRentalDays = () => {
      const startDate = quotation.rentalPeriod?.startDate;
      const endDate = quotation.rentalPeriod?.endDate;

      if (!startDate || !endDate) {
        // Fallback to duration-based calculation if dates are missing
        const duration = Number(quotation.rentalPeriod?.duration) || 1;
        const durationType = quotation.rentalPeriod?.durationType;

        if (durationType === "DAILY") {
          return duration;
        } else if (durationType === "WEEKLY") {
          return duration * 7;
        } else if (durationType === "MONTHLY") {
          return duration * 30;
        }
        return duration;
      }

      // Calculate actual days between start and end dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    };

    const rentalDays = calculateRentalDays();

    // Get requirements from quotation
    const withDriver = quotation.requirements?.withDriver || false;
    const fuelIncluded = quotation.requirements?.fuelIncluded || false;

    const vehiclesData = quotation.vehicles.map((vehicle) => {
      const quantity = Number(vehicle.quantity) || 1;
      const pricing = vehicle.vehicleId?.pricing || {};

      // Get base rates from vehicle pricing
      const dailyRate = Number(pricing.dailyRate) || 0;
      const weeklyRate = Number(pricing.weeklyRate) || 0;
      const monthlyRate = Number(pricing.monthlyRate) || 0;
      const driverCharges = Number(pricing.driverCharges) || 0;
      const fuelCharges = Number(pricing.fuelCharges) || 0;

      // Determine which base rate to use based on durationType
      let baseRatePerDay = dailyRate;
      if (quotation.rentalPeriod?.durationType === "WEEKLY") {
        baseRatePerDay = weeklyRate / 7;
      } else if (quotation.rentalPeriod?.durationType === "MONTHLY") {
        baseRatePerDay = monthlyRate / 30;
      }

      return {
        vehicleId: vehicle.vehicleId?._id || vehicle.vehicleId,
        vehicleName: vehicle.vehicleId?.vehicleName || "Unknown Vehicle",
        quantity: quantity,
        rentalDays: rentalDays,
        withDriver:
          vehicle.withDriver !== undefined ? vehicle.withDriver : withDriver,
        withFuel:
          vehicle.withFuel !== undefined ? vehicle.withFuel : fuelIncluded,
        // Standard rates from database
        baseRatePerDay: baseRatePerDay,
        driverChargesPerDay: driverCharges,
        fuelChargesPerDay: fuelCharges,
        // Custom rates (editable by user)
        customBaseRatePerDay: baseRatePerDay,
        customDriverChargesPerDay:
          withDriver || vehicle.withDriver ? driverCharges : 0,
        customFuelChargesPerDay:
          fuelIncluded || vehicle.withFuel ? fuelCharges : 0,
      };
    });

    setResponseData(vehiclesData);
  };

  const handleSubmitResponse = async (quotationId, approvalData) => {
    console.log("handleSubmitResponse called with:", {
      quotationId,
      approvalData,
    });

    const result = await dispatch(
      respondToQuotation({
        quotationId,
        ...approvalData,
      }),
    );

    console.log("Dispatch result:", result);

    if (result.type === "quotation/respondToQuotation/fulfilled") {
      alert("Quotation response submitted successfully");
      setRespondModal(null);
      setResponseData([]);
      dispatch(fetchFleetQuotations());
    } else {
      const errorMessage =
        result.payload ||
        result.error?.message ||
        "Failed to respond to quotation";
      console.error("Error submitting quotation:", errorMessage);
      alert(`Error: ${errorMessage}`);
    }
  };

  if (loading && !quotations) return <LoadingSpinner />;

  return (
    <div className="drivermego-b2b-quotation-fleet-quotations-page">
      <div className="drivermego-b2b-quotation-fleet-quotations-container">
        <div className="drivermego-b2b-quotation-page-header">
          <h1>Quotation Requests</h1>
          <p className="drivermego-b2b-quotation-page-subtitle">
            Manage and respond to customer quotation requests
          </p>
        </div>

        {/* Stats Grid */}
        <div className="drivermego-b2b-quotation-stats-grid">
          <div
            className="drivermego-b2b-quotation-stat-card drivermego-b2b-quotation-total"
            onClick={() => setFilter("all")}
          >
            <div className="drivermego-b2b-quotation-stat-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div className="drivermego-b2b-quotation-stat-content">
              <h3>Total Requests</h3>
              <p className="drivermego-b2b-quotation-stat-value">
                {stats.total}
              </p>
            </div>
          </div>
          <div
            className="drivermego-b2b-quotation-stat-card drivermego-b2b-quotation-pending"
            onClick={() => setFilter("pending")}
          >
            <div className="drivermego-b2b-quotation-stat-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="drivermego-b2b-quotation-stat-content">
              <h3>Pending</h3>
              <p className="drivermego-b2b-quotation-stat-value">
                {stats.pending}
              </p>
            </div>
          </div>
          <div
            className="drivermego-b2b-quotation-stat-card drivermego-b2b-quotation-quoted"
            onClick={() => setFilter("quoted")}
          >
            <div className="drivermego-b2b-quotation-stat-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="drivermego-b2b-quotation-stat-content">
              <h3>Quoted</h3>
              <p className="drivermego-b2b-quotation-stat-value">
                {stats.quoted}
              </p>
            </div>
          </div>
          <div
            className="drivermego-b2b-quotation-stat-card drivermego-b2b-quotation-rejected"
            onClick={() => setFilter("rejected")}
          >
            <div className="drivermego-b2b-quotation-stat-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div className="drivermego-b2b-quotation-stat-content">
              <h3>Rejected</h3>
              <p className="drivermego-b2b-quotation-stat-value">
                {stats.rejected}
              </p>
            </div>
          </div>
          <div
            className="drivermego-b2b-quotation-stat-card drivermego-b2b-quotation-accepted"
            onClick={() => setFilter("accepted")}
          >
            <div className="drivermego-b2b-quotation-stat-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
            </div>
            <div className="drivermego-b2b-quotation-stat-content">
              <h3>Accepted</h3>
              <p className="drivermego-b2b-quotation-stat-value">
                {stats.accepted}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Filters Section */}
        <div className="drivermego-b2b-quotation-quotation-filters-section">
          <div className="drivermego-b2b-quotation-filters-row">
            {/* Search Input */}
            <div className="drivermego-b2b-quotation-search-box">
              <svg
                className="drivermego-b2b-quotation-search-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <input
                type="text"
                placeholder="Search by ID, customer name, company, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="drivermego-b2b-quotation-search-input"
              />
              {searchQuery && (
                <button
                  className="drivermego-b2b-quotation-clear-search"
                  onClick={() => setSearchQuery("")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div className="drivermego-b2b-quotation-filter-group">
              <label>Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="drivermego-b2b-quotation-filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount-high">Amount (High to Low)</option>
                <option value="amount-low">Amount (Low to High)</option>
                <option value="vehicles">Vehicle Count</option>
              </select>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="drivermego-b2b-quotation-filter-tabs">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All ({stats.total})
            </button>
            <button
              className={
                filter === "pending" ? "drivermego-b2b-quotation-active" : ""
              }
              onClick={() => setFilter("pending")}
            >
              Pending ({stats.pending})
            </button>
            <button
              className={filter === "quoted" ? "active" : ""}
              onClick={() => setFilter("quoted")}
            >
              Quoted ({stats.quoted})
            </button>
            <button
              className={
                filter === "accepted" ? "drivermego-b2b-quotation-active" : ""
              }
              onClick={() => setFilter("accepted")}
            >
              Accepted ({stats.accepted})
            </button>
            <button
              className={
                filter === "rejected" ? "drivermego-b2b-quotation-active" : ""
              }
              onClick={() => setFilter("rejected")}
            >
              Rejected ({stats.rejected})
            </button>
          </div>
        </div>

        {/* Results Info */}
        <div className="drivermego-b2b-quotation-results-info">
          <span className="drivermego-b2b-quotation-results-count">
            Showing {paginatedQuotations.length} of {filteredQuotations.length}{" "}
            quotations
            {filteredQuotations.length !== stats.total &&
              ` (filtered from ${stats.total} total)`}
          </span>
        </div>

        {/* Quotations Table */}
        {filteredQuotations.length === 0 ? (
          <div className="drivermego-b2b-quotation-no-quotations">
            <div className="drivermego-b2b-quotation-no-quotations-icon">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <h2>No Quotation Requests Found</h2>
            <p>
              {filter === "all" && !searchQuery
                ? "Quotation requests from customers will appear here"
                : "No quotations match your current filters"}
            </p>
            {(filter !== "all" || searchQuery) && (
              <button
                className="drivermego-b2b-quotation-btn drivermego-b2b-quotation-btn-secondary"
                onClick={() => {
                  setFilter("all");
                  setSearchQuery("");
                  setDateFilter("all");
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="drivermego-b2b-quotation-quotations-table-container">
            <table className="drivermego-b2b-quotation-quotations-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Customer</th>
                  <th>Rental Period</th>
                  <th>Vehicles</th>
                  <th>Requirements</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotations.map((quotation) => {
                  const mappedStatus = mapStatus(quotation.status);
                  const totalVehicles = quotation.vehicles.reduce(
                    (sum, v) => sum + v.quantity,
                    0,
                  );

                  return (
                    <tr
                      key={quotation._id}
                      className={`drivermego-b2b-quotation-table-row drivermego-b2b-quotation-status-${mappedStatus}`}
                    >
                      <td className="drivermego-b2b-quotation-quotation-id-cell">
                        <span className="drivermego-b2b-quotation-quotation-id">
                          #{quotation.quotationNumber}
                        </span>
                      </td>
                      <td className="drivermego-b2b-quotation-customer-cell">
                        <div className="drivermego-b2b-quotation-customer-info">
                          <span className="drivermego-b2b-quotation-customer-name">
                            {quotation.corporateOwnerId?.fullName || "N/A"}
                          </span>
                          <span className="drivermego-b2b-quotation-customer-company">
                            {quotation.corporateOwnerId?.companyName || ""}
                          </span>
                          <span className="drivermego-b2b-quotation-customer-email">
                            {quotation.corporateOwnerId?.email || ""}
                          </span>
                        </div>
                      </td>
                      <td className="drivermego-b2b-quotation-rental-cell">
                        <div className="drivermego-b2b-quotation-rental-info">
                          <span className="drivermego-b2b-quotation-rental-duration">
                            {quotation.rentalPeriod?.duration || "N/A"}{" "}
                            {quotation.rentalPeriod?.durationType === "DAILY"
                              ? "Days"
                              : quotation.rentalPeriod?.durationType ===
                                  "WEEKLY"
                                ? "Weeks"
                                : quotation.rentalPeriod?.durationType ===
                                    "MONTHLY"
                                  ? "Months"
                                  : ""}
                          </span>
                          <span className="drivermego-b2b-quotation-rental-dates">
                            {quotation.rentalPeriod?.startDate
                              ? new Date(
                                  quotation.rentalPeriod.startDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : ""}
                            {quotation.rentalPeriod?.endDate
                              ? " - " +
                                new Date(
                                  quotation.rentalPeriod.endDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td className="drivermego-b2b-quotation-vehicles-cell">
                        <div className="drivermego-b2b-quotation-vehicles-badge">
                          <span className="drivermego-b2b-quotation-vehicle-count">
                            {totalVehicles}
                          </span>
                          <span className="drivermego-b2b-quotation-vehicle-label">
                            vehicle{totalVehicles !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* <span className="drivermego-b2b-quotation-vehicle-types">
                          {quotation.vehicles.length} type
                          {quotation.vehicles.length !== 1 ? "s" : ""}
                        </span> */}
                      </td>
                      <td className="drivermego-b2b-quotation-requirements-cell">
                        <div className="drivermego-b2b-quotation-requirements-badges">
                          <span
                            className={`drivermego-b2b-quotation-req-badge ${quotation.requirements?.withDriver ? "drivermego-b2b-quotation-yes" : "drivermego-b2b-quotation-no"}`}
                          >
                            {quotation.requirements?.withDriver
                              ? "Driver"
                              : "No Driver"}
                          </span>
                          <span
                            className={`drivermego-b2b-quotation-req-badge ${quotation.requirements?.fuelIncluded ? "drivermego-b2b-quotation-yes" : "drivermego-b2b-quotation-no"}`}
                          >
                            {quotation.requirements?.fuelIncluded
                              ? "Fuel"
                              : "No Fuel"}
                          </span>
                        </div>
                      </td>
                      <td className="drivermego-b2b-quotation-amount-cell">
                        {quotation.quotedPrice?.totalAmount ? (
                          <span className="drivermego-b2b-quotation-amount-value">
                            KWD {quotation.quotedPrice.totalAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="drivermego-b2b-quotation-amount-pending">
                            Pending Quote
                          </span>
                        )}
                      </td>
                      <td className="drivermego-b2b-quotation-status-cell">
                        <span
                          className={`drivermego-b2b-quotation-status-badge ${mappedStatus}`}
                        >
                          {mappedStatus}
                        </span>
                      </td>
                      <td className="drivermego-b2b-quotation-date-cell">
                        <span className="drivermego-b2b-quotation-request-date">
                          {new Date(quotation.requestedAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                        <span className="drivermego-b2b-quotation-request-time">
                          {new Date(quotation.requestedAt).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </td>
                      <td className="drivermego-b2b-quotation-actions-cell">
                        <div className="drivermego-b2b-quotation-action-buttons">
                          <button
                            className="drivermego-b2b-quotation-action-btn drivermego-b2b-quotation-view-btn"
                            onClick={() => handleViewDetails(quotation)}
                            title="View Full Details"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span>View</span>
                          </button>
                          {quotation.status === "REQUESTED" && (
                            <button
                              className="drivermego-b2b-quotation-action-btn drivermego-b2b-quotation-quote-btn"
                              onClick={() => handleRespondClick(quotation)}
                              title="Provide Quotation"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="12" y1="18" x2="12" y2="12"></line>
                                <line x1="9" y1="15" x2="15" y2="15"></line>
                              </svg>
                              <span>Quote</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="drivermego-b2b-quotation-pagination-container">
                <div className="drivermego-b2b-quotation-pagination-info">
                  Page {currentPage} of {totalPages} (
                  {filteredQuotations.length} total)
                </div>
                <div className="drivermego-b2b-quotation-pagination-controls">
                  <button
                    className="drivermego-b2b-quotation-pagination-btn"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    title="First Page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="11 17 6 12 11 7"></polyline>
                      <polyline points="18 17 13 12 18 7"></polyline>
                    </svg>
                  </button>
                  <button
                    className="drivermego-b2b-quotation-pagination-btn"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Previous Page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>

                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      className={`drivermego-b2b-quotation-pagination-btn drivermego-b2b-quotation-page-number ${currentPage === page ? "drivermego-b2b-quotation-active" : ""}`}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    className="drivermego-b2b-quotation-pagination-btn"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Next Page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                  <button
                    className="drivermego-b2b-quotation-pagination-btn"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last Page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="13 17 18 12 13 7"></polyline>
                      <polyline points="6 17 11 12 6 7"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedQuotation && (
          <QuotationDetailsModal
            quotation={selectedQuotation}
            onClose={() => setSelectedQuotation(null)}
          />
        )}

        {respondModal && (
          <QuotationResponseModal
            quotation={respondModal}
            responseData={responseData}
            setResponseData={setResponseData}
            onClose={() => {
              setRespondModal(null);
              setResponseData([]);
            }}
            onSubmit={handleSubmitResponse}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default B2B_Quotation;
