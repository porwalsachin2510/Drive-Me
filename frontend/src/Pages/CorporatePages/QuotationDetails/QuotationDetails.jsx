"use client";

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
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import "./QuotationDetails.css";

const QuotationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState("commuters");
  
  const { currentQuotation, loading, error } = useSelector(
    (state) => state.quotation
  );

  useEffect(() => {
    if (id && id !== "undefined" && id !== "null") {
      console.log("Fetching quotation with ID:", id);
      dispatch(getQuotationById(id));
    } else {
      console.error("Invalid or missing quotation ID in URL params:", id);
    }
  }, [id, dispatch]);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [showContractModal, setShowContractModal] = useState(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [negotiateAmount, setNegotiateAmount] = useState("");
  const [negotiateMessage, setNegotiateMessage] = useState("");

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
    if (
      window.confirm(
        "Are you sure you want to accept this quotation? This will move it forward for contract processing."
      )
    ) {
      const data = {
        decision: "accept",
        message: "Quotation accepted. Looking forward to working together.",
      };

      const result = await dispatch(acceptQuotation({ quotationId: id, data }));

      if (result.type === "quotation/acceptQuotation/fulfilled") {
        alert("Quotation accepted successfully!");
        navigate(`/quotation/${id}`);
      }
    }
  };

  const handleReject = async () => {
    if (!rejectMessage.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    const data = {
      decision: "reject",
      message: rejectMessage,
    };

    const result = await dispatch(rejectQuotation({ quotationId: id, data }));

    if (result.type === "quotation/rejectQuotation/fulfilled") {
      alert("Quotation rejected successfully!");
      setShowRejectModal(false);
      navigate(`/my-quotations`);
    }
  };

  const handleNegotiate = async () => {
    if (!negotiateAmount || parseFloat(negotiateAmount) <= 0) {
      alert("Please enter a valid counter offer amount");
      return;
    }

    const result = await dispatch(
      negotiateQuotation({
        quotationId: id,
        counterOffer: { totalAmount: parseFloat(negotiateAmount) },
        message: negotiateMessage,
      })
    );

    if (result.type === "quotation/negotiateQuotation/fulfilled") {
      alert("Counter offer submitted successfully!");
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
    alert("Contract created successfully!");
    // Optionally navigate to the contract details page or contracts list
    navigate(`/corporate/contracts`);
    // Or refresh the quotation to show updated status
    // dispatch(getQuotationById(id));
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
          onClick={() => navigate(-1)}
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

        {/* Rental Period Details */}
        <div className="single-quotation-section">
          <h2>Rental Period Details</h2>
          <div className="single-quotation-card">
            <div className="single-quotation-info-grid">
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
                        <div className="single-quotation-spec-item">
                          <span>Seats:</span>
                          <strong>
                            {vehicle.capacity?.seatingCapacity || "N/A"}
                          </strong>
                        </div>
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
                          KWD{" "}
                          {quotedPrice.breakdown?.vehicleRental?.toFixed(2) ||
                            "0.00"}
                        </strong>
                      </div>
                      {requirements.withDriver && (
                        <div className="single-quotation-breakdown-row">
                          <span>Driver Charges:</span>
                          <strong>
                            KWD{" "}
                            {quotedPrice.breakdown?.driverCharges?.toFixed(2) ||
                              "0.00"}
                          </strong>
                        </div>
                      )}
                      {requirements.fuelIncluded && (
                        <div className="single-quotation-breakdown-row">
                          <span>Fuel Charges:</span>
                          <strong>
                            KWD{" "}
                            {quotedPrice.breakdown?.fuelCharges?.toFixed(2) ||
                              "0.00"}
                          </strong>
                        </div>
                      )}
                      <div className="single-quotation-breakdown-row single-quotation-breakdown-total">
                        <span>Total Amount:</span>
                        <strong>
                          KWD {quotedPrice.totalAmount?.toFixed(2) || "0.00"}
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
                              </span>
                            </div>
                            <div className="single-quotation-breakdown-rows">
                              <div className="single-quotation-breakdown-row">
                                <span>Base Rental:</span>
                                <strong>
                                  KWD{" "}
                                  {breakdown.baseRental?.toFixed(2) || "0.00"}
                                </strong>
                              </div>
                              {requirements.withDriver &&
                                breakdown.driverCharges > 0 && (
                                  <div className="single-quotation-breakdown-row">
                                    <span>Driver Charges:</span>
                                    <strong>
                                      KWD{" "}
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
                                      KWD{" "}
                                      {breakdown.fuelCharges?.toFixed(2) ||
                                        "0.00"}
                                    </strong>
                                  </div>
                                )}
                              <div className="single-quotation-breakdown-row single-quotation-breakdown-subtotal">
                                <span>Subtotal:</span>
                                <strong>
                                  KWD{" "}
                                  {breakdown.totalAmount?.toFixed(2) || "0.00"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )
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

                {/* Action Buttons */}
                <div className="single-quotation-action-buttons">
                  <button
                    className="single-quotation-btn single-quotation-btn-accept"
                    onClick={handleAcceptQuotation}
                  >
                    Accept Quotation
                  </button>
                  <button
                    className="single-quotation-btn single-quotation-btn-negotiate"
                    onClick={() => setShowNegotiateModal(true)}
                    style={{ backgroundColor: "#f59e0b", color: "#fff" }}
                  >
                    Negotiate Price
                  </button>
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
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.vehicleRental?.toFixed(
                        2
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="single-quotation-price-row">
                    <span className="single-quotation-price-label">
                      Driver Charges:
                    </span>
                    <span className="single-quotation-price-value">
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.driverCharges?.toFixed(
                        2
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="single-quotation-price-row">
                    <span className="single-quotation-price-label">
                      Fuel Charges:
                    </span>
                    <span className="single-quotation-price-value">
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.fuelCharges?.toFixed(
                        2
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="single-quotation-price-row single-quotation-total-row">
                    <span className="single-quotation-price-label">
                      Total Amount:
                    </span>
                    <span className="single-quotation-price-value single-quotation-total-value">
                      KWD{" "}
                      {quotation.quotedPrice.totalAmount?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>

                {/* Create Contract Button */}
                <div className="single-quotation-action-buttons">
                  <button
                    className="single-quotation-btn single-quotation-btn-contract"
                    onClick={handleCreateContractRequest}
                  >
                    Create Contract Request
                  </button>
                </div>
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
                  Current quoted price: <strong>KWD {quotedPrice.totalAmount?.toFixed(2) || "0.00"}</strong>
                </p>
                <label style={{ display: "block", marginTop: "12px", fontWeight: "600" }}>
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
                <label style={{ display: "block", marginTop: "12px", fontWeight: "600" }}>
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
      </div>
      <Footer />
    </>
  );
};

export default QuotationDetails;
