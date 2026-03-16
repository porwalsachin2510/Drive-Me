"use client"

import { useState, useEffect } from "react"
import "./AdminAds.css"
import api from "../../../utils/api"

function AdminAds() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalViews: 0,
    totalClicks: 0,
    totalRevenue: 0
  })

  const defaultFormData = {
    title: "",
    provider: "",
    placement: "top",
    size: "728x90",
    startDate: "",
    endDate: "",
    status: "active",
    targetUrl: "",
    description: "",
    budget: 0,
    dailyBudget: 0
  }
  const [formData, setFormData] = useState(defaultFormData)
  const [campaignImage, setCampaignImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchCampaigns()
    fetchStats()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/ads/campaigns')
      setCampaigns(response.data.campaigns)
    } catch (error) {
      console.error("Error fetching campaigns:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/ads/stats')
      setStats(response.data.stats)
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setCampaignImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const resetImageState = () => {
    setCampaignImage(null)
    setImagePreview(null)
  }

  const handleCreateCampaign = async () => {
    try {
      setUploading(true)
      const submitData = new FormData()
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined && formData[key] !== null) {
          submitData.append(key, formData[key])
        }
      })
      
      // Append image file if selected
      if (campaignImage) {
        submitData.append('campaignImage', campaignImage)
      }

      await api.post('/admin/ads/campaigns', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setShowCreateModal(false)
      setFormData(defaultFormData)
      resetImageState()
      fetchCampaigns()
      fetchStats()
    } catch (error) {
      console.error("Error creating campaign:", error)
      alert(error.response?.data?.message || "Error creating campaign")
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateCampaign = async () => {
    try {
      setUploading(true)
      const submitData = new FormData()
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined && formData[key] !== null && key !== 'imageUrl' && key !== '_id' && key !== '__v') {
          submitData.append(key, formData[key])
        }
      })
      
      // Append image file if a new one is selected
      if (campaignImage) {
        submitData.append('campaignImage', campaignImage)
      }

      await api.put(`/admin/ads/campaigns/${selectedCampaign._id}`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setShowEditModal(false)
      setSelectedCampaign(null)
      setFormData(defaultFormData)
      resetImageState()
      fetchCampaigns()
      fetchStats()
    } catch (error) {
      console.error("Error updating campaign:", error)
      alert(error.response?.data?.message || "Error updating campaign")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/admin/ads/campaigns/${campaignId}`)
      fetchCampaigns()
      fetchStats()
    } catch (error) {
      console.error("Error deleting campaign:", error)
    }
  }

  const handleToggleStatus = async (campaignId, status) => {
    try {
      await api.put(`/admin/ads/campaigns/${campaignId}/status`, { status })
      fetchCampaigns()
      fetchStats()
    } catch (error) {
      console.error("Error toggling status:", error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "#28a745"
      case "paused": return "#ffc107"
      case "expired": return "#dc3545"
      default: return "#6c757d"
    }
  }

  const renderCampaignCard = (campaign) => (
    <div key={campaign._id} className="campaign-card">
      <div className="campaign-preview">
        <img src={campaign.imageUrl || "/placeholder.svg"} alt={campaign.title} />
        <div className="campaign-status" style={{ backgroundColor: getStatusColor(campaign.status) }}>
          {campaign.status}
        </div>
      </div>
      
      <div className="campaign-info">
        <h4>{campaign.title}</h4>
        <p className="provider">{campaign.provider}</p>
        <div className="campaign-details">
          <span className="placement">{campaign.placement}</span>
          <span className="size">{campaign.size}</span>
        </div>
        
        <div className="campaign-metrics">
          <div className="metric">
            <span className="label">Views:</span>
            <span className="value">{campaign.views || 0}</span>
          </div>
          <div className="metric">
            <span className="label">Clicks:</span>
            <span className="value">{campaign.clicks || 0}</span>
          </div>
          <div className="metric">
            <span className="label">CTR:</span>
            <span className="value">
              {campaign.views ? ((campaign.clicks / campaign.views) * 100).toFixed(2) : 0}%
            </span>
          </div>
        </div>
        
        <div className="campaign-dates">
          <span className="date">{new Date(campaign.startDate).toLocaleDateString()}</span>
          <span className="date">to</span>
          <span className="date">{new Date(campaign.endDate).toLocaleDateString()}</span>
        </div>
      </div>
      
      <div className="campaign-actions">
        <button 
          className="edit-btn"
          onClick={() => {
            setSelectedCampaign(campaign)
            setFormData(campaign)
            setShowEditModal(true)
          }}
        >
          Edit
        </button>
        
        <button 
          className={`status-btn ${campaign.status}`}
          onClick={() => handleToggleStatus(
            campaign._id, 
            campaign.status === 'active' ? 'paused' : 'active'
          )}
        >
          {campaign.status === 'active' ? 'Pause' : 'Activate'}
        </button>
        
        <button 
          className="delete-btn"
          onClick={() => handleDeleteCampaign(campaign._id)}
        >
          Delete
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="admin-ads">
        <div className="loading">Loading campaigns...</div>
      </div>
    )
  }

  return (
    <div className="admin-ads">
      <div className="ads-header">
        <h2>Advertisement Management</h2>
        <div className="ads-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalCampaigns}</span>
            <span className="stat-label">Total Campaigns</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeCampaigns}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalViews}</span>
            <span className="stat-label">Total Views</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalClicks}</span>
            <span className="stat-label">Total Clicks</span>
          </div>
        </div>
        <button 
          className="create-btn"
          onClick={() => setShowCreateModal(true)}
        >
          Create Campaign
        </button>
      </div>

      <div className="campaigns-grid">
        {campaigns.map(renderCampaignCard)}
      </div>

      {campaigns.length === 0 && (
        <div className="no-campaigns">
          <p>No campaigns found</p>
          <button onClick={() => setShowCreateModal(true)}>
            Create First Campaign
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Campaign</h3>
            <div className="form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Campaign title"
                />
              </div>
              
              <div className="form-group">
                <label>Provider</label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  placeholder="Provider name"
                />
              </div>
              
              <div className="form-group">
                <label>Placement</label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData({...formData, placement: e.target.value})}
                >
                  <option value="top">Top Banner</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="footer">Footer</option>
                  <option value="popup">Popup</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Size</label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData({...formData, size: e.target.value})}
                >
                  <option value="728x90">728x90</option>
                  <option value="300x250">300x250</option>
                  <option value="120x60">120x60</option>
<option value="468x60">468x60</option>
</select>
</div>

<div className="form-group">
<label>Campaign Image *</label>
<input
type="file"
accept="image/*"
onChange={handleImageChange}
style={{ marginBottom: '10px' }}
/>
{imagePreview && (
<div className="image-preview" style={{ marginTop: '10px' }}>
<img 
  src={imagePreview} 
  alt="Preview" 
  style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
/>
<button 
  type="button" 
  onClick={() => { setCampaignImage(null); setImagePreview(null); }}
  style={{ marginLeft: '10px', padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
>
  Remove
</button>
</div>
)}
</div>

<div className="form-group">
<label>Target URL</label>
<input
type="url"
value={formData.targetUrl}
onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
placeholder="https://example.com"
/>
</div>

<div className="form-group">
<label>Description</label>
<textarea
value={formData.description || ""}
onChange={(e) => setFormData({...formData, description: e.target.value})}
placeholder="Campaign description"
rows={3}
/>
</div>

<div className="form-row">
<div className="form-group">
<label>Budget (KWD)</label>
<input
type="number"
value={formData.budget}
onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
placeholder="Budget amount"
min="0"
/>
</div>
<div className="form-group">
<label>Daily Budget (KWD)</label>
<input
type="number"
value={formData.dailyBudget || 0}
onChange={(e) => setFormData({...formData, dailyBudget: Number(e.target.value)})}
placeholder="Daily budget"
min="0"
/>
</div>
</div>

<div className="form-group">
<label>Start Date</label>
<input
type="date"
value={formData.startDate}
onChange={(e) => setFormData({...formData, startDate: e.target.value})}
/>
</div>

<div className="form-group">
<label>End Date</label>
<input
type="date"
value={formData.endDate}
onChange={(e) => setFormData({...formData, endDate: e.target.value})}
/>
</div>

<div className="form-group">
<label>Status</label>
<select
value={formData.status}
onChange={(e) => setFormData({...formData, status: e.target.value})}
>
<option value="active">Active</option>
<option value="paused">Paused</option>
</select>
</div>

<div className="modal-actions">
<button className="cancel-btn" onClick={() => { setShowCreateModal(false); resetImageState(); }}>
Cancel
</button>
<button className="save-btn" onClick={handleCreateCampaign} disabled={uploading}>
{uploading ? 'Uploading...' : 'Create Campaign'}
</button>
</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Campaign</h3>
            <div className="form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Campaign title"
                />
              </div>
              
              <div className="form-group">
                <label>Provider</label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  placeholder="Provider name"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Placement</label>
                  <select
                    value={formData.placement}
                    onChange={(e) => setFormData({...formData, placement: e.target.value})}
                  >
                    <option value="top">Top Banner</option>
                    <option value="sidebar">Sidebar</option>
                    <option value="footer">Footer</option>
                    <option value="popup">Popup</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Size</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({...formData, size: e.target.value})}
                  >
                    <option value="728x90">728x90</option>
                    <option value="300x250">300x250</option>
                    <option value="120x60">120x60</option>
<option value="468x60">468x60</option>
</select>
</div>
</div>

<div className="form-group">
<label>Campaign Image</label>
{formData.imageUrl && !imagePreview && (
<div style={{ marginBottom: '10px' }}>
<p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Current image:</p>
<img 
  src={formData.imageUrl} 
  alt="Current" 
  style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
/>
</div>
)}
<input
type="file"
accept="image/*"
onChange={handleImageChange}
style={{ marginBottom: '10px' }}
/>
{imagePreview && (
<div className="image-preview" style={{ marginTop: '10px' }}>
<p style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>New image preview:</p>
<img 
  src={imagePreview} 
  alt="Preview" 
  style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }}
/>
<button 
  type="button" 
  onClick={() => { setCampaignImage(null); setImagePreview(null); }}
  style={{ marginLeft: '10px', padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
>
  Remove
</button>
</div>
)}
</div>

<div className="form-group">
<label>Target URL</label>
<input
type="url"
value={formData.targetUrl}
onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
placeholder="https://example.com"
/>
</div>

<div className="form-group">
<label>Description</label>
<textarea
value={formData.description || ""}
onChange={(e) => setFormData({...formData, description: e.target.value})}
placeholder="Campaign description"
rows={3}
/>
</div>

<div className="form-row">
<div className="form-group">
<label>Budget (KWD)</label>
<input
type="number"
value={formData.budget}
onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
placeholder="Budget amount"
min="0"
/>
</div>

<div className="form-group">
<label>Daily Budget (KWD)</label>
<input
type="number"
value={formData.dailyBudget || 0}
onChange={(e) => setFormData({...formData, dailyBudget: Number(e.target.value)})}
placeholder="Daily budget"
min="0"
/>
</div>
</div>

<div className="form-row">
<div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate ? formData.startDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formData.endDate ? formData.endDate.substring(0, 10) : ""}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
<div className="modal-actions">
<button className="cancel-btn" onClick={() => { setShowEditModal(false); setSelectedCampaign(null); resetImageState(); }}>
Cancel
</button>
<button className="save-btn" onClick={handleUpdateCampaign} disabled={uploading}>
{uploading ? 'Uploading...' : 'Update Campaign'}
</button>
</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAds
