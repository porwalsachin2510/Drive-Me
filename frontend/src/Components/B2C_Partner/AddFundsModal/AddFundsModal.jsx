import React, { useState } from 'react'
import './addfundsmodal.css'

const AddFundsModal = ({ isOpen, onClose, currentBalance, onAddFunds }) => {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const predefinedAmounts = [50, 100, 200, 500, 1000]

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setLoading(true)
    try {
      await onAddFunds(parseFloat(amount))
      setAmount('')
      onClose()
    } catch (error) {
      alert('Failed to add funds. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="add-funds-modal-overlay">
      <div className="add-funds-modal">
        <div className="add-funds-header">
          <h3>Add Funds to Wallet</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="current-balance">
          <p>Current Balance: <strong>AED {currentBalance || 0}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="add-funds-form">
          <div className="amount-input-group">
            <label>Enter Amount (AED)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              step="0.01"
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
                  AED {presetAmount}
                </button>
              ))}
            </div>
          </div>

          <div className="payment-methods">
            <h4>Payment Method</h4>
            <div className="payment-options">
              <label className="payment-option">
                <input type="radio" name="payment" value="card" defaultChecked />
                <span>💳 Credit/Debit Card</span>
              </label>
              <label className="payment-option">
                <input type="radio" name="payment" value="bank" />
                <span>🏦 Bank Transfer</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-funds-btn" disabled={loading}>
              {loading ? 'Processing...' : `Add AED ${amount || '0'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddFundsModal
