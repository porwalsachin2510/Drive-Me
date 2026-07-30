"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/api";
import "./AdminDropdownManagement.css";
import { notify } from "../../../utils/toast";

function AdminDropdownManagement() {
  const [dropdowns, setDropdowns] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [newOption, setNewOption] = useState({
    value: "",
    label: "",
    icon: "",
    description: "",
  });

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      setLoading(true);
      const response = await api.get("/dropdowns");
      setDropdowns(response.data.data.dropdowns || []);
    } catch (error) {
      console.error("Error fetching dropdowns:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      await api.post("/dropdowns/seed");
      await fetchDropdowns();
      notify("Default dropdown options seeded successfully!");
    } catch (error) {
      console.error("Error seeding defaults:", error);
      notify("Failed to seed defaults. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!selectedCategory || !newOption.value || !newOption.label) {
      notify("Please fill in value and label");
      return;
    }

    try {
      setSaving(true);
      await api.post(
        `/dropdowns/category/${selectedCategory.category}/options`,
        newOption,
      );
      await fetchDropdowns();
      setShowAddModal(false);
      setNewOption({ value: "", label: "", icon: "", description: "" });

      // Update selected category with new data
      const updatedDropdown = dropdowns.find(
        (d) => d.category === selectedCategory.category,
      );
      if (updatedDropdown) {
        setSelectedCategory(updatedDropdown);
      }
    } catch (error) {
      console.error("Error adding option:", error);
      notify(error.response?.data?.message || "Failed to add option");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOption = async (optionId, updates) => {
    if (!selectedCategory) return;

    try {
      setSaving(true);
      await api.put(
        `/dropdowns/category/${selectedCategory.category}/options/${optionId}`,
        updates,
      );
      await fetchDropdowns();
      setEditingOption(null);

      // Update selected category with new data
      const response = await api.get("/dropdowns");
      const updatedDropdowns = response.data.data.dropdowns || [];
      const updatedCategory = updatedDropdowns.find(
        (d) => d.category === selectedCategory.category,
      );
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
    } catch (error) {
      console.error("Error updating option:", error);
      notify("Failed to update option");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = async (optionId) => {
    if (!selectedCategory) return;
    if (!window.confirm("Are you sure you want to delete this option?")) return;

    try {
      setSaving(true);
      await api.delete(
        `/dropdowns/category/${selectedCategory.category}/options/${optionId}`,
      );
      await fetchDropdowns();

      // Update selected category with new data
      const response = await api.get("/dropdowns");
      const updatedDropdowns = response.data.data.dropdowns || [];
      const updatedCategory = updatedDropdowns.find(
        (d) => d.category === selectedCategory.category,
      );
      if (updatedCategory) {
        setSelectedCategory(updatedCategory);
      }
    } catch (error) {
      console.error("Error deleting option:", error);
      notify("Failed to delete option");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOptionStatus = async (optionId, currentStatus) => {
    await handleUpdateOption(optionId, { isActive: !currentStatus });
  };

  const filteredDropdowns = dropdowns.filter(
    (dropdown) =>
      dropdown.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dropdown.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getCategoryIcon = (category) => {
    if (category.includes("VEHICLE")) return "car-icon";
    if (
      category.includes("LOCATION") ||
      category.includes("CITIES") ||
      category.includes("COUNTRIES")
    )
      return "location-icon";
    if (category.includes("CURRENCY")) return "currency-icon";
    if (category.includes("LICENSE")) return "license-icon";
    if (category.includes("RENTAL") || category.includes("DURATION"))
      return "calendar-icon";
    if (category.includes("BUDGET")) return "budget-icon";
    if (category.includes("FEATURE")) return "feature-icon";
    if (category.includes("PAYMENT")) return "payment-icon";
    return "default-icon";
  };

  const formatCategoryName = (category) => {
    return category
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Get contextual placeholder examples based on the selected category
  const getPlaceholderExamples = (category) => {
    if (!category)
      return {
        value: "e.g., OPTION_1",
        label: "e.g., Option 1",
        icon: "e.g., icon",
        description: "Brief description",
      };

    const cat = category.toUpperCase();

    if (cat.includes("VEHICLE_CATEGORIES_PASSENGER")) {
      return {
        value: "e.g., SEDAN, SUV, MINIVAN",
        label: "e.g., Sedan, SUV, Minivan",
        icon: "e.g., car, suv",
        description: "e.g., Comfortable 4-door sedan for business travel",
      };
    }
    if (cat.includes("VEHICLE_CATEGORIES_GOODS")) {
      return {
        value: "e.g., PICKUP_1TON, TRUCK_7TON",
        label: "e.g., Pickup 1 Ton, Truck 7 Ton",
        icon: "e.g., truck, pickup",
        description: "e.g., Light goods carrier for small deliveries",
      };
    }
    if (cat.includes("VEHICLE_CATEGORIES_MANAGED")) {
      return {
        value: "e.g., SHUTTLE_BUS, EXECUTIVE_VAN",
        label: "e.g., Shuttle Bus, Executive Van",
        icon: "e.g., bus, van",
        description: "e.g., Managed shuttle service for employees",
      };
    }
    if (cat.includes("LOCATION") || cat === "LOCATIONS") {
      return {
        value: "e.g., dubai, abu_dhabi, kuwait_city",
        label: "e.g., Dubai, Abu Dhabi, Kuwait City",
        icon: "e.g., location",
        description: "e.g., Major city in UAE",
      };
    }
    if (cat.includes("CITIES")) {
      return {
        value: "e.g., Dubai, Sharjah, Ajman",
        label: "e.g., Dubai, Sharjah, Ajman",
        icon: "e.g., city",
        description: "e.g., City in the UAE",
      };
    }
    if (cat.includes("COUNTRIES")) {
      return {
        value: "e.g., UAE, Kuwait, Saudi Arabia",
        label: "e.g., United Arab Emirates, Kuwait",
        icon: "e.g., flag",
        description: "e.g., Country in the Middle East",
      };
    }
    if (cat.includes("CURRENCIES")) {
      return {
        value: "e.g., AED, KWD, SAR",
        label: "e.g., AED - UAE Dirham, KWD - Kuwaiti Dinar",
        icon: "e.g., currency",
        description: "e.g., Official currency of UAE",
      };
    }
    if (cat.includes("LICENSE_TYPE") || cat.includes("LICENSE")) {
      return {
        value: "e.g., Light, Heavy, Commercial",
        label: "e.g., Light Vehicle License",
        icon: "e.g., license",
        description: "e.g., License for driving light vehicles",
      };
    }
    if (cat.includes("RENTAL_DURATION")) {
      return {
        value: "e.g., daily, weekly, monthly",
        label: "e.g., Daily Rental, Weekly Rental",
        icon: "e.g., calendar",
        description: "e.g., Perfect for short-term needs",
      };
    }
    if (cat.includes("BUDGET_RANGES_DAILY")) {
      return {
        value: "e.g., 0-500, 500-1000, 1000+",
        label: "e.g., Less than 500 (Budget) - NO CURRENCY!",
        icon: "e.g., money",
        description: "Currency is added automatically based on user location",
      };
    }
    if (cat.includes("BUDGET_RANGES_WEEKLY")) {
      return {
        value: "e.g., 0-3000, 3000-6000, 6000+",
        label: "e.g., Less than 3,000 (Budget) - NO CURRENCY!",
        icon: "e.g., money",
        description: "Currency is added automatically based on user location",
      };
    }
    if (cat.includes("BUDGET_RANGES_MONTHLY")) {
      return {
        value: "e.g., 0-10000, 10000-25000, 25000+",
        label: "e.g., Less than 10,000 (Budget) - NO CURRENCY!",
        icon: "e.g., money",
        description: "Currency is added automatically based on user location",
      };
    }
    if (cat.includes("BUDGET_RANGES_LONGTERM")) {
      return {
        value: "e.g., 0-8000, 8000-20000, 20000+",
        label: "e.g., Less than 8,000/month (Budget) - NO CURRENCY!",
        icon: "e.g., money",
        description: "Currency is added automatically based on user location",
      };
    }
    if (cat.includes("VEHICLE_FEATURES") || cat.includes("FEATURES")) {
      return {
        value: "e.g., GPS Tracking, Dash Camera, Sunroof",
        label: "e.g., GPS Tracking, Dash Camera",
        icon: "e.g., feature",
        description: "e.g., Real-time vehicle tracking system",
      };
    }
    if (cat.includes("MIN_SEATS")) {
      return {
        value: "e.g., 1, 5, 10, 30",
        label: "e.g., Minimum Seats Required",
        icon: "e.g., seat",
        description: "e.g., Minimum seating capacity required",
      };
    }
    if (cat.includes("PAYMENT")) {
      return {
        value: "e.g., CASH, CARD, BANK_TRANSFER",
        label: "e.g., Cash Payment, Card Payment",
        icon: "e.g., payment",
        description: "e.g., Pay with cash upon delivery",
      };
    }

    return {
      value: "e.g., OPTION_VALUE",
      label: "e.g., Option Label",
      icon: "e.g., icon-name",
      description: "Brief description of this option",
    };
  };

  return (
    <div className="admin-dropdown-management">
      <div className="admin-dropdown-header">
        <div className="header-left">
          <h2>Dropdown Management</h2>
          <p className="header-description">
            Manage all dropdown options used across the application. Changes
            apply instantly to all users.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="seed-btn"
            onClick={handleSeedDefaults}
            disabled={saving}
          >
            {saving ? "Seeding..." : "Seed Defaults"}
          </button>
        </div>
      </div>

      <div className="admin-dropdown-stats">
        <div className="stat-card">
          <span className="stat-number">{dropdowns.length}</span>
          <span className="stat-label">Categories</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {dropdowns.reduce((sum, d) => sum + (d.options?.length || 0), 0)}
          </span>
          <span className="stat-label">Total Options</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {dropdowns.filter((d) => d.isSystemDefault).length}
          </span>
          <span className="stat-label">System Defaults</span>
        </div>
      </div>

      <div className="admin-dropdown-content">
        <div className="categories-panel">
          <div className="panel-header">
            <h3>Categories</h3>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {loading ? (
            <div className="loading-state">Loading categories...</div>
          ) : (
            <div className="categories-list">
              {filteredDropdowns.map((dropdown) => (
                <div
                  key={dropdown.category}
                  className={`category-item ${selectedCategory?.category === dropdown.category ? "active" : ""}`}
                  onClick={() => setSelectedCategory(dropdown)}
                >
                  <div
                    className={`category-icon ${getCategoryIcon(dropdown.category)}`}
                  ></div>
                  <div className="category-info">
                    <span className="category-name">{dropdown.name}</span>
                    <span className="category-count">
                      {dropdown.options?.length || 0} options
                    </span>
                  </div>
                  {dropdown.isSystemDefault && (
                    <span className="system-badge">System</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="options-panel">
          {selectedCategory ? (
            <>
              <div className="panel-header">
                <div className="panel-title-section">
                  <h3>{selectedCategory.name}</h3>
                  <span className="category-code">
                    {selectedCategory.category}
                  </span>
                </div>
                <button
                  className="add-option-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Option
                </button>
              </div>

              {selectedCategory.description && (
                <p className="panel-description">
                  {selectedCategory.description}
                </p>
              )}

              <div className="options-list">
                {selectedCategory.options
                  ?.sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((option) => (
                    <div
                      key={option._id}
                      className={`option-item ${!option.isActive ? "inactive" : ""}`}
                    >
                      {editingOption === option._id ? (
                        <div className="option-edit-form">
                          <input
                            type="text"
                            defaultValue={option.value}
                            placeholder="Value"
                            id={`edit-value-${option._id}`}
                            className="edit-input"
                          />
                          <input
                            type="text"
                            defaultValue={option.label}
                            placeholder="Label"
                            id={`edit-label-${option._id}`}
                            className="edit-input"
                          />
                          <input
                            type="text"
                            defaultValue={option.description || ""}
                            placeholder="Description"
                            id={`edit-desc-${option._id}`}
                            className="edit-input"
                          />
                          <div className="edit-actions">
                            <button
                              className="save-btn"
                              onClick={() => {
                                const valueEl = document.getElementById(
                                  `edit-value-${option._id}`,
                                );
                                const labelEl = document.getElementById(
                                  `edit-label-${option._id}`,
                                );
                                const descEl = document.getElementById(
                                  `edit-desc-${option._id}`,
                                );
                                handleUpdateOption(option._id, {
                                  value: valueEl.value,
                                  label: labelEl.value,
                                  description: descEl.value,
                                });
                              }}
                              disabled={saving}
                            >
                              Save
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={() => setEditingOption(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="option-content">
                            <div className="option-main">
                              <span className="option-label">
                                {option.label}
                              </span>
                              <span className="option-value">
                                {option.value}
                              </span>
                            </div>
                            {option.description && (
                              <span className="option-description">
                                {option.description}
                              </span>
                            )}
                            {option.icon && (
                              <span className="option-icon">{option.icon}</span>
                            )}
                          </div>
                          <div className="option-actions">
                            <span className="option-order">
                              #{option.order || 0}
                            </span>
                            <button
                              className={`status-toggle ${option.isActive ? "active" : "inactive"}`}
                              onClick={() =>
                                handleToggleOptionStatus(
                                  option._id,
                                  option.isActive,
                                )
                              }
                              title={
                                option.isActive
                                  ? "Click to disable"
                                  : "Click to enable"
                              }
                            >
                              {option.isActive ? "Active" : "Inactive"}
                            </button>
                            <button
                              className="edit-btn"
                              onClick={() => setEditingOption(option._id)}
                            >
                              Edit
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteOption(option._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                {(!selectedCategory.options ||
                  selectedCategory.options.length === 0) && (
                  <div className="empty-options">
                    <p>No options in this category yet.</p>
                    <button
                      className="add-first-btn"
                      onClick={() => setShowAddModal(true)}
                    >
                      Add First Option
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">⚙️</div>
              <h3>Select a Category</h3>
              <p>
                Choose a dropdown category from the left panel to view and
                manage its options.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Option Modal */}
      {showAddModal && selectedCategory && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <h3>Add New Option</h3>
                <div className="modal-category-badge">
                  <span className="modal-category-label">Adding to:</span>
                  <span className="modal-category-name">
                    {selectedCategory.name}
                  </span>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                x
              </button>
            </div>
            <div className="modal-body">
              {/* Category Info Banner */}
              <div className="category-info-banner">
                <div
                  className={`category-banner-icon ${getCategoryIcon(selectedCategory.category)}`}
                ></div>
                <div className="category-banner-text">
                  <strong>{selectedCategory.name}</strong>
                  <span className="category-banner-code">
                    {selectedCategory.category}
                  </span>
                  {selectedCategory.description && (
                    <p className="category-banner-desc">
                      {selectedCategory.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Budget Range Notice - Don't add currency */}
              {selectedCategory.category?.includes("BUDGET_RANGES") && (
                <div className="budget-currency-notice">
                  <div className="notice-icon">info</div>
                  <div className="notice-content">
                    <strong>
                      Important: Do NOT include currency (AED/KWD) in the label
                    </strong>
                    <p>
                      Currency is automatically added based on user's location.
                      Just enter the numeric range and category.
                    </p>
                    <p>
                      <strong>Correct:</strong> "Less than 1,500 (Budget)" or
                      "1,500-3,000 (Economy)"
                    </p>
                    <p>
                      <strong>Wrong:</strong> "Less than 1,500 AED (Budget)"
                    </p>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Value *</label>
                <input
                  type="text"
                  value={newOption.value}
                  onChange={(e) =>
                    setNewOption({ ...newOption, value: e.target.value })
                  }
                  placeholder={
                    getPlaceholderExamples(selectedCategory.category).value
                  }
                />
                <span className="form-hint">
                  Unique identifier used in the system (no spaces, use
                  underscores)
                </span>
              </div>
              <div className="form-group">
                <label>Label *</label>
                <input
                  type="text"
                  value={newOption.label}
                  onChange={(e) =>
                    setNewOption({ ...newOption, label: e.target.value })
                  }
                  placeholder={
                    getPlaceholderExamples(selectedCategory.category).label
                  }
                />
                <span className="form-hint">
                  Display text shown to users in dropdowns
                </span>
              </div>
              <div className="form-group">
                <label>Icon (optional)</label>
                <input
                  type="text"
                  value={newOption.icon}
                  onChange={(e) =>
                    setNewOption({ ...newOption, icon: e.target.value })
                  }
                  placeholder={
                    getPlaceholderExamples(selectedCategory.category).icon
                  }
                />
                <span className="form-hint">
                  Icon identifier for visual display
                </span>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newOption.description}
                  onChange={(e) =>
                    setNewOption({ ...newOption, description: e.target.value })
                  }
                  placeholder={
                    getPlaceholderExamples(selectedCategory.category)
                      .description
                  }
                  rows={3}
                />
                <span className="form-hint">
                  Additional details about this option
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleAddOption}
                disabled={saving || !newOption.value || !newOption.label}
              >
                {saving ? "Adding..." : `Add to ${selectedCategory.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDropdownManagement;
