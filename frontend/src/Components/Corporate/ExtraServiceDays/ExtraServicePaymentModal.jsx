"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/api";
// Reuse the polished contract payment-method styles so this modal matches the
// "Select Payment Method" experience customers already know from contracts.
import "../PaymentMethodSelector/PaymentMethodSelector.css";
import "./extraservicedays.css";

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

// Show cash + card + bank + wallet, in the same order as the contract modal.
const METHOD_ORDER = ["CASH", "CARD", "BANK_TRANSFER", "WALLET"];

const fmtMoney = (amount, currency) =>
  amount == null
    ? "—"
    : `${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${currency || "AED"}`;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function ExtraServicePaymentModal({ request, onClose, onSubmit, submitting }) {
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
        console.error("[v0] ESD payment settings error:", err);
        if (active) setOnlinePaymentsEnabled(true);
      } finally {
        if (active) setLoadingSettings(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const currency = request?.currency || "AED";
  const amount = request?.charge || 0;

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
            Choose how you&apos;d like to pay for this extra service day
          </p>

          {/* Charge breakdown */}
          <div className="esd-pay-breakdown">
            <div className="esd-pay-breakdown-head">CHARGE SUMMARY</div>
            <div className="esd-pay-row">
              <span>Purpose</span>
              <span className="esd-pay-strong">{request?.purpose}</span>
            </div>
            <div className="esd-pay-row">
              <span>
                {(request?.serviceDates?.length || 0)} day
                {(request?.serviceDates?.length || 0) === 1 ? "" : "s"}
              </span>
              <span>
                {(request?.serviceDates || [])
                  .map((d) => fmtDate(d))
                  .join(", ")}
              </span>
            </div>
            <div className="esd-pay-row">
              <span>Vehicles</span>
              <span>{request?.vehiclesRequired}</span>
            </div>
            {request?.invoiceId?.invoiceNumber && (
              <div className="esd-pay-row">
                <span>Invoice</span>
                <span className="esd-pay-muted">
                  {request.invoiceId.invoiceNumber}
                </span>
              </div>
            )}
            <div className="esd-pay-total">
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
            <button className="btn-cancel" onClick={onClose} disabled={submitting}>
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
