/* eslint-disable no-unused-vars */
"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getQuotationById,
  acceptQuotation,
  rejectQuotation,
  negotiateQuotation,
} from "../../../Redux/slices/quotationSlice";
import ContractRequestModal from "../../../Components/Corporate/ContractRequest/ContractRequestModal";
import ManagedServiceBrief from "../../../Components/Corporate/ManagedServiceBrief/ManagedServiceBrief";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import api from "../../../utils/api";
import "./QuotationDetails.css";
import { notify } from "../../../utils/toast";
import { partnerRoleLabel, customerRoleLabel } from "../../../utils/roleFamilies";

// Admin Negotiation Request Modal Component
const AdminNegotiationModal = ({ quotation, onClose, onSuccess }) => {
  const [message, setMessage] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please provide a reason for the negotiation request");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post(
        `/quotations/${quotation._id}/request-negotiation`,
        {
          message,
          expectedPrice: expectedPrice ? parseFloat(expectedPrice) : null,
        },
      );

      if (response.data.success) {
        onSuccess(response.data.negotiation);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to submit negotiation request",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="single-quotation-modal-overlay" onClick={onClose}>
      <div
        className="single-quotation-modal admin-negotiation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="single-quotation-modal-header">
          <h2>Request Admin Negotiation</h2>
          <button className="single-quotation-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="single-quotation-modal-body">
          <div className="admin-negotiation-info">
            <div className="negotiation-info-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className="negotiation-info-text">
              <strong>How Admin Negotiation Works:</strong>
              <ul>
                <li>
                  Admin will negotiate with the {partnerRoleLabel(quotation.fleetOwnerId?.role)} on your behalf
                </li>
                <li>
                  If a better price is achieved, the quotation will be updated
                </li>
                <li>A commission of 0-35% may apply on the savings achieved</li>
                <li>You can then accept or reject the updated quotation</li>
              </ul>
            </div>
          </div>

          <div className="current-price-display">
            <span>Current Quoted Price:</span>
            <strong>
              {quotation.quotedPrice?.currency || getActiveCurrency()}{" "}
              {quotation.quotedPrice?.totalAmount?.toFixed(2) || "0.00"}
            </strong>
          </div>

          {error && <div className="negotiation-error">{error}</div>}

          <div className="form-group">
            <label>Expected Price (Optional):</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter your expected price..."
              value={expectedPrice}
              onChange={(e) => setExpectedPrice(e.target.value)}
              className="single-quotation-textarea"
              style={{ height: "auto", padding: "10px" }}
            />
            <span className="form-hint">
              Leave blank if you want Admin to get the best possible price
            </span>
          </div>

          <div className="form-group">
            <label>Why do you want a better price? *</label>
            <textarea
              className="single-quotation-textarea"
              rows="4"
              placeholder="Explain your reason for requesting negotiation... (e.g., budget constraints, long-term partnership potential, market rates, etc.)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <div className="single-quotation-modal-footer">
          <button
            className="single-quotation-btn single-quotation-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="single-quotation-btn single-quotation-btn-accept admin-negotiate-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Request Admin Negotiation"}
          </button>
        </div>
      </div>
    </div>
  );
};

const QuotationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState("commuters");

  const { currentQuotation, loading, error } = useSelector(
    (state) => state.quotation,
  );

  useEffect(() => {
    if (id && id !== "undefined" && id !== "null") {
      console.log("Fetching quotation with ID:", id);
      dispatch(getQuotationById(id));
    } else {
      console.error("Invalid or missing quotation ID in URL params:", id);
    }
  }, [id, dispatch]);

  // When the corporate lands here straight after requesting a managed-service
  // quotation (?brief=1), scroll them to the brief so they can fill it in.
  useEffect(() => {
    if (!loading && window.location.search.includes("brief=1")) {
      const el = document.getElementById("managed-service-brief");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [showContractModal, setShowContractModal] = useState(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [negotiateAmount, setNegotiateAmount] = useState("");
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const [existingContract, setExistingContract] = useState(null);

  // Admin Negotiation states
  const [showAdminNegotiationModal, setShowAdminNegotiationModal] =
    useState(false);
  const [adminNegotiationStatus, setAdminNegotiationStatus] = useState(null);

  // Check if contract already exists for this quotation
  useEffect(() => {
    const checkExistingContract = async () => {
      if (id && id !== "undefined" && id !== "null") {
        try {
          const response = await api.get(`/contracts/by-quotation/${id}`);
          if (response.data.success && response.data.contract) {
            setExistingContract(response.data.contract);
          }
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          // Contract doesn't exist yet - that's fine
          setExistingContract(null);
        }
      }
    };
    checkExistingContract();
  }, [id]);

  const quotation = currentQuotation?.quotation || currentQuotation;

  const calculateRentalDays = () => {
    if (
      !quotation?.rentalPeriod?.startDate ||
      !quotation?.rentalPeriod?.endDate
    )
      return 0;

    const start = new Date(quotation.rentalPeriod.startDate);
    const end = new Date(quotation.rentalPeriod.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAcceptQuotation = async () => {
    const isPartial =
      (currentQuotation?.quotation || currentQuotation)?.fulfillment?.type ===
      "PARTIAL";
    const confirmText = isPartial
      ? "This is a partial offer — the partner will supply fewer vehicles than you originally requested. Accept this partial quotation and move it forward for contract processing?"
      : "Are you sure you want to accept this quotation? This will move it forward for contract processing.";
    if (window.confirm(confirmText)) {
      const data = {
        decision: "accept",
        message: "Quotation accepted. Looking forward to working together.",
      };

      const result = await dispatch(acceptQuotation({ quotationId: id, data }));

      if (result.type === "quotation/acceptQuotation/fulfilled") {
        notify("Quotation accepted successfully!");
        navigate(`/quotation/${id}`);
      }
    }
  };

  const handleReject = async () => {
    if (!rejectMessage.trim()) {
      notify("Please provide a reason for rejection");
      return;
    }

    const data = {
      decision: "reject",
      message: rejectMessage,
    };

    const result = await dispatch(rejectQuotation({ quotationId: id, data }));

    if (result.type === "quotation/rejectQuotation/fulfilled") {
      notify("Quotation rejected successfully!");
      setShowRejectModal(false);
      navigate("/corporate-profile?tab=my-quotations");
    }
  };

  const handleNegotiate = async () => {
    if (!negotiateAmount || parseFloat(negotiateAmount) <= 0) {
      notify("Please enter a valid counter offer amount");
      return;
    }

    const result = await dispatch(
      negotiateQuotation({
        quotationId: id,
        counterOffer: { totalAmount: parseFloat(negotiateAmount) },
        message: negotiateMessage,
      }),
    );

    if (result.type === "quotation/negotiateQuotation/fulfilled") {
      notify("Counter offer submitted successfully!");
      setShowNegotiateModal(false);
      setNegotiateAmount("");
      setNegotiateMessage("");
      dispatch(getQuotationById(id));
    }
  };

  const handleCreateContractRequest = () => {
    setShowContractModal(true);
  };

  // eslint-disable-next-line no-unused-vars
  const handleContractSuccess = (contract) => {
    setShowContractModal(false);
    notify("Contract created successfully!");
    // Optionally navigate to the contract details page or contracts list
    navigate(`/corporate-profile?tab=contracts`);
    // Or refresh the quotation to show updated status
    // dispatch(getQuotationById(id));
  };

  const handleAdminNegotiationSuccess = (negotiation) => {
    setShowAdminNegotiationModal(false);
    setAdminNegotiationStatus("REQUESTED");
    notify(
      "Admin Negotiation request submitted successfully! You will be notified when there are updates.",
    );
    dispatch(getQuotationById(id)); // Refresh quotation to show updated status
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="single-quotation-details-container">
        <div className="single-quotation-error-card">
          <div className="single-quotation-error-icon">⚠️</div>
          <h3>Error Loading Quotation</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!quotation || !quotation._id) {
    return (
      <div className="single-quotation-details-container">
        <div className="single-quotation-pending-card">
          <div className="single-quotation-pending-icon">⏳</div>
          <h3>Loading</h3>
          <p>Please wait while we load the quotation details...</p>
        </div>
      </div>
    );
  }

  const fleetOwner = quotation.fleetOwnerId || {};
  const partnerLabel = partnerRoleLabel(fleetOwner.role);
  const customerLabel = customerRoleLabel(quotation.corporateOwnerId?.role);
  const vehicles = quotation.vehicles || [];
  const rentalPeriod = quotation.rentalPeriod || {};
  const requirements = quotation.requirements || {};
  const quotedPrice = quotation.quotedPrice || {};
  const status = (quotation.status || "pending").toLowerCase();

  const rentalDays = calculateRentalDays();

  const getFacilitiesList = (facilities) => {
    if (!facilities) return [];
    const facilityList = [];
    if (facilities.airConditioning) facilityList.push("Air Conditioning");
    if (facilities.entertainmentScreen)
      facilityList.push("Entertainment Screen");
    if (facilities.gpsTracking) facilityList.push("GPS Tracking");
    if (facilities.musicSystem) facilityList.push("Music System");
    if (facilities.refrigeration) facilityList.push("Refrigeration");
    if (facilities.wheelchairAccess) facilityList.push("Wheelchair Access");
    if (facilities.wifiOnboard) facilityList.push("WiFi Onboard");
    return facilityList;
  };

  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="single-quotation-details-container">
        {/* Back Button */}
        <button
          className="single-quotation-back-button"
          onClick={() => navigate("/corporate-profile?tab=my-quotations")}
        >
          ← Back to Quotations
        </button>

        {/* Header */}
        <div className="single-quotation-header">
          <div className="single-quotation-header-left">
            <h1>Quotation #{quotation.quotationNumber || quotation._id}</h1>
          </div>
          <span className={`single-quotation-status-badge status-${status}`}>
            {status.toUpperCase()}
          </span>
        </div>

        {/* Fleet Owner Information */}
        <div className="single-quotation-section">
          <h2>Fleet Owner Information</h2>
          <div className="single-quotation-card">
            <div className="single-quotation-info-grid">
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">COMPANY/NAME:</div>
                <div className="single-quotation-value">
                  {fleetOwner.companyName || fleetOwner.fullName || "N/A"}
                </div>
              </div>
              {/* <div className="single-quotation-info-item">
              <div className="single-quotation-label">📧 EMAIL:</div>
              <div className="single-quotation-value">
                {fleetOwner.email || "N/A"}
              </div>
            </div>
            <div className="single-quotation-info-item">
              <div className="single-quotation-label">📱 PHONE:</div>
              <div className="single-quotation-value">
                {fleetOwner.whatsappNumber || fleetOwner.phone || "N/A"}
              </div>
            </div> */}
            </div>
          </div>
        </div>

        {/* Managed Service Brief — only for managed-service quotations. The
            corporate authors its operational requirements (work locations &
            shifts, routes, employee roster) here so the partner sees exactly
            what it is committing to BEFORE it prices and returns a quote. */}
        {quotation.serviceMode === "MANAGED" && (
          <div className="single-quotation-section" id="managed-service-brief">
            <ManagedServiceBrief quotationId={quotation._id} mode="corporate" />
          </div>
        )}

        {/* Rental Period Details */}
        <div className="single-quotation-section">
          <h2>Rental Period Details</h2>
          <div className="single-quotation-card">
            <div className="single-quotation-info-grid">
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">RENTAL DURATION:</div>
                <div className="single-quotation-value">
                  {rentalPeriod.duration || "N/A"}{" "}
                  {rentalPeriod.durationType === "DAILY"
                    ? rentalPeriod.duration === 1
                      ? "Day"
                      : "Days"
                    : rentalPeriod.durationType === "WEEKLY"
                      ? rentalPeriod.duration === 1
                        ? "Week"
                        : "Weeks"
                      : rentalPeriod.durationType === "MONTHLY"
                        ? rentalPeriod.duration === 1
                          ? "Month"
                          : "Months"
                        : rentalPeriod.durationType === "LONG_TERM"
                          ? rentalPeriod.duration === 1
                            ? "Year"
                            : "Years"
                          : ""}
                </div>
              </div>
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">START DATE:</div>
                <div className="single-quotation-value">
                  {formatDate(rentalPeriod.startDate)}
                </div>
              </div>
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">END DATE:</div>
                <div className="single-quotation-value">
                  {formatDate(rentalPeriod.endDate)}
                </div>
              </div>
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">TOTAL RENTAL DAYS:</div>
                <div className="single-quotation-value">{rentalDays} days</div>
              </div>
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">DRIVER REQUIRED:</div>
                <div className="single-quotation-value">
                  <span
                    className={`single-quotation-badge ${
                      requirements.withDriver
                        ? "badge-success"
                        : "badge-secondary"
                    }`}
                  >
                    {requirements.withDriver ? "Yes" : "No"}
                  </span>
                </div>
              </div>
              <div className="single-quotation-info-item">
                <div className="single-quotation-label">FUEL INCLUDED:</div>
                <div className="single-quotation-value">
                  <span
                    className={`single-quotation-badge ${
                      requirements.fuelIncluded
                        ? "badge-success"
                        : "badge-secondary"
                    }`}
                  >
                    {requirements.fuelIncluded ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicles Requested */}
        <div className="single-quotation-section">
          <h2>
            Vehicles Requested ({quotation.totalVehicles || vehicles.length}{" "}
            total)
          </h2>
          {vehicles.length > 0 ? (
            <div className="single-quotation-vehicles-grid">
              {vehicles.map((vehicleItem, index) => {
                const vehicle = vehicleItem.vehicleId || {};
                const quantity = vehicleItem.quantity || 1;
                const facilitiesList = getFacilitiesList(vehicle.facilities);

                // Goods carriers have cargo capacity (in tons), not passenger
                // seats. Detect via serviceType, falling back to the capacity
                // shape so older records without serviceType still render right.
                const isGoodsCarrier =
                  vehicle.serviceType === "GOODS_CARRIER" ||
                  (!vehicle.capacity?.seatingCapacity &&
                    !!vehicle.capacity?.cargoCapacity);

                return (
                  <div key={index} className="single-quotation-vehicle-card">
                    {/* Vehicle Images */}
                    {vehicle.photos && vehicle.photos.length > 0 && (
                      <div className="single-quotation-vehicle-image">
                        <img
                          src={vehicle.photos[0]?.url || "/placeholder.svg"}
                          alt={vehicle.vehicleName || "Vehicle"}
                        />
                        <span className="single-quotation-vehicle-quantity">
                          Qty: {quantity}
                        </span>
                      </div>
                    )}

                    {/* Vehicle Info */}
                    <div className="single-quotation-vehicle-details">
                      <h3>{vehicle.vehicleName || "N/A"}</h3>

                      <div className="single-quotation-vehicle-specs">
                        <div className="single-quotation-spec-item">
                          <span>Type:</span>
                          <strong>{vehicle.vehicleCategory || "N/A"}</strong>
                        </div>
                        <div className="single-quotation-spec-item">
                          <span>Year:</span>
                          <strong>{vehicle.manufacturingYear || "N/A"}</strong>
                        </div>
                        {isGoodsCarrier ? (
                          <div className="single-quotation-spec-item">
                            <span>Cargo Capacity:</span>
                            <strong>
                              {vehicle.capacity?.cargoCapacity
                                ? `${vehicle.capacity.cargoCapacity} tons`
                                : "N/A"}
                            </strong>
                          </div>
                        ) : (
                          <div className="single-quotation-spec-item">
                            <span>Seats:</span>
                            <strong>
                              {vehicle.capacity?.seatingCapacity || "N/A"}
                            </strong>
                          </div>
                        )}
                        <div className="single-quotation-spec-item">
                          <span>Location:</span>
                          <strong>{vehicle.location || "N/A"}</strong>
                        </div>
                        <div className="single-quotation-spec-item">
                          <span>Registration:</span>
                          <strong>{vehicle.registrationNumber || "N/A"}</strong>
                        </div>
                      </div>

                      {/* Facilities */}
                      {facilitiesList.length > 0 && (
                        <div className="single-quotation-facilities">
                          <span className="single-quotation-facilities-label">
                            Facilities:
                          </span>
                          <div className="single-quotation-facilities-list">
                            {facilitiesList.map((facility, idx) => (
                              <span
                                key={idx}
                                className="single-quotation-facility-badge"
                              >
                                {facility}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="single-quotation-empty-message">
              No vehicles found in this quotation.
            </div>
          )}
        </div>

        {/* Pricing Breakdown */}
        <div className="single-quotation-section">
          <h2 className="single-quotation-section-title">Pricing Breakdown</h2>

          {/* Negotiation Savings Information - Show if negotiation was applied */}
          {quotation?.adminNegotiation?.priceReduced &&
            quotation?.adminNegotiation?.status === "COMPLETED" &&
            (() => {
              // Transparent, step-by-step negotiation summary so the Corporate
              // can see exactly what happened:
              //   Original quotation (service charge included)
              //   → price after negotiation
              //   → savings
              //   → admin negotiation service fee (a % of the savings)
              //   → total the Corporate ultimately pays
              const curr =
                quotation.quotedPrice?.currency || getActiveCurrency();
              const originalPrice =
                quotation.adminNegotiation.originalPrice || 0;
              const afterNegotiation = quotation.quotedPrice?.totalAmount || 0;
              const savings =
                quotation.adminNegotiation.savingsAmount ??
                Math.max(0, originalPrice - afterNegotiation);
              const serviceCharge = quotation.quotedPrice?.serviceCharge || 0;
              const feeRate =
                quotation.adminNegotiation.adminCommissionRate ?? 25;
              // Prefer the stored fee; fall back to (rate% of savings) so the
              // card is always internally consistent even for older records.
              const negotiationFee =
                quotation.adminNegotiation.adminCommission ??
                Math.round(((savings * feeRate) / 100) * 100) / 100;
              const totalPayable = afterNegotiation + negotiationFee;
              const isManaged = quotation.serviceMode === "MANAGED";

              return (
                <div className="negotiation-savings-card">
                  <div className="negotiation-savings-header">
                    <span className="negotiation-savings-icon">✓</span>
                    <h3>
                      Negotiation Applied - Here&apos;s the Full Breakdown
                    </h3>
                  </div>
                  <div className="negotiation-savings-details">
                    <div className="savings-detail-row">
                      <span className="savings-label">
                        Original Quotation
                        {isManaged ? " (incl. service charge)" : ""}:
                      </span>
                      <span className="savings-value original-price">
                        {curr} {originalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="savings-detail-row">
                      <span className="savings-label">
                        Price After Negotiation:
                      </span>
                      <span className="savings-value new-price">
                        {curr} {afterNegotiation.toFixed(2)}
                      </span>
                    </div>
                    {isManaged && serviceCharge > 0 && (
                      <div className="savings-detail-note">
                        Includes {curr} {serviceCharge.toFixed(2)} partner
                        management / service charge.
                      </div>
                    )}
                    <div className="savings-detail-row highlight">
                      <span className="savings-label">Your Savings:</span>
                      <span className="savings-value savings-amount">
                        {curr} {savings.toFixed(2)}
                      </span>
                    </div>

                    {negotiationFee > 0 && (
                      <>
                        <div className="savings-detail-row fee-row">
                          <span className="savings-label">
                            Negotiation Service Fee ({feeRate}% of savings):
                          </span>
                          <span className="savings-value fee-value">
                            + {curr} {negotiationFee.toFixed(2)}
                          </span>
                        </div>
                        <div className="savings-detail-note">
                          A {feeRate}% fee on the {curr} {savings.toFixed(2)} we
                          saved you is charged for the negotiation service. It
                          is collected separately with your advance payment.
                        </div>
                        <div className="savings-detail-row total-payable-row">
                          <span className="savings-label">
                            Total Payable ({curr} {afterNegotiation.toFixed(2)}{" "}
                            + {curr} {negotiationFee.toFixed(2)} fee):
                          </span>
                          <span className="savings-value total-payable-value">
                            {curr} {totalPayable.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

          {quotation?.status?.toUpperCase() === "REQUESTED" && (
            <div className="single-quotation-waiting-message">
              <div className="single-quotation-waiting-icon">⏳</div>
              <h3 className="single-quotation-waiting-title">
                Waiting for Fleet Owner Response
              </h3>
              <p className="single-quotation-waiting-text">
                The fleet owner hasn't provided a quote yet. You'll be notified
                once they respond.
              </p>
            </div>
          )}

          {quotation?.status?.toUpperCase() === "QUOTED" &&
            quotation?.quotedPrice && (
              <>
                {/* Partial-offer notice: the partner could not supply every
                    vehicle requested, so they are quoting for what they have
                    available now. The corporate can accept this partial offer
                    or reject it. */}
                {quotation?.fulfillment?.type === "PARTIAL" && (
                  <div className="single-quotation-partial-banner">
                    <div className="single-quotation-partial-header">
                      <span className="single-quotation-partial-icon">!</span>
                      <div>
                        <strong>
                          Partial availability:{" "}
                          {quotation.fulfillment.totalOfferedVehicles} of{" "}
                          {quotation.fulfillment.totalRequestedVehicles}{" "}
                          vehicles offered now
                        </strong>
                        <p>
                          {fleetOwner.companyName ||
                            fleetOwner.fullName ||
                            "The partner"}{" "}
                          currently has{" "}
                          {quotation.fulfillment.totalOfferedVehicles}{" "}
                          vehicle(s) available and is quoting for those. You can
                          accept this partial offer or reject it.
                        </p>
                      </div>
                    </div>
                    {quotation.fulfillment.hasFutureAvailability && (
                      <div className="single-quotation-partial-future">
                        <strong>More vehicles coming:</strong>{" "}
                        {quotation.fulfillment.futureAvailabilityNote ||
                          "The partner expects additional vehicles soon."}
                        {quotation.fulfillment.futureAvailabilityDate && (
                          <span>
                            {" "}
                            (expected by{" "}
                            {formatDate(
                              quotation.fulfillment.futureAvailabilityDate,
                            )}
                            )
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Overall Breakdown */}
                <div className="single-quotation-breakdown-section">
                  <h3 className="single-quotation-breakdown-title">
                    Overall Summary
                  </h3>
                  <div className="single-quotation-card">
                    <div className="single-quotation-breakdown-rows">
                      <div className="single-quotation-breakdown-row">
                        <span>Vehicle Rental:</span>
                        <strong>
                          {quotedPrice.currency || getActiveCurrency()}{" "}
                          {quotedPrice.breakdown?.vehicleRental?.toFixed(2) ||
                            "0.00"}
                        </strong>
                      </div>
                      {requirements.withDriver && (
                        <div className="single-quotation-breakdown-row">
                          <span>Driver Charges:</span>
                          <strong>
                            {quotedPrice.currency || getActiveCurrency()}{" "}
                            {quotedPrice.breakdown?.driverCharges?.toFixed(2) ||
                              "0.00"}
                          </strong>
                        </div>
                      )}
                      {requirements.fuelIncluded && (
                        <div className="single-quotation-breakdown-row">
                          <span>Fuel Charges:</span>
                          <strong>
                            {quotedPrice.currency || getActiveCurrency()}{" "}
                            {quotedPrice.breakdown?.fuelCharges?.toFixed(2) ||
                              "0.00"}
                          </strong>
                        </div>
                      )}
                      {quotation.serviceMode === "MANAGED" && (
                        <>
                          {/* Vehicles subtotal = total minus the partner's
                              management/service charge, so the addition to the
                              Total Amount below is transparent. */}
                          <div className="single-quotation-breakdown-row">
                            <span>Vehicles Subtotal:</span>
                            <strong>
                              {quotedPrice.currency || getActiveCurrency()}{" "}
                              {(
                                (quotedPrice.totalAmount || 0) -
                                (quotedPrice.serviceCharge || 0)
                              ).toFixed(2)}
                            </strong>
                          </div>
                          <div className="single-quotation-breakdown-row">
                            <span>Partner Management / Service Charge:</span>
                            <strong>
                              {quotedPrice.currency || getActiveCurrency()}{" "}
                              {(quotedPrice.serviceCharge || 0).toFixed(2)}
                            </strong>
                          </div>
                        </>
                      )}
                      <div className="single-quotation-breakdown-row single-quotation-breakdown-total">
                        <span>Total Amount:</span>
                        <strong>
                          {quotedPrice.currency || getActiveCurrency()}{" "}
                          {quotedPrice.totalAmount?.toFixed(2) || "0.00"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per Vehicle Breakdown */}
                {quotedPrice.perVehicleBreakdown &&
                  quotedPrice.perVehicleBreakdown.length > 0 && (
                    <div className="single-quotation-breakdown-section">
                      <h3 className="single-quotation-breakdown-title">
                        Per Vehicle Breakdown
                      </h3>
                      {quotedPrice.perVehicleBreakdown.map(
                        (breakdown, index) => (
                          <div
                            key={index}
                            className="single-quotation-vehicle-breakdown-card"
                          >
                            <div className="single-quotation-vehicle-breakdown-title">
                              <span>{breakdown.vehicleName}</span>
                              <span className="single-quotation-vehicle-breakdown-qty">
                                Qty: {breakdown.quantity}
                                {breakdown.requestedQuantity &&
                                  breakdown.requestedQuantity >
                                    breakdown.quantity && (
                                    <span className="single-quotation-qty-requested">
                                      {" "}
                                      of {breakdown.requestedQuantity} requested
                                    </span>
                                  )}
                              </span>
                            </div>
                            <div className="single-quotation-breakdown-rows">
                              <div className="single-quotation-breakdown-row">
                                <span>Base Rental:</span>
                                <strong>
                                  {quotedPrice.currency || getActiveCurrency()}{" "}
                                  {breakdown.baseRental?.toFixed(2) || "0.00"}
                                </strong>
                              </div>
                              {requirements.withDriver &&
                                breakdown.driverCharges > 0 && (
                                  <div className="single-quotation-breakdown-row">
                                    <span>Driver Charges:</span>
                                    <strong>
                                      {quotedPrice.currency ||
                                        getActiveCurrency()}{" "}
                                      {breakdown.driverCharges?.toFixed(2) ||
                                        "0.00"}
                                    </strong>
                                  </div>
                                )}
                              {requirements.fuelIncluded &&
                                breakdown.fuelCharges > 0 && (
                                  <div className="single-quotation-breakdown-row">
                                    <span>Fuel Charges:</span>
                                    <strong>
                                      {quotedPrice.currency ||
                                        getActiveCurrency()}{" "}
                                      {breakdown.fuelCharges?.toFixed(2) ||
                                        "0.00"}
                                    </strong>
                                  </div>
                                )}
                              <div className="single-quotation-breakdown-row single-quotation-breakdown-subtotal">
                                <span>Subtotal:</span>
                                <strong>
                                  {quotedPrice.currency || getActiveCurrency()}{" "}
                                  {breakdown.totalAmount?.toFixed(2) || "0.00"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                {quotation.responseMessage && (
                  <div className="single-quotation-response-message">
                    <p>
                      <strong>Fleet Owner Message:</strong>{" "}
                      {quotation.responseMessage}
                    </p>
                  </div>
                )}

                {quotation.terms && (
                  <div className="single-quotation-response-message">
                    <p>
                      <strong>Terms & Conditions:</strong> {quotation.terms}
                    </p>
                  </div>
                )}

                {/* Admin Negotiation Status Banner */}
                {quotation?.adminNegotiation?.status &&
                  quotation.adminNegotiation.status !== "NONE" && (
                    <div
                      className={`admin-negotiation-status-banner status-${quotation.adminNegotiation.status.toLowerCase()}`}
                    >
                      <div className="banner-icon">
                        {quotation.adminNegotiation.status === "REQUESTED" &&
                          "⏳"}
                        {quotation.adminNegotiation.status === "IN_PROGRESS" &&
                          "🔄"}
                        {quotation.adminNegotiation.status === "COMPLETED" &&
                          "✅"}
                        {quotation.adminNegotiation.status === "FAILED" && "❌"}
                      </div>
                      <div className="banner-content">
                        <strong>
                          Admin Negotiation:{" "}
                          {quotation.adminNegotiation.status.replace("_", " ")}
                        </strong>
                        {quotation.adminNegotiation.status === "REQUESTED" && (
                          <p>
                            Your negotiation request is being reviewed by Admin.
                          </p>
                        )}
                        {quotation.adminNegotiation.status ===
                          "IN_PROGRESS" && (
                          <p>
                            Admin is actively negotiating with the {partnerLabel}.
                            Please wait for updates.
                          </p>
                        )}
                        {quotation.adminNegotiation.status === "COMPLETED" &&
                          quotation.adminNegotiation.priceReduced && (
                            <p>
                              Great news! Price reduced from{" "}
                              {quotation.quotedPrice?.currency ||
                                getActiveCurrency()}{" "}
                              {quotation.adminNegotiation.originalPrice?.toFixed(
                                2,
                              )}{" "}
                              to{" "}
                              {quotation.quotedPrice?.currency ||
                                getActiveCurrency()}{" "}
                              {quotation.quotedPrice?.totalAmount?.toFixed(2)}.
                              You saved{" "}
                              {quotation.quotedPrice?.currency ||
                                getActiveCurrency()}{" "}
                              {quotation.adminNegotiation.savingsAmount?.toFixed(
                                2,
                              )}
                              !
                            </p>
                          )}
                        {quotation.adminNegotiation.status === "FAILED" && (
                          <p>
                            Unfortunately, the negotiation did not result in a
                            better price.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                {/* Action Buttons */}
                <div className="single-quotation-action-buttons">
                  <button
                    className="single-quotation-btn single-quotation-btn-accept"
                    onClick={handleAcceptQuotation}
                  >
                    Accept Quotation
                  </button>
                  {/* Admin Negotiation Button - Only show if not already in negotiation */}
                  {(!quotation?.adminNegotiation?.status ||
                    quotation.adminNegotiation.status === "NONE" ||
                    quotation.adminNegotiation.status === "FAILED") && (
                    <button
                      className="single-quotation-btn single-quotation-btn-negotiate admin-negotiate-btn"
                      onClick={() => setShowAdminNegotiationModal(true)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ marginRight: "6px" }}
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Request Admin to Negotiate
                    </button>
                  )}
                  <button
                    className="single-quotation-btn single-quotation-btn-reject"
                    onClick={() => setShowRejectModal(true)}
                  >
                    Reject Quotation
                  </button>
                </div>
              </>
            )}

          {quotation?.status?.toUpperCase() === "ACCEPTED" &&
            quotation?.quotedPrice && (
              <>
                <div className="single-quotation-success-message">
                  <div className="single-quotation-success-icon">✅</div>
                  <h3 className="single-quotation-success-title">
                    Quotation Accepted!
                  </h3>
                  <p className="single-quotation-success-text">
                    You have successfully accepted this quotation. You can now
                    create a contract request with the fleet owner.
                  </p>
                </div>

                {/* Display Pricing Details */}
                <div className="single-quotation-price-summary">
                  <div className="single-quotation-price-row">
                    <span className="single-quotation-price-label">
                      Vehicle Rental:
                    </span>
                    <span className="single-quotation-price-value">
                      {quotation.quotedPrice.currency || getActiveCurrency()}{" "}
                      {quotation.quotedPrice.breakdown?.vehicleRental?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="single-quotation-price-row">
                    <span className="single-quotation-price-label">
                      Driver Charges:
                    </span>
                    <span className="single-quotation-price-value">
                      {quotation.quotedPrice.currency || getActiveCurrency()}{" "}
                      {quotation.quotedPrice.breakdown?.driverCharges?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="single-quotation-price-row">
                    <span className="single-quotation-price-label">
                      Fuel Charges:
                    </span>
                    <span className="single-quotation-price-value">
                      {quotation.quotedPrice.currency || getActiveCurrency()}{" "}
                      {quotation.quotedPrice.breakdown?.fuelCharges?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                  {quotation.serviceMode === "MANAGED" && (
                    <>
                      <div className="single-quotation-price-row">
                        <span className="single-quotation-price-label">
                          Vehicles Subtotal:
                        </span>
                        <span className="single-quotation-price-value">
                          {quotation.quotedPrice.currency ||
                            getActiveCurrency()}{" "}
                          {(
                            (quotation.quotedPrice.totalAmount || 0) -
                            (quotation.quotedPrice.serviceCharge || 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="single-quotation-price-row">
                        <span className="single-quotation-price-label">
                          Partner Management / Service Charge:
                        </span>
                        <span className="single-quotation-price-value">
                          {quotation.quotedPrice.currency ||
                            getActiveCurrency()}{" "}
                          {(quotation.quotedPrice.serviceCharge || 0).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="single-quotation-price-row single-quotation-total-row">
                    <span className="single-quotation-price-label">
                      Total Amount:
                    </span>
                    <span className="single-quotation-price-value single-quotation-total-value">
                      {quotation.quotedPrice.currency || getActiveCurrency()}{" "}
                      {quotation.quotedPrice.totalAmount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>

                {/* Create Contract Button - Only show if no contract exists yet */}
                {existingContract ? (
                  <div className="single-quotation-contract-exists-message">
                    <p>
                      Contract has already been created.{" "}
                      <a
                        href={`/corporate/contracts/${existingContract._id}`}
                        className="view-contract-link"
                        style={{
                          color: "#007bff",
                          textDecoration: "underline",
                        }}
                      >
                        View Contract Details
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="single-quotation-action-buttons">
                    <button
                      className="single-quotation-btn single-quotation-btn-contract"
                      onClick={handleCreateContractRequest}
                    >
                      Create Contract Request
                    </button>
                  </div>
                )}
              </>
            )}

          {quotation?.status?.toUpperCase() === "REJECTED" && (
            <div className="single-quotation-rejected-message">
              <div className="single-quotation-rejected-icon">❌</div>
              <h3 className="single-quotation-rejected-title">
                Quotation Rejected
              </h3>
              <p className="single-quotation-rejected-text">
                You have rejected this quotation.
                {quotation.rejectionReason && (
                  <span className="single-quotation-rejection-reason">
                    <br />
                    <strong>Reason:</strong> {quotation.rejectionReason}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ContractRequestModal Component */}
        {showContractModal && (
          <ContractRequestModal
            quotation={quotation}
            onClose={() => setShowContractModal(false)}
            onSuccess={handleContractSuccess}
          />
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div
            className="single-quotation-modal-overlay"
            onClick={() => setShowRejectModal(false)}
          >
            <div
              className="single-quotation-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="single-quotation-modal-header">
                <h2>Reject Quotation</h2>
                <button
                  className="single-quotation-modal-close"
                  onClick={() => setShowRejectModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="single-quotation-modal-body">
                <p>Please provide a reason for rejecting this quotation:</p>
                <textarea
                  className="single-quotation-textarea"
                  rows="4"
                  placeholder="Enter your reason for rejection..."
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                />
              </div>
              <div className="single-quotation-modal-footer">
                <button
                  className="single-quotation-btn single-quotation-btn-secondary"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="single-quotation-btn single-quotation-btn-reject"
                  onClick={handleReject}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Negotiate Modal */}
        {showNegotiateModal && (
          <div
            className="single-quotation-modal-overlay"
            onClick={() => setShowNegotiateModal(false)}
          >
            <div
              className="single-quotation-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="single-quotation-modal-header">
                <h2>Negotiate Price</h2>
                <button
                  className="single-quotation-modal-close"
                  onClick={() => setShowNegotiateModal(false)}
                >
                  x
                </button>
              </div>
              <div className="single-quotation-modal-body">
                <p>
                  Current quoted price:{" "}
                  <strong>
                    KWD {quotedPrice.totalAmount?.toFixed(2) || "0.00"}
                  </strong>
                </p>
                <label
                  style={{
                    display: "block",
                    marginTop: "12px",
                    fontWeight: "600",
                  }}
                >
                  Your Counter Offer (KWD):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="single-quotation-textarea"
                  style={{ height: "auto", padding: "10px" }}
                  placeholder="Enter your counter offer amount..."
                  value={negotiateAmount}
                  onChange={(e) => setNegotiateAmount(e.target.value)}
                />
                <label
                  style={{
                    display: "block",
                    marginTop: "12px",
                    fontWeight: "600",
                  }}
                >
                  Message (optional):
                </label>
                <textarea
                  className="single-quotation-textarea"
                  rows="3"
                  placeholder="Explain your counter offer..."
                  value={negotiateMessage}
                  onChange={(e) => setNegotiateMessage(e.target.value)}
                />
              </div>
              <div className="single-quotation-modal-footer">
                <button
                  className="single-quotation-btn single-quotation-btn-secondary"
                  onClick={() => setShowNegotiateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="single-quotation-btn single-quotation-btn-accept"
                  onClick={handleNegotiate}
                  style={{ backgroundColor: "#f59e0b" }}
                >
                  Submit Counter Offer
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Admin Negotiation Modal */}
        {showAdminNegotiationModal && quotation && (
          <AdminNegotiationModal
            quotation={quotation}
            onClose={() => setShowAdminNegotiationModal(false)}
            onSuccess={handleAdminNegotiationSuccess}
          />
        )}
      </div>
      <Footer />
    </>
  );
};

export default QuotationDetails;
