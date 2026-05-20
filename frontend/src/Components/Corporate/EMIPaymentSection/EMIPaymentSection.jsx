import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getEMIPlanByContract,
  payEMIInstallment,
} from "../../../Redux/slices/emiPaymentSlice";
import api from "../../../utils/api";
import "./EMIPaymentSection.css";

const EMIPaymentSection = ({ contract, onRefresh }) => {
  const dispatch = useDispatch();
  const { currentEMIPlan, loading } = useSelector((state) => state.emiPayment);

  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Payment control state
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true);
  const [loadingPaymentSettings, setLoadingPaymentSettings] = useState(true);

  // Define which methods are online payment methods
  const onlinePaymentMethods = ["CARD", "BANK_TRANSFER"];

  const currency = contract?.financials?.currency || "AED";
  const paymentMode = contract?.financials?.paymentMode;

  useEffect(() => {
    if (contract?._id && paymentMode === "EMI") {
      dispatch(getEMIPlanByContract({ contractId: contract._id }));
    }
  }, [contract?._id, paymentMode, dispatch]);

  // Fetch payment settings to check if online payments are enabled
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        setLoadingPaymentSettings(true);
        const response = await api.get("/pages/public/payment-settings");
        if (response.data.success) {
          setOnlinePaymentsEnabled(response.data.data.onlinePaymentsEnabled);
        }
      } catch (error) {
        console.error("Error fetching payment settings:", error);
        // Default to enabled if fetch fails
        setOnlinePaymentsEnabled(true);
      } finally {
        setLoadingPaymentSettings(false);
      }
    };

    fetchPaymentSettings();
  }, []);

  const handlePayInstallment = async () => {
    if (!selectedPaymentMethod) {
      alert("Please select a payment method");
      return;
    }

    setProcessingPayment(true);

    try {
      const result = await dispatch(
        payEMIInstallment({
          emiPaymentId: currentEMIPlan._id,
          installmentNumber: selectedInstallment.installmentNumber,
          paymentMethod: selectedPaymentMethod,
        }),
      ).unwrap();

      if (result.data?.paymentSession?.paymentUrl) {
        window.location.href = result.data.paymentSession.paymentUrl;
      } else {
        alert(result.message || "Payment submitted successfully!");
        setShowPayModal(false);
        setSelectedInstallment(null);
        setSelectedPaymentMethod("");
        dispatch(getEMIPlanByContract({ contractId: contract._id }));
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      alert(error || "Failed to process payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "PAID":
        return "status-paid";
      case "OVERDUE":
        return "status-overdue";
      case "PENDING":
      default:
        return "status-pending";
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate, status) => {
    if (status === "PAID") return false;
    return new Date(dueDate) < new Date();
  };

  // Don't show anything if EMI is not active - PaymentOptionsComparison handles the selection
  if (paymentMode !== "EMI") {
    return null;
  }

  // Show EMI Plan Details when EMI mode is active
  if (!currentEMIPlan) {
    return (
      <div className="emi-section emi-loading">
        <div className="loading-message">Loading EMI plan details...</div>
      </div>
    );
  }

  if (currentEMIPlan) {
    const { emiPlan, installments, summary, serviceSuspension } =
      currentEMIPlan;

    return (
      <div className="emi-section emi-active">
        <div className="emi-plan-header">
          <div className="emi-plan-title">
            <h3>EMI Payment Plan</h3>
            <span className={`emi-status ${emiPlan.status.toLowerCase()}`}>
              {emiPlan.status}
            </span>
          </div>
          <div className="emi-plan-info">
            <div className="info-item">
              <span className="info-label">Tenure</span>
              <span className="info-value">{emiPlan.tenure} Months</span>
            </div>
            <div className="info-item">
              <span className="info-label">Monthly EMI</span>
              <span className="info-value">
                {emiPlan.currency} {emiPlan.monthlyEMI.toLocaleString()}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Total Amount</span>
              <span className="info-value">
                {emiPlan.currency} {emiPlan.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Service Suspension Warning */}
        {serviceSuspension?.isSuspended && (
          <div className="suspension-warning">
            <div className="warning-icon">!</div>
            <div className="warning-content">
              <h4>Service Suspended</h4>
              <p>
                {serviceSuspension.suspensionReason ||
                  "Due to EMI payment default"}
              </p>
              <p>Please clear your dues to reactivate services.</p>
            </div>
          </div>
        )}

        {/* EMI Progress */}
        <div className="emi-progress">
          <div className="progress-stats">
            <div className="stat-item paid">
              <span className="stat-value">{summary.installmentsPaid}</span>
              <span className="stat-label">Paid</span>
            </div>
            <div className="stat-item remaining">
              <span className="stat-value">
                {summary.installmentsRemaining}
              </span>
              <span className="stat-label">Remaining</span>
            </div>
            {summary.installmentsOverdue > 0 && (
              <div className="stat-item overdue">
                <span className="stat-value">
                  {summary.installmentsOverdue}
                </span>
                <span className="stat-label">Overdue</span>
              </div>
            )}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(summary.installmentsPaid / emiPlan.tenure) * 100}%`,
              }}
            />
          </div>
          <div className="progress-amounts">
            <span>
              Paid: {currency} {summary.totalPaid.toLocaleString()}
            </span>
            <span>
              Remaining: {currency} {summary.totalRemaining.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Next Due Info */}
        {summary.nextDueDate && (
          <div className="next-due-card">
            <div className="due-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="due-content">
              <span className="due-label">Next EMI Due</span>
              <span className="due-date">
                {formatDate(summary.nextDueDate)}
              </span>
            </div>
          </div>
        )}

        {/* Installments List */}
        <div className="installments-section">
          <h4>Installment Schedule</h4>
          <div className="installments-list">
            {installments.map((installment) => (
              <div
                key={installment.installmentNumber}
                className={`installment-item ${getStatusClass(installment.status)} ${isOverdue(installment.dueDate, installment.status) ? "is-overdue" : ""}`}
              >
                <div className="installment-number">
                  #{installment.installmentNumber}
                </div>
                <div className="installment-details">
                  <div className="installment-amount">
                    {currency}{" "}
                    {(
                      installment.totalAmountDue || installment.amount
                    ).toLocaleString()}
                    {installment.lateFee > 0 && (
                      <span className="late-fee-badge">
                        +{currency} {installment.lateFee} late fee
                      </span>
                    )}
                  </div>
                  <div className="installment-date">
                    Due: {formatDate(installment.dueDate)}
                    {installment.paidAt && (
                      <span className="paid-date">
                        Paid: {formatDate(installment.paidAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="installment-status">
                  <span
                    className={`status-badge ${getStatusClass(installment.status)}`}
                  >
                    {installment.status}
                  </span>
                  {installment.status !== "PAID" && (
                    <button
                      className="btn-pay-now"
                      onClick={() => {
                        setSelectedInstallment(installment);
                        setShowPayModal(true);
                      }}
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Modal */}
        {showPayModal && selectedInstallment && (
          <div
            className="emi-modal-overlay"
            onClick={() => setShowPayModal(false)}
          >
            <div
              className="emi-modal pay-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="emi-modal-header">
                <h2>
                  Pay EMI Installment #{selectedInstallment.installmentNumber}
                </h2>
                <button
                  className="close-btn"
                  onClick={() => setShowPayModal(false)}
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
                <div className="payment-amount-display">
                  <span>Amount to Pay</span>
                  <strong>
                    {currency}{" "}
                    {(
                      selectedInstallment.totalAmountDue ||
                      selectedInstallment.amount
                    ).toLocaleString()}
                  </strong>
                  {selectedInstallment.lateFee > 0 && (
                    <span className="includes-late-fee">
                      (Includes {currency} {selectedInstallment.lateFee} late
                      fee)
                    </span>
                  )}
                </div>

                <div className="payment-methods">
                  <h4>Select Payment Method</h4>
                  {loadingPaymentSettings ? (
                    <div className="loading-payment-methods">
                      Loading payment options...
                    </div>
                  ) : (
                    <>
                      <div className="method-options">
                        {["CARD", "BANK_TRANSFER", "CASH"]
                          .filter((method) => {
                            // Hide online payment methods if disabled
                            if (
                              !onlinePaymentsEnabled &&
                              onlinePaymentMethods.includes(method)
                            ) {
                              return false;
                            }
                            return true;
                          })
                          .map((method) => (
                            <div
                              key={method}
                              className={`method-option ${selectedPaymentMethod === method ? "selected" : ""}`}
                              onClick={() => setSelectedPaymentMethod(method)}
                            >
                              <div className="method-icon">
                                {method === "CARD" && "Card/Wallet"}
                                {method === "BANK_TRANSFER" && "Bank Transfer"}
                                {method === "CASH" && "Cash"}
                              </div>
                              {selectedPaymentMethod === method && (
                                <div className="selected-indicator" />
                              )}
                            </div>
                          ))}
                      </div>

                      {/* Notice when online payments are disabled */}
                      {!onlinePaymentsEnabled && (
                        <div className="online-payments-disabled-notice">
                          <span>
                            Online payment methods are currently unavailable.
                            Please use cash payment.
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="emi-modal-footer">
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedInstallment(null);
                    setSelectedPaymentMethod("");
                  }}
                  disabled={processingPayment}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm"
                  onClick={handlePayInstallment}
                  disabled={!selectedPaymentMethod || processingPayment}
                >
                  {processingPayment ? "Processing..." : "Pay Now"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default EMIPaymentSection;
