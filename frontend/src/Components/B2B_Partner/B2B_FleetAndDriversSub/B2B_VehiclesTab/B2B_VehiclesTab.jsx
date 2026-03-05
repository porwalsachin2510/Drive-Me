import { useState } from "react";
import api from "../../../../utils/api";
import "./b2b_vehiclestab.css";

function B2B_VehiclesTab({ vehicles, onRefresh }) {
  const [loading, setLoading] = useState({});
  const [showActions, setShowActions] = useState({});

  const getVehicleIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'coaster_bus':
        return '🚌';
      case 'minibus':
        return '🚐';
      case 'van':
        return '🚐';
      case 'sedan':
        return '🚗';
      case 'suv':
        return '🚙';
      default:
        return '🚗';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'success';
      case 'MAINTENANCE':
        return 'warning';
      case 'UNAVAILABLE':
        return 'danger';
      default:
        return 'success';
    }
  };

  const handleStatusUpdate = async (vehicleId, newStatus) => {
    try {
      setLoading(prev => ({ ...prev, [vehicleId]: true }));
      
      const response = await api.patch(`/vehicles/${vehicleId}/status`, {
        status: newStatus
      });
      
      if (response.data.success) {
        // Refresh the vehicles list
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error("Error updating vehicle status:", error);
      alert("Failed to update vehicle status. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, [vehicleId]: false }));
    }
  };

  const toggleActions = (vehicleId) => {
    setShowActions(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="no-vehicles">
        <div className="no-vehicles-icon">🚗</div>
        <h3>No Vehicles Added</h3>
        <p>Start by adding your first vehicle to your fleet.</p>
      </div>
    );
  }

  return (
    <div className="vehicles-grid">
      {vehicles.map((vehicle) => (
        <div key={vehicle._id} className="vehicle-card">
          <div className="vehicle-header">
            <div className="vehicle-icon">{getVehicleIcon(vehicle.vehicleCategory)}</div>
            <span className={`status-badge ${getStatusColor(vehicle.status)}`}>
              {vehicle.status?.toLowerCase() || 'available'}
            </span>
          </div>
          <h3 className="vehicle-name">{vehicle.vehicleName || 'Unknown Vehicle'}</h3>
          <p className="vehicle-plate">
            {vehicle.registrationNumber || 'N/A'} • {vehicle.manufacturingYear || 'N/A'}
          </p>

          <div className="vehicle-details">
            <div className="detail-row">
              <span className="detail-label">Category</span>
              <span className="detail-value">{vehicle.vehicleCategory?.replace(/_/g, ' ') || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Capacity</span>
              <span className="detail-value">{vehicle.capacity?.seatingCapacity || 0} seats</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Service</span>
              <span className="detail-value">{vehicle.serviceType || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <span className="detail-value">{vehicle.location || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Daily Rate</span>
              <span className="detail-value">{vehicle.pricing?.dailyRate || 0} KWD</span>
            </div>
          </div>

          <div className="vehicle-actions">
            {vehicle.status === 'MAINTENANCE' ? (
              <button 
                className="action-btn activate" 
                onClick={() => handleStatusUpdate(vehicle._id, 'AVAILABLE')}
                disabled={loading[vehicle._id]}
              >
                {loading[vehicle._id] ? 'Activating...' : '✅ Activate'}
              </button>
            ) : (
              <button 
                className="action-btn maintenance" 
                onClick={() => handleStatusUpdate(vehicle._id, 'MAINTENANCE')}
                disabled={loading[vehicle._id]}
              >
                {loading[vehicle._id] ? 'Updating...' : '⚡ Maintenance'}
              </button>
            )}
            <div className="action-dropdown">
              <button 
                className="action-btn-more" 
                onClick={() => toggleActions(vehicle._id)}
              >
                ⋯
              </button>
              {showActions[vehicle._id] && (
                <div className="dropdown-menu">
                  <button 
                    className="dropdown-item"
                    onClick={() => handleStatusUpdate(vehicle._id, 'AVAILABLE')}
                  >
                    ✅ Set Available
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => handleStatusUpdate(vehicle._id, 'MAINTENANCE')}
                  >
                    🔧 Set Maintenance
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => handleStatusUpdate(vehicle._id, 'UNAVAILABLE')}
                  >
                    ❌ Set Unavailable
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      alert('Edit vehicle functionality coming soon!');
                      toggleActions(vehicle._id);
                    }}
                  >
                    ✏️ Edit Vehicle
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      alert('Delete vehicle functionality coming soon!');
                      toggleActions(vehicle._id);
                    }}
                  >
                    🗑️ Delete Vehicle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default B2B_VehiclesTab;
