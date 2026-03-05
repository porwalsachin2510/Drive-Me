import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './B2CDailyTrips.css';

const B2CDailyTrips = () => {
  const [todayTrips, setTodayTrips] = useState([]);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatUpdate, setSeatUpdate] = useState({
    availableSeats: 0,
    totalSeats: 0,
    reason: ''
  });

  useEffect(() => {
    fetchTodayTrips();
    fetchUpcomingTrips();
  }, []);

  const fetchTodayTrips = async () => {
    try {
      const response = await api.get('/b2c-daily-trips/today');
      if (response.data.success) {
        setTodayTrips(response.data.data?.trips || []);
      } else {
        setError(response.data.message || 'Failed to fetch today\'s trips');
      }
    } catch (error) {
      console.error('Error fetching today trips:', error);
      setError('Network error. Please try again.');
    }
  };

  const fetchUpcomingTrips = async () => {
    try {
      const response = await api.get('/b2c-daily-trips/upcoming', { params: { days: 7 } });
      if (response.data.success) {
        setUpcomingTrips(response.data.data?.trips || []);
      } else {
        console.error('Failed to fetch upcoming trips:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching upcoming trips:', error);
    }
  };

  const updateTripStatus = async (tripId, status) => {
    try {
      const response = await api.put(`/b2c-daily-trips/status/${tripId}`, { status });

      if (response.data.success) {
        const updateTrips = (trips) => 
          trips.map(trip => 
            trip._id === tripId 
              ? { ...trip, status: status.toUpperCase() }
              : trip
          );
        
        setTodayTrips(updateTrips);
        setUpcomingTrips(updateTrips);
      } else {
        setError(response.data.message || 'Failed to update trip status');
      }
    } catch (error) {
      console.error('Error updating trip status:', error);
      setError('Network error. Please try again.');
    }
  };

  const openSeatModal = (trip) => {
    setSelectedTrip(trip);
    setSeatUpdate({
      availableSeats: trip.availableSeats,
      totalSeats: trip.totalSeats,
      reason: ''
    });
    setShowSeatModal(true);
  };

  const handleSeatUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await api.put(`/b2c-daily-trips/seats/${selectedTrip._id}`, seatUpdate);

      if (response.data.success) {
        const updateTrips = (trips) => 
          trips.map(trip => 
            trip._id === selectedTrip._id 
              ? { 
                  ...trip, 
                  availableSeats: seatUpdate.availableSeats,
                  totalSeats: seatUpdate.totalSeats,
                  bookedSeats: seatUpdate.totalSeats - seatUpdate.availableSeats
                }
              : trip
          );
        
        setTodayTrips(updateTrips);
        setUpcomingTrips(updateTrips);
        setShowSeatModal(false);
        setSelectedTrip(null);
      } else {
        setError(response.data.message || 'Failed to update seats');
      }
    } catch (error) {
      console.error('Error updating seats:', error);
      setError('Network error. Please try again.');
    }
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SCHEDULED': return '#3b82f6';
      case 'STARTED': return '#f59e0b';
      case 'COMPLETED': return '#10b981';
      case 'CANCELLED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const currentTrips = activeTab === 'today' ? todayTrips : upcomingTrips;

  return (
    <div className="b2c-daily-trips-container">
      <div className="trips-header">
        <h2>Daily Trip Management</h2>
        
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Today's Trips ({todayTrips.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming ({upcomingTrips.length})
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="trips-list">
        {currentTrips.length === 0 ? (
          <div className="no-trips">
            <p>No {activeTab === 'today' ? 'today\'s' : 'upcoming'} trips found.</p>
          </div>
        ) : (
          currentTrips.map(trip => (
            <div key={trip._id} className="trip-card">
              <div className="trip-header">
                <div className="route-info">
                  <h3>{trip.routeId?.routeName || 'Unnamed Route'}</h3>
                  <p>{trip.routeId?.fromLocation} → {trip.routeId?.toLocation}</p>
                </div>
                <div className="trip-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(trip.status) }}
                  >
                    {trip.status}
                  </span>
                </div>
              </div>

              <div className="trip-details">
                <div className="detail-item">
                  <label>Date:</label>
                  <span>{formatDate(trip.tripDate)}</span>
                </div>
                <div className="detail-item">
                  <label>Time:</label>
                  <span>{formatTime(trip.startTime)} - {formatTime(trip.endTime)}</span>
                </div>
                <div className="detail-item">
                  <label>Vehicle:</label>
                  <span>{trip.vehicleType}</span>
                </div>
                <div className="detail-item">
                  <label>Driver:</label>
                  <span>{trip.driverId?.fullName || 'Not assigned'}</span>
                </div>
              </div>

              <div className="seat-info">
                <div className="seat-stats">
                  <div className="stat-item">
                    <span className="label">Total Seats:</span>
                    <span className="value">{trip.totalSeats}</span>
                  </div>
                  <div className="stat-item">
                    <span className="label">Booked:</span>
                    <span className="value booked">{trip.bookedSeats}</span>
                  </div>
                  <div className="stat-item">
                    <span className="label">Available:</span>
                    <span className="value available">{trip.availableSeats}</span>
                  </div>
                </div>
                <div className="utilization-bar">
                  <div 
                    className="utilization-fill"
                    style={{ 
                      width: `${(trip.bookedSeats / trip.totalSeats) * 100}%`,
                      backgroundColor: (trip.bookedSeats / trip.totalSeats) > 0.8 ? '#ef4444' : '#10b981'
                    }}
                  ></div>
                </div>
                <span className="utilization-text">
                  {((trip.bookedSeats / trip.totalSeats) * 100).toFixed(1)}% utilized
                </span>
              </div>

              <div className="trip-actions">
                <button
                  className="action-btn update-seats"
                  onClick={() => openSeatModal(trip)}
                >
                  Update Seats
                </button>
                
                {trip.status === 'SCHEDULED' && (
                  <button
                    className="action-btn start-trip"
                    onClick={() => updateTripStatus(trip._id, 'STARTED')}
                  >
                    Start Trip
                  </button>
                )}
                
                {trip.status === 'STARTED' && (
                  <button
                    className="action-btn complete-trip"
                    onClick={() => updateTripStatus(trip._id, 'COMPLETED')}
                  >
                    Complete Trip
                  </button>
                )}
                
                {trip.status !== 'COMPLETED' && (
                  <button
                    className="action-btn cancel-trip"
                    onClick={() => updateTripStatus(trip._id, 'CANCELLED')}
                  >
                    Cancel Trip
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showSeatModal && selectedTrip && (
        <div className="seat-modal-overlay">
          <div className="seat-modal">
            <div className="seat-modal-header">
              <h3>Update Trip Seats</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowSeatModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSeatUpdate} className="seat-form">
              <div className="trip-summary">
                <p><strong>Route:</strong> {selectedTrip.routeId?.routeName}</p>
                <p><strong>Date:</strong> {formatDate(selectedTrip.tripDate)}</p>
                <p><strong>Current:</strong> {selectedTrip.bookedSeats}/{selectedTrip.totalSeats} seats</p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Total Seats</label>
                  <input
                    type="number"
                    value={seatUpdate.totalSeats}
                    onChange={(e) => setSeatUpdate(prev => ({ ...prev, totalSeats: parseInt(e.target.value) }))}
                    min={selectedTrip.bookedSeats || 0}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Available Seats</label>
                  <input
                    type="number"
                    value={seatUpdate.availableSeats}
                    onChange={(e) => setSeatUpdate(prev => ({ ...prev, availableSeats: parseInt(e.target.value) }))}
                    min={0}
                    max={seatUpdate.totalSeats}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason for Change</label>
                <textarea
                  value={seatUpdate.reason}
                  onChange={(e) => setSeatUpdate(prev => ({ ...prev, reason: e.target.value }))}
                  rows="3"
                  placeholder="Reason for seat adjustment..."
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowSeatModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                >
                  Update Seats
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2CDailyTrips;
