"use client";

import { useState } from "react";
import "./QuotationResponseModal.css";

const QuotationResponseModal = ({
  quotation,
  responseData,
  setResponseData,
  onClose,
  onSubmit,
  loading,
}) => {
  const [responseType, setResponseType] = useState("approve");
  const [responseMessage, setResponseMessage] = useState("");
  const [terms, setTerms] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const currency =
    quotation.currency ||
    quotation.vehicles?.[0]?.vehicleId?.pricing.currency ||
    "AED";
  
  const handleVehicleDataChange = (index, field, value) => {
    const updatedData = [...responseData];
    const numValue = Number.parseFloat(value) || 0;
    updatedData[index][field] = numValue;
    setResponseData(updatedData);
  };

  const calculateVehicleTotal = (vehicle) => {
    const quantity = Number(vehicle.quantity) || 0;
    const rentalDays = Number(vehicle.rentalDays) || 0;
    const customBaseRatePerDay = Number(vehicle.customBaseRatePerDay) || 0;
    const customDriverChargesPerDay =
      Number(vehicle.customDriverChargesPerDay) || 0;
    const customFuelChargesPerDay =
      Number(vehicle.customFuelChargesPerDay) || 0;

    // Base calculation: baseRate × quantity × days
    const baseTotal = customBaseRatePerDay * quantity * rentalDays;

    // Driver charges: ONLY if withDriver is true
    const driverTotal = vehicle.withDriver
      ? customDriverChargesPerDay * quantity * rentalDays
      : 0;

    // Fuel charges: ONLY if withFuel is true
    const fuelTotal = vehicle.withFuel
      ? customFuelChargesPerDay * quantity * rentalDays
      : 0;

    const total = baseTotal + driverTotal + fuelTotal;

    return total;
  };

  const calculateGrandTotal = () => {
    return responseData.reduce((total, vehicle) => {
      return total + calculateVehicleTotal(vehicle);
    }, 0);
  };

  const handleSubmit = () => {
    if (responseType === "reject") {
      if (!rejectionReason.trim()) {
        alert("Please provide a reason for rejection");
        return;
      }
      onSubmit(quotation._id, {
        status: "rejected",
        message: rejectionReason,
      });
    } else {
      if (!responseMessage.trim()) {
        alert("Please provide a response message");
        return;
      }

      console.log("Response data before calculation:", responseData);

      let totalVehicleRental = 0;
      let totalDriverCharges = 0;
      let totalFuelCharges = 0;

      const perVehicleBreakdown = responseData.map((vehicle) => {
        const baseTotal =
          vehicle.customBaseRatePerDay * vehicle.quantity * vehicle.rentalDays;
        const driverTotal = vehicle.withDriver
          ? vehicle.customDriverChargesPerDay *
            vehicle.quantity *
            vehicle.rentalDays
          : 0;
        const fuelTotal = vehicle.withFuel
          ? vehicle.customFuelChargesPerDay *
            vehicle.quantity *
            vehicle.rentalDays
          : 0;
        const vehicleSubtotal = baseTotal + driverTotal + fuelTotal;

        // Add to totals for breakdown
        totalVehicleRental += baseTotal;
        totalDriverCharges += driverTotal;
        totalFuelCharges += fuelTotal;

        console.log("Vehicle breakdown calculation:", {
          vehicleName: vehicle.vehicleName,
          quantity: vehicle.quantity,
          rentalDays: vehicle.rentalDays,
          withDriver: vehicle.withDriver,
          withFuel: vehicle.withFuel,
          baseTotal,
          driverTotal,
          fuelTotal,
          vehicleSubtotal,
        });

        return {
          vehicleId: vehicle.vehicleId,
          vehicleName: vehicle.vehicleName,
          quantity: vehicle.quantity,
          baseRental: baseTotal,
          driverCharges: driverTotal,
          fuelCharges: fuelTotal,
          totalAmount: vehicleSubtotal,
        };
      });

      const totalAmount = calculateGrandTotal();

      const quotedPriceData = {
        totalAmount: totalAmount,
        breakdown: {
          vehicleRental: totalVehicleRental,
          driverCharges: totalDriverCharges,
          fuelCharges: totalFuelCharges,
        },
        perVehicleBreakdown: perVehicleBreakdown,
      };

      console.log("Quoted price object:", quotedPriceData);
      console.log("Total breakdown:", {
        totalVehicleRental,
        totalDriverCharges,
        totalFuelCharges,
        totalAmount,
      });

      const approvalData = {
        status: "approved",
        message: responseMessage,
        terms: terms,
        quotedPrice: quotedPriceData,
      };

      console.log("Sending approval data:", approvalData);

      onSubmit(quotation._id, approvalData);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container response-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Respond to Quotation</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="response-type-selector">
            <button
              className={`type-btn approve ${
                responseType === "approve" ? "active" : ""
              }`}
              onClick={() => setResponseType("approve")}
            >
              <span className="btn-icon">✓</span>
              Approve & Quote
            </button>
            <button
              className={`type-btn reject ${
                responseType === "reject" ? "active" : ""
              }`}
              onClick={() => setResponseType("reject")}
            >
              <span className="btn-icon">✗</span>
              Reject
            </button>
          </div>

          {responseType === "approve" ? (
            <>
              <div className="quotation-summary">
                <h3>Quotation Summary</h3>
                <div className="summary-info">
                  <p>
                    <strong>Customer:</strong>{" "}
                    {quotation.corporateOwnerId?.fullName}
                  </p>
                  <p>
                    <strong>Duration:</strong>{" "}
                    {quotation.rentalPeriod?.duration}{" "}
                    {quotation.rentalPeriod?.durationType}
                  </p>
                  <p>
                    <strong>Rental Days:</strong>{" "}
                    {responseData[0]?.rentalDays || 0} days
                  </p>
                  <p>
                    <strong>Currency:</strong> {currency}
                  </p>
                </div>
              </div>

              <div className="vehicles-pricing-section">
                <h3>Set Pricing for Each Vehicle</h3>
                {responseData.map((vehicle, index) => (
                  <div key={index} className="vehicle-pricing-card">
                    <div className="vehicle-pricing-header">
                      <h4>{vehicle.vehicleName}</h4>
                      <div className="vehicle-meta">
                        <span className="quantity-badge">
                          Quantity: {vehicle.quantity}
                        </span>
                        <span className="days-badge">
                          Days: {vehicle.rentalDays}
                        </span>
                      </div>
                    </div>

                    <div className="vehicle-requirements">
                      <span
                        className={`req-badge ${
                          vehicle.withDriver ? "active" : "inactive"
                        }`}
                      >
                        {vehicle.withDriver ? "✓ With Driver" : "✗ No Driver"}
                      </span>
                      <span
                        className={`req-badge ${
                          vehicle.withFuel ? "active" : "inactive"
                        }`}
                      >
                        {vehicle.withFuel ? "✓ Fuel Included" : "✗ No Fuel"}
                      </span>
                    </div>

                    <div className="pricing-inputs">
                      <div className="pricing-row">
                        {/* Base Rate - Always shown */}
                        <div className="input-group">
                          <label>
                            Base Rate (per vehicle per day)
                            <span className="hint">
                              Standard: {currency}{" "}
                              {Number(vehicle.baseRatePerDay).toFixed(2)}/day
                            </span>
                          </label>
                          <div className="input-with-currency">
                            <span className="currency">{currency}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={vehicle.customBaseRatePerDay}
                              onChange={(e) =>
                                handleVehicleDataChange(
                                  index,
                                  "customBaseRatePerDay",
                                  e.target.value
                                )
                              }
                              placeholder="0.00"
                            />
                          </div>
                          <p className="calculation-hint">
                            = {currency} {vehicle.customBaseRatePerDay} ×{" "}
                            {vehicle.quantity} vehicles × {vehicle.rentalDays}{" "}
                            days ={" "}
                            <strong>
                              {currency}{" "}
                              {(
                                vehicle.customBaseRatePerDay *
                                vehicle.quantity *
                                vehicle.rentalDays
                              ).toFixed(2)}
                            </strong>
                          </p>
                        </div>

                        {/* Driver Charges - Only if withDriver is true */}
                        {vehicle.withDriver && (
                          <div className="input-group">
                            <label>
                              Driver Charges (per vehicle per day)
                              <span className="hint">
                                Standard: {currency}{" "}
                                {Number(vehicle.driverChargesPerDay).toFixed(2)}
                                /day
                              </span>
                            </label>
                            <div className="input-with-currency">
                              <span className="currency">{currency}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={vehicle.customDriverChargesPerDay}
                                onChange={(e) =>
                                  handleVehicleDataChange(
                                    index,
                                    "customDriverChargesPerDay",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <p className="calculation-hint">
                              = {currency} {vehicle.customDriverChargesPerDay} ×{" "}
                              {vehicle.quantity} vehicles × {vehicle.rentalDays}{" "}
                              days ={" "}
                              <strong>
                                {currency}{" "}
                                {(
                                  vehicle.customDriverChargesPerDay *
                                  vehicle.quantity *
                                  vehicle.rentalDays
                                ).toFixed(2)}
                              </strong>
                            </p>
                          </div>
                        )}

                        {/* Fuel Charges - Only if withFuel is true */}
                        {vehicle.withFuel && (
                          <div className="input-group">
                            <label>
                              Fuel Charges (per vehicle per day)
                              <span className="hint">
                                Standard: {currency}{" "}
                                {Number(vehicle.fuelChargesPerDay).toFixed(2)}
                                /day
                              </span>
                            </label>
                            <div className="input-with-currency">
                              <span className="currency">{currency}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={vehicle.customFuelChargesPerDay}
                                onChange={(e) =>
                                  handleVehicleDataChange(
                                    index,
                                    "customFuelChargesPerDay",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>
                            <p className="calculation-hint">
                              = {currency} {vehicle.customFuelChargesPerDay} ×{" "}
                              {vehicle.quantity} vehicles × {vehicle.rentalDays}{" "}
                              days ={" "}
                              <strong>
                                {currency}{" "}
                                {(
                                  vehicle.customFuelChargesPerDay *
                                  vehicle.quantity *
                                  vehicle.rentalDays
                                ).toFixed(2)}
                              </strong>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="vehicle-total">
                        <div className="total-breakdown">
                          <div className="breakdown-item">
                            <span>Base Total:</span>
                            <span>
                              {currency}{" "}
                              {(
                                vehicle.customBaseRatePerDay *
                                vehicle.quantity *
                                vehicle.rentalDays
                              ).toFixed(2)}
                            </span>
                          </div>
                          {vehicle.withDriver && (
                            <div className="breakdown-item">
                              <span>Driver Total:</span>
                              <span>
                                {currency}{" "}
                                {(
                                  vehicle.customDriverChargesPerDay *
                                  vehicle.quantity *
                                  vehicle.rentalDays
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {vehicle.withFuel && (
                            <div className="breakdown-item">
                              <span>Fuel Total:</span>
                              <span>
                                {currency}{" "}
                                {(
                                  vehicle.customFuelChargesPerDay *
                                  vehicle.quantity *
                                  vehicle.rentalDays
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="total-line">
                          <span>Total for this vehicle type:</span>
                          <span className="total-value">
                            {currency}{" "}
                            {calculateVehicleTotal(vehicle).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grand-total-section">
                <h3>Total Quotation Amount</h3>
                <p className="grand-total">
                  KWD {calculateGrandTotal().toFixed(2)}
                </p>
              </div>

              <div className="form-group">
                <label>
                  Response Message <span className="required">*</span>
                </label>
                <textarea
                  rows="4"
                  placeholder="Enter your message to the customer..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Terms & Conditions</label>
                <textarea
                  rows="3"
                  placeholder="Add any specific terms and conditions (optional)..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="rejection-section">
                <div className="form-group">
                  <label>
                    Reason for Rejection <span className="required">*</span>
                  </label>
                  <textarea
                    rows="5"
                    placeholder="Please provide a clear reason for rejecting this quotation request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${
              responseType === "approve" ? "btn-success" : "btn-danger"
            }`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : responseType === "approve"
              ? "Submit Quotation"
              : "Reject Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotationResponseModal;
