import { useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import {
  createEMIPlan,
  getEMIPlanByContract,
} from "../../../Redux/slices/emiPaymentSlice";
import { getContractById } from "../../../Redux/slices/contractSlice";
import "./PaymentOptionsComparison.css";

// Helper to calculate contract duration in months
const calculateContractDurationMonths = (contract) => {
  if (!contract?.rentalPeriod) return 0;

  const { durationType, duration, startDate, endDate } = contract.rentalPeriod;

  // Calculate based on durationType and duration
  if (durationType === "DAILY") {
    return Math.ceil(duration / 30); // Convert days to months
  } else if (durationType === "WEEKLY") {
    return Math.ceil((duration * 7) / 30); // Convert weeks to months
  } else if (durationType === "MONTHLY" || durationType === "LONG_TERM") {
    return duration;
  }

  // Fallback: Calculate from actual dates
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 30);
  }

  return 0;
};

// Helper to determine if EMI should be available for this contract
const isEMIEligible = (contract) => {
  const durationMonths = calculateContractDurationMonths(contract);
  // EMI is only available for contracts of 3 months or more
  // Short-term contracts (daily, weekly, 1-2 months) should use standard payment only
  return durationMonths >= 3;
};

// Helper to generate dynamic EMI tenure options based on contract duration
const generateEMITenureOptions = (contract) => {
  const durationMonths = calculateContractDurationMonths(contract);

  // Standard EMI tenures
  const allTenures = [
    { value: 3, label: "3 Months", description: "Quarterly plan" },
    { value: 6, label: "6 Months", description: "Half-yearly plan" },
    { value: 9, label: "9 Months", description: "Extended plan" },
    { value: 12, label: "12 Months", description: "Annual plan" },
    { value: 18, label: "18 Months", description: "Long-term plan" },
    { value: 24, label: "24 Months", description: "Max tenure plan" },
  ];

  // Filter tenures that don't exceed contract duration
  // For a 3-month contract, only 3-month EMI is available
  // For a 6-month contract, 3 and 6-month EMIs are available
  // etc.
  return allTenures.filter((tenure) => tenure.value <= durationMonths);
};

const PaymentOptionsComparison = ({
  contract,
  onSelectStandardPayment,
  onRefresh,
  processingPayment,
}) => {
  const dispatch = useDispatch();

  // Calculate EMI eligibility and available tenures
  const emiEligible = useMemo(() => isEMIEligible(contract), [contract]);
  const availableEMITenures = useMemo(
    () => generateEMITenureOptions(contract),
    [contract],
  );
  const contractDurationMonths = useMemo(
    () => calculateContractDurationMonths(contract),
    [contract],
  );

  // Set default tenure to match contract duration or first available option
  const defaultTenure = useMemo(() => {
    if (availableEMITenures.length === 0) return 3;
    // Default to matching contract duration if available
    const matchingTenure = availableEMITenures.find(
      (t) => t.value === contractDurationMonths,
    );
    return matchingTenure ? matchingTenure.value : availableEMITenures[0].value;
  }, [availableEMITenures, contractDurationMonths]);

  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedTenure, setSelectedTenure] = useState(defaultTenure);
  const [showEMIModal, setShowEMIModal] = useState(false);
  const [creatingEMI, setCreatingEMI] = useState(false);

  const totalAmount = contract?.financials?.totalAmount || 0;
  const advanceAmount = contract?.financials?.advancePayment?.amount || 0;
  const securityDeposit = contract?.financials?.securityDeposit?.amount || 0;
  const finalPaymentAmount = contract?.financials?.finalPayment?.amount || 0;
  const currency = contract?.financials?.currency || "AED";

  // Negotiation Commission details
  const negotiationCommission =
    contract?.negotiationCommission?.adminCommission || 0;
  const hasNegotiationCommission = negotiationCommission > 0;

  // Calculate EMI
  const calculateEMI = (amount, tenure) => {
    return Math.ceil(amount / tenure);
  };

  // EMI includes late fee penalty info
  const lateFeePercentage = 2; // Default late fee percentage

  // Standard payment - what user pays upfront
  const standardUpfrontPayment =
    advanceAmount + securityDeposit + negotiationCommission;

  // EMI Total = Contract Amount + Negotiation Commission (Security deposit is waived)
  // Negotiation commission is spread across all EMIs, NOT paid separately
  const emiTotalAmount = totalAmount + negotiationCommission;

  // EMI - no upfront payment, but monthly installments (includes negotiation commission)
  const monthlyEMI = calculateEMI(emiTotalAmount, selectedTenure);

  // Per-installment breakdown for display
  const negotiationPerEMI = hasNegotiationCommission
    ? Math.ceil(negotiationCommission / selectedTenure)
    : 0;
  const contractPerEMI = calculateEMI(totalAmount, selectedTenure);

  const handleSelectOption = (option) => {
    setSelectedOption(option);
  };

  const handleProceedWithStandard = () => {
    if (onSelectStandardPayment) {
      onSelectStandardPayment();
    }
  };

  const handleProceedWithEMI = () => {
    setShowEMIModal(true);
  };

  const handleCreateEMIPlan = async () => {
    if (!selectedTenure) {
      alert("Please select an EMI tenure");
      return;
    }

    setCreatingEMI(true);
    try {
      const result = await dispatch(
        createEMIPlan({ contractId: contract._id, tenure: selectedTenure }),
      ).unwrap();

      alert(
        result.message ||
          "EMI plan created successfully! Contract is now active.",
      );
      setShowEMIModal(false);

      // Refresh contract and EMI data
      if (onRefresh) onRefresh();
      dispatch(getEMIPlanByContract({ contractId: contract._id }));
      dispatch(getContractById({ contractId: contract._id }));
    } catch (error) {
      alert(error || "Failed to create EMI plan");
    } finally {
      setCreatingEMI(false);
    }
  };

  return (
    <div className="payment-options-comparison">
      <div className="comparison-header">
        <h2>Choose Your Payment Method</h2>
        <p>Select how you would like to pay for this contract</p>
      </div>

      <div className="options-container">
        {/* Standard Payment Option */}
        <div
          className={`payment-option-card ${selectedOption === "standard" ? "selected" : ""}`}
          onClick={() => handleSelectOption("standard")}
        >
          <div className="option-header">
            <div className="option-icon standard-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div className="option-title">
              <h3>Standard Payment</h3>
              <span className="option-subtitle">Pay in 2 installments</span>
            </div>
            {selectedOption === "standard" && (
              <div className="selected-badge">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          <div className="option-breakdown">
            <div className="breakdown-title">Payment Breakdown</div>

            <div className="breakdown-item upfront">
              <div className="breakdown-label">
                <span className="step-number">1</span>
                <span>Pay Now (Upfront)</span>
              </div>
              <div className="breakdown-details">
                <div className="detail-row">
                  <span>Advance Payment (50%)</span>
                  <span>
                    {currency} {advanceAmount.toLocaleString()}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Security Deposit (Refundable)</span>
                  <span>
                    {currency} {securityDeposit.toLocaleString()}
                  </span>
                </div>
                {hasNegotiationCommission && (
                  <div className="detail-row commission">
                    <span>Negotiation Commission</span>
                    <span>
                      {currency} {negotiationCommission.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="detail-row total-row">
                  <strong>Total Upfront</strong>
                  <strong>
                    {currency} {standardUpfrontPayment.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="breakdown-item later">
              <div className="breakdown-label">
                <span className="step-number">2</span>
                <span>Pay Later (End of Contract)</span>
              </div>
              <div className="breakdown-details">
                <div className="detail-row">
                  <span>Final Payment (50%)</span>
                  <span>
                    {currency} {finalPaymentAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="option-features">
            <div className="feature-item pro">
              <span className="feature-icon">+</span>
              <span>Security deposit is fully refundable</span>
            </div>
            <div className="feature-item pro">
              <span className="feature-icon">+</span>
              <span>No additional interest or fees</span>
            </div>
            <div className="feature-item pro">
              <span className="feature-icon">+</span>
              <span>Contract activates after advance payment</span>
            </div>
            <div className="feature-item con">
              <span className="feature-icon">-</span>
              <span>Higher upfront payment required</span>
            </div>
          </div>

          <div className="option-total">
            <div className="total-label">Total Contract Value</div>
            <div className="total-amount">
              {currency} {totalAmount.toLocaleString()}
            </div>
            <div className="total-note">
              + {currency} {securityDeposit.toLocaleString()} refundable deposit
            </div>
          </div>

          {selectedOption === "standard" && (
            <button
              className="btn-proceed"
              onClick={handleProceedWithStandard}
              disabled={processingPayment}
            >
              {processingPayment
                ? "Processing..."
                : "Proceed with Standard Payment"}
            </button>
          )}
        </div>

        {/* EMI Payment Option - Only show if contract is EMI eligible (3+ months) */}
        {emiEligible ? (
          <div
            className={`payment-option-card emi-card ${selectedOption === "emi" ? "selected" : ""}`}
            onClick={() => handleSelectOption("emi")}
          >
            <div className="option-header">
              <div className="option-icon emi-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="option-title">
                <h3>EMI Payment</h3>
                <span className="option-subtitle">
                  Pay in easy monthly installments
                </span>
              </div>
              <span className="popular-badge">Popular</span>
              {selectedOption === "emi" && (
                <div className="selected-badge">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>

            <div className="option-breakdown">
              <div className="breakdown-title">Payment Structure</div>

              <div className="emi-selector">
                <label>Select EMI Tenure:</label>
                <div className="tenure-pills">
                  {availableEMITenures.map((option) => (
                    <button
                      key={option.value}
                      className={`tenure-pill ${selectedTenure === option.value ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTenure(option.value);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="tenure-info">
                  <small>
                    EMI options based on your {contractDurationMonths}-month
                    contract duration
                  </small>
                </div>
              </div>

              <div className="emi-calculation">
                <div className="emi-main">
                  <div className="emi-amount">
                    <span className="emi-value">
                      {currency} {monthlyEMI.toLocaleString()}
                    </span>
                    <span className="emi-period">/month</span>
                  </div>
                  <div className="emi-tenure">for {selectedTenure} months</div>
                </div>
                <div className="emi-total">
                  <span>
                    Total: {currency} {emiTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="emi-breakdown-details">
                <div className="detail-row highlight">
                  <span>Pay Now (Upfront)</span>
                  <span className="zero-amount">{currency} 0</span>
                </div>
                <div className="detail-row">
                  <span>Monthly EMI</span>
                  <span>
                    {currency} {monthlyEMI.toLocaleString()}
                  </span>
                </div>
                {hasNegotiationCommission && (
                  <div className="detail-row sub-detail">
                    <span className="sub-label">- Contract Portion</span>
                    <span>
                      {currency} {contractPerEMI.toLocaleString()}
                    </span>
                  </div>
                )}
                {hasNegotiationCommission && (
                  <div className="detail-row sub-detail">
                    <span className="sub-label">- Negotiation Fee</span>
                    <span>
                      {currency} {negotiationPerEMI.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span>Number of EMIs</span>
                  <span>{selectedTenure}</span>
                </div>
                <div className="detail-row">
                  <span>First EMI Due</span>
                  <span>End of this month</span>
                </div>
              </div>
            </div>

            <div className="option-features">
              <div className="feature-item pro">
                <span className="feature-icon">+</span>
                <span>No upfront payment required</span>
              </div>
              <div className="feature-item pro">
                <span className="feature-icon">+</span>
                <span>Contract activates immediately</span>
              </div>
              <div className="feature-item pro">
                <span className="feature-icon">+</span>
                <span>Spread payment over {selectedTenure} months</span>
              </div>
              <div className="feature-item con">
                <span className="feature-icon">-</span>
                <span>{lateFeePercentage}% late fee if EMI overdue</span>
              </div>
              <div className="feature-item con">
                <span className="feature-icon">-</span>
                <span>No security deposit refund benefit</span>
              </div>
              {hasNegotiationCommission && (
                <div className="feature-item neutral">
                  <span className="feature-icon">*</span>
                  <span>Negotiation commission included in EMI</span>
                </div>
              )}
            </div>

            <div className="option-total">
              <div className="total-label">Total EMI Value</div>
              <div className="total-amount">
                {currency} {emiTotalAmount.toLocaleString()}
              </div>
              <div className="total-note">
                {hasNegotiationCommission
                  ? `(Contract: ${currency} ${totalAmount.toLocaleString()} + Negotiation: ${currency} ${negotiationCommission.toLocaleString()})`
                  : "No security deposit required"}
              </div>
            </div>

            {selectedOption === "emi" && (
              <button
                className="btn-proceed emi-btn"
                onClick={handleProceedWithEMI}
                disabled={creatingEMI}
              >
                {creatingEMI ? "Creating Plan..." : "Proceed with EMI Payment"}
              </button>
            )}
          </div>
        ) : (
          /* Show message when EMI is not available for short-term contracts */
          <div className="payment-option-card emi-card emi-unavailable">
            <div className="option-header">
              <div className="option-icon emi-icon disabled">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="option-title">
                <h3>EMI Payment</h3>
                <span className="option-subtitle">
                  Not available for this contract
                </span>
              </div>
            </div>
            <div className="emi-unavailable-message">
              <div className="unavailable-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h4>EMI Not Available</h4>
              <p>
                EMI payment option is only available for long-term contracts (3
                months or more). Your current contract duration is{" "}
                <strong>
                  {contractDurationMonths}{" "}
                  {contractDurationMonths === 1 ? "month" : "months"}
                </strong>
                .
              </p>
              <div className="emi-requirements">
                <strong>EMI is available for:</strong>
                <ul>
                  <li>Quarterly contracts (3 months)</li>
                  <li>Half-yearly contracts (6 months)</li>
                  <li>Yearly contracts (12 months)</li>
                  <li>Long-term contracts (12+ months)</li>
                </ul>
              </div>
              <p className="alternative-suggestion">
                Please use <strong>Standard Payment</strong> (Advance + Final
                Payment) for this contract.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Comparison Table - Only show EMI column if eligible */}
      <div className="comparison-table-section">
        <h3>Quick Comparison</h3>
        <div className="comparison-table">
          <div className="table-header">
            <div className="table-cell"></div>
            <div className="table-cell">Standard Payment</div>
            {emiEligible && <div className="table-cell">EMI Payment</div>}
          </div>
          <div className="table-row">
            <div className="table-cell label">Upfront Payment</div>
            <div className="table-cell">
              {currency} {standardUpfrontPayment.toLocaleString()}
            </div>
            {emiEligible && (
              <div className="table-cell highlight">{currency} 0</div>
            )}
          </div>
          <div className="table-row">
            <div className="table-cell label">Security Deposit</div>
            <div className="table-cell">
              {currency} {securityDeposit.toLocaleString()} (Refundable)
            </div>
            {emiEligible && <div className="table-cell">Not Required</div>}
          </div>
          <div className="table-row">
            <div className="table-cell label">Monthly Payment</div>
            <div className="table-cell">None</div>
            {emiEligible && (
              <div className="table-cell">
                {currency} {monthlyEMI.toLocaleString()}/month
              </div>
            )}
          </div>
          <div className="table-row">
            <div className="table-cell label">Contract Activation</div>
            <div className="table-cell">After advance payment</div>
            {emiEligible && (
              <div className="table-cell highlight">Immediate</div>
            )}
          </div>
          <div className="table-row">
            <div className="table-cell label">Late Payment Fee</div>
            <div className="table-cell">None</div>
            {emiEligible && (
              <div className="table-cell">{lateFeePercentage}% of EMI</div>
            )}
          </div>
          {hasNegotiationCommission && (
            <div className="table-row">
              <div className="table-cell label">Negotiation Commission</div>
              <div className="table-cell">Paid upfront</div>
              {emiEligible && <div className="table-cell">Included in EMI</div>}
            </div>
          )}
          <div className="table-row total">
            <div className="table-cell label">Total Cost</div>
            <div className="table-cell">
              {currency}{" "}
              {(totalAmount + negotiationCommission).toLocaleString()}
            </div>
            {emiEligible && (
              <div className="table-cell">
                {currency} {emiTotalAmount.toLocaleString()}
              </div>
            )}
          </div>
        </div>
        {!emiEligible && (
          <div className="emi-not-available-note">
            <small>
              EMI payment option is not available for contracts shorter than 3
              months. Your contract duration: {contractDurationMonths}{" "}
              {contractDurationMonths === 1 ? "month" : "months"}.
            </small>
          </div>
        )}
      </div>

      {/* EMI Tenure Selection Modal - Only show if EMI eligible */}
      {showEMIModal && emiEligible && (
        <div
          className="emi-modal-overlay"
          onClick={() => setShowEMIModal(false)}
        >
          <div className="emi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emi-modal-header">
              <h2>Confirm EMI Plan</h2>
              <button
                className="close-btn"
                onClick={() => setShowEMIModal(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="emi-modal-content">
              <div className="total-amount-display">
                <span>Total EMI Amount</span>
                <strong>
                  {currency} {emiTotalAmount.toLocaleString()}
                </strong>
                {hasNegotiationCommission && (
                  <div className="amount-breakdown">
                    <small>
                      Contract: {currency} {totalAmount.toLocaleString()} +
                      Negotiation: {currency}{" "}
                      {negotiationCommission.toLocaleString()}
                    </small>
                  </div>
                )}
              </div>

              <div className="tenure-options">
                <div className="tenure-info-header">
                  <small>
                    Available EMI options for your {contractDurationMonths}
                    -month contract:
                  </small>
                </div>
                {availableEMITenures.map((option) => (
                  <div
                    key={option.value}
                    className={`tenure-option ${selectedTenure === option.value ? "selected" : ""}`}
                    onClick={() => setSelectedTenure(option.value)}
                  >
                    <div className="tenure-main">
                      <span className="tenure-months">{option.label}</span>
                      <span className="tenure-emi">
                        {currency}{" "}
                        {calculateEMI(
                          emiTotalAmount,
                          option.value,
                        ).toLocaleString()}
                        /month
                      </span>
                    </div>
                    <span className="tenure-description">
                      {option.description}
                    </span>
                    {selectedTenure === option.value && (
                      <div className="selected-check">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="emi-summary">
                <h4>EMI Summary</h4>
                <div className="summary-row">
                  <span>Monthly EMI:</span>
                  <strong>
                    {currency}{" "}
                    {calculateEMI(
                      emiTotalAmount,
                      selectedTenure,
                    ).toLocaleString()}
                  </strong>
                </div>
                {hasNegotiationCommission && (
                  <div className="summary-row sub-row">
                    <span>- Contract Portion:</span>
                    <span>
                      {currency}{" "}
                      {calculateEMI(
                        totalAmount,
                        selectedTenure,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {hasNegotiationCommission && (
                  <div className="summary-row sub-row">
                    <span>- Negotiation Fee:</span>
                    <span>
                      {currency}{" "}
                      {Math.ceil(
                        negotiationCommission / selectedTenure,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Total Installments:</span>
                  <strong>{selectedTenure}</strong>
                </div>
                <div className="summary-row">
                  <span>First EMI Due:</span>
                  <strong>End of this month</strong>
                </div>
                <div className="summary-row">
                  <span>Security Deposit:</span>
                  <strong className="waived">Waived (Not Required)</strong>
                </div>
                <div className="summary-note">
                  <p>
                    Late payment fee: {lateFeePercentage}% of EMI amount after
                    due date
                  </p>
                  <p>
                    Service may be suspended after 3 consecutive overdue EMIs
                  </p>
                </div>
              </div>
            </div>

            <div className="emi-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowEMIModal(false)}
                disabled={creatingEMI}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={handleCreateEMIPlan}
                disabled={!selectedTenure || creatingEMI}
              >
                {creatingEMI
                  ? "Creating Plan..."
                  : "Confirm EMI Plan & Activate Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentOptionsComparison;
