"use client";

import { useState, useEffect } from "react";
import "./AdminUsers.css";
import AdminUserDetailsModal from "./AdminUserDetailsModal/AdminUserDetailsModal";
import SuspendUserModal from "./SuspendUserModal/SuspendUserModal";
import ActivateUserModal from "./ActivateUserModal/ActivateUserModal";
import api from "../../../utils/api";

function AdminUsers() {
  const [activeTab, setActiveTab] = useState("all-users");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Whether the currently logged-in admin is a super admin. Only a super admin
  // may suspend/delete another super admin, so this gates those actions in the UI.
  const [currentIsSuperAdmin, setCurrentIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    commuters: 0,
    corporates: 0,
    b2cPartners: 0,
    b2bPartners: 0,
    drivers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
  });

  useEffect(() => {
    fetchUsers();
    fetchUserStats();
    fetchMyPermissions();
  }, []);

  const fetchMyPermissions = async () => {
    try {
      const response = await api.get("/admin/admins/my-permissions");
      const isSuper =
        response.data?.permissions?.isSuperAdmin === true ||
        response.data?.admin?.isPrimaryOwner === true;
      setCurrentIsSuperAdmin(isSuper);
    } catch (error) {
      console.error("Error fetching my permissions:", error);
      setCurrentIsSuperAdmin(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await api.get("/admin/users/stats");
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  const handleUserAction = async (userId, action, data = {}) => {
    try {
      if (action === "delete") {
        // Delete uses DELETE method, not PUT
        if (
          window.confirm(
            "Are you sure you want to delete this user? This action cannot be undone.",
          )
        ) {
          await api.delete(`/admin/users/${userId}`);
        } else {
          return;
        }
      } else if (action === "suspend") {
        // Use PUT with body data for suspension
        await api.put(`/admin/users/${userId}/suspend`, data);
      } else if (action === "activate") {
        // Use PUT with body data for activation
        await api.put(`/admin/users/${userId}/activate`, data);
      } else {
        await api.put(`/admin/users/${userId}/${action}`);
      }
      fetchUsers();
      fetchUserStats();
      // Close modals
      setShowSuspendModal(false);
      setShowActivateModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      alert(`Failed to ${action} user. Please try again.`);
    }
  };

  const handleSuspendClick = (user) => {
    setSelectedUser(user);
    setShowSuspendModal(true);
  };

  const handleActivateClick = (user) => {
    setSelectedUser(user);
    setShowActivateModal(true);
  };

  const handleSuspendConfirm = async (suspensionData) => {
    if (selectedUser) {
      await handleUserAction(selectedUser._id, "suspend", suspensionData);
    }
  };

  const handleActivateConfirm = async (activationData) => {
    if (selectedUser) {
      await handleUserAction(selectedUser._id, "activate", activationData);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getUsersByTab = () => {
    switch (activeTab) {
      case "all-users":
        return filteredUsers;
      case "commuters":
        return filteredUsers.filter((user) => user.role === "COMMUTER");
      case "corporates":
        return filteredUsers.filter((user) => user.role === "CORPORATE");
      case "b2c-partners":
        return filteredUsers.filter((user) => user.role === "B2C_PARTNER");
      case "b2b-partners":
        return filteredUsers.filter((user) => user.role === "B2B_PARTNER");
      case "drivers":
        return filteredUsers.filter(
          (user) =>
            user.role === "B2B_PARTNER_DRIVER" ||
            user.role === "CORPORATE_DRIVER",
        );
      case "suspended":
        return filteredUsers.filter((user) => user.status === "SUSPENDED");
      default:
        return filteredUsers;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return "#28a745";
      case "SUSPENDED":
        return "#dc3545";
      case "PENDING":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  // A super admin is stored with role "ADMIN" + adminPermissions.isSuperAdmin = true.
  const isSuperAdmin = (user) =>
    user?.role === "ADMIN" && user?.adminPermissions?.isSuperAdmin === true;

  // Human-readable role label shown on the badge.
  const getRoleLabel = (user) => {
    if (isSuperAdmin(user)) return "SUPER ADMIN";
    return (user.role || "").replace(/_/g, " ");
  };

  const getRoleColor = (user) => {
    if (isSuperAdmin(user)) return "#dc3545";
    switch (user?.role) {
      case "COMMUTER":
        return "#007bff";
      case "CORPORATE":
        return "#6f42c1";
      case "B2C_PARTNER":
        return "#28a745";
      case "B2B_PARTNER":
        return "#fd7e14";
      case "B2B_PARTNER_DRIVER":
      case "CORPORATE_DRIVER":
        return "#20c997";
      default:
        return "#6c757d";
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : "U";
  };

  const tabData = [
    { id: "all-users", label: "All Users", count: stats.totalUsers },
    { id: "commuters", label: "Commuters", count: stats.commuters },
    { id: "corporates", label: "Corporates", count: stats.corporates },
    { id: "b2c-partners", label: "B2C Partners", count: stats.b2cPartners },
    { id: "b2b-partners", label: "B2B Partners", count: stats.b2bPartners },
    { id: "drivers", label: "Drivers", count: stats.drivers },
    { id: "suspended", label: "Suspended", count: stats.suspendedUsers },
  ];

  return (
    <div className="admin-users">
      <div className="admin-users-header">
        <h2>User Management</h2>
        <div className="admin-users-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.totalUsers}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.activeUsers}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.suspendedUsers}</span>
            <span className="stat-label">Suspended</span>
          </div>
        </div>
      </div>

      <div className="admin-users-tabs">
        {tabData.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="admin-users-search">
        <input
          type="text"
          placeholder="Search users by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="admin-users-content">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="users-grid">
            {getUsersByTab().map((user) => (
              <div key={user._id} className="user-card">
                <div className="user-avatar">
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={user.fullName}
                      className="avatar-circle"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: getRoleColor(user) }}
                    >
                      {getInitial(user.fullName)}
                    </div>
                  )}
                  <div
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(user.status) }}
                  />
                </div>

                <div className="user-info">
                  <h4>{user.fullName}</h4>
                  <p className="user-email">{user.email}</p>
                  <p className="user-phone">{user.whatsappNumber}</p>
                  <div className="user-badges">
                    <span
                      className="role-badge"
                      style={{ backgroundColor: getRoleColor(user) }}
                    >
                      {getRoleLabel(user)}
                    </span>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(user.status) }}
                    >
                      {user.status}
                    </span>
                  </div>
                  {user.companyName && (
                    <p className="company-name">{user.companyName}</p>
                  )}
                  {user.status === "SUSPENDED" && user.suspensionReason && (
                    <div className="suspension-info-mini">
                      <div className="suspension-reason">
                        Reason: {user.suspensionReason}
                      </div>
                      {user.suspensionEndDate && (
                        <div className="suspension-duration">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          Ends:{" "}
                          {new Date(
                            user.suspensionEndDate,
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="user-actions">
                  <button
                    className="view-btn"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowDetailsModal(true);
                    }}
                  >
                    View Details
                  </button>

                  {(() => {
                    // A super admin can only be suspended/deleted by another
                    // super admin. Hide those actions from everyone else so the
                    // platform's top-level owner account stays protected.
                    const targetIsSuperAdmin = isSuperAdmin(user);
                    const canManageThisUser =
                      !targetIsSuperAdmin || currentIsSuperAdmin;

                    if (!canManageThisUser) {
                      return (
                        <span className="protected-account-note">
                          Protected account
                        </span>
                      );
                    }

                    return (
                      <>
                        {user.status === "ACTIVE" ? (
                          <button
                            className="suspend-btn"
                            onClick={() => handleSuspendClick(user)}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="activate-btn"
                            onClick={() => handleActivateClick(user)}
                          >
                            Activate
                          </button>
                        )}

                        <button
                          className="delete-btn"
                          onClick={() => handleUserAction(user._id, "delete")}
                        >
                          Delete
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetailsModal && selectedUser && (
        <AdminUserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedUser(null);
          }}
          onUpdate={fetchUsers}
          onActivate={async (userId, message) => {
            await handleUserAction(userId, "activate", { message });
            setShowDetailsModal(false);
          }}
        />
      )}

      {showSuspendModal && selectedUser && (
        <SuspendUserModal
          user={selectedUser}
          onClose={() => {
            setShowSuspendModal(false);
            setSelectedUser(null);
          }}
          onConfirm={handleSuspendConfirm}
        />
      )}

      {showActivateModal && selectedUser && (
        <ActivateUserModal
          user={selectedUser}
          onClose={() => {
            setShowActivateModal(false);
            setSelectedUser(null);
          }}
          onConfirm={handleActivateConfirm}
        />
      )}
    </div>
  );
}

export default AdminUsers;
