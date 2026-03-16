import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import "./b2b_driverstab.css";

function B2B_DriversTab({ drivers }) {
  const [expandedCards, setExpandedCards] = useState({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const toggleExpand = (driverId) => {
    setExpandedCards(prev => ({
      ...prev,
      [driverId]: !prev[driverId]
    }));
  };

  const getStatusColor = (status) => {
    if (status === "On Trip") return "on-trip";
    if (status === "Available") return "available";
    return "off-duty";
  };

    const formatDriverName = (name) => {
    return name ? name.charAt(0).toUpperCase() : "D";
  };

  const formatStatus = (status) => {
    if (!status) return "Available";
    return status.replace("_", " ");
  };

  const handleViewProfile = (driver) => {
    setSelectedDriver(driver);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setSelectedDriver(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (!drivers || drivers.length === 0) {
    return (
      <div className="no-drivers">
        <div className="no-drivers-icon">👥</div>
        <h3>No Drivers Added</h3>
        <p>Start by adding your first driver to your fleet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="drivers-grid">
        {drivers.map((driver) => {
          const isExpanded = expandedCards[driver._id];
          
          return (
          <div key={driver._id} className={`driver-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="driver-avatar">{formatDriverName(driver.name)}</div>
            <h3 className="driver-name">{driver.name || "Unknown Driver"}</h3>
            <p className="driver-id">ID: {driver.licenseNumber || "N/A"}</p>
            <span className={`driver-status ${getStatusColor(driver.status)}`}>
              {formatStatus(driver.status)}
            </span>

            {/* Expand/Collapse Toggle */}
            <button 
              className="expand-toggle-btn"
              onClick={() => toggleExpand(driver._id)}
            >
              {isExpanded ? (
                <>Hide Details <FiChevronUp /></>
              ) : (
                <>View Details <FiChevronDown /></>
              )}
            </button>

            {/* Expandable Details Section */}
            <div className={`driver-details ${isExpanded ? 'expanded' : 'collapsed'}`}>
              <div className="rating-row">
                <span className="label">Rating</span>
                <span className="value">{driver.ratings?.average || 0} *</span>
              </div>
              <div className="detail-row">
                <span className="label">Phone</span>
                <span className="value">{driver.phone || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="label">Experience</span>
                <span className="value">{driver.experience?.years || 0} years</span>
              </div>
              <div className="detail-row">
                <span className="label">License Type</span>
                <span className="value">{driver.licenseType || "N/A"}</span>
              </div>
            </div>

            <button 
              className="view-profile-btn" 
              onClick={() => handleViewProfile(driver)}
            >
              View Profile & Logs
            </button>
          </div>
          );
        })}
      </div>

      {/* Driver Profile Modal */}
      {showProfileModal && selectedDriver && (
        <div className="driver-profile-modal-overlay" onClick={closeProfileModal}>
          <div className="driver-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="driver-profile-modal-header">
              <h3>Driver Profile</h3>
              <button className="close-btn" onClick={closeProfileModal}>
                x
              </button>
            </div>
            <div className="driver-profile-modal-body">
              <div className="driver-profile-avatar">
                <div className="avatar-large">{formatDriverName(selectedDriver.name)}</div>
                <h2>{selectedDriver.name || "Unknown Driver"}</h2>
                <span className={`driver-status ${getStatusColor(selectedDriver.status)}`}>
                  {formatStatus(selectedDriver.status)}
                </span>
              </div>
              
              <div className="driver-profile-details">
                <div className="profile-section">
                  <h4>Contact Information</h4>
                  <div className="profile-row">
                    <span className="label">Phone</span>
                    <span className="value">{selectedDriver.phone || "N/A"}</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Email</span>
                    <span className="value">{selectedDriver.email || "N/A"}</span>
                  </div>
                </div>
                
                <div className="profile-section">
                  <h4>License Information</h4>
                  <div className="profile-row">
                    <span className="label">License Number</span>
                    <span className="value">{selectedDriver.licenseNumber || "N/A"}</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">License Type</span>
                    <span className="value">{selectedDriver.licenseType || "N/A"}</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Expiry Date</span>
                    <span className="value">{formatDate(selectedDriver.licenseExpiry)}</span>
                  </div>
                </div>
                
                <div className="profile-section">
                  <h4>Experience & Performance</h4>
                  <div className="profile-row">
                    <span className="label">Experience</span>
                    <span className="value">{selectedDriver.experience?.years || 0} years</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Rating</span>
                    <span className="value">{selectedDriver.ratings?.average || 0} / 5</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Total Reviews</span>
                    <span className="value">{selectedDriver.ratings?.count || 0}</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Total Trips</span>
                    <span className="value">{selectedDriver.totalTrips || 0}</span>
                  </div>
                </div>
                
                <div className="profile-section">
                  <h4>Account Information</h4>
                  <div className="profile-row">
                    <span className="label">Driver ID</span>
                    <span className="value">{selectedDriver._id || "N/A"}</span>
                  </div>
                  <div className="profile-row">
                    <span className="label">Joined</span>
                    <span className="value">{formatDate(selectedDriver.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="driver-profile-modal-footer">
              <button className="close-profile-btn" onClick={closeProfileModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default B2B_DriversTab;
