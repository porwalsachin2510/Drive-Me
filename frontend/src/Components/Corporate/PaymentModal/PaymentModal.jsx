"use client";

import { useState } from "react";
import "./PaymentModal.css";

const PaymentModal = ({ contract, onClose, onSubmit }) => {
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    bankName: "",
    accountNumber: "",
    walletType: "applepay",
  });

  const handleChange = (e) => {
    setPaymentData({
      ...paymentData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      method: paymentMethod,
      ...paymentData,
      contractId: contract._id,
      amount: contract.totalAmount,
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(amount);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Complete Payment</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="payment-summary">
          <div className="summary-row">
            <span>Contract Amount:</span>
            <span className="amount">
              {formatCurrency(contract.totalAmount)}
            </span>
          </div>
          <div className="summary-row">
            <span>Processing Fee:</span>
            <span className="amount">
              {formatCurrency(contract.totalAmount * 0.02)}
            </span>
          </div>
          <div className="summary-row total">
            <span>Total Payable:</span>
            <span className="amount">
              {formatCurrency(contract.totalAmount * 1.02)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="payment-methods">
            <label
              className={`method-option ${
                paymentMethod === "card" ? "active" : ""
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === "card"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span className="method-icon">💳</span>
              <span>Credit/Debit Card</span>
            </label>

            <label
              className={`method-option ${
                paymentMethod === "wallet" ? "active" : ""
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="wallet"
                checked={paymentMethod === "wallet"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span className="method-icon">📱</span>
              <span>Mobile Wallet</span>
            </label>

            <label
              className={`method-option ${
                paymentMethod === "bank" ? "active" : ""
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="bank"
                checked={paymentMethod === "bank"}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span className="method-icon">🏦</span>
              <span>Bank Transfer</span>
            </label>
          </div>

          {paymentMethod === "card" && (
            <div className="payment-fields">
              <div className="form-group">
                <label>Card Number *</label>
                <input
                  type="text"
                  name="cardNumber"
                  value={paymentData.cardNumber}
                  onChange={handleChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength="19"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cardholder Name *</label>
                <input
                  type="text"
                  name="cardName"
                  value={paymentData.cardName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date *</label>
                  <input
                    type="text"
                    name="expiryDate"
                    value={paymentData.expiryDate}
                    onChange={handleChange}
                    placeholder="MM/YY"
                    maxLength="5"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CVV *</label>
                  <input
                    type="text"
                    name="cvv"
                    value={paymentData.cvv}
                    onChange={handleChange}
                    placeholder="123"
                    maxLength="3"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "wallet" && (
            <div className="payment-fields">
              <div className="form-group">
                <label>Select Wallet *</label>
                <select
                  name="walletType"
                  value={paymentData.walletType}
                  onChange={handleChange}
                  required
                >
                  <option value="applepay">Apple Pay</option>
                  <option value="googlepay">Google Pay</option>
                  <option value="samsungpay">Samsung Pay</option>
                </select>
              </div>
              <div className="wallet-info">
                <p>You will be redirected to complete the payment securely</p>
              </div>
            </div>
          )}

          {paymentMethod === "bank" && (
            <div className="payment-fields">
              <div className="form-group">
                <label>Bank Name *</label>
                <input
                  type="text"
                  name="bankName"
                  value={paymentData.bankName}
                  onChange={handleChange}
                  placeholder="Enter bank name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Account Number *</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={paymentData.accountNumber}
                  onChange={handleChange}
                  placeholder="Enter account number"
                  required
                />
              </div>
              <div className="bank-info">
                <p>
                  Please transfer the amount to the following account and submit
                  the transaction reference.
                </p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pay-btn">
              Pay {formatCurrency(contract.totalAmount * 1.02)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
