"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/api";
// Reuse the polished contract payment-method styles so this modal matches the
// "Select Payment Method" experience customers already know from contracts.
import "../PaymentMethodSelector/PaymentMethodSelector.css";
import "./managedbilling.css";

const METHOD_INFO = {
  CASH: {
    name: "Cash Payment",
    icon: "💵",
    description: "Pay your partner in cash and they'll confirm it here",
    processingTime: "Partner confirms",
    online: false,
  },
  CARD: {
    name: "Credit/Debit Card",
    icon: "💳",
    description: "Pay securely with Visa, Mastercard, or other cards",
    processingTime: "Instant",
    online: true,
  },
  BANK_TRANSFER: {
    name: "Bank Transfer",
    icon: "🏦",
    description: "Transfer to your partner and they'll confirm it here",
    processingTime: "Partner confirms",
    online: false,
  },
  WALLET: {
    name: "Mobile Wallet",
    icon: "📱",
    description: "Apple Pay, Google Pay, and local wallets",
    processingTime: "Instant",
    online: true,
  },
};

const METHOD_ORDER = ["CASH", "CARD", "BANK_TRANSFER", "WALLET"];

const fmtMoney = (amount, currency) =>
  amount == null
    ? "—"
    : `${currency || "AED"} ${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default function OperationalInvoicePaymentModal({
  invoice,
  currency,
  onClose,
  onSubmit,
  submitting,
}) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingSettings(true);
        const res = await api.get("/pages/public/payment-settings");
        if (active && res.data?.success) {
          setOnlinePaymentsEnabled(res.data.data.onlinePaymentsEnabled);
        }
      } catch (err) {
        console.error("[v0] Invoice payment settings error:", err);
        if (active) setOnlinePaymentsEnabled(true);
      } finally {
        if (active) setLoadingSettings(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const amount = invoice?.amount ?? invoice?.total ?? 0;

  const availableMethods = METHOD_ORDER.filter((m) =>
    onlinePaymentsEnabled ? true : !METHOD_INFO[m].online,
  );

  const handleProceed = () => {
    if (selectedMethod && !submitting) onSubmit(selectedMethod);
  };

  return (
    <div className="payment-method-modal-overlay" onClick={onClose}>
      <div
        className="payment-method-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="payment-method-header">
          <h2>Select Payment Method</h2>
          <button className="payment-method-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="payment-method-content">
          <p className="payment-method-subtitle">
            Choose how you&apos;d like to pay this operational invoice
          </p>

          {/* Charge breakdown */}
          <div className="mbill-pay-breakdown">
            <div className="mbill-pay-breakdown-head">INVOICE SUMMARY</div>
            <div className="mbill-pay-row">
              <span>Invoice</span>
              <span className="mbill-pay-strong">{invoice?.invoiceNumber}</span>
            </div>
            <div className="mbill-pay-row">
              <span>Period</span>
              <span>{invoice?.periodLabel || invoice?.billingPeriod?.label || "—"}</span>
            </div>
            {invoice?.usage?.trips != null && (
              <div className="mbill-pay-row">
                <span>Trips</span>
                <span>{invoice.usage.trips}</span>
              </div>
            )}
            {invoice?.usage?.slaPenalty > 0 && (
              <div className="mbill-pay-row">
                <span>SLA penalty</span>
                <span>-{fmtMoney(invoice.usage.slaPenalty, currency)}</span>
              </div>
            )}
            <div className="mbill-pay-total">
              <span>Total Due Now</span>
              <span>{fmtMoney(amount, currency)}</span>
            </div>
          </div>

          {loadingSettings ? (
            <div className="payment-methods-loading">
              <div className="loading-spinner"></div>
              <p>Loading payment options...</p>
            </div>
          ) : (
            <>
              <div className="payment-methods-grid">
                {availableMethods.map((method) => {
                  const info = METHOD_INFO[method];
                  return (
                    <div
                      key={method}
                      className={`payment-method-card ${
                        selectedMethod === method ? "selected" : ""
                      }`}
                      onClick={() => setSelectedMethod(method)}
                    >
                      <div className="payment-method-icon">{info.icon}</div>
                      <h3>{info.name}</h3>
                      <p className="payment-method-description">
                        {info.description}
                      </p>
                      <div className="payment-method-processing">
                        <span className="processing-label">Processing:</span>
                        <span className="processing-time">
                          {info.processingTime}
                        </span>
                      </div>
                      {selectedMethod === method && (
                        <div className="payment-method-checkmark">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!onlinePaymentsEnabled && (
                <div className="online-payments-disabled-notice">
                  <span className="notice-icon">ℹ️</span>
                  <span>
                    Online payment methods (Card, Mobile Wallet) are currently
                    unavailable. Please use cash or bank transfer.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="payment-method-footer">
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn-proceed"
              onClick={handleProceed}
              disabled={!selectedMethod || submitting}
            >
              {submitting ? "Processing…" : "Proceed to Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
