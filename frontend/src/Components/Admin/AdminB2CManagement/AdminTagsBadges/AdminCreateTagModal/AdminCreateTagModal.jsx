"use client"

import { useState } from "react"
import "./AdminCreateTagModal.css"

function AdminCreateTagModal({ onClose, onSave, editMode = false, initialData = null }) {
  const [tagLabel, setTagLabel] = useState(initialData?.label || "")
  const [selectedColor, setSelectedColor] = useState(initialData?.color || "#000000")
  const [description, setDescription] = useState(initialData?.description || "")
  const [category, setCategory] = useState(initialData?.category || "general")
  const [saving, setSaving] = useState(false)

  const colors = [
    { id: "black", value: "#000000", bg: "#f3f4f6" },
    { id: "blue", value: "#3b82f6", bg: "#dbeafe" },
    { id: "purple", value: "#8b5cf6", bg: "#e9d5ff" },
    { id: "yellow", value: "#eab308", bg: "#fef3c7" },
    { id: "pink", value: "#ec4899", bg: "#fce7f3" },
    { id: "light-pink", value: "#f9a8d4", bg: "#fce7f3" },
    { id: "gray", value: "#6b7280", bg: "#f3f4f6" },
    { id: "indigo", value: "#6366f1", bg: "#e0e7ff" },
  ]

  return (
    <div className="ad-dash-modal-overlay" onClick={onClose}>
      <div className="ad-dash-modal-content ad-dash-tag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-dash-modal-header">
          <h3 className="ad-dash-modal-title">{editMode ? 'Edit Tag' : 'Create New Tag'}</h3>
          <button className="ad-dash-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ad-dash-modal-body">
          <div className="ad-dash-form-group">
            <label className="ad-dash-form-label">Tag Label</label>
            <input
              type="text"
              className="ad-dash-form-input"
              placeholder="e.g., High Demand"
              value={tagLabel}
              onChange={(e) => setTagLabel(e.target.value)}
            />
          </div>

          <div className="ad-dash-form-group">
            <label className="ad-dash-form-label">Color Theme</label>
            <div className="ad-dash-color-grid">
              {colors.map((color) => (
                <button
                  key={color.id}
                  className={`ad-dash-color-option ${selectedColor === color.value ? "ad-dash-color-selected" : ""}`}
                  style={{ backgroundColor: color.bg }}
                  onClick={() => setSelectedColor(color.value)}
                >
                  <div className="ad-dash-color-circle" style={{ backgroundColor: color.value }}></div>
                </button>
              ))}
            </div>
          </div>

          <div className="ad-dash-form-group">
            <label className="ad-dash-form-label">Description</label>
            <input
              type="text"
              className="ad-dash-form-input"
              placeholder="Brief description of this tag"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="ad-dash-form-group">
            <label className="ad-dash-form-label">Category</label>
            <select
              className="ad-dash-form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="general">General</option>
              <option value="route">Route</option>
              <option value="vehicle">Vehicle</option>
              <option value="service">Service</option>
              <option value="promo">Promotion</option>
            </select>
          </div>

          <div className="ad-dash-form-group">
            <label className="ad-dash-form-label">Preview</label>
            <div className="ad-dash-tag-preview">
              <span
                className="ad-dash-preview-tag"
                style={{
                  backgroundColor: colors.find((c) => c.value === selectedColor)?.bg || "#f3f4f6",
                  color: selectedColor,
                }}
              >
                {tagLabel || "Tag Preview"}
              </span>
            </div>
          </div>
        </div>

        <div className="ad-dash-modal-footer">
          <button className="ad-dash-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="ad-dash-btn-primary" 
            disabled={!tagLabel.trim() || saving}
            onClick={async () => {
              if (!tagLabel.trim()) return
              setSaving(true)
              try {
                const colorObj = colors.find((c) => c.value === selectedColor)
                await onSave({
                  label: tagLabel.trim(),
                  color: selectedColor,
                  textColor: colorObj?.bg === '#f3f4f6' ? '#ffffff' : '#ffffff',
                  description,
                  category
                })
              } catch (err) {
                console.error("Error saving tag:", err)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving...' : (editMode ? 'Update Tag' : 'Save Tag')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminCreateTagModal
