/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import "./addfundsmodal.css";
import api from "../../../utils/api";
import useCurrency from "../../../hooks/useCurrency";

const AddFundsModal = ({ isOpen, onClose, currentBalance, onAddFunds }) => {
  const { formatCurrency, getCurrencyDecimals, getCurrencySymbol } =
    useCurrency();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState("AED");
  const [decimals, setDecimals] = useState(2);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingPaymentConfig, setLoadingPaymentConfig] = useState(true);

  // Fetch payment configuration on mount
  useEffect(() => {
    if (isOpen) {
      fetchPaymentConfig();
    }
  }, [isOpen]);

  const fetchPaymentConfig = async () => {
    try {
      setLoadingPaymentConfig(true);
      console.log("[v0] Fetching payment configuration...");

      const response = await api.get("/wallets/payment-config");

      if (response.data?.success) {
        const {
          currency: userCurrency,
          decimals: userDecimals,
          paymentMethods: methods,
        } = response.data.data;

        console.log("[v0] Payment config received:", {
          currency: userCurrency,
          decimals: userDecimals,
          methods: methods.length,
        });

        setCurrency(userCurrency);
        setDecimals(userDecimals);
        setPaymentMethods(methods || []);

        // Set first available method as default
        if (methods && methods.length > 0) {
          setSelectedPaymentMethod(methods[0].id);
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching payment config:", error);
      // Fallback to defaults
       setCurrency("AED");
       setDecimals(2);
      setPaymentMethods([
        {
          id: "card",
          name: "Credit/Debit Card",
          gateway: "TAP",
          enabled: true,
        },
      ]);
    } finally {
      setLoadingPaymentConfig(false);
    }
  };

  const predefinedAmounts =
    currency === "KWD" ? [10, 20, 50, 100, 200] : [50, 100, 200, 500, 1000];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      console.log("[v0] Adding funds:", {
        amount,
        currency,
        paymentMethod: selectedPaymentMethod,
      });
      await onAddFunds(parseFloat(amount), currency, selectedPaymentMethod);
      setAmount("");
      onClose();
    } catch (error) {
      console.error("[v0] Error adding funds:", error);
      alert("Failed to add funds. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <div className="add-funds-modal-overlay">
      <div className="add-funds-modal">
        <div className="add-funds-header">
          <h3>Add Funds to Wallet</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {loadingPaymentConfig ? (
          <div className="loading-state">
            <p>Loading payment methods...</p>
          </div>
        ) : (
          <>
            <div className="current-balance">
              <p>
                Current Balance:{" "}
                <strong>{formatCurrency(currentBalance || 0, currency)}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="add-funds-form">
              <div className="amount-input-group">
                <label>Enter Amount ({currencySymbol})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Enter amount in ${currency}`}
                  min="0.001"
                  step={decimals === 3 ? "0.001" : "0.01"}
                  required
                />
              </div>

              <div className="predefined-amounts">
                <p>Quick Add:</p>
                <div className="amount-buttons">
                  {predefinedAmounts.map((presetAmount) => (
                    <button
                      key={presetAmount}
                      type="button"
                      className="amount-btn"
                      onClick={() => setAmount(presetAmount)}
                    >
                      {currencySymbol} {presetAmount}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethods.length > 0 && (
                <div className="payment-methods">
                  <h4>Select Payment Method</h4>
                  <div className="payment-options">
                    {paymentMethods.map((method) => (
                      <label key={method.id} className="payment-option">
                        <input
                          type="radio"
                          name="payment"
                          value={method.id}
                          checked={selectedPaymentMethod === method.id}
                          onChange={(e) =>
                            setSelectedPaymentMethod(e.target.value)
                          }
                        />
                        <span>{method.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="add-funds-btn"
                  disabled={loading || !amount}
                >
                  {loading
                    ? "Processing..."
                    : `Add ${currencySymbol} ${amount || "0"}`}
                </button>
              </div>

              <div className="secure-payment-note">
                <p>🔒 Secure Payment</p>
                <p>Your payment information is encrypted and secure.</p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AddFundsModal;
