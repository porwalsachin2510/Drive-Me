"use client"

import { useState } from "react"
import "./AdminChatModal.css"

function AdminChatModal({ provider, onClose }) {
  const [message, setMessage] = useState("")

  const handleSend = () => {
    if (message.trim()) {
      console.log("Sending message to provider:", provider.name, message)
      setMessage("")
      onClose()
    }
  }

  if (!provider) return null

  return (
    <div className="admin-chat-modal-overlay" onClick={onClose}>
      <div className="admin-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-chat-modal-header">
          <div>
            <h2 className="admin-chat-modal-title">Request More Details</h2>
            <p className="admin-chat-modal-subtitle">
              Send a message to <strong>{provider.name}</strong> specifying what information is missing or needs
              clarification.
            </p>
          </div>
          <button className="admin-chat-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="admin-chat-modal-body">
          <label className="admin-chat-modal-label">Message to Provider</label>
          <div className="admin-chat-modal-textarea-wrapper">
            <textarea
              className="admin-chat-modal-textarea"
              placeholder="e.g., Please upload a clearer copy of the driver's license..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
            <button className="admin-chat-modal-emoji-btn" title="Add Emoji">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="admin-chat-modal-footer">
          <button className="admin-chat-modal-btn admin-chat-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-chat-modal-btn admin-chat-modal-btn-send" onClick={handleSend}>
            Send Request
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminChatModal
