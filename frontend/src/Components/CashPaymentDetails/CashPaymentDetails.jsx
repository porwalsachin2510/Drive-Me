"use client";

import { useEffect, useState } from "react";
import api from "../../utils/api";
import "./CashPaymentDetails.css";

// Simple module-level cache so we don't re-fetch the (static) admin details
// every time a user toggles a cash payment method across the app.
let cachedDetails = null;
let inflightRequest = null;

const fetchCashDetails = async () => {
  if (cachedDetails) return cachedDetails;
  if (inflightRequest) return inflightRequest;
  inflightRequest = api
    .get("/pages/public/cash-payment-details")
    .then((res) => {
      if (res.data?.success) {
        cachedDetails = res.data.data;
        return cachedDetails;
      }
      return null;
    })
    .finally(() => {
      inflightRequest = null;
    });
  return inflightRequest;
};

/**
 * CashPaymentDetails
 *
 * Shows the admin's bank account details and office address so a user paying by
 * CASH knows exactly where to transfer the money or drop it off. Used anywhere a
 * cash payment method is selected (subscription renewal, corporate contracts,
 * EMI, etc.).
 *
 * Props:
 *  - variant: "inline" (default) renders a card in-flow; "modal" renders an
 *    overlay dialog with a close button.
 *  - onClose: required for variant="modal".
 *  - amount / currency: optional, shown as the amount the user should pay.
 *  - title: optional heading override.
 */
const CashPaymentDetails = ({
  variant = "inline",
  onClose,
  amount,
  currency,
  title = "Cash Payment Details",
}) => {
  const [details, setDetails] = useState(cachedDetails);
  const [loading, setLoading] = useState(!cachedDetails);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    let mounted = true;
    if (cachedDetails) {
      setDetails(cachedDetails);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCashDetails()
      .then((data) => {
        if (!mounted) return;
        if (data) {
          setDetails(data);
        } else {
          setError("Unable to load payment details. Please contact support.");
        }
      })
      .catch(() => {
        if (mounted)
          setError("Unable to load payment details. Please contact support.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCopy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context) — silently ignore.
    }
  };

  const renderRow = (label, value, copyKey) => {
    if (!value) return null;
    return (
      <div className="cpd-row" key={label}>
        <span className="cpd-row-label">{label}</span>
        <span className="cpd-row-value">
          {value}
          {copyKey && (
            <button
              type="button"
              className="cpd-copy-btn"
              onClick={() => handleCopy(copyKey, value)}
              aria-label={`Copy ${label}`}
            >
              {copiedKey === copyKey ? "Copied" : "Copy"}
            </button>
          )}
        </span>
      </div>
    );
  };

  const body = (
    <div className="cpd-card" role="region" aria-label={title}>
      <div className="cpd-header">
        <div className="cpd-header-icon" aria-hidden="true">
          💵
        </div>
        <div>
          <h3 className="cpd-title">{title}</h3>
          <p className="cpd-subtitle">
            Pay using one of the options below. Your payment will be activated
            once the admin verifies it.
          </p>
        </div>
        {variant === "modal" && (
          <button
            type="button"
            className="cpd-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {amount != null && amount !== "" && (
        <div className="cpd-amount">
          <span className="cpd-amount-label">Amount to Pay</span>
          <span className="cpd-amount-value">
            {currency ? `${currency} ` : ""}
            {Number(amount).toFixed(2)}
          </span>
        </div>
      )}

      {loading ? (
        <div className="cpd-loading">Loading payment details...</div>
      ) : error ? (
        <div className="cpd-error">{error}</div>
      ) : (
        <>
          {details?.bankTransfer && (
            <div className="cpd-section">
              <h4 className="cpd-section-title">
                <span className="cpd-section-icon" aria-hidden="true">
                  🏦
                </span>
                Option 1: Bank Transfer
              </h4>
              {renderRow("Bank Name", details.bankTransfer.bankName)}
              {renderRow("Account Name", details.bankTransfer.accountName)}
              {renderRow(
                "Account Number",
                details.bankTransfer.accountNumber,
                "accountNumber",
              )}
              {renderRow("IBAN", details.bankTransfer.iban, "iban")}
              {renderRow(
                "SWIFT / BIC",
                details.bankTransfer.swiftCode,
                "swift",
              )}
            </div>
          )}

          {details?.office && (
            <div className="cpd-section">
              <h4 className="cpd-section-title">
                <span className="cpd-section-icon" aria-hidden="true">
                  📍
                </span>
                Option 2: Pay at Our Office
              </h4>
              {renderRow("Office", details.office.name)}
              {renderRow("Address", details.office.address, "address")}
              {renderRow("Working Hours", details.office.hours)}
            </div>
          )}

          {(details?.contact?.phone || details?.contact?.email) && (
            <div className="cpd-section">
              <h4 className="cpd-section-title">
                <span className="cpd-section-icon" aria-hidden="true">
                  ☎️
                </span>
                Need Help?
              </h4>
              {renderRow("Phone", details.contact.phone)}
              {renderRow("Email", details.contact.email)}
            </div>
          )}

          {details?.instructions && (
            <div className="cpd-instructions">
              <strong>Important:</strong> {details.instructions}
            </div>
          )}
        </>
      )}

      {variant === "modal" && (
        <div className="cpd-actions">
          <button type="button" className="cpd-done-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      )}
    </div>
  );

  if (variant === "modal") {
    return (
      <div className="cpd-overlay" onClick={onClose}>
        <div className="cpd-modal" onClick={(e) => e.stopPropagation()}>
          {body}
        </div>
      </div>
    );
  }

  return body;
};

export default CashPaymentDetails;
