/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { useLocale } from "../../hooks/useLocale";
import { getNativeSymbol, getPaymentMethods, getCurrencyDecimals } from "../../config/localeConfig";
import "./WalletRechargeModal.css";

const WalletRechargeModal = ({
  isOpen,
  onClose,
  onRechargeSuccess,
  country: countryProp,
  currency: currencyProp,
}) => {
  const locale = useLocale();
  // The user's active locale is the source of truth. Props (when supplied by a
  // parent) take precedence so existing callers keep working, but we no longer
  // hardcode Kuwait/KWD — UAE users get AED, Kuwait users get KWD, etc.
  const country = countryProp || locale.country;
  const currency = currencyProp || locale.currency;
  const nativeSymbol = getNativeSymbol(currency);

  const [amount, setAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);

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

  // Available payment methods come from the active locale (set per country in
  // localeConfig). New countries automatically get their correct methods.
  useEffect(() => {
    const localeMethods =
      locale.paymentMethods?.length > 0
        ? locale.paymentMethods
        : getPaymentMethods(country);
    // Exclude the wallet method itself inside the wallet-recharge flow.
    const methods = localeMethods
      .filter((m) => m.id !== "wallet")
      .map((m) => ({ icon: "💳", ...m }));
    setPaymentMethods(methods);
    // Ensure the selected method is valid for this country.
    if (methods.length && !methods.some((m) => m.id === selectedPaymentMethod)) {
      setSelectedPaymentMethod(methods[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, locale.paymentMethods]);

  // Predefined amounts for quick selection (scaled by currency magnitude).
  // 3-decimal currencies (KWD/BHD/OMR) have higher unit value, so use smaller
  // presets; 2-decimal currencies (AED/SAR/QAR) use larger presets.
  const quickAmounts =
    getCurrencyDecimals(currency) === 3
      ? [10, 20, 50, 100, 200]
      : [50, 100, 200, 500, 1000];

  const handleAmountChange = (value) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");
    setAmount(numericValue);
  };

  const handleQuickAmountSelect = (quickAmount) => {
    setAmount(quickAmount.toString());
  };

  const handleRecharge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsProcessing(true);

    try {
      console.log("[v0] Starting payment session creation:", {
        amount,
        currency,
        paymentMethod: selectedPaymentMethod,
      });

      // Create payment session
      const response = await api.post("/wallet/create-payment-session", {
        amount: parseFloat(amount),
        currency: currency,
        paymentMethod: selectedPaymentMethod,
        country: country,
      });

      console.log("[v0] Payment session response:", {
        success: response.data.success,
        hasPaymentUrl: !!response.data.data?.paymentUrl,
        paymentUrl: response.data.data?.paymentUrl?.substring(0, 50),
      });

      if (response.data.success && response.data.data?.paymentUrl) {
        console.log(
          "[v0] Redirecting to payment page:",
          response.data.data.paymentUrl,
        );
        // Redirect to Stripe/Tap payment page
        window.location.href = response.data.data.paymentUrl;
      } else {
        console.error("[v0] Invalid payment response:", response.data);
        alert(response.data.message || "Payment initialization failed");
      }
    } catch (error) {
      console.error("[v0] Recharge error:", error);
      alert("Failed to process recharge. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wallet-recharge-modal-overlay">
      <div className="wallet-recharge-modal">
        <div className="modal-header">
          <h3>💰 Add Funds to Wallet</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Amount Selection */}
          <div className="amount-section">
            <label className="section-title">Enter Amount</label>
            <div className="amount-input-container">
              <span className="currency-symbol">{nativeSymbol}</span>
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="amount-input"
                disabled={isProcessing}
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="quick-amounts">
              <label className="quick-amount-label">Quick Amounts:</label>
              <div className="quick-amount-buttons">
                {quickAmounts.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    className="quick-amount-btn"
                    onClick={() => handleQuickAmountSelect(quickAmount)}
                    disabled={isProcessing}
                  >
                    {`${nativeSymbol}${quickAmount}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="payment-method-section">
            <label className="section-title">Select Payment Method</label>
            {loadingPaymentSettings ? (
              <div className="payment-methods-loading">
                Loading payment options...
              </div>
            ) : !onlinePaymentsEnabled ? (
              <div className="online-payments-disabled-notice">
                <div className="notice-icon">ℹ️</div>
                <div className="notice-content">
                  <strong>Online Payments Unavailable</strong>
                  <p>
                    Online payment methods are currently disabled by the
                    administrator. Wallet recharge is not available at this
                    time.
                  </p>
                </div>
              </div>
            ) : (
              <div className="payment-methods">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`payment-method-option ${selectedPaymentMethod === method.id ? "selected" : ""}`}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                  >
                    <span className="payment-icon">{method.icon}</span>
                    <span className="payment-name">{method.name}</span>
                    <div className="payment-radio">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={selectedPaymentMethod === method.id}
                        onChange={() => setSelectedPaymentMethod(method.id)}
                        disabled={isProcessing}
                      />
                      <span className="radio-custom"></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transaction Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="transaction-summary">
              <label className="section-title">Transaction Summary</label>
              <div className="summary-item">
                <span>Recharge Amount:</span>
                <span>{`${nativeSymbol}${amount}`}</span>
              </div>
              <div className="summary-item">
                <span>Processing Fee:</span>
                <span>{`${nativeSymbol}0.00`}</span>
              </div>
              <div className="summary-item total">
                <span>Total Amount:</span>
                <span>{`${nativeSymbol}${amount}`}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className="recharge-btn"
            onClick={handleRecharge}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              isProcessing ||
              !onlinePaymentsEnabled
            }
          >
            {isProcessing
              ? "Processing..."
              : !onlinePaymentsEnabled
                ? "Online Payments Disabled"
                : `Add ${nativeSymbol}${amount || "0.00"}`}
          </button>
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <div className="security-text">
            <strong>Secure Payment</strong>
            <p>
              Your payment information is encrypted and secure. We support all
              major payment methods in {country}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletRechargeModal;
