"use client";

import { useState } from "react";
import api from "../../utils/api";
import "./PaymentModal.css";

function PaymentModal({ isOpen, onClose, amount, currency, onPaymentSuccess: _onPaymentSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    holderName: "",
    email: "",
    phone: ""
  });

  const paymentMethods = [
    {
      id: "card",
      name: "Credit/Debit Card",
      icon: "💳",
      fields: ["cardNumber", "expiryDate", "cvv", "holderName"]
    },
    {
      id: "apple_pay",
      name: "Apple Pay",
      icon: "🍎",
      fields: []
    },
    {
      id: "google_pay",
      name: "Google Pay",
      icon: "🤖",
      fields: []
    },
    {
      id: "knet",
      name: "KNET",
      icon: "🔵",
      fields: ["cardNumber", "holderName"]
    },
    {
      id: "benefit",
      name: "Benefit",
      icon: "🟣",
      fields: ["cardNumber", "holderName"]
    },
    {
      id: "zaincash",
      name: "Zain Cash",
      icon: "🟢",
      fields: ["phone"]
    }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.slice(0, 2) + "/" + v.slice(2, 4);
    }
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Create payment session with backend
      const response = await api.post('/wallet/create-payment-session', {
        amount: parseFloat(amount),
        paymentMethod: selectedMethod,
        currency: currency,
        paymentDetails: formData
      });

      const data = response.data;

      if (data.success) {
        // Redirect to payment gateway
        window.location.href = data.data.paymentSession.paymentUrl;
      } else {
        alert("Payment failed: " + data.message);
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const selectedPaymentMethod = paymentMethods.find(m => m.id === selectedMethod);

  return (
    <div className="drivemego-wppm-payment-modal-overlay" onClick={onClose}>
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
            {currency === "KWD" ? "KWD" : "AED"}{" "}
            {parseFloat(amount).toFixed(currency === "KWD" ? 3 : 2)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="drivemego-wppm-payment-form">
          <div className="drivemego-wppm-payment-methods-section">
            <h3>Select Payment Method</h3>
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
          </div>

          {selectedPaymentMethod.fields.length > 0 && (
            <div className="drivemego-wppm-payment-details-section">
              <h3>Payment Details</h3>
              <div className="drivemego-wppm-form-fields">
                {selectedPaymentMethod.fields.includes("cardNumber") && (
                  <div className="drivemego-wppm-form-group">
                    <label>Card Number</label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cardNumber: formatCardNumber(e.target.value),
                        }))
                      }
                      placeholder="1234 5678 9012 3456"
                      maxLength="19"
                      required
                    />
                  </div>
                )}

                {selectedPaymentMethod.fields.includes("expiryDate") && (
                  <div className="drivemego-wppm-form-group">
                    <label>Expiry Date</label>
                    <input
                      type="text"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          expiryDate: formatExpiryDate(e.target.value),
                        }))
                      }
                      placeholder="MM/YY"
                      maxLength="5"
                      required
                    />
                  </div>
                )}

                {selectedPaymentMethod.fields.includes("cvv") && (
                  <div className="drivemego-wppm-form-group">
                    <label>CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      placeholder="123"
                      maxLength="4"
                      required
                    />
                  </div>
                )}

                {selectedPaymentMethod.fields.includes("holderName") && (
                  <div className="drivemego-wppm-form-group">
                    <label>Cardholder Name</label>
                    <input
                      type="text"
                      name="holderName"
                      value={formData.holderName}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                )}

                {selectedPaymentMethod.fields.includes("phone") && (
                  <div className="drivemego-wppm-form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+965 5000 0000"
                      required
                    />
                  </div>
                )}
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
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="drivemego-wppm-spinner"></span>
                  Processing...
                </>
              ) : (
                <>
                  Pay {currency === "KWD" ? "KWD" : "AED"}{" "}
                  {parseFloat(amount).toFixed(currency === "KWD" ? 3 : 2)}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="drivemego-wppm-security-info">
          <div className="drivemego-wppm-security-badge">🔒 Secure Payment</div>
          <div className="drivemego-wppm-security-text">
            Your payment information is encrypted and secure. We use
            industry-standard security measures.
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
