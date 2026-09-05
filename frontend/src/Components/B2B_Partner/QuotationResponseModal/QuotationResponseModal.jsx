"use client";

import { useState } from "react";
import { getActiveCurrency } from "../../../config/localeConfig";
import ManagedServiceBrief from "../../Corporate/ManagedServiceBrief/ManagedServiceBrief";
import "./QuotationResponseModal.css";
import { notify } from "../../../utils/toast";
import { requestedByLabel, customerRoleLabel } from "../../../utils/roleFamilies";

// Common reasons a partner might reject a request. Presented as quick-pick
// chips so the partner can reject in one tap (they can still edit the text).
const QUICK_REJECTION_REASONS = [
  "No vehicles available right now",
  "Requested vehicles are already booked",
  "Rental dates don't work for us",
  "Route / location not serviceable",
  "Pricing is not viable for us",
];

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
  const [serviceCharge, setServiceCharge] = useState("");

  // Availability-aware quoting: the partner can offer fewer vehicles than the
  // customer requested and optionally promise more in the future.
  const [hasFutureAvailability, setHasFutureAvailability] = useState(false);
  const [futureAvailabilityNote, setFutureAvailabilityNote] = useState("");
  const [futureAvailabilityDate, setFutureAvailabilityDate] = useState("");

  // Totals used to detect whether this is a partial offer.
  const totalRequested = responseData.reduce(
    (sum, v) => sum + (Number(v.requestedQuantity ?? v.quantity) || 0),
    0,
  );
  const totalOffered = responseData.reduce(
    (sum, v) => sum + (Number(v.quantity) || 0),
    0,
  );
  const isPartialOffer = totalRequested > 0 && totalOffered < totalRequested;

  // Managed-service quotations let the partner add a management/service charge
  // (any amount, including 0) for running operations on the customer's behalf.
  const isManaged = quotation.serviceMode === "MANAGED";
  const customerRole =
    quotation.corporateOwnerId?.role ||
    quotation.corporateOwnerId?.userType ||
    quotation.corporateId?.role ||
    quotation.corporateId?.userType;
  const customerLabel = customerRoleLabel(customerRole);
  const customerNoun = customerRole === "SCHOOL_CUSTOMER" ? "School Customer" : "customer";

  const currency =
    quotation.currency ||
    quotation.vehicles?.[0]?.vehicleId?.pricing.currency ||
    getActiveCurrency();

  const handleVehicleDataChange = (index, field, value) => {
    const updatedData = [...responseData];
    const numValue = Number.parseFloat(value) || 0;
    updatedData[index][field] = numValue;
    setResponseData(updatedData);
  };

  // The partner sets how many of each vehicle they can actually supply now.
  // Offered quantity must be between 1 and the requested quantity.
  const handleOfferedQuantityChange = (index, value) => {
    const updatedData = [...responseData];
    const requested =
      Number(
        updatedData[index].requestedQuantity ?? updatedData[index].quantity,
      ) || 1;
    let offered = Math.floor(Number(value) || 0);
    if (offered < 1) offered = 1;
    if (offered > requested) offered = requested;
    updatedData[index].quantity = offered;
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

  const vehiclesSubtotal = () => {
    return responseData.reduce((total, vehicle) => {
      return total + calculateVehicleTotal(vehicle);
    }, 0);
  };

  const calculateGrandTotal = () => {
    const charge = isManaged ? Number.parseFloat(serviceCharge) || 0 : 0;
    return vehiclesSubtotal() + charge;
  };

  const handleSubmit = () => {
    if (responseType === "reject") {
      if (!rejectionReason.trim()) {
        notify("Please provide a reason for rejection");
        return;
      }
      onSubmit(quotation._id, {
        status: "rejected",
        message: rejectionReason,
      });
    } else {
      if (!responseMessage.trim()) {
        notify("Please provide a response message");
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
          requestedQuantity: Number(
            vehicle.requestedQuantity ?? vehicle.quantity,
          ),
          baseRental: baseTotal,
          driverCharges: driverTotal,
          fuelCharges: fuelTotal,
          totalAmount: vehicleSubtotal,
        };
      });

      const totalAmount = calculateGrandTotal();

      const quotedPriceData = {
        totalAmount: totalAmount,
        serviceCharge: isManaged ? Number.parseFloat(serviceCharge) || 0 : 0,
        breakdown: {
          vehicleRental: totalVehicleRental,
          driverCharges: totalDriverCharges,
          fuelCharges: totalFuelCharges,
        },
        perVehicleBreakdown: perVehicleBreakdown,
      };

  // If offering fewer vehicles now, a future-availability note is required
  // so the customer understands whether more are coming.

      if (
        isPartialOffer &&
        hasFutureAvailability &&
        !futureAvailabilityNote.trim()
      ) {
        notify(
          "Please describe the future availability (e.g. how many more vehicles and roughly when).",
        );
        return;
      }

      const fulfillmentData = {
        hasFutureAvailability: isPartialOffer ? hasFutureAvailability : false,
        futureAvailabilityNote:
          isPartialOffer && hasFutureAvailability
            ? futureAvailabilityNote.trim()
            : "",
        futureAvailabilityDate:
          isPartialOffer && hasFutureAvailability && futureAvailabilityDate
            ? futureAvailabilityDate
            : null,
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
        fulfillment: fulfillmentData,
      };

      console.log("Sending approval data:", approvalData);

      onSubmit(quotation._id, approvalData);
    }
  };

  return (
    <div
      className="drivemego-quotation-response-modal-overlay"
      onClick={onClose}
    >
      <div
        className="drivemego-quotation-response-modal-container drivemego-quotation-response-response-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Respond to Quotation</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
  {/* Managed-service quotations arrive with an operations brief the
                        customer authored: the routes, work locations & shifts and
                        employee roster you would be committing to. Read it BEFORE you
                        price so you can quote accurately (or reject if you can't cover
                        those routes). You can ask clarifying questions in the brief's
                        messaging thread without leaving this modal. */}
          {isManaged && (
            <div className="managed-brief-embed" style={{ marginBottom: 20 }}>
              <ManagedServiceBrief quotationId={quotation._id} mode="partner" />
            </div>
          )}

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
                    <strong>{customerLabel}:</strong>{" "}
                    {quotation.corporateOwnerId?.fullName}
                  </p>
                  <p>
                    <strong>Duration:</strong>{" "}
                    {quotation.rentalPeriod?.duration}{" "}
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
                            : quotation.rentalPeriod?.durationType}
                  </p>
                  <p>
                    <strong>Total Rental Days:</strong>{" "}
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
                          Requested:{" "}
                          {vehicle.requestedQuantity ?? vehicle.quantity}
                        </span>
                        <span className="days-badge">
                          Days: {vehicle.rentalDays}
                        </span>
                      </div>
                    </div>

                    {/* Availability: how many of this vehicle the partner can
                        actually supply now. Defaults to the full requested
                        amount; lower it if you don't have enough. */}
                    <div className="availability-control">
                      <label>
                        Vehicles you can supply now
                          <span className="availability-hint">
                            {requestedByLabel(customerRole)}{" "}
                            {vehicle.requestedQuantity ?? vehicle.quantity}
                          </span>
                      </label>
                      <div className="availability-input-row">
                        <input
                          type="number"
                          min="1"
                          max={vehicle.requestedQuantity ?? vehicle.quantity}
                          step="1"
                          value={vehicle.quantity}
                          onChange={(e) =>
                            handleOfferedQuantityChange(index, e.target.value)
                          }
                        />
                        <span className="availability-of">
                          of {vehicle.requestedQuantity ?? vehicle.quantity}
                        </span>
                      </div>
                      {Number(vehicle.quantity) <
                        Number(
                          vehicle.requestedQuantity ?? vehicle.quantity,
                        ) && (
                        <p className="availability-warning">
                          Partial: you are offering {vehicle.quantity} of{" "}
                          {vehicle.requestedQuantity ?? vehicle.quantity}{" "}
                          requested.
                        </p>
                      )}
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
                                  e.target.value,
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
                                    e.target.value,
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
                                    e.target.value,
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

              {isPartialOffer && (
                <div className="partial-offer-section">
                  <div className="partial-offer-banner">
                    <span className="partial-offer-icon">!</span>
                    <div>
                      <strong>
                        Partial offer: {totalOffered} of {totalRequested}{" "}
                        vehicles
                      </strong>
                      <p>
                        You are quoting only for the vehicles you have available
                        right now. That is perfectly fine &mdash; the {customerNoun}
                        can accept this partial offer or reject it. If you have
                        no vehicles available at all, use{" "}
                        <button
                          type="button"
                          className="inline-reject-link"
                          onClick={() => setResponseType("reject")}
                        >
                          Reject
                        </button>{" "}
                        instead.
                      </p>
                    </div>
                  </div>

                  {/* Future availability is completely OPTIONAL. A partner is
                      never required to promise more vehicles later. Only tick
                      this if you genuinely expect more capacity. */}
                  <label className="future-availability-toggle">
                    <input
                      type="checkbox"
                      checked={hasFutureAvailability}
                      onChange={(e) =>
                        setHasFutureAvailability(e.target.checked)
                      }
                    />
                    <span>
                      (Optional) I may have more vehicles available later
                    </span>
                  </label>

                  {hasFutureAvailability && (
                    <div className="future-availability-fields">
                      <div className="form-group">
                        <label>
                          Future availability details{" "}
                          <span className="required">*</span>
                        </label>
                        <textarea
                          rows="3"
                          placeholder="e.g. 3 more sedans expected by mid next month; you can take these now and add the rest later."
                          value={futureAvailabilityNote}
                          onChange={(e) =>
                            setFutureAvailabilityNote(e.target.value)
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Expected availability date (optional)</label>
                        <input
                          type="date"
                          value={futureAvailabilityDate}
                          onChange={(e) =>
                            setFutureAvailabilityDate(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isManaged && (
                <div className="managed-service-charge-section">
                  <div className="managed-service-charge-note">
                    <strong>Managed Service request.</strong> This {customerNoun}
                    wants you to run all operations (routes, schedules,
                    employees, trips and invitations) on their behalf. You may
                    add a management / service charge for this. Enter any
                    amount, or 0 for no charge.
                  </div>
                  <div className="form-group">
                    <label>Management / Service Charge ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grand-total-section">
                <h3>Total Quotation Amount</h3>
                {isManaged && (
                  <div className="grand-total-breakdown">
                    <div className="breakdown-item">
                      <span>Vehicles Subtotal:</span>
                      <span>
                        {currency} {vehiclesSubtotal().toFixed(2)}
                      </span>
                    </div>
                    <div className="breakdown-item">
                      <span>Management / Service Charge:</span>
                      <span>
                        {currency}{" "}
                        {(Number.parseFloat(serviceCharge) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <p className="grand-total">
                  {currency} {calculateGrandTotal().toFixed(2)}
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
                <div className="rejection-intro">
                  <strong>Rejecting this request?</strong>
                  <p>
                    Pick a quick reason below or write your own. The {customerNoun}
                    will see this message so they understand why you
                    couldn&apos;t quote.
                  </p>
                </div>

                <div className="rejection-quick-reasons">
                  {QUICK_REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`rejection-reason-chip ${
                        rejectionReason === reason ? "active" : ""
                      }`}
                      onClick={() => setRejectionReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

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

        <div className="drivemego-quotation-response-modal-footer">
          <button
            className="drivemego-quotation-response-btn drivemego-quotation-response-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`drivemego-quotation-response-btn ${
              responseType === "approve"
                ? "drivemego-quotation-response-btn-success"
                : "drivemego-quotation-response-btn-danger"
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
