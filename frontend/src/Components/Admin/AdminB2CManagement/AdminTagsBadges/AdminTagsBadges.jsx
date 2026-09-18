"use client";

import { useState, useEffect } from "react";
import "./AdminTagsBadges.css";
import AdminCreateTagModal from "./AdminCreateTagModal/AdminCreateTagModal";
import api from "../../../../utils/api";

const svg = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);
const ICONS = {
  route: svg(<><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>),
  vehicle: svg(<><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></>),
  service: svg(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  promo: svg(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>),
  general: svg(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>),
  check: svg(<polyline points="20 6 9 17 4 12" />),
  x: svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  info: svg(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>),
  plus: svg(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  help: svg(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
};

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
      icon: ICONS.route,
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
      icon: ICONS.vehicle,
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
      icon: ICONS.service,
      description: "Describe service quality and type",
      examples: ["Premium", "Budget Friendly", "Corporate", "VIP", "Standard"],
      whereUsed: ["Route Listings", "Partner Profiles", "Booking Pages"],
      color: "#8b5cf6",
    },
    promo: {
      title: "Promotion Tags",
      icon: ICONS.promo,
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
      icon: ICONS.general,
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
              ? ICONS.check
              : notification.type === "error"
                ? ICONS.x
                : ICONS.info}
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
            <span className="ad-dash-tb-btn-icon">{ICONS.help}</span>{" "}
            {showUsageGuide ? "Hide Guide" : "Usage Guide"}
          </button>
          <button
            className="ad-dash-tb-create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="ad-dash-tb-btn-icon">{ICONS.plus}</span> Create Tag
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
