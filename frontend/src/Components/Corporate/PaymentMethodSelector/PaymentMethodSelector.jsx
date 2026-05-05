"use client";

import { useState } from "react";
import PaymentBreakdown from "../PaymentBreakdown/PaymentBreakdown";
import "./PaymentMethodSelector.css";

const PaymentMethodSelector = ({
  acceptedMethods,
  onSelectMethod,
  onClose,
  contract,
  paymentType = "advance", // "advance" or "final"
}) => {
  const [selectedMethod, setSelectedMethod] = useState(null);

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

          <PaymentBreakdown contract={contract} paymentType={paymentType} />

          <div className="payment-methods-grid">
            {acceptedMethods && acceptedMethods.length > 0 ? (
              acceptedMethods.map((method) => {
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
                    <div className="payment-method-icon">{methodInfo.icon}</div>
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
