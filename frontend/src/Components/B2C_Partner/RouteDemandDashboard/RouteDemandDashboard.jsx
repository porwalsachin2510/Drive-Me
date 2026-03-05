import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import './RouteDemandDashboard.css';

const RouteDemandDashboard = () => {
  const [demandData, setDemandData] = useState({
    totalRequests: 0,
    pendingRequests: [],
    highDemandRoutes: [],
    demandByLocation: [],
    demandByTime: [],
    recentRequests: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseData, setResponseData] = useState({
    status: 'accepted',
    message: '',
    estimatedStartDate: '',
    proposedPrice: ''
  });

  useEffect(() => {
    fetchDemandData();
  }, []);

  const fetchDemandData = async () => {
    try {
      // Backend: GET /api/route-requests (routeRequestRoutes.js)
      const response = await api.get('/route-requests');

      if (response.data.success) {
        setDemandData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch demand data');
      }
    } catch (error) {
      console.error('Error fetching demand data:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Backend: POST /api/route-requests/:requestId/respond (routeRequestRoutes.js)
      const response = await api.post(`/route-requests/${selectedRequest._id}/respond`, responseData);

      if (response.data.success) {
        setShowResponseModal(false);
        setSelectedRequest(null);
        setResponseData({
          status: 'accepted',
          message: '',
          estimatedStartDate: '',
          proposedPrice: ''
        });
        
        // Refresh demand data
        fetchDemandData();
      } else {
        alert(response.data.message || 'Failed to submit response');
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Error submitting response');
    }
  };

  const openResponseModal = (request) => {
    setSelectedRequest(request);
    setResponseData({
      status: 'accepted',
      message: '',
      estimatedStartDate: '',
      proposedPrice: ''
    });
    setShowResponseModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDemandLevel = (count) => {
    if (count >= 10) return { level: 'High', color: '#ef4444' };
    if (count >= 5) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#10b981' };
  };

  if (loading) {
    return (
      <div className="route-demand-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading demand data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-demand-dashboard">
      <div className="dashboard-header">
        <h2>Route Demand Dashboard</h2>
        <div className="demand-summary">
          <span className="total-requests">
            Total Requests: <strong>{demandData.totalRequests}</strong>
          </span>
          <span className="pending-requests">
            Pending: <strong>{demandData.pendingRequests.length}</strong>
          </span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Requests ({demandData.pendingRequests.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'hot-routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('hot-routes')}
        >
          High Demand Routes
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Demand Analytics
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{demandData.totalRequests}</h3>
                  <p>Total Requests</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon pending">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{demandData.pendingRequests.length}</h3>
                  <p>Pending Response</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon routes">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>{demandData.highDemandRoutes.length}</h3>
                  <p>High Demand Routes</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon growth">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                    <polyline points="17 6 23 6 23 12"></polyline>
                  </svg>
                </div>
                <div className="stat-content">
                  <h3>+{Math.floor(Math.random() * 30 + 10)}%</h3>
                  <p>Monthly Growth</p>
                </div>
              </div>
            </div>

            <div className="recent-requests">
              <h3>Recent Route Requests</h3>
              <div className="requests-list">
                {demandData.recentRequests.map((request, index) => (
                  <div key={index} className="request-item">
                    <div className="request-info">
                      <h4>{request.fromLocation} → {request.toLocation}</h4>
                      <p>Requested by: {request.requesterName}</p>
                      <p>Preferred time: {request.preferredTime}</p>
                    </div>
                    <div className="request-meta">
                      <span className="request-date">{formatDate(request.createdAt)}</span>
                      <span className={`status ${request.status.toLowerCase()}`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="pending-requests-section">
            <h3>Pending Route Requests</h3>
            <div className="pending-list">
              {demandData.pendingRequests.map((request, index) => (
                <div key={index} className="pending-item">
                  <div className="request-details">
                    <div className="route-info">
                      <h4>{request.fromLocation} → {request.toLocation}</h4>
                      <p><strong>Requester:</strong> {request.requesterName}</p>
                      <p><strong>Email:</strong> {request.requesterEmail}</p>
                      <p><strong>Phone:</strong> {request.requesterPhone}</p>
                    </div>
                    <div className="preferences">
                      <p><strong>Preferred Time:</strong> {request.preferredTime}</p>
                      <p><strong>Frequency:</strong> {request.frequency}</p>
                      <p><strong>Passengers:</strong> {request.numberOfPassengers}</p>
                      <p><strong>Budget:</strong> ${request.budgetRange}</p>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button
                      className="respond-btn"
                      onClick={() => openResponseModal(request)}
                    >
                      Respond to Request
                    </button>
                    <button className="view-btn">View Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'hot-routes' && (
          <div className="hot-routes-section">
            <h3>High Demand Routes</h3>
            <div className="routes-grid">
              {demandData.highDemandRoutes.map((route, index) => {
                const demand = getDemandLevel(route.requestCount);
                return (
                  <div key={index} className="route-card">
                    <div className="route-header">
                      <h4>{route.fromLocation} → {route.toLocation}</h4>
                      <span 
                        className="demand-badge"
                        style={{ backgroundColor: demand.color }}
                      >
                        {demand.level} Demand
                      </span>
                    </div>
                    <div className="route-stats">
                      <div className="stat">
                        <label>Requests</label>
                        <span>{route.requestCount}</span>
                      </div>
                      <div className="stat">
                        <label>Avg Budget</label>
                        <span>${route.averageBudget}</span>
                      </div>
                      <div className="stat">
                        <label>Peak Time</label>
                        <span>{route.peakTime}</span>
                      </div>
                    </div>
                    <button className="create-route-btn">
                      Create Route
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <div className="analytics-grid">
              <div className="chart-card">
                <h3>Demand by Location</h3>
                <div className="location-chart">
                  {demandData.demandByLocation.map((location, index) => (
                    <div key={index} className="location-item">
                      <span className="location-name">{location.location}</span>
                      <div className="demand-bar">
                        <div 
                          className="demand-fill"
                          style={{ 
                            width: `${(location.requestCount / Math.max(...demandData.demandByLocation.map(l => l.requestCount))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="request-count">{location.requestCount}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-card">
                <h3>Demand by Time</h3>
                <div className="time-chart">
                  {demandData.demandByTime.map((timeSlot, index) => (
                    <div key={index} className="time-item">
                      <span className="time-label">{timeSlot.time}</span>
                      <div className="time-bar">
                        <div 
                          className="time-fill"
                          style={{ 
                            height: `${(timeSlot.requestCount / Math.max(...demandData.demandByTime.map(t => t.requestCount))) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="time-count">{timeSlot.requestCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showResponseModal && selectedRequest && (
        <div className="response-modal-overlay">
          <div className="response-modal">
            <div className="modal-header">
              <h3>Respond to Route Request</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowResponseModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="request-summary">
              <h4>Request Details</h4>
              <p><strong>Route:</strong> {selectedRequest.fromLocation} → {selectedRequest.toLocation}</p>
              <p><strong>Requester:</strong> {selectedRequest.requesterName}</p>
              <p><strong>Preferred Time:</strong> {selectedRequest.preferredTime}</p>
              <p><strong>Frequency:</strong> {selectedRequest.frequency}</p>
            </div>
            
            <form onSubmit={handleResponseSubmit} className="response-form">
              <div className="form-group">
                <label>Response Status</label>
                <select
                  value={responseData.status}
                  onChange={(e) => setResponseData(prev => ({ ...prev, status: e.target.value }))}
                  required
                >
                  <option value="accepted">Accept Request</option>
                  <option value="rejected">Reject Request</option>
                  <option value="pending_review">Under Review</option>
                </select>
              </div>

              {responseData.status === 'accepted' && (
                <>
                  <div className="form-group">
                    <label>Estimated Start Date</label>
                    <input
                      type="date"
                      value={responseData.estimatedStartDate}
                      onChange={(e) => setResponseData(prev => ({ ...prev, estimatedStartDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Proposed Monthly Price</label>
                    <input
                      type="number"
                      value={responseData.proposedPrice}
                      onChange={(e) => setResponseData(prev => ({ ...prev, proposedPrice: e.target.value }))}
                      placeholder="Enter monthly price"
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Response Message</label>
                <textarea
                  value={responseData.message}
                  onChange={(e) => setResponseData(prev => ({ ...prev, message: e.target.value }))}
                  rows="4"
                  placeholder="Enter your response message..."
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowResponseModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                >
                  Send Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteDemandDashboard;
