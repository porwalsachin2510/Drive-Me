import { getActiveCurrency } from "../../../../config/localeConfig";
import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import api from "../../../../utils/api";
import B2B_EditVehicleModal from "../B2B_EditVehicleModal/B2B_EditVehicleModal";
import "./b2b_vehiclestab.css";

function B2B_VehiclesTab({ vehicles, onRefresh }) {
  const [loading, setLoading] = useState({});
  const [showActions, setShowActions] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
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

  const toggleExpand = (vehicleId) => {
    setExpandedCards(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setShowEditModal(true);
    setShowActions({}); // Close dropdown
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditingVehicle(null);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setEditingVehicle(null);
    if (onRefresh) {
      onRefresh();
    }
  };

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="b2b-operator-dashboard-vehicles-tab-no-vehicles">
        <div className="b2b-operator-dashboard-vehicles-tab-no-vehicles-icon">
          🚗
        </div>
        <h3>No Vehicles Added</h3>
        <p>Start by adding your first vehicle to your fleet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="b2b-operator-dashboard-vehicles-tab-vehicles-grid">
        {vehicles.map((vehicle) => {
          const isExpanded = expandedCards[vehicle._id];

          return (
            <div
              key={vehicle._id}
              className={`b2b-operator-dashboard-vehicles-tab-vehicle-card ${isExpanded ? "b2b-operator-dashboard-vehicles-tab-expanded" : ""}`}
            >
              <div className="b2b-operator-dashboard-vehicles-tab-vehicle-header">
                <div className="b2b-operator-dashboard-vehicles-tab-vehicle-icon">
                  {getVehicleIcon(vehicle.vehicleCategory)}
                </div>
                <span
                  className={`b2b-operator-dashboard-vehicles-tab-status-badge ${getStatusColor(vehicle.status)}`}
                >
                  {vehicle.status?.toLowerCase() || "available"}
                </span>
              </div>
              <h3 className="b2b-operator-dashboard-vehicles-tab-vehicle-name">
                {vehicle.vehicleName || "Unknown Vehicle"}
              </h3>
              <p className="b2b-operator-dashboard-vehicles-tab-vehicle-plate">
                {vehicle.registrationNumber || "N/A"} •{" "}
                {vehicle.manufacturingYear || "N/A"}
              </p>

              {/* Expand/Collapse Toggle */}
              <button
                className="b2b-operator-dashboard-vehicles-tab-expand-toggle-btn"
                onClick={() => toggleExpand(vehicle._id)}
              >
                {isExpanded ? (
                  <>
                    Hide Details <FiChevronUp />
                  </>
                ) : (
                  <>
                    View Details <FiChevronDown />
                  </>
                )}
              </button>

              {/* Expandable Details Section */}
              <div
                className={`b2b-operator-dashboard-vehicles-tab-vehicle-details ${isExpanded ? "b2b-operator-dashboard-vehicles-tab-expanded" : "b2b-operator-dashboard-vehicles-tab-collapsed"}`}
              >
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    Category
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.vehicleCategory?.replace(/_/g, " ") || "N/A"}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    {vehicle.serviceType === "GOODS_CARRIER"
                      ? "Cargo Capacity"
                      : "Capacity"}
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.serviceType === "GOODS_CARRIER"
                      ? `${vehicle.capacity?.cargoCapacity || 0} tons`
                      : `${vehicle.capacity?.seatingCapacity || 0} seats`}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    Service
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.serviceType || "N/A"}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    Location
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.location || "N/A"}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    Daily Rate
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.pricing?.dailyRate || 0}{" "}
                    {vehicle.pricing?.currency || getActiveCurrency()}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-vehicles-tab-detail-row">
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-label">
                    Yearly Rate
                  </span>
                  <span className="b2b-operator-dashboard-vehicles-tab-detail-value">
                    {vehicle.pricing?.yearlyRate > 0
                      ? vehicle.pricing.yearlyRate
                      : (vehicle.pricing?.monthlyRate || 0) * 12}{" "}
                    {vehicle.pricing?.currency || getActiveCurrency()}
                  </span>
                </div>
              </div>

              <div className="b2b-operator-dashboard-vehicles-tab-vehicle-actions">
                {vehicle.status === "MAINTENANCE" ? (
                  <button
                    className="b2b-operator-dashboard-vehicles-tab-action-btn b2b-operator-dashboard-vehicles-tab-activate"
                    onClick={() => handleStatusUpdate(vehicle._id, "AVAILABLE")}
                    disabled={loading[vehicle._id]}
                  >
                    {loading[vehicle._id] ? "Activating..." : "✅ Activate"}
                  </button>
                ) : (
                  <button
                    className="b2b-operator-dashboard-vehicles-tab-action-btn b2b-operator-dashboard-vehicles-tab-maintenance"
                    onClick={() =>
                      handleStatusUpdate(vehicle._id, "MAINTENANCE")
                    }
                    disabled={loading[vehicle._id]}
                  >
                    {loading[vehicle._id] ? "Updating..." : "⚡ Maintenance"}
                  </button>
                )}
                <div className="b2b-operator-dashboard-vehicles-tab-action-dropdown">
                  <button
                    className="b2b-operator-dashboard-vehicles-tab-action-btn-more"
                    onClick={() => toggleActions(vehicle._id)}
                  >
                    ⋯
                  </button>
                  {showActions[vehicle._id] && (
                    <div className="b2b-operator-dashboard-vehicles-tab-dropdown-menu">
                      <button
                        className="b2b-operator-dashboard-vehicles-tab-dropdown-item"
                        onClick={() =>
                          handleStatusUpdate(vehicle._id, "AVAILABLE")
                        }
                      >
                        ✅ Set Available
                      </button>
                      <button
                        className="b2b-operator-dashboard-vehicles-tab-dropdown-item"
                        onClick={() =>
                          handleStatusUpdate(vehicle._id, "MAINTENANCE")
                        }
                      >
                        🔧 Set Maintenance
                      </button>
                      <button
                        className="b2b-operator-dashboard-vehicles-tab-dropdown-item"
                        onClick={() =>
                          handleStatusUpdate(vehicle._id, "UNAVAILABLE")
                        }
                      >
                        ❌ Set Unavailable
                      </button>
                      <button
                        className="b2b-operator-dashboard-vehicles-tab-dropdown-item"
                        onClick={() => handleEditVehicle(vehicle)}
                      >
                        ✏️ Edit Vehicle
                      </button>
                      <button
                        className="b2b-operator-dashboard-vehicles-tab-dropdown-item"
                        onClick={() => {
                          alert("Delete vehicle functionality coming soon!");
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
          );
        })}
      </div>

      {/* Edit Vehicle Modal */}
      {showEditModal && editingVehicle && (
        <B2B_EditVehicleModal
          vehicle={editingVehicle}
          onClose={handleEditModalClose}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}

export default B2B_VehiclesTab;
