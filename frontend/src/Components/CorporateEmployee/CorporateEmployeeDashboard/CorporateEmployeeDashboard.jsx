import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import './CorporateEmployeeDashboard.css';

const CorporateEmployeeDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    employee: null,
    route: null,
    vehicle: null,
    todayTrips: [],
    upcomingTrips: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Backend: GET /api/corporate-employee-users/dashboard
      const response = await api.get('/corporate-employee-users/dashboard');

      if (response.data.success) {
        setDashboardData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="drivemego-corporate-employee-dashboard">
        <div className="drivemego-loading-container">
          <div className="drivemego-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-corporate-employee-dashboard">
      <div className="dashboard-header">
        <h2>My Dashboard</h2>
        <p>Welcome back, {dashboardData.employee?.fullName || 'Employee'}!</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-content">
        {/* Employee Info Card */}
        <div className="info-card">
          <h3>My Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Employee ID:</label>
              <span>{dashboardData.employee?.employeeId || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Department:</label>
              <span>{dashboardData.employee?.department || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Designation:</label>
              <span>{dashboardData.employee?.designation || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Work Shift:</label>
              <span>{dashboardData.employee?.workShift || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Assigned Route Card */}
        <div className="route-card">
          <h3>Assigned Route</h3>
          {dashboardData.route ? (
            <div className="route-info">
              <div className="route-details">
                <p><strong>Route Name:</strong> {dashboardData.route.routeName}</p>
                <p><strong>Pickup:</strong> {dashboardData.route.fromLocation}</p>
                <p><strong>Dropoff:</strong> {dashboardData.route.toLocation}</p>
              </div>
              <div className="schedule-info">
                <h4>Schedule:</h4>
                {dashboardData.route.schedule?.map((day, index) => (
                  <div key={index} className="schedule-item">
                    <span className="day">{day.day}:</span>
                    <span className="time">{day.pickupTime} - {day.dropoffTime}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No route assigned</p>
          )}
        </div>

        {/* Vehicle Info Card */}
        <div className="vehicle-card">
          <h3>Vehicle Details</h3>
          {dashboardData.vehicle ? (
            <div className="vehicle-info">
              <div className="vehicle-details">
                <p><strong>Vehicle Number:</strong> {dashboardData.vehicle.vehicleNumber}</p>
                <p><strong>Vehicle Type:</strong> {dashboardData.vehicle.vehicleType}</p>
                <p><strong>Capacity:</strong> {dashboardData.vehicle.capacity} seats</p>
              </div>
              <div className="driver-info">
                <p><strong>Driver Name:</strong> {dashboardData.vehicle.driverName}</p>
                <p><strong>Driver Contact:</strong> {dashboardData.vehicle.driverContact}</p>
                <p><strong>Seat Number:</strong> {dashboardData.vehicle.seatNumber}</p>
              </div>
            </div>
          ) : (
            <p>No vehicle assigned</p>
          )}
        </div>

        {/* Today's Trips */}
        <div className="trips-card">
          <h3>Today's Trips</h3>
          {dashboardData.todayTrips.length > 0 ? (
            <div className="trips-list">
              {dashboardData.todayTrips.map((trip, index) => (
                <div key={index} className="trip-item">
                  <div className="trip-time">
                    <span className="time">{formatTime(trip.scheduledTime)}</span>
                    <span className="route">{trip.pickupLocation} → {trip.dropoffLocation}</span>
                  </div>
                  <div className="trip-status">
                    <span className={`status ${trip.status.toLowerCase()}`}>
                      {trip.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No trips scheduled for today</p>
          )}
        </div>

        {/* Upcoming Trips */}
        <div className="trips-card">
          <h3>Upcoming Trips</h3>
          {dashboardData.upcomingTrips.length > 0 ? (
            <div className="trips-list">
              {dashboardData.upcomingTrips.slice(0, 5).map((trip, index) => (
                <div key={index} className="trip-item">
                  <div className="trip-date">
                    <span className="date">{formatDate(trip.tripDate)}</span>
                    <span className="time">{formatTime(trip.scheduledTime)}</span>
                  </div>
                  <div className="trip-route">
                    <span>{trip.pickupLocation} → {trip.dropoffLocation}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No upcoming trips</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CorporateEmployeeDashboard;
