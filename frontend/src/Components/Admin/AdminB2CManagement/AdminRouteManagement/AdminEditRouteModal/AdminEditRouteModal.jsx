"use client"

import { useState } from "react"
import { X, Route as RouteIcon, Clock, Tag, Star } from "lucide-react"
import "./AdminEditRouteModal.css"

function AdminEditRouteModal({ route: _route, onClose }) {
  const [selectedTags, setSelectedTags] = useState(["premium"])
  const [isFeatured, setIsFeatured] = useState(true)
  const [isActive, setIsActive] = useState(true)

  const tags = [
    { id: "budget", label: "Budget Friendly" },
    { id: "ac", label: "AC Vehicle" },
    { id: "wifi", label: "WiFi Available" },
    { id: "premium", label: "Premium" },
    { id: "ladies", label: "Ladies Only" },
    { id: "express", label: "Express" },
  ]

  const toggleTag = (tagId) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId))
    } else {
      setSelectedTags([...selectedTags, tagId])
    }
  }

  return (
    <div className="route-management-modal-overlay" onClick={onClose}>
      <div className="route-management-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="route-management-modal-header">
          <div>
            <h3 className="route-management-modal-title">Edit Route</h3>
            <p className="route-management-modal-subtitle">
              Configure route details, tags, pricing, and schedule.
            </p>
          </div>
          <button className="route-management-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="route-management-modal-form">
          <div className="route-management-form-section">
            <h4 className="route-management-section-title">
              <RouteIcon size={16} /> Basic Information
            </h4>

            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Route Name</label>
                <input type="text" className="route-management-form-input" defaultValue="Route 5001: Hawally Loop" />
              </div>
              <div className="route-management-form-group">
                <label className="route-management-form-label">Provider</label>
                <input type="text" className="route-management-form-input" defaultValue="KGL Transport" />
              </div>
            </div>

            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">From (Origin)</label>
                <input type="text" className="route-management-form-input" defaultValue="Jahra" />
              </div>
              <div className="route-management-form-group">
                <label className="route-management-form-label">To (Destination)</label>
                <input type="text" className="route-management-form-input" defaultValue="Jahra" />
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">
              <Clock size={16} /> Schedule &amp; Pricing
            </h4>
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Time</label>
                <input type="text" className="route-management-form-input" defaultValue="8:00 AM" />
              </div>
              <div className="route-management-form-group">
                <label className="route-management-form-label">Price (KWD)</label>
                <input type="text" className="route-management-form-input" defaultValue="1.323" />
              </div>
              <div className="route-management-form-group">
                <label className="route-management-form-label">Total Seats</label>
                <input type="text" className="route-management-form-input" defaultValue="44" />
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">
              <Tag size={16} /> Assign Tags
            </h4>
            <div className="route-management-days-grid">
              {tags.map((tag) => (
                <label key={tag.id} className="route-management-day-checkbox">
                  <input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                  <span className="route-management-day-label">{tag.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">
              <Star size={16} /> Visibility
            </h4>
            <div className="route-management-days-grid">
              <label className="route-management-day-checkbox">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                <span className="route-management-day-label">Mark as Featured</span>
              </label>
              <label className="route-management-day-checkbox">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="route-management-day-label">Route Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="route-management-modal-footer">
          <button className="route-management-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="route-management-btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

export default AdminEditRouteModal
