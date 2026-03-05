import "./PaymentBreakdown.css";

const PaymentBreakdown = ({ contract }) => {
  const financials = contract?.financials || {};
  const quotation = contract?.quotationId || {};
  const totalAmount = financials.totalAmount || quotation.totalAmount || 0;
  const currency = financials.currency || quotation.currency || "AED";

  const advanceAmount = (totalAmount * 50) / 100;
  const remainingAmount = (totalAmount * 50) / 100;
  const securityDeposit = (totalAmount * 10) / 100;
  const totalPayment = advanceAmount + securityDeposit;
  const adminCommission = (advanceAmount * 10) / 100;
  const fleetOwnerGetsFromAdvance = advanceAmount - adminCommission;

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
        <div className="breakdown-item highlight">
          <span className="breakdown-label">Advance + Security Deposit:</span>
          <span className="breakdown-amount total-due">
            {currency} {totalPayment.toFixed(2)}
          </span>
        </div>
        <div className="breakdown-info">
          <p>
            You will pay {currency} {advanceAmount.toFixed(2)} (advance) +{" "}
            {currency} {securityDeposit.toFixed(2)} (deposit) = {currency}{" "}
            {totalPayment.toFixed(2)} total
          </p>
        </div>
      </div>

      <div className="breakdown-divider"></div>

      <div className="breakdown-section">
        <h4>Commission Breakdown (On Advance Only)</h4>
        <div className="breakdown-item">
          <span className="breakdown-label">
            Admin Commission (10% of Advance):
          </span>
          <span className="breakdown-amount commission">
            {currency} {adminCommission.toFixed(2)}
          </span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">
            Fleet Owner Gets (90% of Advance):
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
    </div>
  );
};

export default PaymentBreakdown;
