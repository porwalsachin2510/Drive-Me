import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Settings,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Percent,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Building2,
  Truck,
  Car,
  Edit2,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  getUsersWithCommissionSettings,
  getUserCommissionSettings,
  updateCommissionSettings,
  // eslint-disable-next-line no-unused-vars
  createCommissionSettings,
} from "../../../services/adminAPI";
import "./AdminCommissionSettings.css";

const AdminCommissionSettings = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [stats, setStats] = useState({
    totalUsers: 0,
    usersWithCustomRates: 0,
    averageRate: 20,
  });

  const [commissionForm, setCommissionForm] = useState({
    defaultCommissionRate: 20,
    negotiationCommissionRate: 25,
    customRates: [],
    notes: "",
    emiCommissionSettings: {
      emiCommissionRate: 20,
      lateFeeCommissionRate: 0,
      lateFeePercentage: 2,
      gracePeriodDays: 0,
      overdueWarningThreshold: 2,
      suspensionThreshold: 3,
    },
  });

  const roleOptions = [
    { value: "ALL", label: "All Users" },
    { value: "CORPORATE", label: "Corporate", icon: Building2 },
    { value: "B2B_PARTNER", label: "B2B Partner", icon: Truck },
    { value: "B2C_PARTNER", label: "B2C Partner", icon: Car },
  ];

  const rateTypes = [
    { value: "CONTRACT", label: "Contract Commission" },
    { value: "BOOKING", label: "Booking Commission" },
    { value: "MONTHLY_PASS", label: "Monthly Pass Commission" },
    { value: "NEGOTIATION", label: "Negotiation Commission" },
    { value: "EMI", label: "EMI Commission" },
  ];

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUsersWithCommissionSettings({
        role: roleFilter !== "ALL" ? roleFilter : undefined,
        search: searchTerm,
      });

      if (response.success) {
        setUsers(response.users || []);
        setFilteredUsers(response.users || []);
        calculateStats(response.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({ type: "error", text: "Failed to load users" });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.companyName?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (roleFilter !== "ALL") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, users]);

  const calculateStats = (usersList) => {
    const usersWithSettings = usersList.filter((u) => u.commissionSettings);
    const rates = usersWithSettings.map(
      (u) => u.commissionSettings?.defaultCommissionRate || 20,
    );
    const avgRate =
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 20;

    setStats({
      totalUsers: usersList.length,
      usersWithCustomRates: usersWithSettings.length,
      averageRate: avgRate.toFixed(1),
    });
  };

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setEditMode(false);
    setShowModal(true);

    try {
      const response = await getUserCommissionSettings(user._id);

      if (response.success && response.settings) {
        setCommissionForm({
          defaultCommissionRate: response.settings.defaultCommissionRate || 20,
          negotiationCommissionRate:
            response.settings.negotiationCommissionRate || 25,
          customRates: response.settings.customRates || [],
          notes: response.settings.notes || "",
          emiCommissionSettings: response.settings.emiCommissionSettings || {
            emiCommissionRate: 20,
            lateFeeCommissionRate: 0,
            lateFeePercentage: 2,
            gracePeriodDays: 0,
            overdueWarningThreshold: 2,
            suspensionThreshold: 3,
          },
        });
      } else {
        setCommissionForm({
          defaultCommissionRate: 20,
          negotiationCommissionRate: 25,
          customRates: [],
          notes: "",
          emiCommissionSettings: {
            emiCommissionRate: 20,
            lateFeeCommissionRate: 0,
            lateFeePercentage: 2,
            gracePeriodDays: 0,
            overdueWarningThreshold: 2,
            suspensionThreshold: 3,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching commission settings:", error);
      setCommissionForm({
        defaultCommissionRate: 20,
        negotiationCommissionRate: 25,
        customRates: [],
        notes: "",
        emiCommissionSettings: {
          emiCommissionRate: 20,
          lateFeeCommissionRate: 0,
          lateFeePercentage: 2,
          gracePeriodDays: 0,
          overdueWarningThreshold: 2,
          suspensionThreshold: 3,
        },
      });
    }
  };

  const handleEditUser = (user) => {
    handleViewUser(user);
    setEditMode(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      const response = await updateCommissionSettings(
        selectedUser._id,
        commissionForm,
      );

      if (response.success) {
        setMessage({
          type: "success",
          text: "Commission settings saved successfully!",
        });
        setEditMode(false);
        fetchUsers();
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const addCustomRate = () => {
    setCommissionForm((prev) => ({
      ...prev,
      customRates: [
        ...prev.customRates,
        {
          rateType: "CONTRACT",
          rate: 20,
          effectiveFrom: new Date().toISOString().split("T")[0],
          effectiveUntil: null,
        },
      ],
    }));
  };

  const updateCustomRate = (index, field, value) => {
    setCommissionForm((prev) => {
      const updated = [...prev.customRates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, customRates: updated };
    });
  };

  const removeCustomRate = (index) => {
    setCommissionForm((prev) => ({
      ...prev,
      customRates: prev.customRates.filter((_, i) => i !== index),
    }));
  };

  const getRoleIcon = (role) => {
    const icons = {
      CORPORATE: Building2,
      B2B_PARTNER: Truck,
      B2C_PARTNER: Car,
    };
    const IconComponent = icons[role] || Users;
    return <IconComponent size={18} />;
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      CORPORATE: "role-corporate",
      B2B_PARTNER: "role-b2b",
      B2C_PARTNER: "role-b2c",
    };
    return classes[role] || "";
  };

  return (
    <div className="admin-commission-settings">
      {/* Header */}
      <div className="commission-header">
        <div className="commission-header-content">
          <h1>Commission Management</h1>
          <p>
            Configure commission rates for each user. Rates can range from 0% to
            100%.
          </p>
        </div>
        <button className="refresh-btn" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={18} className={loading ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="commission-stats">
        <div className="stat-card">
          <div className="stat-icon users-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalUsers}</span>
            <span className="stat-label">Total Users</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon custom-icon">
            <Settings size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.usersWithCustomRates}</span>
            <span className="stat-label">Custom Rates</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rate-icon">
            <Percent size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.averageRate}%</span>
            <span className="stat-label">Avg. Rate</span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`commission-message ${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="commission-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={18} />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="commission-table-container">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spinning" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No users found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <table className="commission-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Commission Type</th>
                <th>Commission Rate</th>
                <th>Custom Rules</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.profileImage ? (
                          <img src={user.profileImage} alt={user.fullName} />
                        ) : (
                          <span>{user.fullName?.charAt(0) || "U"}</span>
                        )}
                      </div>
                      <div className="user-details">
                        <span className="user-name">{user.fullName}</span>
                        <span className="user-email">{user.email}</span>
                        {user.companyName && (
                          <span className="user-company">
                            {user.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`role-badge ${getRoleBadgeClass(user.role)}`}
                    >
                      {getRoleIcon(user.role)}
                      {user.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <span className="commission-type-label">
                      {user.role === "B2B_PARTNER" && "Contract Commission"}
                      {user.role === "CORPORATE" && "Negotiation Commission"}
                      {user.role === "B2C_PARTNER" && "Booking Commission"}
                    </span>
                  </td>
                  <td>
                    <span className="rate-value">
                      {user.role === "B2B_PARTNER" &&
                        `${user.commissionSettings?.defaultCommissionRate ?? 20}%`}
                      {user.role === "CORPORATE" &&
                        `${user.commissionSettings?.negotiationCommissionRate ?? 25}%`}
                      {user.role === "B2C_PARTNER" &&
                        `${user.commissionSettings?.defaultCommissionRate ?? 20}%`}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`custom-rules-badge ${user.commissionSettings?.customRates?.length > 0 ? "has-rules" : ""}`}
                    >
                      {user.commissionSettings?.customRates?.length || 0} rules
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn view-btn"
                        onClick={() => handleViewUser(user)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditUser(user)}
                        title="Edit Settings"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedUser && (
        <div
          className="commission-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="commission-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <h2>
                  {editMode
                    ? "Edit Commission Settings"
                    : "Commission Settings"}
                </h2>
                <span
                  className={`role-badge ${getRoleBadgeClass(selectedUser.role)}`}
                >
                  {getRoleIcon(selectedUser.role)}
                  {selectedUser.role?.replace("_", " ")}
                </span>
              </div>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* User Info */}
              <div className="modal-user-info">
                <div className="user-avatar large">
                  {selectedUser.profileImage ? (
                    <img
                      src={selectedUser.profileImage}
                      alt={selectedUser.fullName}
                    />
                  ) : (
                    <span>{selectedUser.fullName?.charAt(0) || "U"}</span>
                  )}
                </div>
                <div className="user-details">
                  <h3>{selectedUser.fullName}</h3>
                  <p>{selectedUser.email}</p>
                  {selectedUser.companyName && (
                    <p className="company">{selectedUser.companyName}</p>
                  )}
                </div>
              </div>

              {/* Commission Settings Form */}
              <div className="commission-form">
                <div className="form-section">
                  <h4>
                    <Percent size={18} />
                    {selectedUser.role === "B2B_PARTNER" &&
                      "Contract Commission Settings"}
                    {selectedUser.role === "CORPORATE" &&
                      "Negotiation Commission Settings"}
                    {selectedUser.role === "B2C_PARTNER" &&
                      "Booking Commission Settings"}
                  </h4>

                  <div className="commission-type-info">
                    {selectedUser.role === "B2B_PARTNER" && (
                      <p className="info-text">
                        This commission is taken from B2B Partner when Corporate
                        pays for a contract (Standard Payment or EMI). The
                        commission is calculated on the advance payment amount.
                      </p>
                    )}
                    {selectedUser.role === "CORPORATE" && (
                      <p className="info-text">
                        This commission is taken from Corporate when Admin
                        negotiates a price reduction on their behalf. The
                        commission is calculated as a percentage of the savings
                        achieved through negotiation.
                      </p>
                    )}
                    {selectedUser.role === "B2C_PARTNER" && (
                      <p className="info-text">
                        This commission is taken from B2C Partner when a
                        Commuter makes a booking. The commission is calculated
                        on the total booking amount.
                      </p>
                    )}
                  </div>

                  <div className="form-row">
                    {/* B2B Partner: Contract Commission */}
                    {selectedUser.role === "B2B_PARTNER" && (
                      <div className="form-group">
                        <label>Contract Commission Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionForm.defaultCommissionRate}
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              defaultCommissionRate:
                                parseFloat(e.target.value) || 0,
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Commission on contract payments (0-100%)
                        </span>
                      </div>
                    )}

                    {/* Corporate: Negotiation Commission */}
                    {selectedUser.role === "CORPORATE" && (
                      <div className="form-group">
                        <label>Negotiation Commission Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionForm.negotiationCommissionRate}
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              negotiationCommissionRate:
                                parseFloat(e.target.value) || 0,
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Commission on negotiated savings (0-100%)
                        </span>
                      </div>
                    )}

                    {/* B2C Partner: Booking Commission */}
                    {selectedUser.role === "B2C_PARTNER" && (
                      <div className="form-group">
                        <label>Booking Commission Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionForm.defaultCommissionRate}
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              defaultCommissionRate:
                                parseFloat(e.target.value) || 0,
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Commission on bookings (0-100%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Rates Section */}
                <div className="form-section">
                  <div className="section-header">
                    <h4>
                      <DollarSign size={18} />
                      Custom Rate Rules
                    </h4>
                    {editMode && (
                      <button className="add-rule-btn" onClick={addCustomRate}>
                        + Add Rule
                      </button>
                    )}
                  </div>

                  {commissionForm.customRates.length === 0 ? (
                    <div className="no-rules">
                      <p>
                        No custom rate rules configured. Default rate will be
                        applied.
                      </p>
                    </div>
                  ) : (
                    <div className="custom-rates-list">
                      {commissionForm.customRates.map((rate, index) => (
                        <div key={index} className="custom-rate-item">
                          <div className="rate-fields">
                            <div className="form-group">
                              <label>Type</label>
                              <select
                                value={rate.rateType}
                                onChange={(e) =>
                                  updateCustomRate(
                                    index,
                                    "rateType",
                                    e.target.value,
                                  )
                                }
                                disabled={!editMode}
                              >
                                {rateTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Rate (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={rate.rate}
                                onChange={(e) =>
                                  updateCustomRate(
                                    index,
                                    "rate",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                disabled={!editMode}
                              />
                            </div>
                            <div className="form-group">
                              <label>Effective From</label>
                              <input
                                type="date"
                                value={rate.effectiveFrom?.split("T")[0] || ""}
                                onChange={(e) =>
                                  updateCustomRate(
                                    index,
                                    "effectiveFrom",
                                    e.target.value,
                                  )
                                }
                                disabled={!editMode}
                              />
                            </div>
                            <div className="form-group">
                              <label>Until (Optional)</label>
                              <input
                                type="date"
                                value={rate.effectiveUntil?.split("T")[0] || ""}
                                onChange={(e) =>
                                  updateCustomRate(
                                    index,
                                    "effectiveUntil",
                                    e.target.value || null,
                                  )
                                }
                                disabled={!editMode}
                              />
                            </div>
                          </div>
                          {editMode && (
                            <button
                              className="remove-rule-btn"
                              onClick={() => removeCustomRate(index)}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* EMI Commission Settings - Only for CORPORATE users */}
                {selectedUser.role === "CORPORATE" && (
                  <div className="form-section emi-section">
                    <h4>
                      <DollarSign size={18} />
                      EMI Payment Settings
                    </h4>
                    <p className="section-description">
                      Configure commission and penalties for EMI payments
                    </p>

                    <div className="form-row">
                      <div className="form-group">
                        <label>EMI Commission Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.emiCommissionRate ?? 20
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                emiCommissionRate:
                                  parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Commission on each EMI payment (0-35%)
                        </span>
                      </div>

                      <div className="form-group">
                        <label>Late Fee Percentage (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.lateFeePercentage ?? 2
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                lateFeePercentage:
                                  parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Penalty for overdue EMI payments
                        </span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Grace Period (Days)</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          step="1"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.gracePeriodDays ?? 0
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                gracePeriodDays: parseInt(e.target.value) || 0,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Days before late fee applies
                        </span>
                      </div>

                      <div className="form-group">
                        <label>Late Fee Commission (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.lateFeeCommissionRate ?? 0
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                lateFeeCommissionRate:
                                  parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Admin share of late fees collected
                        </span>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Warning Threshold (Overdue EMIs)</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          step="1"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.overdueWarningThreshold ?? 2
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                overdueWarningThreshold:
                                  parseInt(e.target.value) || 2,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Send warning after this many overdue EMIs
                        </span>
                      </div>

                      <div className="form-group">
                        <label>Suspension Threshold (Overdue EMIs)</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          step="1"
                          value={
                            commissionForm.emiCommissionSettings
                              ?.suspensionThreshold ?? 3
                          }
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              emiCommissionSettings: {
                                ...prev.emiCommissionSettings,
                                suspensionThreshold:
                                  parseInt(e.target.value) || 3,
                              },
                            }))
                          }
                          disabled={!editMode}
                        />
                        <span className="form-hint">
                          Allow service suspension after this many
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div className="form-section">
                  <h4>
                    <Calendar size={18} />
                    Notes
                  </h4>
                  <textarea
                    placeholder="Add any notes about this user's commission settings..."
                    value={commissionForm.notes}
                    onChange={(e) =>
                      setCommissionForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    disabled={!editMode}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {!editMode ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => setEditMode(true)}
                  >
                    <Edit2 size={16} />
                    Edit Settings
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSaveSettings}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={16} className="spinning" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Settings
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCommissionSettings;
