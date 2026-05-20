"use client";

import { useState, useEffect } from "react";
import PaymentBreakdown from "../PaymentBreakdown/PaymentBreakdown";
import api from "../../../utils/api";
import "./PaymentMethodSelector.css";

const PaymentMethodSelector = ({
  acceptedMethods,
  onSelectMethod,
  onClose,
  contract,
}) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
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

  // Define which methods are considered "online" payments
  const onlinePaymentMethods = ["CARD", "WALLET", "BANK_TRANSFER"];

  // Filter accepted methods based on online payment status
  const availableMethods =
    acceptedMethods?.filter((method) => {
      if (!onlinePaymentsEnabled && onlinePaymentMethods.includes(method)) {
        return false; // Hide online methods when disabled
      }
      return true;
    }) || [];

  const paymentMethodsInfo = {
    CARD: {
      name: "Credit/Debit Card",
      icon: "💳",
      description: "Pay securely with Visa, Mastercard, or other cards",
      processingTime: "Instant",
    },
    WALLET: {
      name: "Mobile Wallet",
      icon: "📱",
      description: "Apple Pay, Google Pay, and local wallets",
      processingTime: "Instant",
    },
    BANK_TRANSFER: {
      name: "Bank Transfer",
      icon: "🏦",
      description: "Direct transfer from your bank account",
      processingTime: "1-2 business days",
    },
    CASH: {
      name: "Cash Payment",
      icon: "💵",
      description: "Pay in cash at authorized collection points",
      processingTime: "Subject to verification",
    },
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
  };

  const handleProceed = () => {
    if (selectedMethod) {
      onSelectMethod(selectedMethod);
    }
  };

  return (
    <div className="payment-method-modal-overlay">
      <div className="payment-method-modal">
        <div className="payment-method-header">
          <h2>Select Payment Method</h2>
          <button className="payment-method-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="payment-method-content">
          <p className="payment-method-subtitle">
            Choose how you'd like to pay for this contract
          </p>

          <PaymentBreakdown contract={contract} />

          {loadingPaymentSettings ? (
            <div className="payment-methods-loading">
              <div className="loading-spinner"></div>
              <p>Loading payment options...</p>
            </div>
          ) : (
            <>
              <div className="payment-methods-grid">
                {availableMethods.length > 0 ? (
                  availableMethods.map((method) => {
                    const methodInfo = paymentMethodsInfo[method];
                    if (!methodInfo) return null;

                    return (
                      <div
                        key={method}
                        className={`payment-method-card ${
                          selectedMethod === method ? "selected" : ""
                        }`}
                        onClick={() => handleMethodSelect(method)}
                      >
                        <div className="payment-method-icon">
                          {methodInfo.icon}
                        </div>
                        <h3>{methodInfo.name}</h3>
                        <p className="payment-method-description">
                          {methodInfo.description}
                        </p>
                        <div className="payment-method-processing">
                          <span className="processing-label">Processing:</span>
                          <span className="processing-time">
                            {methodInfo.processingTime}
                          </span>
                        </div>
                        {selectedMethod === method && (
                          <div className="payment-method-checkmark">✓</div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="no-payment-methods">
                    <p>No payment methods available</p>
                  </div>
                )}
              </div>

              {/* Notice when online payments are disabled */}
              {!onlinePaymentsEnabled && (
                <div className="online-payments-disabled-notice">
                  <span className="notice-icon">ℹ️</span>
                  <span>
                    Online payment methods (Card, Wallet, Bank Transfer) are
                    currently unavailable. Please use cash payment.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="payment-method-footer">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-proceed"
              onClick={handleProceed}
              disabled={!selectedMethod}
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
