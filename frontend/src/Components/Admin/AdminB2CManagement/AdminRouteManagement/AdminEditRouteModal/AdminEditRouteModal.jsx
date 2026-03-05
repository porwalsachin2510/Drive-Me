"use client"

import { useState } from "react"
import "./AdminEditRouteModal.css"

function AdminEditRouteModal({ route: _route, onClose }) {
  const [selectedTags, setSelectedTags] = useState(["premium"])
  const [isFeatured, setIsFeatured] = useState(true)
  const [isActive, setIsActive] = useState(true)

  const tags = [
    { id: "budget", label: "Budget Friendly", color: "green" },
    { id: "ac", label: "AC Vehicle", color: "blue" },
    { id: "wifi", label: "WiFi Available", color: "purple" },
    { id: "premium", label: "Premium", color: "yellow" },
    { id: "ladies", label: "Ladies Only", color: "pink" },
    { id: "express", label: "Express", color: "red" },
  ]

  const toggleTag = (tagId) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId))
    } else {
      setSelectedTags([...selectedTags, tagId])
    }
  }

  return (
    <div className="ad-dash-modal-overlay" onClick={onClose}>
      <div className="ad-dash-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-modal-header">
          <div>
            <h3 className="ad-dash-modal-title">Edit Route</h3>
            <p className="ad-dash-modal-subtitle">Configure route details, tags, pricing, and schedule.</p>
          </div>
          <button className="ad-dash-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ad-dash-modal-body">
          <div className="ad-dash-form-row">
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">Route Name</label>
              <input type="text" className="ad-dash-form-input" defaultValue="Route 5001: Hawally Loop" />
            </div>
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">Provider</label>
              <input type="text" className="ad-dash-form-input" defaultValue="KGL Transport" />
            </div>
          </div>

          <div className="ad-dash-form-row">
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">From (Origin)</label>
              <input type="text" className="ad-dash-form-input" defaultValue="Jahra" />
            </div>
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">To (Destination)</label>
              <input type="text" className="ad-dash-form-input" defaultValue="Jahra" />
            </div>
          </div>

          <div className="ad-dash-form-row">
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">Time</label>
              <input type="text" className="ad-dash-form-input" defaultValue="8:00 AM" />
            </div>
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">Price (KWD)</label>
              <input type="text" className="ad-dash-form-input" defaultValue="1.323" />
            </div>
            <div className="ad-dash-form-group">
              <label className="ad-dash-form-label">Total Seats</label>
              <input type="text" className="ad-dash-form-input" defaultValue="44" />
            </div>
          </div>

          <div className="ad-dash-form-group-full">
            <label className="ad-dash-form-label">Assign Tags</label>
            <div className="ad-dash-tags-grid">
              {tags.map((tag) => (
                <label key={tag.id} className="ad-dash-tag-checkbox">
                  <input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                  <span className={`ad-dash-tag-label ad-dash-tag-${tag.color}`}>{tag.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="ad-dash-form-toggles">
            <label className="ad-dash-toggle-item">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="ad-dash-toggle-checkbox"
              />
              <span className="ad-dash-toggle-label">Mark as Featured</span>
            </label>
            <label className="ad-dash-toggle-item">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="ad-dash-toggle-checkbox"
              />
              <span className="ad-dash-toggle-label">Route Active</span>
            </label>
          </div>
        </div>

        <div className="ad-dash-modal-footer">
          <button className="ad-dash-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-dash-btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

export default AdminEditRouteModal
