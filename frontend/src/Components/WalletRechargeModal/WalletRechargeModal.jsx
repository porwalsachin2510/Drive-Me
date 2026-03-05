import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './WalletRechargeModal.css';

const WalletRechargeModal = ({ 
  isOpen, 
  onClose, 
  onRechargeSuccess, 
  country = 'UAE',
  currency = 'AED'
}) => {
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Available payment methods based on country
  useEffect(() => {
    const methods = country === 'UAE' ? [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳', gateway: 'STRIPE' },
      { id: 'apple_pay', name: 'Apple Pay', icon: '🍎', gateway: 'STRIPE' },
      { id: 'google_pay', name: 'Google Pay', icon: '🤖', gateway: 'STRIPE' },
      { id: 'knet', name: 'KNET', icon: '🔵', gateway: 'TAP' },
      { id: 'upi', name: 'UPI', icon: '📱', gateway: 'UPI' },
    ] : [
      { id: 'card', name: 'Credit/Debit Card', icon: '💳', gateway: 'TAP' },
      { id: 'knet', name: 'KNET', icon: '🔵', gateway: 'TAP' },
      { id: 'benefit', name: 'Benefit', icon: '🟣', gateway: 'TAP' },
      { id: 'zaincash', name: 'Zain Cash', icon: '🟢', gateway: 'TAP' },
      { id: 'stcpay', name: 'STC Pay', icon: '🔴', gateway: 'TAP' },
      { id: 'upi', name: 'UPI', icon: '📱', gateway: 'UPI' },
    ];
    setPaymentMethods(methods);
  }, [country]);

  // Predefined amounts for quick selection
  const quickAmounts = country === 'UAE' 
    ? [50, 100, 200, 500, 1000] // AED
    : [10, 20, 50, 100, 200]; // KWD

  const handleAmountChange = (value) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    setAmount(numericValue);
  };

  const handleQuickAmountSelect = (quickAmount) => {
    setAmount(quickAmount.toString());
  };

  const handleRecharge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);

    try {
      const selectedMethod = paymentMethods.find(method => method.id === selectedPaymentMethod);
      
      // Create payment session based on gateway
      const response = await api.post('/wallet/create-payment-session', {
        amount: parseFloat(amount),
        currency: currency,
        paymentMethod: selectedPaymentMethod,
        country: country
      });

      if (response.data.success) {
        // Redirect to payment gateway or handle payment
        if (response.data.paymentUrl) {
          window.location.href = response.data.paymentUrl;
        } else if (response.data.paymentIntentClientSecret) {
          // Handle Stripe payment
          const stripe = window.Stripe(response.data.publishableKey);
          const { error } = await stripe.confirmPayment({
            clientSecret: response.data.paymentIntentClientSecret,
            confirmParams: {
              return_url: `${window.location.origin}/wallet/recharge/success`,
            },
          });

          if (error) {
            alert(`Payment failed: ${error.message}`);
          }
        }
      } else {
        alert(response.data.message || 'Payment initialization failed');
      }
    } catch (error) {
      console.error('Recharge error:', error);
      alert('Failed to process recharge. Please try again.');
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
              <span className="currency-symbol">{currency === 'AED' ? 'د.إ' : 'د.ك'}</span>
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
                    {currency === 'AED' ? `د.إ${quickAmount}` : `د.ك${quickAmount}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="payment-method-section">
            <label className="section-title">Select Payment Method</label>
            <div className="payment-methods">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`payment-method-option ${selectedPaymentMethod === method.id ? 'selected' : ''}`}
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
          </div>

          {/* Transaction Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="transaction-summary">
              <label className="section-title">Transaction Summary</label>
              <div className="summary-item">
                <span>Recharge Amount:</span>
                <span>{currency === 'AED' ? `د.إ${amount}` : `د.ك${amount}`}</span>
              </div>
              <div className="summary-item">
                <span>Processing Fee:</span>
                <span>{currency === 'AED' ? 'د.إ0.00' : 'د.ك0.00'}</span>
              </div>
              <div className="summary-item total">
                <span>Total Amount:</span>
                <span>{currency === 'AED' ? `د.إ${amount}` : `د.ك${amount}`}</span>
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
            disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : `Add ${currency === 'AED' ? 'د.إ' : 'د.ك'}${amount || '0.00'}`}
          </button>
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <div className="security-icon">🔒</div>
          <div className="security-text">
            <strong>Secure Payment</strong>
            <p>Your payment information is encrypted and secure. We support all major payment methods in {country}.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletRechargeModal;
