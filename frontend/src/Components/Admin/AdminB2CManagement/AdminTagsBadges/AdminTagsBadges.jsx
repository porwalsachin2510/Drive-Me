"use client"

import { useState, useEffect } from "react"
import "./AdminTagsBadges.css"
import AdminCreateTagModal from "./AdminCreateTagModal/AdminCreateTagModal"
import api from "../../../../utils/api"

function AdminTagsBadges() {
  const [hoveredTag, setHoveredTag] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/b2c/tags')
      setTags(response.data.tags)
    } catch (error) {
      console.error("Error fetching tags:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTag = async (tagData) => {
    try {
      await api.post('/admin/b2c/tags', tagData)
      setShowCreateModal(false)
      fetchTags()
    } catch (error) {
      console.error("Error creating tag:", error)
    }
  }

  const handleDeleteTag = async (tagId) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      try {
        await api.delete(`/admin/b2c/tags/${tagId}`)
        fetchTags()
      } catch (error) {
        console.error("Error deleting tag:", error)
      }
    }
  }

  const handleEditTag = (tag) => {
    setEditingTag(tag)
    setShowEditModal(true)
  }

  const handleUpdateTag = async (tagData) => {
    try {
      await api.put(`/admin/b2c/tags/${editingTag._id}`, tagData)
      setShowEditModal(false)
      setEditingTag(null)
      fetchTags()
    } catch (error) {
      console.error("Error updating tag:", error)
    }
  }

  const handleToggleStatus = async (tagId, currentStatus) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active"
      // Note: Backend doesn't have update endpoint yet, but we can add it
      console.log(`Toggling tag ${tagId} status to: ${newStatus}`)
      fetchTags()
    } catch (error) {
      console.error("Error updating tag status:", error)
    }
  }

  if (loading) {
    return (
      <div className="ad-dash-tags-badges">
        <div className="loading">Loading tags...</div>
      </div>
    )
  }

  return (
    <div className="ad-dash-tags-badges">
      <div className="ad-dash-tb-header">
        <div>
          <h3 className="ad-dash-tb-title">Global Tags</h3>
          <p className="ad-dash-tb-subtitle">Manage reusable badges for routes and services.</p>
        </div>
        <button className="ad-dash-tb-create-btn" onClick={() => setShowCreateModal(true)}>
          <span>➕</span> Create Tag
        </button>
      </div>

      <div className="ad-dash-tb-grid">
        {tags.map((tag) => (
          <div
            key={tag._id}
            className="ad-dash-tb-tag-card"
            onMouseEnter={() => setHoveredTag(tag._id)}
            onMouseLeave={() => setHoveredTag(null)}
          >
            <div className="ad-dash-tb-tag-content">
              <span className="ad-dash-tb-tag-icon">{tag.icon}</span>
              <span
                className="ad-dash-tb-tag-label"
                style={{
                  backgroundColor: tag.color,
                  color: tag.textColor,
                }}
              >
                {tag.label}
              </span>
            </div>
            
            <div className="ad-dash-tb-tag-info">
              <p className="ad-dash-tb-tag-description">{tag.description}</p>
              <div className="ad-dash-tb-tag-stats">
                <span className="ad-dash-tb-usage-count">
                  Used {tag.usageCount} times
                </span>
                <span 
                  className={`ad-dash-tb-status ${tag.status}`}
                >
                  {tag.status}
                </span>
              </div>
              <div className="ad-dash-tb-tag-date">
                Created {new Date(tag.createdAt).toLocaleDateString()}
              </div>
            </div>

            {hoveredTag === tag._id && (
              <div className="ad-dash-tb-tag-actions">
                <button 
                  className="ad-dash-tb-action-btn edit"
                  onClick={() => handleEditTag(tag)}
                >
                  Edit
                </button>
                <button 
                  className="ad-dash-tb-action-btn toggle"
                  onClick={() => handleToggleStatus(tag._id, tag.status)}
                >
                  {tag.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  className="ad-dash-tb-action-btn delete"
                  onClick={() => handleDeleteTag(tag._id)}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="no-tags">
          <p>No tags found. Create your first tag to get started.</p>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateModal && (
        <AdminCreateTagModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTag}
        />
      )}

      {/* Edit Tag Modal */}
      {showEditModal && editingTag && (
        <AdminCreateTagModal
          onClose={() => {
            setShowEditModal(false)
            setEditingTag(null)
          }}
          onSave={handleUpdateTag}
          editMode={true}
          initialData={editingTag}
        />
      )}
    </div>
  )
}

export default AdminTagsBadges
