"use client";
import "./QuotationDetailsModal.css";

const QuotationDetailsModal = ({ quotation, onClose }) => {
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-section">
            <h2>Quotation Details</h2>
            <span className="quotation-number-large">
              #{quotation.quotationNumber}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Status Badge */}
          <div className="status-section">
            <span className={`status-badge-large ${mappedStatus}`}>
              {mappedStatus}
            </span>
            <div className="dates-info">
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
          <div className="detail-section">
            <h3 className="section-title">
              <span className="section-icon">👤</span>
              Customer Information
            </h3>
            <div className="detail-grid">
              <div className="detail-item-full">
                <span className="detail-label">Full Name:</span>
                <span className="detail-value">
                  {quotation.corporateOwnerId?.fullName || "N/A"}
                </span>
              </div>
              <div className="detail-item-full">
                <span className="detail-label">Company Name:</span>
                <span className="detail-value">
                  {quotation.corporateOwnerId?.companyName || "N/A"}
                </span>
              </div>
              <div className="detail-item-full">
                <span className="detail-label">Email Address:</span>
                <span className="detail-value email-value">
                  {quotation.corporateOwnerId?.email || "N/A"}
                </span>
              </div>
              <div className="detail-item-full">
                <span className="detail-label">WhatsApp Number:</span>
                <span className="detail-value">
                  {quotation.corporateOwnerId?.whatsappNumber || "N/A"}
                </span>
              </div>
              <div className="detail-item-full">
                <span className="detail-label">Company Address:</span>
                <span className="detail-value">
                  {quotation.corporateOwnerId?.companyAddress || "N/A"}
                </span>
              </div>
              <div className="detail-item-full">
                <span className="detail-label">Nationality:</span>
                <span className="detail-value">
                  {quotation.corporateOwnerId?.nationality || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Rental Period */}
          <div className="detail-section">
            <h3 className="section-title">
              <span className="section-icon">📅</span>
              Rental Period
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Duration Type:</span>
                <span className="detail-value highlight">
                  {quotation.rentalPeriod?.durationType || "N/A"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration:</span>
                <span className="detail-value highlight">
                  {quotation.rentalPeriod?.duration || "N/A"}{" "}
                  {quotation.rentalPeriod?.durationType === "DAILY"
                    ? "Days"
                    : quotation.rentalPeriod?.durationType === "WEEKLY"
                    ? "Weeks"
                    : quotation.rentalPeriod?.durationType === "MONTHLY"
                    ? "Months"
                    : ""}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Start Date:</span>
                <span className="detail-value">
                  {quotation.rentalPeriod?.startDate
                    ? new Date(
                        quotation.rentalPeriod.startDate
                      ).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">End Date:</span>
                <span className="detail-value">
                  {quotation.rentalPeriod?.endDate
                    ? new Date(
                        quotation.rentalPeriod.endDate
                      ).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="detail-section">
            <h3 className="section-title">
              <span className="section-icon">📋</span>
              Requirements
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Driver Required:</span>
                <span
                  className={`detail-value ${
                    quotation.requirements?.withDriver ? "yes" : "no"
                  }`}
                >
                  {quotation.requirements?.withDriver ? "✓ Yes" : "✗ No"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Fuel Included:</span>
                <span
                  className={`detail-value ${
                    quotation.requirements?.fuelIncluded ? "yes" : "no"
                  }`}
                >
                  {quotation.requirements?.fuelIncluded ? "✓ Yes" : "✗ No"}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="detail-section">
            <h3 className="section-title">
              <span className="section-icon">🚗</span>
              Vehicle Details
            </h3>
            <div className="vehicles-list">
              {quotation.vehicles.map((vehicle, index) => {
                const vehicleData = vehicle.vehicleId;
                return (
                  <div key={index} className="vehicle-detail-card">
                    <div className="vehicle-card-header">
                      <h4>
                        Vehicle {index + 1}: {vehicleData?.vehicleName || "N/A"}
                      </h4>
                      <span className="quantity-badge">
                        Qty: {vehicle.quantity}
                      </span>
                    </div>

                    <div className="vehicle-card-body">
                      <div className="vehicle-info-grid">
                        <div className="vehicle-info-item">
                          <span className="label">Category:</span>
                          <span className="value">
                            {vehicleData?.vehicleCategory || "N/A"}
                          </span>
                        </div>
                        <div className="vehicle-info-item">
                          <span className="label">Registration:</span>
                          <span className="value">
                            {vehicleData?.registrationNumber || "N/A"}
                          </span>
                        </div>
                        <div className="vehicle-info-item">
                          <span className="label">Manufacturing Year:</span>
                          <span className="value">
                            {vehicleData?.manufacturingYear || "N/A"}
                          </span>
                        </div>
                        <div className="vehicle-info-item">
                          <span className="label">Vehicle Name:</span>
                          <span className="value">
                            {vehicleData?.vehicleName || "N/A"}
                          </span>
                        </div>
                        <div className="vehicle-info-item">
                          <span className="label">Seating Capacity:</span>
                          <span className="value">
                            {vehicleData?.capacity?.seatingCapacity || "N/A"}{" "}
                            Seats
                          </span>
                        </div>
                        <div className="vehicle-info-item">
                          <span className="label">Location:</span>
                          <span className="value">
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
                        <div className="facilities-section">
                          <h5>Facilities</h5>
                          <div className="facilities-grid">
                            {Object.entries(vehicleData.facilities).map(
                              ([key, value]) =>
                                value && (
                                  <div key={key} className="facility-item">
                                    <span className="facility-icon">✓</span>
                                    <span className="facility-name">
                                      {key.replace(/([A-Z])/g, " $1").trim()}
                                    </span>
                                  </div>
                                )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle Photos */}
                      {vehicleData?.photos && vehicleData.photos.length > 0 && (
                        <div className="photos-section">
                          <h5>Vehicle Photos</h5>
                          <div className="photos-grid">
                            {vehicleData.photos.map((photo, idx) => (
                              <img
                                key={idx}
                                src={photo.url || "/placeholder.svg"}
                                alt={`Vehicle ${index + 1} - ${idx + 1}`}
                                className="vehicle-photo"
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
              <div className="detail-section quoted-section">
                <h3 className="section-title">
                  <span className="section-icon">💰</span>
                  Your Quotation Breakdown
                </h3>
                {quotation.quotedPrice.perVehicleBreakdown.map(
                  (breakdown, index) => (
                    <div key={index} className="breakdown-card">
                      <h4>{breakdown.vehicleName}</h4>
                      <div className="breakdown-details">
                        <div className="breakdown-row">
                          <span>Base Rate:</span>
                          <span>
                            KWD {(breakdown.baseRental ?? 0).toFixed(2)}
                          </span>
                        </div>
                        {breakdown.driverCharges > 0 && (
                          <div className="breakdown-row">
                            <span>Driver Charges:</span>
                            <span>
                              KWD {(breakdown.driverCharges ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {breakdown.fuelCharges > 0 && (
                          <div className="breakdown-row">
                            <span>Fuel Charges:</span>
                            <span>
                              KWD {(breakdown.fuelCharges ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="breakdown-row">
                          <span>Quantity:</span>
                          <span>{breakdown.quantity}</span>
                        </div>
                        <div className="breakdown-row subtotal">
                          <span>Subtotal:</span>
                          <span>
                            KWD {(breakdown.totalAmount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
                <div className="total-amount-section">
                  <h3>Total Amount</h3>
                  <p className="total-amount">
                    KWD {quotation.quotedPrice.totalAmount.toFixed(2)}
                  </p>
                </div>
                {quotation.responseMessage && (
                  <div className="response-message-box">
                    <h5>Message:</h5>
                    <p>{quotation.responseMessage}</p>
                  </div>
                )}
                {quotation.terms && (
                  <div className="terms-box">
                    <h5>Terms & Conditions:</h5>
                    <p>{quotation.terms}</p>
                  </div>
                )}
              </div>
            )}

          {/* Rejection Message */}
          {quotation.status === "REJECTED" && quotation.responseMessage && (
            <div className="detail-section rejection-section">
              <h3 className="section-title">
                <span className="section-icon">❌</span>
                Rejection Reason
              </h3>
              <p className="rejection-message">{quotation.responseMessage}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetailsModal;
