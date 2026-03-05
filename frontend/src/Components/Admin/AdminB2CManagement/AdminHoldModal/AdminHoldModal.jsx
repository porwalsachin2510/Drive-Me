"use client"

import { useState } from "react"
import "./AdminHoldModal.css"

const AdminHoldModal = ({ provider, onClose }) => {
  const [amount, setAmount] = useState("0.000")
  const [note, setNote] = useState("")

  const handleConfirm = () => {
    console.log("Holding funds:", { provider, amount, note })
    onClose()
  }

  return (
    <div className="ad-dash-hold-modal-overlay" onClick={onClose}>
      <div className="ad-dash-hold-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-hold-modal-header">
          <h3>Hold Funds</h3>
          <button className="ad-dash-hold-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="ad-dash-hold-modal-body">
          <div className="ad-dash-hold-modal-balance">
            <span className="ad-dash-hold-modal-balance-label">AVAILABLE BALANCE</span>
            <span className="ad-dash-hold-modal-balance-value">{provider?.balance || "0.000"} KWD</span>
          </div>

          <div className="ad-dash-hold-modal-field">
            <label>Amount (KWD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ad-dash-hold-modal-input"
              step="0.001"
              min="0"
            />
          </div>

          <div className="ad-dash-hold-modal-field">
            <label>Note / Reason</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Monthly payout"
              className="ad-dash-hold-modal-textarea"
              rows="4"
            />
          </div>
        </div>

        <div className="ad-dash-hold-modal-footer">
          <button className="ad-dash-hold-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-dash-hold-modal-confirm" onClick={handleConfirm}>
            Confirm Hold
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminHoldModal
