"use client";

import { useState, useEffect } from "react";
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
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { quotations, loading, error } = useSelector(
    (state) => state.quotation
  );
  const [filter, setFilter] = useState("all");
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [respondModal, setRespondModal] = useState(null);
  const [responseData, setResponseData] = useState([]);

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

  const filteredQuotations =
    quotations?.filter((q) => {
      if (filter === "all") return true;
      return mapStatus(q.status) === filter;
    }) || [];

  const stats = {
    total: quotations?.length || 0,
    pending: quotations?.filter((q) => q.status === "REQUESTED").length || 0,
    quoted: quotations?.filter((q) => q.status === "QUOTED").length || 0,
    rejected: quotations?.filter((q) => q.status === "REJECTED").length || 0,
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
      })
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
    <div className="fleet-quotations-page">
      <div className="fleet-quotations-container">
        <div className="page-header">
          <h1>Quotation Requests</h1>
          <p className="page-subtitle">
            Manage and respond to customer quotation requests
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>Total Requests</h3>
              <p className="stat-value">{stats.total}</p>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>Pending</h3>
              <p className="stat-value">{stats.pending}</p>
            </div>
          </div>
          <div className="stat-card quoted">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>Quoted</h3>
              <p className="stat-value">{stats.quoted}</p>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <h3>Rejected</h3>
              <p className="stat-value">{stats.rejected}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All Requests
          </button>
          <button
            className={filter === "pending" ? "active" : ""}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className={filter === "quoted" ? "active" : ""}
            onClick={() => setFilter("quoted")}
          >
            Quoted
          </button>
          <button
            className={filter === "rejected" ? "active" : ""}
            onClick={() => setFilter("rejected")}
          >
            Rejected
          </button>
        </div>

        {/* Quotations List */}
        {filteredQuotations.length === 0 ? (
          <div className="no-quotations">
            <div className="no-quotations-icon">📋</div>
            <h2>No Quotation Requests</h2>
            <p>
              {filter === "all"
                ? "Quotation requests from customers will appear here"
                : `No ${filter} quotation requests found`}
            </p>
          </div>
        ) : (
          <div className="quotations-list">
            {filteredQuotations.map((quotation) => {
              const mappedStatus = mapStatus(quotation.status);
              const totalVehicles = quotation.vehicles.reduce(
                (sum, v) => sum + v.quantity,
                0
              );

              return (
                <div key={quotation._id} className="quotation-card">
                  <div className="quotation-card-header">
                    <div className="quotation-header-left">
                      <h3 className="quotation-number">
                        #{quotation.quotationNumber}
                      </h3>
                      <span className={`status-badge ${mappedStatus}`}>
                        {mappedStatus}
                      </span>
                    </div>
                    <div className="quotation-header-right">
                      <p className="quotation-date">
                        Requested on{" "}
                        {new Date(quotation.requestedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="quotation-card-body">
                    <div className="info-row">
                      <div className="info-section customer-info">
                        <div className="info-header">
                          <span className="info-icon">👤</span>
                          <h4>Customer Details</h4>
                        </div>
                        <div className="info-content">
                          <div className="info-item">
                            <span className="label">Name:</span>
                            <span className="value">
                              {quotation.corporateOwnerId?.fullName || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">Company:</span>
                            <span className="value">
                              {quotation.corporateOwnerId?.companyName || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">Email:</span>
                            <span className="value email">
                              {quotation.corporateOwnerId?.email || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">WhatsApp:</span>
                            <span className="value">
                              {quotation.corporateOwnerId?.whatsappNumber ||
                                "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="info-section rental-info">
                        <div className="info-header">
                          <span className="info-icon">📅</span>
                          <h4>Rental Period</h4>
                        </div>
                        <div className="info-content">
                          <div className="info-item">
                            <span className="label">Duration Type:</span>
                            <span className="value">
                              {quotation.rentalPeriod?.durationType || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">Duration:</span>
                            <span className="value">
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
                          </div>
                          <div className="info-item">
                            <span className="label">Start Date:</span>
                            <span className="value">
                              {quotation.rentalPeriod?.startDate
                                ? new Date(
                                    quotation.rentalPeriod.startDate
                                  ).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">End Date:</span>
                            <span className="value">
                              {quotation.rentalPeriod?.endDate
                                ? new Date(
                                    quotation.rentalPeriod.endDate
                                  ).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="info-section requirements-info">
                        <div className="info-header">
                          <span className="info-icon">🚗</span>
                          <h4>Vehicle Requirements</h4>
                        </div>
                        <div className="info-content">
                          <div className="info-item">
                            <span className="label">Total Vehicles:</span>
                            <span className="value highlight">
                              {totalVehicles}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">Vehicle Types:</span>
                            <span className="value">
                              {quotation.vehicles.length}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">With Driver:</span>
                            <span className="value">
                              {quotation.requirements?.withDriver
                                ? "✓ Yes"
                                : "✗ No"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="label">Fuel Included:</span>
                            <span className="value">
                              {quotation.requirements?.fuelIncluded
                                ? "✓ Yes"
                                : "✗ No"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {quotation.status === "QUOTED" &&
                      quotation.quotedPrice?.totalAmount && (
                        <div className="quoted-price-section">
                          <div className="price-summary">
                            <h4>Your Quotation</h4>
                            <div className="total-price">
                              <span>Total Amount:</span>
                              <span className="amount">
                                KWD{" "}
                                {quotation.quotedPrice.totalAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {quotation.responseMessage && (
                            <div className="response-note">
                              <strong>Note:</strong> {quotation.responseMessage}
                            </div>
                          )}
                          {quotation.validUntil && (
                            <div className="validity-note">
                              <strong>Valid Until:</strong>{" "}
                              {new Date(
                                quotation.validUntil
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  <div className="quotation-card-footer">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleViewDetails(quotation)}
                    >
                      <span className="btn-icon">👁️</span>
                      View Full Details
                    </button>
                    {quotation.status === "REQUESTED" && (
                      <button
                        className="btn btn-success"
                        onClick={() => handleRespondClick(quotation)}
                      >
                        <span className="btn-icon">💼</span>
                        Provide Quotation
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
