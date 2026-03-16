"use client"

import { useState, useEffect } from "react"
import "./AdminUsers.css"
import AdminUserDetailsModal from "./AdminUserDetailsModal/AdminUserDetailsModal"
import api from "../../../utils/api"

function AdminUsers() {
  const [activeTab, setActiveTab] = useState("all-users")
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    commuters: 0,
    corporates: 0,
    b2cPartners: 0,
    b2bPartners: 0,
    drivers: 0,
    activeUsers: 0,
    suspendedUsers: 0
  })

  useEffect(() => {
    fetchUsers()
    fetchUserStats()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/users')
      setUsers(response.data.users)
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserStats = async () => {
    try {
      const response = await api.get('/admin/users/stats')
      setStats(response.data.stats)
    } catch (error) {
      console.error("Error fetching user stats:", error)
    }
  }

  const handleUserAction = async (userId, action) => {
    try {
      if (action === 'delete') {
        // Delete uses DELETE method, not PUT
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          await api.delete(`/admin/users/${userId}`)
        } else {
          return
        }
      } else {
        await api.put(`/admin/users/${userId}/${action}`)
      }
      fetchUsers()
      fetchUserStats()
    } catch (error) {
      console.error(`Error ${action} user:`, error)
      alert(`Failed to ${action} user. Please try again.`)
    }
  }

  const filteredUsers = users.filter(user => 
    user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getUsersByTab = () => {
    switch (activeTab) {
      case "all-users":
        return filteredUsers
      case "commuters":
        return filteredUsers.filter(user => user.role === "COMMUTER")
      case "corporates":
        return filteredUsers.filter(user => user.role === "CORPORATE")
      case "b2c-partners":
        return filteredUsers.filter(user => user.role === "B2C_PARTNER")
      case "b2b-partners":
        return filteredUsers.filter(user => user.role === "B2B_PARTNER")
      case "drivers":
        return filteredUsers.filter(user => 
          user.role === "B2B_PARTNER_DRIVER" || user.role === "CORPORATE_DRIVER"
        )
      case "suspended":
        return filteredUsers.filter(user => user.status === "SUSPENDED")
      default:
        return filteredUsers
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE": return "#28a745"
      case "SUSPENDED": return "#dc3545"
      case "PENDING": return "#ffc107"
      default: return "#6c757d"
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case "COMMUTER": return "#007bff"
      case "CORPORATE": return "#6f42c1"
      case "B2C_PARTNER": return "#28a745"
      case "B2B_PARTNER": return "#fd7e14"
      case "B2B_PARTNER_DRIVER":
      case "CORPORATE_DRIVER": return "#20c997"
      default: return "#6c757d"
    }
  }

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : "U"
  }

  const tabData = [
    { id: "all-users", label: "All Users", count: stats.totalUsers },
    { id: "commuters", label: "Commuters", count: stats.commuters },
    { id: "corporates", label: "Corporates", count: stats.corporates },
    { id: "b2c-partners", label: "B2C Partners", count: stats.b2cPartners },
    { id: "b2b-partners", label: "B2B Partners", count: stats.b2bPartners },
    { id: "drivers", label: "Drivers", count: stats.drivers },
    { id: "suspended", label: "Suspended", count: stats.suspendedUsers },
  ]

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
        {tabData.map(tab => (
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
            {getUsersByTab().map(user => (
              <div key={user._id} className="user-card">
                <div className="user-avatar">
                  <div 
                    className="avatar-circle" 
                    style={{ backgroundColor: getRoleColor(user.role) }}
                  >
                    {getInitial(user.fullName)}
                  </div>
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
                      style={{ backgroundColor: getRoleColor(user.role) }}
                    >
                      {user.role.replace('_', ' ')}
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
                </div>

                <div className="user-actions">
                  <button 
                    className="view-btn"
                    onClick={() => {
                      setSelectedUser(user)
                      setShowDetailsModal(true)
                    }}
                  >
                    View Details
                  </button>
                  
                  {user.status === "ACTIVE" ? (
                    <button 
                      className="suspend-btn"
                      onClick={() => handleUserAction(user._id, 'suspend')}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button 
                      className="activate-btn"
                      onClick={() => handleUserAction(user._id, 'activate')}
                    >
                      Activate
                    </button>
                  )}
                  
                  <button 
                    className="delete-btn"
                    onClick={() => handleUserAction(user._id, 'delete')}
                  >
                    Delete
                  </button>
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
            setShowDetailsModal(false)
            setSelectedUser(null)
          }}
          onUpdate={fetchUsers}
        />
      )}
    </div>
  )
}

export default AdminUsers
