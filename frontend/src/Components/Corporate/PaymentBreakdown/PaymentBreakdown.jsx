/* eslint-disable no-unused-vars */
import { getActiveCurrency } from "../../../config/localeConfig";
import "./PaymentBreakdown.css";

const PaymentBreakdown = ({
  contract,
  payment,
  paymentType = "advance",
  commissionPreview = null,
}) => {
  // Handle both contract and payment props
  // If payment is provided (Admin view), use payment data
  // If contract is provided (Corporate view), use contract data
  // paymentType: "advance" or "final"

  // Check if this is an EMI payment
  const isEMIPayment =
    payment?.paymentSource === "EMI" || payment?.paymentType === "EMI";

  // If this is an EMI payment, render EMI-specific breakdown
  if (isEMIPayment && payment?.emiData) {
    return <EMIPaymentBreakdown payment={payment} />;
  }

  let totalAmount = 0;
  let currency = getActiveCurrency();
  let negotiationCommission = 0;
  let negotiationCommissionStatus = null;
  let hasNegotiationCommission = false;
  // Platform default is 20% (matches backend DEFAULT_COMMISSION_PERCENTAGE and the
  // Commission Management screen). This is only a placeholder — the real applied
  // rate comes from `commissionPreview`, `payment`, or the contract below.
  let commissionRate = 20;

  // Use actual amounts from payment if available (already calculated with correct rates)
  let actualAdminCommission = null;
  let actualFleetOwnerAmount = null;

  if (payment) {
    // Use payment object directly (from Admin Payment Verification)
    totalAmount =
      payment.contractId?.financials?.totalAmount ||
      payment.contractId?.quotationId?.quotedPrice?.totalAmount ||
      payment.amount ||
      0;
    currency =
      payment.currency ||
      payment.contractId?.financials?.currency ||
      getActiveCurrency();
    negotiationCommission =
      payment.negotiationCommissionAmount ||
      payment.contractId?.negotiationCommission?.adminCommission ||
      0;
    negotiationCommissionStatus =
      payment.contractId?.negotiationCommission?.commissionStatus;
    hasNegotiationCommission = negotiationCommission > 0;

    // Get commission rate from payment - prefer the actual stored rate
    commissionRate =
      payment.appliedCommissionRate ||
      payment.adminCommission?.percentage ||
      payment.contractId?.appliedCommissionRate ||
      20;

    // Use actual calculated amounts from payment if available
    if (
      payment.adminCommission &&
      typeof payment.adminCommission === "object"
    ) {
      actualAdminCommission = payment.adminCommission.amount;
    } else if (typeof payment.adminCommission === "number") {
      actualAdminCommission = payment.adminCommission;
    }
    actualFleetOwnerAmount = payment.fleetOwnerAmount;
  } else if (contract) {
    // Use contract object (from Corporate Contract Details)
    const financials = contract?.financials || {};
    const quotation = contract?.quotationId || {};
    totalAmount =
      financials.totalAmount ||
      quotation.totalAmount ||
      quotation?.quotedPrice?.totalAmount ||
      0;
    currency = financials.currency || quotation.currency || getActiveCurrency();
    // Prefer the live backend preview (the exact rate that will be charged),
    // then any rate stored on the contract, then the platform default.
    commissionRate =
      commissionPreview?.appliedCommissionRate ||
      contract.appliedCommissionRate ||
      financials.appliedCommissionRate ||
      20;

    // When the preview is available, use its exact split so the modal shows the
    // same admin/fleet-owner amounts the backend will actually apply.
    if (commissionPreview) {
      actualAdminCommission = commissionPreview.adminCommission;
      actualFleetOwnerAmount = commissionPreview.fleetOwnerAmount;
    }

    // Check for negotiation commission on contract
    if (contract.negotiationCommission) {
      negotiationCommission =
        contract.negotiationCommission.adminCommission || 0;
      negotiationCommissionStatus =
        contract.negotiationCommission.commissionStatus;
      hasNegotiationCommission = negotiationCommission > 0;
    }
  }

  const advanceAmount = (totalAmount * 50) / 100;
  const remainingAmount = (totalAmount * 50) / 100;
  const securityDeposit = (totalAmount * 10) / 100;

  // For advance payment: include security deposit and pending negotiation commission
  // For final payment: only the remaining amount (50%)
  const isAdvancePayment = paymentType === "advance";

  // Only add negotiation commission to total if status is PENDING (not yet paid) AND it's advance payment
  const pendingNegotiationCommission =
    isAdvancePayment &&
    hasNegotiationCommission &&
    negotiationCommissionStatus === "PENDING"
      ? negotiationCommission
      : 0;
  const totalPayment = isAdvancePayment
    ? advanceAmount + securityDeposit + pendingNegotiationCommission
    : remainingAmount;

  // Use actual amounts from payment if available, otherwise calculate based on dynamic rate
  const adminCommission =
    actualAdminCommission !== null
      ? actualAdminCommission
      : (advanceAmount * commissionRate) / 100;
  const fleetOwnerGetsFromAdvance =
    actualFleetOwnerAmount !== null
      ? actualFleetOwnerAmount
      : advanceAmount - adminCommission;

  return (
    <div className="payment-breakdown">
      <h3 className="breakdown-title">Payment Breakdown</h3>

      <div className="breakdown-section">
        <h4>Contract Value</h4>
        <div className="breakdown-item">
          <span className="breakdown-label">Total Contract Amount:</span>
          <span className="breakdown-amount">
            {currency} {totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>Payment Schedule</h4>

        <div className="breakdown-item">
          <span className="breakdown-label">1. Advance Payment (50%):</span>
          <span className="breakdown-amount">
            {currency} {advanceAmount.toFixed(2)}
          </span>
        </div>

        <div className="breakdown-item payment-with-note">
          <span className="breakdown-label">
            2. Security Deposit (10% Extra):
          </span>
          <span className="breakdown-amount">
            {currency} {securityDeposit.toFixed(2)}
          </span>
          <span className="breakdown-note">
            Refundable after contract completion
          </span>
        </div>

        <div className="breakdown-item">
          <span className="breakdown-label">3. Remaining Amount (50%):</span>
          <span className="breakdown-amount">
            {currency} {remainingAmount.toFixed(2)}
          </span>
          <span className="breakdown-note">
            Due 30 days from advance payment
          </span>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>What You Pay Now</h4>

        {isAdvancePayment ? (
          <>
            {/* Advance Payment Breakdown */}
            <div className="breakdown-item">
              <span className="breakdown-label">Advance Payment (50%):</span>
              <span className="breakdown-amount">
                {currency} {advanceAmount.toFixed(2)}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Security Deposit (10%):</span>
              <span className="breakdown-amount">
                {currency} {securityDeposit.toFixed(2)}
              </span>
            </div>

            {/* Negotiation Service Fee - Show only if pending */}
            {hasNegotiationCommission &&
              negotiationCommissionStatus === "PENDING" && (
                <div className="breakdown-item negotiation-fee">
                  <span className="breakdown-label">
                    Negotiation Service Fee:
                  </span>
                  <span className="breakdown-amount negotiation-commission">
                    {currency} {negotiationCommission.toFixed(2)}
                  </span>
                  <span className="breakdown-note">
                    Commission for admin negotiation service (based on savings
                    achieved)
                  </span>
                </div>
              )}

            {/* Show if negotiation commission already paid */}
            {hasNegotiationCommission &&
              negotiationCommissionStatus === "PAID" && (
                <div className="breakdown-item negotiation-fee paid">
                  <span className="breakdown-label">
                    Negotiation Service Fee:
                  </span>
                  <span className="breakdown-amount negotiation-paid">
                    {currency} {negotiationCommission.toFixed(2)} (Paid)
                  </span>
                </div>
              )}

            <div className="breakdown-divider small"></div>

            <div className="breakdown-item highlight">
              <span className="breakdown-label">Total Due Now:</span>
              <span className="breakdown-amount total-due">
                {currency} {totalPayment.toFixed(2)}
              </span>
            </div>
            <div className="breakdown-info">
              <p>
                {pendingNegotiationCommission > 0 ? (
                  <>
                    Advance ({currency} {advanceAmount.toFixed(2)}) + Deposit (
                    {currency} {securityDeposit.toFixed(2)}) + Negotiation Fee (
                    {currency} {pendingNegotiationCommission.toFixed(2)}) ={" "}
                    <strong>
                      {currency} {totalPayment.toFixed(2)}
                    </strong>
                  </>
                ) : (
                  <>
                    Advance ({currency} {advanceAmount.toFixed(2)}) + Deposit (
                    {currency} {securityDeposit.toFixed(2)}) ={" "}
                    <strong>
                      {currency} {totalPayment.toFixed(2)}
                    </strong>
                  </>
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Final/Remaining Payment Breakdown */}
            <div className="breakdown-item">
              <span className="breakdown-label">Remaining Amount (50%):</span>
              <span className="breakdown-amount">
                {currency} {remainingAmount.toFixed(2)}
              </span>
            </div>

            <div className="breakdown-divider small"></div>

            <div className="breakdown-item highlight">
              <span className="breakdown-label">Total Due Now:</span>
              <span className="breakdown-amount total-due">
                {currency} {totalPayment.toFixed(2)}
              </span>
            </div>
            <div className="breakdown-info">
              <p>
                This is the final payment for your contract. Remaining 50% ={" "}
                <strong>
                  {currency} {remainingAmount.toFixed(2)}
                </strong>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Only show commission breakdown for advance payments */}
      {isAdvancePayment && (
        <>
          <div className="breakdown-divider"></div>

          <div className="breakdown-section">
            <h4>Commission Breakdown (On Advance Only)</h4>
            <div className="breakdown-item">
              <span className="breakdown-label">
                Admin Commission ({commissionRate}% of Advance):
              </span>
              <span className="breakdown-amount commission">
                {currency} {adminCommission.toFixed(2)}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">
                Fleet Owner Gets ({100 - commissionRate}% of Advance):
              </span>
              <span className="breakdown-amount fleet-owner">
                {currency} {fleetOwnerGetsFromAdvance.toFixed(2)}
              </span>
            </div>
            <div className="breakdown-info">
              <p>
                Security deposit {currency} {securityDeposit.toFixed(2)} is held
                separately and will be refunded
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// EMI Payment Breakdown Component for Admin Verification
const EMIPaymentBreakdown = ({ payment }) => {
  const currency = payment.currency || getActiveCurrency();
  const emiData = payment.emiData || {};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const totalEMIAmount = payment.amount || 0;
  const contractAmountPortion =
    emiData.contractAmountPortion ||
    totalEMIAmount - (emiData.negotiationCommissionPortion || 0);
  const adminCommissionRate = emiData.adminCommission?.rate || 20;
  const adminCommissionAmount = emiData.adminCommission?.amount || 0;
  const negotiationCommissionPortion =
    emiData.negotiationCommissionPortion || 0;
  const fleetOwnerAmount = emiData.fleetOwnerAmount || 0;
  const tenure = emiData.tenure || 6;
  const totalEMIPlanAmount = emiData.totalAmount || 0;
  const monthlyEMI = emiData.monthlyEMI || 0;

  // Total admin earnings from this installment
  const totalAdminEarnings =
    adminCommissionAmount + negotiationCommissionPortion;

  return (
    <div className="payment-breakdown emi-breakdown">
      <h3 className="breakdown-title">EMI Installment Breakdown</h3>

      <div className="breakdown-section">
        <h4>Installment Details</h4>
        <div className="breakdown-item">
          <span className="breakdown-label">Installment Number:</span>
          <span className="breakdown-amount">
            #{payment.installmentNumber} of {tenure}
          </span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Payment Method:</span>
          <span className="breakdown-amount">
            {payment.paymentMethod === "BANK_TRANSFER"
              ? "Bank Transfer"
              : payment.paymentMethod || "Manual"}
          </span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Total EMI Amount:</span>
          <span className="breakdown-amount">
            {formatCurrency(totalEMIAmount)}
          </span>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>Amount Distribution</h4>

        <div className="breakdown-item">
          <span className="breakdown-label">Contract Amount Portion:</span>
          <span className="breakdown-amount">
            {formatCurrency(contractAmountPortion)}
          </span>
        </div>

        {negotiationCommissionPortion > 0 && (
          <div className="breakdown-item">
            <span className="breakdown-label">
              Negotiation Commission Portion:
            </span>
            <span className="breakdown-amount negotiation-commission">
              {formatCurrency(negotiationCommissionPortion)}
            </span>
            <span className="breakdown-note">
              (Total {currency} 1,000 spread across {tenure} installments)
            </span>
          </div>
        )}
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>Commission Breakdown (EMI)</h4>

        <div className="breakdown-item">
          <span className="breakdown-label">
            Admin Commission ({adminCommissionRate}% of Contract Portion):
          </span>
          <span className="breakdown-amount commission">
            {formatCurrency(adminCommissionAmount)}
          </span>
        </div>

        {negotiationCommissionPortion > 0 && (
          <div className="breakdown-item">
            <span className="breakdown-label">
              Negotiation Commission (to Admin):
            </span>
            <span className="breakdown-amount commission">
              {formatCurrency(negotiationCommissionPortion)}
            </span>
          </div>
        )}

        <div className="breakdown-item highlight-admin">
          <span className="breakdown-label">Total Admin Earnings:</span>
          <span className="breakdown-amount total-admin">
            {formatCurrency(totalAdminEarnings)}
          </span>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>Fleet Owner (B2B Partner) Earnings</h4>

        <div className="breakdown-item highlight">
          <span className="breakdown-label">Fleet Owner Receives:</span>
          <span className="breakdown-amount fleet-owner">
            {formatCurrency(fleetOwnerAmount)}
          </span>
        </div>

        <div className="breakdown-info">
          <p>
            Contract Portion ({formatCurrency(contractAmountPortion)}) - Admin
            Commission ({formatCurrency(adminCommissionAmount)}) ={" "}
            <strong>{formatCurrency(fleetOwnerAmount)}</strong>
          </p>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section summary-section">
        <h4>Verification Summary</h4>
        <div className="breakdown-summary">
          <div className="summary-row">
            <span className="summary-label">Corporate Pays:</span>
            <span className="summary-value">
              {formatCurrency(totalEMIAmount)}
            </span>
          </div>
          <div className="summary-row admin-row">
            <span className="summary-label">Admin Receives:</span>
            <span className="summary-value">
              {formatCurrency(totalAdminEarnings)}
            </span>
          </div>
          <div className="summary-row fleet-row">
            <span className="summary-label">Fleet Owner Receives:</span>
            <span className="summary-value">
              {formatCurrency(fleetOwnerAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentBreakdown;
