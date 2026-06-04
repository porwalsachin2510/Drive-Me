"use client";

import { useEffect, useState, useRef } from "react";
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

  // CRITICAL: Use ref to prevent double execution in React StrictMode
  const hasVerifiedRef = useRef(false);
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    const verifyWalletPayment = async () => {
      // PREVENT DOUBLE EXECUTION - This is critical for React StrictMode
      if (hasVerifiedRef.current || isVerifyingRef.current) {
        console.log("[Wallet] Skipping duplicate verification call");
        return;
      }
      isVerifyingRef.current = true;
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

      // Also detect from session ID format for extra safety
      if (
        paymentId &&
        (paymentId.startsWith("cs_test_") ||
          paymentId.startsWith("cs_live_") ||
          paymentId.startsWith("pi_"))
      ) {
        provider = "STRIPE";
      } else if (
        paymentId &&
        (paymentId.startsWith("chg_") || paymentId.startsWith("txn_"))
      ) {
        provider = "TAP";
      }

      console.log("[Wallet] Detected provider:", provider);

      if (status === "success" && paymentId) {
        try {
          // Call wallet add funds with payment verification
          const response = await api.post("/wallet/add-funds", {
            amount: 0, // Will be determined from payment session
            paymentMethod: "card",
            paymentDetails: {},
            paymentSessionId: paymentId,
            gateway: provider, // Pass the detected gateway to backend
          });

          if (response.data.success) {
            // Mark as verified to prevent any future duplicate calls
            hasVerifiedRef.current = true;

            console.log(
              "[Wallet] Payment verified and funds added:",
              response.data,
            );

            setVerificationStatus("success");
            setMessage(
              response.data.data?.alreadyProcessed
                ? "Payment was already processed. Your wallet balance is up to date."
                : "Payment completed successfully! Funds have been added to your wallet.",
            );

            // Refresh wallet balance
            dispatch(getWalletBalance());

            // Redirect to wallet page after 3 seconds
            setTimeout(() => {
              navigate("/wallet");
            }, 3000);
          } else {
            console.error(
              "[Wallet] Payment verification failed:",
              response.data.message,
            );
            setVerificationStatus("failed");
            setMessage(
              response.data.message ||
                "Payment verification failed. Please contact support.",
            );
          }
        } catch (error) {
          console.error("[Wallet] Payment verification error:", error);
          isVerifyingRef.current = false; // Allow retry on error
          setVerificationStatus("failed");
          setMessage("Payment verification failed. Please contact support.");
        }
      } else if (status === "cancelled" || status === "canceled") {
        hasVerifiedRef.current = true; // Prevent further processing
        setVerificationStatus("cancelled");
        setMessage(
          "Payment was cancelled. You can try again from the wallet page.",
        );
        setTimeout(() => {
          navigate("/wallet");
        }, 3000);
      } else {
        hasVerifiedRef.current = true; // Prevent further processing
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
            <p>
              Please wait while we confirm your payment and add funds to your
              wallet...
            </p>
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
