"use client";

import { useState, useEffect } from "react";
import api from "../../utils/api";
import { useLocale } from "../../hooks/useLocale";
import { getPaymentMethods } from "../../config/localeConfig";
import "./PaymentModal.css";

const METHOD_ICONS = {
  card: "💳",
  apple_pay: "🍎",
  google_pay: "🤖",
  knet: "🔵",
  benefit: "🟣",
  zaincash: "🟢",
  stcpay: "🔴",
  mada: "🟢",
};

// eslint-disable-next-line no-unused-vars
function PaymentModal({
  isOpen,
  onClose,
  amount,
  currency: currencyProp,
  onPaymentSuccess: _onPaymentSuccess,
}) {
  const locale = useLocale();
  // Currency and methods follow the user's active country unless a parent
  // explicitly passes a currency (kept for backward compatibility).
  const currency = currencyProp || locale.currency;
  const currencyDecimals = locale.getCurrencyDecimals(currency);
  const [selectedMethod, setSelectedMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);

  // Payment control state
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true);
  const [loadingPaymentSettings, setLoadingPaymentSettings] = useState(true);

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

  // Build the method list from the active locale (excludes the wallet method).
  const localeMethods =
    locale.paymentMethods?.length > 0
      ? locale.paymentMethods
      : getPaymentMethods(locale.country);
  const paymentMethods = localeMethods
    .filter((m) => m.id !== "wallet")
    .map((m) => ({
      id: m.id,
      name: m.name,
      icon: METHOD_ICONS[m.id] || "💳",
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Create payment session with backend. We intentionally DO NOT collect
      // card number / CVV / expiry here — those are entered on the payment
      // gateway's own PCI-compliant hosted page after redirect. Sending them
      // from our app would be redundant, insecure, and bad UX.
      const response = await api.post("/wallet/create-payment-session", {
        amount: parseFloat(amount),
        paymentMethod: selectedMethod,
        currency: currency,
      });

      const data = response.data;

      if (data.success && data.data?.paymentUrl) {
        // Redirect to the payment gateway's secure hosted page.
        window.location.href = data.data.paymentUrl;
      } else {
        alert(
          "Payment failed: " +
            (data.message || "Could not create payment session"),
        );
      }
    } catch (error) {
      console.error("Payment error:", error);
      const errorMessage =
        error.response?.data?.message || "Payment failed. Please try again.";
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const selectedPaymentMethod =
    paymentMethods.find((m) => m.id === selectedMethod) ||
    paymentMethods[0] ||
    null;
  const selectedMethodName = selectedPaymentMethod?.name || "Payment";

  return (
    <div className="drivemego-wppm-payment-modal-overlay">
      <div
        className="drivemego-wppm-payment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drivemego-wppm-payment-modal-header">
          <h2>Add Funds to Wallet</h2>
          <button className="drivemego-wppm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drivemego-wppm-payment-amount-display">
          <div className="drivemego-wppm-amount-label">Amount to Add</div>
          <div className="drivemego-wppm-amount-value">
            {currency} {parseFloat(amount).toFixed(currencyDecimals)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="drivemego-wppm-payment-form">
          <div className="drivemego-wppm-payment-methods-section">
            <h3>Select Payment Method</h3>
            {loadingPaymentSettings ? (
              <div className="drivemego-wppm-loading">
                Loading payment options...
              </div>
            ) : !onlinePaymentsEnabled ? (
              <div className="drivemego-wppm-disabled-notice">
                <div className="drivemego-wppm-notice-icon">ℹ️</div>
                <div className="drivemego-wppm-notice-content">
                  <strong>Online Payments Unavailable</strong>
                  <p>
                    Online payment methods are currently disabled by the
                    administrator.
                  </p>
                </div>
              </div>
            ) : (
              <div className="drivemego-wppm-payment-methods-grid">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`drivemego-wppm-payment-method-card ${selectedMethod === method.id ? "drivemego-wppm-selected" : ""}`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <div className="drivemego-wppm-method-icon">
                      {method.icon}
                    </div>
                    <div className="drivemego-wppm-method-name">
                      {method.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {onlinePaymentsEnabled && !loadingPaymentSettings && (
            <div className="drivemego-wppm-redirect-notice">
              <div className="drivemego-wppm-redirect-icon">🔐</div>
              <div className="drivemego-wppm-redirect-text">
                You&apos;ll be redirected to a secure {selectedMethodName} page
                to enter your payment details and complete this top-up. We never
                ask for or store your card information.
              </div>
            </div>
          )}

          <div className="drivemego-wppm-payment-actions">
            <button
              type="button"
              className="drivemego-wppm-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="drivemego-wppm-btn-pay"
              disabled={isProcessing || !onlinePaymentsEnabled}
            >
              {isProcessing ? (
                <>
                  <span className="drivemego-wppm-spinner"></span>
                  Redirecting...
                </>
              ) : !onlinePaymentsEnabled ? (
                "Online Payments Disabled"
              ) : (
                <>Continue to Secure Payment</>
              )}
            </button>
          </div>
        </form>

        <div className="drivemego-wppm-security-info">
          <div className="drivemego-wppm-security-badge">🔒 Secure Payment</div>
          <div className="drivemego-wppm-security-text">
            Your payment is processed on the provider&apos;s PCI-compliant
            gateway. We use industry-standard security measures.
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
