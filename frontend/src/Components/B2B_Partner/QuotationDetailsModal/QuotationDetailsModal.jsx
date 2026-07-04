"use client";
import { getActiveCurrency } from "../../../config/localeConfig";
import ManagedServiceBrief from "../../Corporate/ManagedServiceBrief/ManagedServiceBrief";
import "./QuotationDetailsModal.css";

const QuotationDetailsModal = ({ quotation, onClose }) => {
  // Managed-service requests always carry an operations brief submitted by the
  // corporate at request time. Show it read-only here so the partner can review
  // the routes, work locations & shifts and employee roster before it prices.
  const isManaged =
    quotation.serviceMode === "MANAGED" ||
    quotation.serviceType === "MANAGED_SERVICES" ||
    quotation.hasBrief === true;
  const quotationId = quotation._id || quotation.id;
  const currency =
    quotation.currency ||
    quotation.vehicles?.[0]?.vehicleId?.pricing?.currency ||
    getActiveCurrency();

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

  const mappedStatus = mapStatus(quotation.status);

  return (
    <div className="b2b-quotation-details-modal-overlay" onClick={onClose}>
      <div
        className="b2b-quotation-details-modal-container b2b-quotation-details-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="b2b-quotation-details-modal-header">
          <div className="b2b-quotation-details-modal-title-section">
            <h2>Quotation Details</h2>
            <span className="b2b-quotation-details-quotation-number-large">
              #{quotation.quotationNumber}
            </span>
          </div>
          <button
            className="b2b-quotation-details-modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="b2b-quotation-details-modal-body">
          {/* Status Badge */}
          <div className="b2b-quotation-details-status-section">
            <span
              className={`b2b-quotation-details-status-badge-large ${mappedStatus}`}
            >
              {mappedStatus}
            </span>
            <div className="b2b-quotation-details-dates-info">
              <p>
                <strong>Requested:</strong>{" "}
                {new Date(quotation.requestedAt).toLocaleString()}
              </p>
              {quotation.validUntil && (
                <p>
                  <strong>Valid Until:</strong>{" "}
                  {new Date(quotation.validUntil).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="b2b-quotation-details-detail-section">
            <h3 className="b2b-quotation-details-section-title">
              <span className="b2b-quotation-details-section-icon">👤</span>
              Customer Information
            </h3>
            <div className="b2b-quotation-details-detail-grid">
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  Full Name:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.corporateOwnerId?.fullName || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  Company Name:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.corporateOwnerId?.companyName || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  Email Address:
                </span>
                <span className="b2b-quotation-details-detail-value email-value">
                  {quotation.corporateOwnerId?.email || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  WhatsApp Number:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.corporateOwnerId?.whatsappNumber || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  Company Address:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.corporateOwnerId?.companyAddress || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item-full">
                <span className="b2b-quotation-details-detail-label">
                  Nationality:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.corporateOwnerId?.nationality || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Rental Period */}
          <div className="b2b-quotation-details-detail-section">
            <h3 className="b2b-quotation-details-section-title">
              <span className="b2b-quotation-details-section-icon">📅</span>
              Rental Period
            </h3>
            <div className="b2b-quotation-details-detail-grid">
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  Duration Type:
                </span>
                <span className="b2b-quotation-details-detail-value b2b-quotation-details-highlight">
                  {quotation.rentalPeriod?.durationType === "DAILY"
                    ? "Daily Rental"
                    : quotation.rentalPeriod?.durationType === "WEEKLY"
                      ? "Weekly Rental"
                      : quotation.rentalPeriod?.durationType === "MONTHLY"
                        ? "Monthly Rental"
                        : quotation.rentalPeriod?.durationType === "LONG_TERM"
                          ? "Long-term (Yearly)"
                          : quotation.rentalPeriod?.durationType || "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  Duration:
                </span>
                <span className="b2b-quotation-details-detail-value b2b-quotation-details-highlight">
                  {quotation.rentalPeriod?.duration || "N/A"}{" "}
                  {quotation.rentalPeriod?.durationType === "DAILY"
                    ? quotation.rentalPeriod?.duration === 1
                      ? "Day"
                      : "Days"
                    : quotation.rentalPeriod?.durationType === "WEEKLY"
                      ? quotation.rentalPeriod?.duration === 1
                        ? "Week"
                        : "Weeks"
                      : quotation.rentalPeriod?.durationType === "MONTHLY"
                        ? quotation.rentalPeriod?.duration === 1
                          ? "Month"
                          : "Months"
                        : quotation.rentalPeriod?.durationType === "LONG_TERM"
                          ? quotation.rentalPeriod?.duration === 1
                            ? "Year"
                            : "Years"
                          : ""}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  Start Date:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.rentalPeriod?.startDate
                    ? new Date(
                        quotation.rentalPeriod.startDate,
                      ).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  End Date:
                </span>
                <span className="b2b-quotation-details-detail-value">
                  {quotation.rentalPeriod?.endDate
                    ? new Date(
                        quotation.rentalPeriod.endDate,
                      ).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="b2b-quotation-details-detail-section">
            <h3 className="b2b-quotation-details-section-title">
              <span className="b2b-quotation-details-section-icon">📋</span>
              Requirements
            </h3>
            <div className="b2b-quotation-details-detail-grid">
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  Driver Required:
                </span>
                <span
                  className={`b2b-quotation-details-detail-value ${
                    quotation.requirements?.withDriver
                      ? "b2b-quotation-details-yes"
                      : "b2b-quotation-details-no"
                  }`}
                >
                  {quotation.requirements?.withDriver ? "✓ Yes" : "✗ No"}
                </span>
              </div>
              <div className="b2b-quotation-details-detail-item">
                <span className="b2b-quotation-details-detail-label">
                  Fuel Included:
                </span>
                <span
                  className={`b2b-quotation-details-detail-value ${
                    quotation.requirements?.fuelIncluded
                      ? "b2b-quotation-details-yes"
                      : "b2b-quotation-details-no"
                  }`}
                >
                  {quotation.requirements?.fuelIncluded ? "✓ Yes" : "✗ No"}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="b2b-quotation-details-detail-section">
            <h3 className="b2b-quotation-details-section-title">
              <span className="b2b-quotation-details-section-icon">🚗</span>
              Vehicle Details
            </h3>
            <div className="b2b-quotation-details-vehicles-list">
              {quotation.vehicles.map((vehicle, index) => {
                const vehicleData = vehicle.vehicleId;
                // Goods carriers report cargo capacity (tons), not seats.
                const isGoodsCarrier =
                  vehicleData?.serviceType === "GOODS_CARRIER" ||
                  (!vehicleData?.capacity?.seatingCapacity &&
                    !!vehicleData?.capacity?.cargoCapacity);
                return (
                  <div
                    key={index}
                    className="b2b-quotation-details-vehicle-detail-card"
                  >
                    <div className="b2b-quotation-details-vehicle-card-header">
                      <h4>
                        Vehicle {index + 1}: {vehicleData?.vehicleName || "N/A"}
                      </h4>
                      <span className="b2b-quotation-details-quantity-badge">
                        Qty: {vehicle.quantity}
                      </span>
                    </div>

                    <div className="b2b-quotation-details-vehicle-card-body">
                      <div className="b2b-quotation-details-vehicle-info-grid">
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            Category:
                          </span>
                          <span className="b2b-quotation-details-value">
                            {vehicleData?.vehicleCategory || "N/A"}
                          </span>
                        </div>
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            Registration:
                          </span>
                          <span className="b2b-quotation-details-value">
                            {vehicleData?.registrationNumber || "N/A"}
                          </span>
                        </div>
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            Manufacturing Year:
                          </span>
                          <span className="b2b-quotation-details-value">
                            {vehicleData?.manufacturingYear || "N/A"}
                          </span>
                        </div>
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            Vehicle Name:
                          </span>
                          <span className="b2b-quotation-details-value">
                            {vehicleData?.vehicleName || "N/A"}
                          </span>
                        </div>
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            {isGoodsCarrier
                              ? "Cargo Capacity:"
                              : "Seating Capacity:"}
                          </span>
                          <span className="b2b-quotation-details-value">
                            {isGoodsCarrier
                              ? vehicleData?.capacity?.cargoCapacity
                                ? `${vehicleData.capacity.cargoCapacity} tons`
                                : "N/A"
                              : `${vehicleData?.capacity?.seatingCapacity || "N/A"} Seats`}
                          </span>
                        </div>
                        <div className="b2b-quotation-details-vehicle-info-item">
                          <span className="b2b-quotation-details-label">
                            Location:
                          </span>
                          <span className="b2b-quotation-details-value">
                            {vehicleData?.location || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Pricing Information */}
                      {/* <div className="pricing-section">
                        <h5>Standard Pricing</h5>
                        <div className="pricing-grid">
                          <div className="pricing-item">
                            <span className="label">Daily Rate:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.dailyRate?.toFixed(2) ||
                                "0.00"}
                            </span>
                          </div>
                          <div className="pricing-item">
                            <span className="label">Weekly Rate:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.weeklyRate?.toFixed(2) ||
                                "0.00"}
                            </span>
                          </div>
                          <div className="pricing-item">
                            <span className="label">Monthly Rate:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.monthlyRate?.toFixed(2) ||
                                "0.00"}
                            </span>
                          </div>
                          <div className="pricing-item">
                            <span className="label">Driver Charges:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.driverCharges?.toFixed(
                                2
                              ) || "0.00"}
                            </span>
                          </div>
                          <div className="pricing-item">
                            <span className="label">Fuel Charges:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.fuelCharges?.toFixed(2) ||
                                "0.00"}
                            </span>
                          </div>
                          <div className="pricing-item">
                            <span className="label">Per KM Charge:</span>
                            <span className="value">
                              KWD{" "}
                              {vehicleData?.pricing?.perKmCharge?.toFixed(2) ||
                                "0.00"}
                            </span>
                          </div>
                        </div>
                      </div> */}

                      {/* Facilities */}
                      {vehicleData?.facilities && (
                        <div className="b2b-quotation-details-facilities-section">
                          <h5>Facilities</h5>
                          <div className="b2b-quotation-details-facilities-grid">
                            {Object.entries(vehicleData.facilities).map(
                              ([key, value]) =>
                                value && (
                                  <div
                                    key={key}
                                    className="b2b-quotation-details-facility-item"
                                  >
                                    <span className="b2b-quotation-details-facility-icon">
                                      ✓
                                    </span>
                                    <span className="b2b-quotation-details-facility-name">
                                      {key.replace(/([A-Z])/g, " $1").trim()}
                                    </span>
                                  </div>
                                ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle Photos */}
                      {vehicleData?.photos && vehicleData.photos.length > 0 && (
                        <div className="b2b-quotation-details-photos-section">
                          <h5>Vehicle Photos</h5>
                          <div className="b2b-quotation-details-photos-grid">
                            {vehicleData.photos.map((photo, idx) => (
                              <img
                                key={idx}
                                src={photo.url || "/placeholder.svg"}
                                alt={`Vehicle ${index + 1} - ${idx + 1}`}
                                className="b2b-quotation-details-vehicle-photo"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quoted Price Breakdown */}
          {quotation.status === "QUOTED" &&
            quotation.quotedPrice?.perVehicleBreakdown &&
            quotation.quotedPrice.perVehicleBreakdown.length > 0 && (
              <div className="b2b-quotation-details-detail-section b2b-quotation-details-quoted-section">
                <h3 className="b2b-quotation-details-section-title">
                  <span className="b2b-quotation-details-section-icon">💰</span>
                  Your Quotation Breakdown
                </h3>
                {quotation.quotedPrice.perVehicleBreakdown.map(
                  (breakdown, index) => (
                    <div
                      key={index}
                      className="b2b-quotation-details-breakdown-card"
                    >
                      <h4>{breakdown.vehicleName}</h4>
                      <div className="b2b-quotation-details-breakdown-details">
                        <div className="b2b-quotation-details-breakdown-row">
                          <span>Base Rate:</span>
                          <span>
                            {currency} {(breakdown.baseRental ?? 0).toFixed(2)}
                          </span>
                        </div>
                        {breakdown.driverCharges > 0 && (
                          <div className="b2b-quotation-details-breakdown-row">
                            <span>Driver Charges:</span>
                            <span>
                              {currency}{" "}
                              {(breakdown.driverCharges ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {breakdown.fuelCharges > 0 && (
                          <div className="b2b-quotation-details-breakdown-row">
                            <span>Fuel Charges:</span>
                            <span>
                              {currency}{" "}
                              {(breakdown.fuelCharges ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="b2b-quotation-details-breakdown-row">
                          <span>Quantity:</span>
                          <span>{breakdown.quantity}</span>
                        </div>
                        <div className="b2b-quotation-details-breakdown-row b2b-quotation-details-subtotal">
                          <span>Subtotal:</span>
                          <span>
                            {currency} {(breakdown.totalAmount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
                <div className="b2b-quotation-details-total-amount-section">
                  <h3>Total Amount</h3>
                  <p className="b2b-quotation-details-total-amount">
                    {currency} {quotation.quotedPrice.totalAmount.toFixed(2)}
                  </p>
                </div>
                {quotation.responseMessage && (
                  <div className="b2b-quotation-details-response-message-box">
                    <h5>Message:</h5>
                    <p>{quotation.responseMessage}</p>
                  </div>
                )}
                {quotation.terms && (
                  <div className="b2b-quotation-details-terms-box">
                    <h5>Terms & Conditions:</h5>
                    <p>{quotation.terms}</p>
                  </div>
                )}
              </div>
            )}

          {/* Managed Service Brief — the operational requirements the corporate
              submitted with the request. Read-only for the partner here so it
              can confirm it can serve these routes/locations before quoting. */}
          {isManaged && quotationId && (
            <div className="b2b-quotation-details-detail-section">
              <h3 className="b2b-quotation-details-section-title">
                <span className="b2b-quotation-details-section-icon">📋</span>
                Managed Service Brief
              </h3>
              <p className="b2b-quotation-details-brief-hint">
                Review the requested routes, work locations &amp; shifts and
                employee roster below before you submit a quote.
              </p>
              <ManagedServiceBrief quotationId={quotationId} mode="partner" />
            </div>
          )}

          {/* Rejection Message */}
          {quotation.status === "REJECTED" && quotation.responseMessage && (
            <div className="b2b-quotation-details-detail-section b2b-quotation-details-rejection-section">
              <h3 className="b2b-quotation-details-section-title">
                <span className="b2b-quotation-details-section-icon">❌</span>
                Rejection Reason
              </h3>
              <p className="b2b-quotation-details-rejection-message">
                {quotation.responseMessage}
              </p>
            </div>
          )}
        </div>

        <div className="b2b-quotation-details-modal-footer">
          <button
            className="b2b-quotation-details-btn b2b-quotation-details-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetailsModal;
