import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { verifyEMIOnlinePayment } from "../../Redux/slices/emiPaymentSlice";
import "./EMIPaymentCallback.css";

const EMIPaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [status, setStatus] = useState("processing");
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Prevent duplicate verification calls (React StrictMode can cause double mounting)
  const verificationAttempted = useRef(false);
  const sessionId = searchParams.get("session_id");
  const urlStatus = searchParams.get("status");
  const provider = searchParams.get("provider");

  useEffect(() => {
    const verifyPayment = async () => {
      // Prevent duplicate calls from React StrictMode or double renders
      if (verificationAttempted.current) {
        console.log("[v0] EMI verification already attempted, skipping");
        return;
      }
      verificationAttempted.current = true;

      if (!sessionId) {
        setStatus("error");
        setErrorMessage("Invalid payment session. No session ID found.");
        return;
      }

      // If URL indicates cancellation, don't verify
      if (urlStatus === "cancelled" || urlStatus === "cancel") {
        setStatus("cancelled");
        setErrorMessage("Payment was cancelled.");
        return;
      }

      try {
        const result = await dispatch(
          verifyEMIOnlinePayment({ sessionId, provider }),
        ).unwrap();

        if (result.success) {
          setStatus("success");
          setPaymentDetails({
            installmentNumber:
              result.data?.installmentNumber || result.data?.installment_number,
            amount: result.data?.amount,
            contractId: result.data?.contractId || result.data?.contract_id,
            transactionId:
              result.data?.transactionId ||
              result.data?.transaction_id ||
              sessionId.slice(-8).toUpperCase(),
          });
        } else {
          setStatus("error");
          setErrorMessage(result.message || "Payment verification failed.");
        }
      } catch (error) {
        console.error("EMI Payment verification error:", error);
        setStatus("error");
        setErrorMessage(
          error?.message || "An error occurred while verifying your payment.",
        );
      }
    };

    verifyPayment();
  }, [sessionId, urlStatus, dispatch, provider]);

  const handleViewContract = () => {
    if (paymentDetails?.contractId) {
      navigate(`/corporate/contracts/${paymentDetails.contractId}`);
    } else {
      navigate("/corporate-profile?tab=contracts");
    }
  };

  const handleGoToContracts = () => {
    navigate("/corporate-profile?tab=contracts");
  };

  const handleRetryPayment = () => {
    // Go back to the contract page to retry
    navigate("/corporate-profile?tab=contracts");
  };

  const renderContent = () => {
    switch (status) {
      case "processing":
        return (
          <>
            <div className="status-icon processing">
              <div className="spinner"></div>
            </div>
            <h2>Verifying Payment</h2>
            <p className="message">
              Please wait while we verify your EMI payment. This may take a few
              moments...
            </p>
          </>
        );

      case "success":
        return (
          <>
            <div className="status-icon success">
              <CheckCircle size={40} />
            </div>
            <h2>Payment Successful!</h2>
            <p className="message">
              Your EMI installment has been paid successfully. Thank you for
              your payment.
            </p>
            {paymentDetails && (
              <div className="payment-details">
                {paymentDetails.installmentNumber && (
                  <div className="detail-row">
                    <span className="detail-label">Installment #</span>
                    <span className="detail-value">
                      {paymentDetails.installmentNumber}
                    </span>
                  </div>
                )}
                {paymentDetails.amount && (
                  <div className="detail-row">
                    <span className="detail-label">Amount Paid</span>
                    <span className="detail-value">
                      AED {parseFloat(paymentDetails.amount).toLocaleString()}
                    </span>
                  </div>
                )}
                {paymentDetails.transactionId && (
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID</span>
                    <span className="detail-value">
                      {paymentDetails.transactionId}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="action-buttons">
              <button className="btn-primary" onClick={handleViewContract}>
                View Contract
              </button>
              <button className="btn-secondary" onClick={handleGoToContracts}>
                All Contracts
              </button>
            </div>
          </>
        );

      case "cancelled":
        return (
          <>
            <div className="status-icon error">
              <Clock size={40} />
            </div>
            <h2>Payment Cancelled</h2>
            <p className="message">
              Your EMI payment was cancelled. No charges have been made to your
              account.
            </p>
            <div className="action-buttons">
              <button className="btn-primary" onClick={handleRetryPayment}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={handleGoToContracts}>
                Back to Contracts
              </button>
            </div>
          </>
        );

      case "error":
      default:
        return (
          <>
            <div className="status-icon error">
              <XCircle size={40} />
            </div>
            <h2>Payment Failed</h2>
            <p className="message">
              {errorMessage ||
                "There was an issue processing your payment. Please try again or contact support."}
            </p>
            <div className="action-buttons">
              <button className="btn-primary" onClick={handleRetryPayment}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={handleGoToContracts}>
                Back to Contracts
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="emi-payment-callback">
      <div className="callback-card">{renderContent()}</div>
    </div>
  );
};

export default EMIPaymentCallback;
