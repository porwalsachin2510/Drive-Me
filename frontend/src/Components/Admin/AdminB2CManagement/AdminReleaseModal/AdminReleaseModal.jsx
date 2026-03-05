"use client"

import { useState } from "react"
import "./AdminReleaseModal.css"

const AdminReleaseModal = ({ provider, onClose }) => {
  const [amount, setAmount] = useState("0.000")
  const [note, setNote] = useState("")

  const handleConfirm = () => {
    console.log("Releasing funds:", { provider, amount, note })
    onClose()
  }

  return (
    <div className="ad-dash-release-modal-overlay" onClick={onClose}>
      <div className="ad-dash-release-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-release-modal-header">
          <h3>Release Funds</h3>
          <button className="ad-dash-release-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="ad-dash-release-modal-body">
          <div className="ad-dash-release-modal-balance">
            <span className="ad-dash-release-modal-balance-label">AVAILABLE BALANCE</span>
            <span className="ad-dash-release-modal-balance-value">{provider?.balance || "0.000"} KWD</span>
          </div>

          <div className="ad-dash-release-modal-field">
            <label>Amount (KWD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ad-dash-release-modal-input"
              step="0.001"
              min="0"
            />
          </div>

          <div className="ad-dash-release-modal-field">
            <label>Note / Reason</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Monthly payout"
              className="ad-dash-release-modal-textarea"
              rows="4"
            />
          </div>
        </div>

        <div className="ad-dash-release-modal-footer">
          <button className="ad-dash-release-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-dash-release-modal-confirm" onClick={handleConfirm}>
            Confirm Release
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminReleaseModal
