"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { verifyPayment } from "../../Redux/slices/paymentSlice";
import LoadingSpinner from "../../Components/LoadingSpinner/LoadingSpinner";
import "./PaymentCallback.css";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const { contractId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [verificationStatus, setVerificationStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyPaymentCallback = async () => {
      const status = searchParams.get("status");
      const sessionId = searchParams.get("session_id"); // Stripe
      const chargeId = searchParams.get("tap_id"); // Tap Payments



      // Determine payment provider based on query params
      let provider = "STRIPE";
      let paymentId = sessionId;

      if (chargeId) {
        provider = "TAP";
        paymentId = chargeId;
      }

      if (status === "success" && paymentId) {
        try {
          const result = await dispatch(
            verifyPayment({
              sessionId: paymentId,
              provider: provider,
            })
          ).unwrap();

          setVerificationStatus("success");
          setMessage(
            "Payment completed successfully! Your contract is now active."
          );

          // Extract contract ID from the result or use route param
          const finalContractId = result.data.contract?._id || contractId;

          // Redirect to contract details after 3 seconds
          setTimeout(() => {
            if (finalContractId) {
              navigate(`/corporate/contracts/${finalContractId}`);
            } else {
              navigate("/corporate/contracts");
            }
          }, 3000);
        } catch (error) {
          console.error("Payment verification failed:", error);
          setVerificationStatus("failed");
          setMessage(
            error || "Payment verification failed. Please contact support."
          );
        }
      } else if (status === "cancelled" || status === "canceled") {
        setVerificationStatus("cancelled");
        setMessage(
          "Payment was cancelled. You can try again from the contract details page."
        );
        setTimeout(() => {
          if (contractId) {
            navigate(`/corporate/contracts/${contractId}`);
          } else {
            navigate("/corporate/contracts");
          }
        }, 3000);
      } else {
        setVerificationStatus("failed");
        setMessage("Payment failed or was not completed. Please try again.");
        setTimeout(() => {
          if (contractId) {
            navigate(`/corporate/contracts/${contractId}`);
          } else {
            navigate("/corporate/contracts");
          }
        }, 3000);
      }
    };

    verifyPaymentCallback();
  }, [searchParams, dispatch, navigate, contractId]);

  return (
    <div className="payment-callback-container">
      <div className="payment-callback-card">
        {verificationStatus === "verifying" && (
          <>
            <LoadingSpinner />
            <h2>Verifying Payment</h2>
            <p>Please wait while we confirm your payment...</p>
          </>
        )}

        {verificationStatus === "success" && (
          <>
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>{message}</p>
            <p className="redirect-message">
              Redirecting to contract details...
            </p>
          </>
        )}

        {verificationStatus === "failed" && (
          <>
            <div className="error-icon">✕</div>
            <h2>Payment Failed</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting back...</p>
          </>
        )}

        {verificationStatus === "cancelled" && (
          <>
            <div className="warning-icon">⚠</div>
            <h2>Payment Cancelled</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
