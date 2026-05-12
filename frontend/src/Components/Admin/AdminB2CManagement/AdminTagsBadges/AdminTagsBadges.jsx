"use client";

import { useState, useEffect } from "react";
import "./AdminTagsBadges.css";
import AdminCreateTagModal from "./AdminCreateTagModal/AdminCreateTagModal";
import api from "../../../../utils/api";

function AdminTagsBadges() {
  const [hoveredTag, setHoveredTag] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showUsageGuide, setShowUsageGuide] = useState(false);

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general", label: "General" },
    { value: "route", label: "Route" },
    { value: "vehicle", label: "Vehicle" },
    { value: "service", label: "Service" },
    { value: "promo", label: "Promotion" },
  ];

  // Usage guide information for each category
  const categoryUsageGuide = {
    route: {
      title: "Route Tags",
      icon: "🛣️",
      description: "Describe route characteristics and features",
      examples: [
        "Express",
        "Direct",
        "Ladies Only",
        "Night Route",
        "Weekend Only",
      ],
      whereUsed: ["B2C Routes", "B2B Routes", "Commuter Search Filters"],
      color: "#3b82f6",
    },
    vehicle: {
      title: "Vehicle Tags",
      icon: "🚐",
      description: "Describe vehicle features and amenities",
      examples: [
        "AC Vehicle",
        "WiFi Available",
        "USB Charging",
        "Luxury Seats",
        "Wheelchair Accessible",
      ],
      whereUsed: ["Vehicle Profiles", "Route Details", "Fleet Management"],
      color: "#10b981",
    },
    service: {
      title: "Service Tags",
      icon: "⭐",
      description: "Describe service quality and type",
      examples: ["Premium", "Budget Friendly", "Corporate", "VIP", "Standard"],
      whereUsed: ["Route Listings", "Partner Profiles", "Booking Pages"],
      color: "#8b5cf6",
    },
    promo: {
      title: "Promotion Tags",
      icon: "🎉",
      description: "Highlight special offers and promotions",
      examples: [
        "New Route",
        "Limited Time",
        "50% Off",
        "Early Bird",
        "Flash Sale",
      ],
      whereUsed: ["Route Cards", "Search Results", "Featured Sections"],
      color: "#f59e0b",
    },
    general: {
      title: "General Tags",
      icon: "🏷️",
      description: "General-purpose tags for various uses",
      examples: ["Popular", "Recommended", "Verified", "Featured", "Top Rated"],
      whereUsed: ["Any route or vehicle", "General categorization"],
      color: "#6b7280",
    },
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/b2c/tags");
      setTags(response.data.tags || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      showNotification("error", "Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (tagData) => {
    try {
      const response = await api.post("/admin/b2c/tags", tagData);
      if (response.data.success) {
        setShowCreateModal(false);
        showNotification("success", "Tag created successfully");
        fetchTags();
      }
    } catch (error) {
      console.error("Error creating tag:", error);
      showNotification(
        "error",
        error.response?.data?.message || "Failed to create tag",
      );
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this tag? It will be removed from all routes using it.",
      )
    ) {
      try {
        const response = await api.delete(`/admin/b2c/tags/${tagId}`);
        if (response.data.success) {
          showNotification("success", "Tag deleted successfully");
          fetchTags();
        }
      } catch (error) {
        console.error("Error deleting tag:", error);
        showNotification(
          "error",
          error.response?.data?.message || "Failed to delete tag",
        );
      }
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setShowEditModal(true);
  };

  const handleUpdateTag = async (tagData) => {
    try {
      const response = await api.put(
        `/admin/b2c/tags/${editingTag._id}`,
        tagData,
      );
      if (response.data.success) {
        setShowEditModal(false);
        setEditingTag(null);
        showNotification("success", "Tag updated successfully");
        fetchTags();
      }
    } catch (error) {
      console.error("Error updating tag:", error);
      showNotification(
        "error",
        error.response?.data?.message || "Failed to update tag",
      );
    }
  };

  const handleToggleStatus = async (tagId, currentStatus) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const response = await api.put(`/admin/b2c/tags/${tagId}`, {
        status: newStatus,
      });
      if (response.data.success) {
        showNotification(
          "success",
          `Tag ${newStatus === "active" ? "activated" : "deactivated"} successfully`,
        );
        fetchTags();
      }
    } catch (error) {
      console.error("Error updating tag status:", error);
      showNotification("error", "Failed to update tag status");
    }
  };

  const filteredTags =
    categoryFilter === "all"
      ? tags
      : tags.filter((tag) => tag.category === categoryFilter);

  if (loading) {
    return (
      <div className="ad-dash-tags-badges">
        <div className="loading">Loading tags...</div>
      </div>
    );
  }

  return (
    <div className="ad-dash-tags-badges">
      {/* Notification */}
      {notification && (
        <div
          className={`ad-dash-tb-notification ad-dash-tb-notification-${notification.type}`}
        >
          <span className="ad-dash-tb-notification-icon">
            {notification.type === "success"
              ? "✓"
              : notification.type === "error"
                ? "✕"
                : "i"}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="ad-dash-tb-header">
        <div>
          <h3 className="ad-dash-tb-title">Global Tags</h3>
          <p className="ad-dash-tb-subtitle">
            Manage reusable badges for routes and services. B2C and B2B partners
            can add these tags to their routes.
          </p>
        </div>
        <div className="ad-dash-tb-header-actions">
          <button
            className="ad-dash-tb-guide-btn"
            onClick={() => setShowUsageGuide(!showUsageGuide)}
          >
            <span>?</span> {showUsageGuide ? "Hide Guide" : "Usage Guide"}
          </button>
          <button
            className="ad-dash-tb-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <span>+</span> Create Tag
          </button>
        </div>
      </div>

      {/* Usage Guide Section */}
      {showUsageGuide && (
        <div className="ad-dash-tb-usage-guide">
          <div className="ad-dash-tb-guide-header">
            <h4>Tag Category Usage Guide</h4>
            <p>
              Understanding when to use each tag category for better
              organization
            </p>
          </div>
          <div className="ad-dash-tb-guide-grid">
            {Object.entries(categoryUsageGuide).map(([key, guide]) => (
              <div
                key={key}
                className="ad-dash-tb-guide-card"
                style={{ borderLeftColor: guide.color }}
              >
                <div className="ad-dash-tb-guide-card-header">
                  <span className="ad-dash-tb-guide-icon">{guide.icon}</span>
                  <h5>{guide.title}</h5>
                </div>
                <p className="ad-dash-tb-guide-description">
                  {guide.description}
                </p>
                <div className="ad-dash-tb-guide-section">
                  <label>Example Tags:</label>
                  <div className="ad-dash-tb-guide-examples">
                    {guide.examples.map((ex, idx) => (
                      <span
                        key={idx}
                        className="ad-dash-tb-guide-example"
                        style={{ backgroundColor: guide.color, color: "#fff" }}
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ad-dash-tb-guide-section">
                  <label>Where Used:</label>
                  <ul className="ad-dash-tb-guide-usage-list">
                    {guide.whereUsed.map((use, idx) => (
                      <li key={idx}>{use}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="ad-dash-tb-filters">
        <div className="ad-dash-tb-filter-group">
          <label className="ad-dash-tb-filter-label">Filter by Category:</label>
          <select
            className="ad-dash-tb-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ad-dash-tb-stats">
          <span className="ad-dash-tb-stat-item">Total: {tags.length}</span>
          <span className="ad-dash-tb-stat-item">
            Active: {tags.filter((t) => t.status === "active").length}
          </span>
          <span className="ad-dash-tb-stat-item">
            Showing: {filteredTags.length}
          </span>
        </div>
      </div>

      <div className="ad-dash-tb-grid">
        {filteredTags.map((tag) => (
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
              <p className="ad-dash-tb-tag-description">
                {tag.description || "No description"}
              </p>
              <div className="ad-dash-tb-tag-stats">
                <span className="ad-dash-tb-usage-count">
                  Used {tag.usageCount || 0} times
                </span>
                <span className="ad-dash-tb-category-badge">
                  {tag.category || "general"}
                </span>
                <span className={`ad-dash-tb-status ${tag.status}`}>
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
                  {tag.status === "active" ? "Deactivate" : "Activate"}
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
            setShowEditModal(false);
            setEditingTag(null);
          }}
          onSave={handleUpdateTag}
          editMode={true}
          initialData={editingTag}
        />
      )}
    </div>
  );
}

export default AdminTagsBadges;
