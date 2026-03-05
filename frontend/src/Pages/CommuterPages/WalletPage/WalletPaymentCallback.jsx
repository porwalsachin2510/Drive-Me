"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../../../utils/api";
import { getWalletBalance } from "../../../Redux/slices/walletSlice";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import "./WalletPaymentCallback.css";

const WalletPaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [verificationStatus, setVerificationStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyWalletPayment = async () => {
      const status = searchParams.get("status");
      const sessionId = searchParams.get("session_id"); // Stripe
      const chargeId = searchParams.get("tap_id"); // Tap Payments

      console.log("[Wallet] Payment callback - Status:", status);
      console.log("[Wallet] Payment callback - Session ID:", sessionId);
      console.log("[Wallet] Payment callback - Charge ID:", chargeId);

      // Determine payment provider based on query params
      let provider = "STRIPE";
      let paymentId = sessionId;

      if (chargeId) {
        provider = "TAP";
        paymentId = chargeId;
      }

      if (status === "success" && paymentId) {
        try {
          // Call wallet add funds with payment verification
          const response = await api.post('/wallet/add-funds', {
            amount: 0, // Will be determined from payment session
            paymentMethod: "card",
            paymentDetails: {},
            paymentSessionId: paymentId
          });

          if (response.data.success) {
            console.log("[Wallet] Payment verified and funds added:", response.data);
            
            setVerificationStatus("success");
            setMessage("Payment completed successfully! Funds have been added to your wallet.");

            // Refresh wallet balance
            dispatch(getWalletBalance());

            // Redirect to wallet page after 3 seconds
            setTimeout(() => {
              navigate("/wallet");
            }, 3000);
          } else {
            console.error("[Wallet] Payment verification failed:", response.data.message);
            setVerificationStatus("failed");
            setMessage(response.data.message || "Payment verification failed. Please contact support.");
          }
        } catch (error) {
          console.error("[Wallet] Payment verification error:", error);
          setVerificationStatus("failed");
          setMessage("Payment verification failed. Please contact support.");
        }
      } else if (status === "cancelled" || status === "canceled") {
        setVerificationStatus("cancelled");
        setMessage("Payment was cancelled. You can try again from the wallet page.");
        setTimeout(() => {
          navigate("/wallet");
        }, 3000);
      } else {
        setVerificationStatus("failed");
        setMessage("Payment failed or was not completed. Please try again.");
        setTimeout(() => {
          navigate("/wallet");
        }, 3000);
      }
    };

    verifyWalletPayment();
  }, [searchParams, dispatch, navigate]);

  return (
    <div className="wallet-payment-callback-container">
      <div className="wallet-payment-callback-card">
        {verificationStatus === "verifying" && (
          <>
            <LoadingSpinner />
            <h2>Verifying Payment</h2>
            <p>Please wait while we confirm your payment and add funds to your wallet...</p>
          </>
        )}

        {verificationStatus === "success" && (
          <>
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting to your wallet...</p>
          </>
        )}

        {verificationStatus === "failed" && (
          <>
            <div className="error-icon">✕</div>
            <h2>Payment Failed</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting back to wallet...</p>
          </>
        )}

        {verificationStatus === "cancelled" && (
          <>
            <div className="warning-icon">⚠</div>
            <h2>Payment Cancelled</h2>
            <p>{message}</p>
            <p className="redirect-message">Redirecting back to wallet...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletPaymentCallback;
