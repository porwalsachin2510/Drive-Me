import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers,
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiShield,
  FiShieldOff,
  FiCheck,
  FiX,
  FiEye,
  FiEyeOff,
  FiMoreVertical,
  FiUserCheck,
  FiUserX,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { toast } from 'react-hot-toast';
import {
    getAllAdmins,
    getAdminStats,
    createAdmin,
    updateAdminPermissions,
    getAdminDetails,
    suspendAdmin,
    activateAdmin,
    deleteAdmin
} from '../../../services/adminAPI';
import './AdminManagement.css';

// Module definitions for permissions
const MODULES = [
  {
    key: "overview",
    label: "Overview/Dashboard",
    description: "Access to admin dashboard overview",
  },
  {
    key: "b2cManagement",
    label: "B2C Management",
    description: "Manage B2C rentals and bookings",
  },
  {
    key: "ridePooling",
    label: "Ride Pooling",
    description: "Manage ride pooling services",
  },
  {
    key: "b2bListings",
    label: "B2B Listings",
    description: "Manage B2B vehicle listings",
  },
  { key: "users", label: "Users", description: "Manage user accounts" },
  {
    key: "wallets",
    label: "Wallets",
    description: "Manage user wallets and transactions",
  },
  {
    key: "vehicleApproval",
    label: "Vehicle Approval",
    description: "Approve/reject vehicle registrations",
  },
  {
    key: "commission",
    label: "Commission",
    description: "Manage commission settings and rates",
  },
  {
    key: "negotiations",
    label: "Negotiations",
    description: "Handle price negotiations and offers",
  },
  {
    key: "settlement",
    label: "Settlement",
    description: "Manage payment settlements",
  },
  {
    key: "dropdowns",
    label: "Dropdowns",
    description: "Manage dropdown configurations",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Access to reports and analytics",
  },
  { key: "finance", label: "Finance", description: "Access to financial data" },
  {
    key: "communication",
    label: "Communication",
    description: "Manage notifications and messages",
  },
  { key: "ads", label: "Ads", description: "Manage advertisements" },
  {
    key: "paymentVerification",
    label: "Payment Verification",
    description: "Verify payments",
  },
  { key: "content", label: "Content", description: "Manage app content" },
  {
    key: "adminManagement",
    label: "Admin Management",
    description: "Create and manage other admins",
  },
  {
    key: "termsAndConditions",
    label: "Terms & Conditions",
    description: "Manage terms, privacy policy and legal content",
  },
];

const AdminManagement = () => {
  // State management
  const [admins, setAdmins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminDetails, setAdminDetails] = useState(null);

  // Form state for creating new admin
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    whatsappNumber: "",
    countryCode: "+971",
    isSuperAdmin: false,
    modules: {},
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
  // Dropdown menu state
  const [openDropdown, setOpenDropdown] = useState(null);

  // Fetch admins
  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllAdmins({
        page: pagination.page,
        limit: 20,
        search: searchTerm,
        status: statusFilter,
      });

      if (response.success) {
        setAdmins(response.admins);
        setPagination(response.pagination);
      }
    } catch (error) {
      toast.error("Failed to fetch admins");
      console.error("Error fetching admins:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, searchTerm, statusFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await getAdminStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchStats();
  }, [fetchAdmins, fetchStats]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest(".actions-dropdown")) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (!showEditModal) {
      if (!formData.password) {
        errors.password = "Password is required";
      } else if (formData.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (!formData.whatsappNumber.trim()) {
      errors.whatsappNumber = "WhatsApp number is required";
    }

    if (!formData.isSuperAdmin) {
      const hasAnyModule = Object.values(formData.modules).some(
        (v) => v === true,
      );
      if (!hasAnyModule) {
        errors.modules = "Select at least one module permission";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle create admin
  const handleCreateAdmin = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const response = await createAdmin({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        whatsappNumber: formData.whatsappNumber,
        countryCode: formData.countryCode,
        isSuperAdmin: formData.isSuperAdmin,
        modules: formData.modules,
      });

      if (response.success) {
        toast.success("Admin created successfully");
        setShowCreateModal(false);
        resetForm();
        fetchAdmins();
        fetchStats();
      } else {
        toast.error(response.message || "Failed to create admin");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle update permissions
  const handleUpdatePermissions = async (e) => {
    e.preventDefault();

    if (!formData.isSuperAdmin) {
      const hasAnyModule = Object.values(formData.modules).some(
        (v) => v === true,
      );
      if (!hasAnyModule) {
        setFormErrors({ modules: "Select at least one module permission" });
        return;
      }
    }

    try {
      setSubmitting(true);
      const response = await updateAdminPermissions(selectedAdmin._id, {
        isSuperAdmin: formData.isSuperAdmin,
        modules: formData.modules,
      });

      if (response.success) {
        toast.success("Permissions updated successfully");
        setShowEditModal(false);
        resetForm();
        fetchAdmins();
        fetchStats();
      } else {
        toast.error(response.message || "Failed to update permissions");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle suspend admin
  const handleSuspendAdmin = async (admin) => {
    try {
      const response = await suspendAdmin(admin._id, {
        reason: "Suspended by administrator",
      });
      if (response.success) {
        toast.success("Admin suspended successfully");
        fetchAdmins();
        fetchStats();
      } else {
        toast.error(response.message || "Failed to suspend admin");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to suspend admin");
    }
    setOpenDropdown(null);
  };

  // Handle activate admin
  const handleActivateAdmin = async (admin) => {
    try {
      const response = await activateAdmin(admin._id);
      if (response.success) {
        toast.success("Admin activated successfully");
        fetchAdmins();
        fetchStats();
      } else {
        toast.error(response.message || "Failed to activate admin");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to activate admin");
    }
    setOpenDropdown(null);
  };

  // Handle delete admin
  const handleDeleteAdmin = async () => {
    try {
      setSubmitting(true);
      const response = await deleteAdmin(selectedAdmin._id);
      if (response.success) {
        toast.success("Admin deleted successfully");
        setShowDeleteModal(false);
        setSelectedAdmin(null);
        fetchAdmins();
        fetchStats();
      } else {
        toast.error(response.message || "Failed to delete admin");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete admin");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle view admin details
  const handleViewAdmin = async (admin) => {
    try {
      const response = await getAdminDetails(admin._id);
      if (response.success) {
        setAdminDetails(response);
        setSelectedAdmin(admin);
        setShowViewModal(true);
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to fetch admin details");
    }
    setOpenDropdown(null);
  };

  // Open edit modal
  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      fullName: admin.fullName,
      email: admin.email,
      password: "",
      confirmPassword: "",
      whatsappNumber: admin.whatsappNumber || "",
      countryCode: admin.countryCode || "+971",
      isSuperAdmin: admin.adminPermissions?.isSuperAdmin || false,
      modules: admin.adminPermissions?.modules || {},
    });
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  // Open delete confirmation
  const openDeleteModal = (admin) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
    setOpenDropdown(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      whatsappNumber: "",
      countryCode: "+971",
      isSuperAdmin: false,
      modules: {},
    });
    setFormErrors({});
      setSelectedAdmin(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
  };

  // Toggle module permission
  const toggleModule = (moduleKey) => {
    setFormData((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: !prev.modules[moduleKey],
      },
    }));
  };

  // Select all modules
  const selectAllModules = () => {
    const allModules = {};
    MODULES.forEach((m) => {
      allModules[m.key] = true;
    });
    setFormData((prev) => ({ ...prev, modules: allModules }));
  };

  // Deselect all modules
  const deselectAllModules = () => {
    setFormData((prev) => ({ ...prev, modules: {} }));
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get status badge class
  const getStatusBadge = (status) => {
    const statusClasses = {
      ACTIVE:
        "drivemego-admin-management-status-badge drivemego-admin-management-status-active",
      SUSPENDED:
        "drivemego-admin-management-status-badge drivemego-admin-management-status-suspended",
      PENDING:
        "drivemego-admin-management-status-badge drivemego-admin-management-status-pending",
    };
    return statusClasses[status] || "drivemego-admin-management-status-badge";
  };

  return (
    <div className="drivemego-admin-management-admin-management">
      {/* Header */}
      <div className="drivemego-admin-management-admin-management-header">
        <div className="drivemego-admin-management-header-left">
          <h1>
            <FiUsers /> Admin Management
          </h1>
          <p>
            Create and manage administrator accounts with custom permissions
          </p>
        </div>
        <button
          className="drivemego-admin-management-btn-create-admin"
          onClick={() => setShowCreateModal(true)}
        >
          <FiUserPlus /> Create New Admin
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="drivemego-admin-management-stats-grid">
          <div className="drivemego-admin-management-stat-card">
            <div className="drivemego-admin-management-stat-icon drivemego-admin-management-total">
              <FiUsers />
            </div>
            <div className="drivemego-admin-management-stat-info">
              <span className="drivemego-admin-management-stat-value">
                {stats.totalAdmins}
              </span>
              <span className="drivemego-admin-management-stat-label">
                Total Admins
              </span>
            </div>
          </div>
          <div className="drivemego-admin-management-stat-card">
            <div className="drivemego-admin-management-stat-icon drivemego-admin-management-super">
              <FiShield />
            </div>
            <div className="drivemego-admin-management-stat-info">
              <span className="drivemego-admin-management-stat-value">
                {stats.superAdmins}
              </span>
              <span className="drivemego-admin-management-stat-label">
                Super Admins
              </span>
            </div>
          </div>
          <div className="drivemego-admin-management-stat-card">
            <div className="drivemego-admin-management-stat-icon drivemego-admin-management-active">
              <FiUserCheck />
            </div>
            <div className="drivemego-admin-management-stat-info">
              <span className="drivemego-admin-management-stat-value">
                {stats.activeAdmins}
              </span>
              <span className="drivemego-admin-management-stat-label">
                Active Admins
              </span>
            </div>
          </div>
          <div className="drivemego-admin-management-stat-card">
            <div className="drivemego-admin-management-stat-icon drivemego-admin-management-limited">
              <FiShieldOff />
            </div>
            <div className="drivemego-admin-management-stat-info">
              <span className="drivemego-admin-management-stat-value">
                {stats.limitedAdmins}
              </span>
              <span className="drivemego-admin-management-stat-label">
                Limited Access
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="drivemego-admin-management-filters-section">
        <div className="drivemego-admin-management-search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="drivemego-admin-management-filter-group">
          <FiFilter />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <button
          className="drivemego-admin-management-btn-refresh"
          onClick={() => {
            fetchAdmins();
            fetchStats();
          }}
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Admins Table */}
      <div className="drivemego-admin-management-admins-table-container">
        {loading ? (
          <div className="drivemego-admin-management-loading-state">
            <div className="drivemego-admin-management-spinner"></div>
            <p>Loading admins...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="drivemego-admin-management-empty-state">
            <FiUsers />
            <h3>No Admins Found</h3>
            <p>Create your first admin account to get started.</p>
            <button onClick={() => setShowCreateModal(true)}>
              <FiUserPlus /> Create Admin
            </button>
          </div>
        ) : (
          <table className="drivemego-admin-management-admins-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Role Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>
                    <div className="drivemego-admin-management-admin-info">
                      <div className="drivemego-admin-management-admin-avatar">
                        {admin.fullName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="drivemego-admin-management-admin-name">
                        <span className="drivemego-admin-management-name">
                          {admin.fullName}
                        </span>
                        <span className="drivemego-admin-management-phone">
                          {admin.whatsappNumber}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{admin.email}</td>
                  <td>
                    {admin.adminPermissions?.isSuperAdmin ? (
                      <span className="drivemego-admin-management-role-badge drivemego-admin-management-super-admin">
                        <FiShield /> Super Admin
                      </span>
                    ) : (
                      <span className="drivemego-admin-management-role-badge drivemego-admin-management-limited-admin">
                        <FiShieldOff /> Limited Access
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={getStatusBadge(admin.status)}>
                      {admin.status}
                    </span>
                  </td>
                  <td>{formatDate(admin.createdAt)}</td>
                  <td>
                    <div className="drivemego-admin-management-actions-dropdown">
                      <button
                        className="drivemego-admin-management-actions-trigger"
                        onClick={() =>
                          setOpenDropdown(
                            openDropdown === admin._id ? null : admin._id,
                          )
                        }
                      >
                        <FiMoreVertical />
                      </button>
                      {openDropdown === admin._id && (
                        <div className="drivemego-admin-management-dropdown-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAdmin(admin);
                            }}
                          >
                            <FiEye /> View Details
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(admin);
                            }}
                          >
                            <FiEdit2 /> Edit Permissions
                          </button>
                          {admin.status === "ACTIVE" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSuspendAdmin(admin);
                              }}
                              className="drivemego-admin-management-danger"
                            >
                              <FiUserX /> Suspend
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateAdmin(admin);
                              }}
                              className="drivemego-admin-management-success"
                            >
                              <FiUserCheck /> Activate
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteModal(admin);
                            }}
                            className="drivemego-admin-management-danger"
                          >
                            <FiTrash2 /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="drivemego-admin-management-pagination">
          <button
            disabled={pagination.page === 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={pagination.page === pagination.pages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            Next
          </button>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div
          className="drivemego-admin-management-modal-overlay"
          onClick={() => {
            setShowCreateModal(false);
            resetForm();
          }}
        >
          <div
            className="drivemego-admin-management-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-admin-management-modal-header">
              <h2>
                <FiUserPlus /> Create New Admin
              </h2>
              <button
                className="drivemego-admin-management-close-btn"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="drivemego-admin-management-modal-body">
                <div className="drivemego-admin-management-form-section">
                  <h3>Basic Information</h3>
                  <div className="drivemego-admin-management-form-grid">
                    <div className="drivemego-admin-management-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fullName: e.target.value,
                          })
                        }
                        placeholder="Enter full name"
                        className={
                          formErrors.fullName
                            ? "drivemego-admin-management-error"
                            : ""
                        }
                      />
                      {formErrors.fullName && (
                        <span className="drivemego-error-text">
                          {formErrors.fullName}
                        </span>
                      )}
                    </div>
                    <div className="drivemego-admin-management-form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="Enter email address"
                        className={formErrors.email ? "drivemego-error" : ""}
                      />
                      {formErrors.email && (
                        <span className="drivemego-admin-management-error-text">
                          {formErrors.email}
                        </span>
                      )}
                    </div>
                    <div className="drivemego-admin-management-form-group">
                      <label>WhatsApp Number *</label>
                      <div className="drivemego-admin-management-phone-input">
                        <select
                          value={formData.countryCode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              countryCode: e.target.value,
                            })
                          }
                        >
                          <option value="+971">+971 (UAE)</option>
                          <option value="+965">+965 (Kuwait)</option>
                        </select>
                        <input
                          type="text"
                          value={formData.whatsappNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              whatsappNumber: e.target.value,
                            })
                          }
                          placeholder="Enter phone number"
                          className={
                            formErrors.whatsappNumber
                              ? "drivemego-admin-management-error"
                              : ""
                          }
                        />
                      </div>
                      {formErrors.whatsappNumber && (
                        <span className="drivemego-admin-management-error-text">
                          {formErrors.whatsappNumber}
                        </span>
                      )}
                    </div>
                    <div className="drivemego-admin-management-form-group">
                      <label>Password *</label>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          placeholder="Enter password"
                          className={formErrors.password ? "error" : ""}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {formErrors.password && (
                        <span className="drivemego-admin-management-error-text">
                          {formErrors.password}
                        </span>
                      )}
                    </div>
                    <div className="drivemego-admin-management-form-group">
                      <label>Confirm Password *</label>
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={formData.confirmPassword}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              confirmPassword: e.target.value,
                            })
                          }
                          placeholder="Confirm password"
                          className={formErrors.confirmPassword ? "error" : ""}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {formErrors.confirmPassword && (
                        <span className="drivemego-admin-management-error-text">
                          {formErrors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="drivemego-admin-management-form-section">
                  <h3>Access Level</h3>
                  <div className="drivemego-admin-management-super-admin-toggle">
                    <label className="drivemego-admin-management-toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.isSuperAdmin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isSuperAdmin: e.target.checked,
                          })
                        }
                      />
                      <span className="drivemego-admin-management-toggle-slider"></span>
                    </label>
                    <div className="drivemego-admin-management-toggle-info">
                      <span className="drivemego-admin-management-toggle-label">
                        Super Admin
                      </span>
                      <span className="drivemego-admin-management-toggle-description">
                        Super admins have access to all modules and can create
                        other admins
                      </span>
                    </div>
                  </div>
                </div>

                {!formData.isSuperAdmin && (
                  <div className="drivemego-admin-management-form-section">
                    <div className="drivemego-admin-management-section-header">
                      <h3>Module Permissions</h3>
                      <div className="drivemego-admin-management-bulk-actions">
                        <button type="button" onClick={selectAllModules}>
                          Select All
                        </button>
                        <button type="button" onClick={deselectAllModules}>
                          Deselect All
                        </button>
                      </div>
                    </div>
                    {formErrors.modules && (
                      <span className="drivemego-admin-management-error-text">
                        {formErrors.modules}
                      </span>
                    )}
                    <div className="drivemego-admin-management-modules-grid">
                      {MODULES.map((module) => (
                        <div
                          key={module.key}
                          className={`drivemego-admin-management-module-card ${formData.modules[module.key] ? "drivemego-selected" : ""}`}
                          onClick={() => toggleModule(module.key)}
                        >
                          <div className="drivemego-admin-management-module-checkbox">
                            {formData.modules[module.key] ? <FiCheck /> : null}
                          </div>
                          <div className="drivemego-admin-management-module-info">
                            <span className="drivemego-admin-management-module-label">
                              {module.label}
                            </span>
                            <span className="drivemego-admin-management-module-description">
                              {module.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="drivemego-admin-management-modal-footer">
                <button
                  type="button"
                  className="drivemego-admin-management-btn-cancel"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-admin-management-btn-submit"
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && selectedAdmin && (
        <div
          className="drivemego-admin-management-modal-overlay"
          onClick={() => {
            setShowEditModal(false);
            resetForm();
          }}
        >
          <div
            className="drivemego-admin-management-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-admin-management-modal-header">
              <h2>
                <FiEdit2 /> Edit Permissions - {selectedAdmin.fullName}
              </h2>
              <button
                className="drivemego-admin-management-close-btn"
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                }}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleUpdatePermissions}>
              <div className="drivemego-admin-management-modal-body">
                <div className="drivemego-admin-management-form-section">
                  <h3>Access Level</h3>
                  <div className="drivemego-admin-management-super-admin-toggle">
                    <label className="drivemego-admin-management-toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.isSuperAdmin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isSuperAdmin: e.target.checked,
                          })
                        }
                      />
                      <span className="drivemego-admin-management-toggle-slider"></span>
                    </label>
                    <div className="drivemego-admin-management-toggle-info">
                      <span className="drivemego-admin-management-toggle-label">
                        Super Admin
                      </span>
                      <span className="drivemego-admin-management-toggle-description">
                        Super admins have access to all modules and can create
                        other admins
                      </span>
                    </div>
                  </div>
                </div>

                {!formData.isSuperAdmin && (
                  <div className="drivemego-admin-management-form-section">
                    <div className="drivemego-admin-management-section-header">
                      <h3>Module Permissions</h3>
                      <div className="drivemego-admin-management-bulk-actions">
                        <button type="button" onClick={selectAllModules}>
                          Select All
                        </button>
                        <button type="button" onClick={deselectAllModules}>
                          Deselect All
                        </button>
                      </div>
                    </div>
                    {formErrors.modules && (
                      <span className="drivemego-admin-management-error-text">
                        {formErrors.modules}
                      </span>
                    )}
                    <div className="drivemego-admin-management-modules-grid">
                      {MODULES.map((module) => (
                        <div
                          key={module.key}
                          className={`drivemego-admin-management-module-card ${formData.modules[module.key] ? "drivemego-selected" : ""}`}
                          onClick={() => toggleModule(module.key)}
                        >
                          <div className="drivemego-admin-management-module-checkbox">
                            {formData.modules[module.key] ? <FiCheck /> : null}
                          </div>
                          <div className="drivemego-admin-management-module-info">
                            <span className="drivemego-admin-management-module-label">
                              {module.label}
                            </span>
                            <span className="drivemego-admin-management-module-description">
                              {module.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="drivemego-admin-management-modal-footer">
                <button
                  type="button"
                  className="drivemego-admin-management-btn-cancel"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="drivemego-admin-management-btn-submit"
                  disabled={submitting}
                >
                  {submitting ? "Updating..." : "Update Permissions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Admin Modal */}
      {showViewModal && adminDetails && (
        <div
          className="drivemego-admin-management-modal-overlay"
          onClick={() => {
            setShowViewModal(false);
            setAdminDetails(null);
          }}
        >
          <div
            className="drivemego-admin-management-modal-content drivemego-admin-management-view-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-admin-management-modal-header">
              <h2>
                <FiEye /> Admin Details
              </h2>
              <button
                className="drivemego-admin-management-close-btn"
                onClick={() => {
                  setShowViewModal(false);
                  setAdminDetails(null);
                }}
              >
                <FiX />
              </button>
            </div>
            <div className="drivemego-admin-management-modal-body">
              <div className="drivemego-admin-management-admin-profile">
                <div className="drivemego-admin-management-profile-avatar">
                  {adminDetails.admin.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="drivemego-admin-management-profile-info">
                  <h3>{adminDetails.admin.fullName}</h3>
                  <p>{adminDetails.admin.email}</p>
                  <span className={getStatusBadge(adminDetails.admin.status)}>
                    {adminDetails.admin.status}
                  </span>
                </div>
              </div>

              <div className="drivemego-admin-management-details-grid">
                <div className="drivemego-admin-management-detail-item">
                  <span className="drivemego-admin-management-detail-label">
                    Phone
                  </span>
                  <span className="drivemego-admin-management-detail-value">
                    {adminDetails.admin.whatsappNumber || "N/A"}
                  </span>
                </div>
                <div className="drivemego-admin-management-detail-item">
                  <span className="drivemego-admin-management-detail-label">
                    Role Type
                  </span>
                  <span className="drivemego-admin-management-detail-value">
                    {adminDetails.admin.adminPermissions?.isSuperAdmin
                      ? "Super Admin"
                      : "Limited Admin"}
                  </span>
                </div>
                <div className="drivemego-admin-management-detail-item">
                  <span className="drivemego-admin-management-detail-label">
                    Created
                  </span>
                  <span className="drivemego-admin-management-detail-value">
                    {formatDate(adminDetails.admin.createdAt)}
                  </span>
                </div>
                <div className="drivemego-admin-management-detail-item">
                  <span className="drivemego-admin-management-detail-label">
                    Created By
                  </span>
                  <span className="drivemego-admin-management-detail-value">
                    {adminDetails.admin.createdByAdmin?.fullName || "System"}
                  </span>
                </div>
              </div>

              <div className="drivemego-admin-management-stats-section">
                <h4>Activity Stats</h4>
                <div className="drivemego-admin-management-mini-stats">
                  <div className="drivemego-admin-management-mini-stat">
                    <span className="drivemego-admin-management-mini-value">
                      {adminDetails.stats.usersActivated}
                    </span>
                    <span className="drivemego-admin-management-mini-label">
                      Users Activated
                    </span>
                  </div>
                  <div className="drivemego-admin-management-mini-stat">
                    <span className="drivemego-mini-value">
                      {adminDetails.stats.adminsCreated}
                    </span>
                    <span className="drivemego-admin-management-mini-label">
                      Admins Created
                    </span>
                  </div>
                </div>
              </div>

              {!adminDetails.admin.adminPermissions?.isSuperAdmin && (
                <div className="drivemego-admin-management-permissions-section">
                  <h4>Module Permissions</h4>
                  <div className="drivemego-admin-management-permissions-list">
                    {MODULES.map((module) => (
                      <div
                        key={module.key}
                        className={`drivemego-admin-management-permission-item ${adminDetails.admin.adminPermissions?.modules?.[module.key] ? "drivemego-admin-management-granted" : "drivemego-admin-management-denied"}`}
                      >
                        {adminDetails.admin.adminPermissions?.modules?.[
                          module.key
                        ] ? (
                          <FiCheck className="drivemego-admin-management-icon drivemego-admin-management-granted" />
                        ) : (
                          <FiX className="drivemego-admin-management-icon drivemego-admin-management-denied" />
                        )}
                        <span>{module.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="drivemego-admin-management-modal-footer">
              <button
                className="drivemego-admin-management-btn-cancel"
                onClick={() => {
                  setShowViewModal(false);
                  setAdminDetails(null);
                }}
              >
                Close
              </button>
              <button
                className="drivemego-admin-management-btn-submit"
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(adminDetails.admin);
                }}
              >
                <FiEdit2 /> Edit Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAdmin && (
        <div
          className="drivemego-admin-management-modal-overlay"
          onClick={() => {
            setShowDeleteModal(false);
            setSelectedAdmin(null);
          }}
        >
          <div
            className="drivemego-admin-management-modal-content drivemego-admin-management-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-admin-management-modal-header drivemego-admin-management-delete">
              <h2>
                <FiTrash2 /> Delete Admin
              </h2>
              <button
                className="drivemego-admin-management-close-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAdmin(null);
                }}
              >
                <FiX />
              </button>
            </div>
            <div className="drivemego-admin-management-modal-body">
              <div className="drivemego-admin-management-delete-warning">
                <FiTrash2 className="drivemego-admin-management-warning-icon" />
                <h3>Are you sure?</h3>
                <p>
                  You are about to delete the admin account for{" "}
                  <strong>{selectedAdmin.fullName}</strong>. This action cannot
                  be undone.
                </p>
              </div>
            </div>
            <div className="drivemego-admin-management-modal-footer">
              <button
                className="drivemego-admin-management-btn-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAdmin(null);
                }}
              >
                Cancel
              </button>
              <button
                className="drivemego-admin-management-btn-delete"
                onClick={handleDeleteAdmin}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};;

export default AdminManagement;
