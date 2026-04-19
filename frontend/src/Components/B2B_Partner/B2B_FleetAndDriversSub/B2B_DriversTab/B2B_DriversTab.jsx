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
      <div className="b2b-operator-dashboard-drivers-tab-no-drivers">
        <div className="b2b-operator-dashboard-drivers-tab-no-drivers-icon">
          👥
        </div>
        <h3>No Drivers Added</h3>
        <p>Start by adding your first driver to your fleet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="b2b-operator-dashboard-drivers-tab-drivers-grid">
        {drivers.map((driver) => {
          const isExpanded = expandedCards[driver._id];

          return (
            <div
              key={driver._id}
              className={`b2b-operator-dashboard-drivers-tab-driver-card ${isExpanded ? "b2b-operator-dashboard-drivers-tab-expanded" : ""}`}
            >
              <div className="b2b-operator-dashboard-drivers-tab-driver-avatar">
                {formatDriverName(driver.name)}
              </div>
              <h3 className="b2b-operator-dashboard-drivers-tab-driver-name">
                {driver.name || "Unknown Driver"}
              </h3>
              <p className="b2b-operator-dashboard-drivers-tab-driver-id">
                ID: {driver.licenseNumber || "N/A"}
              </p>
              <span
                className={`b2b-operator-dashboard-drivers-tab-driver-status ${getStatusColor(driver.status)}`}
              >
                {formatStatus(driver.status)}
              </span>

              {/* Expand/Collapse Toggle */}
              <button
                className="b2b-operator-dashboard-drivers-tab-expand-toggle-btn"
                onClick={() => toggleExpand(driver._id)}
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
                className={`b2b-operator-dashboard-drivers-tab-driver-details ${isExpanded ? "b2b-operator-dashboard-drivers-tab-expanded" : "b2b-operator-dashboard-drivers-tab-collapsed"}`}
              >
                <div className="b2b-operator-dashboard-drivers-tab-rating-row">
                  <span className="b2b-operator-dashboard-drivers-tab-label">
                    Rating
                  </span>
                  <span className="b2b-operator-dashboard-drivers-tab-value">
                    {driver.ratings?.average?.toFixed(1) || "0.0"} / 5 (
                    {driver.ratings?.count || 0} reviews)
                  </span>
                </div>
                <div className="b2b-operator-dashboard-drivers-tab-detail-row">
                  <span className="b2b-operator-dashboard-drivers-tab-label">
                    Phone
                  </span>
                  <span className="b2b-operator-dashboard-drivers-tab-value">
                    {driver.phone || "N/A"}
                  </span>
                </div>
                <div className="b2b-operator-dashboard-drivers-tab-detail-row">
                  <span className="b2b-operator-dashboard-drivers-tab-label">
                    Experience
                  </span>
                  <span className="b2b-operator-dashboard-drivers-tab-value">
                    {driver.experience?.years || 0} years
                  </span>
                </div>
                <div className="b2b-operator-dashboard-drivers-tab-detail-row">
                  <span className="b2b-operator-dashboard-drivers-tab-label">
                    License Type
                  </span>
                  <span className="b2b-operator-dashboard-drivers-tab-value">
                    {driver.licenseType || "N/A"}
                  </span>
                </div>
              </div>

              <button
                className="b2b-operator-dashboard-drivers-tab-view-profile-btn"
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
        <div
          className="b2b-operator-dashboard-drivers-tab-driver-profile-modal-overlay"
          onClick={closeProfileModal}
        >
          <div
            className="b2b-operator-dashboard-drivers-tab-driver-profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="b2b-operator-dashboard-drivers-tab-driver-profile-modal-header">
              <h3>Driver Profile</h3>
              <button
                className="b2b-operator-dashboard-drivers-tab-close-btn"
                onClick={closeProfileModal}
              >
                x
              </button>
            </div>
            <div className="b2b-operator-dashboard-drivers-tab-driver-profile-modal-body">
              <div className="b2b-operator-dashboard-drivers-tab-driver-profile-avatar">
                <div className="b2b-operator-dashboard-drivers-tab-avatar-large">
                  {formatDriverName(selectedDriver.name)}
                </div>
                <h2>{selectedDriver.name || "Unknown Driver"}</h2>
                <span
                  className={`b2b-operator-dashboard-drivers-tab-driver-status ${getStatusColor(selectedDriver.status)}`}
                >
                  {formatStatus(selectedDriver.status)}
                </span>
              </div>

              <div className="b2b-operator-dashboard-drivers-tab-driver-profile-details">
                <div className="b2b-operator-dashboard-drivers-tab-profile-section">
                  <h4>Contact Information</h4>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Phone
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.phone || "N/A"}
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Email
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.email || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="b2b-operator-dashboard-drivers-tab-profile-section">
                  <h4>License Information</h4>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      License Number
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.licenseNumber || "N/A"}
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      License Type
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.licenseType || "N/A"}
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Expiry Date
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {formatDate(selectedDriver.licenseExpiry)}
                    </span>
                  </div>
                </div>

                <div className="b2b-operator-dashboard-drivers-tab-profile-section">
                  <h4>Experience & Performance</h4>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Experience
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.experience?.years || 0} years
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Rating
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.ratings?.average || 0} / 5
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Total Reviews
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.ratings?.count || 0}
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Total Trips
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver.totalTrips || 0}
                    </span>
                  </div>
                </div>

                <div className="b2b-operator-dashboard-drivers-tab-profile-section">
                  <h4>Account Information</h4>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Driver ID
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {selectedDriver._id || "N/A"}
                    </span>
                  </div>
                  <div className="b2b-operator-dashboard-drivers-tab-profile-row">
                    <span className="b2b-operator-dashboard-drivers-tab-label">
                      Joined
                    </span>
                    <span className="b2b-operator-dashboard-drivers-tab-value">
                      {formatDate(selectedDriver.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="b2b-operator-dashboard-drivers-tab-driver-profile-modal-footer">
              <button
                className="b2b-operator-dashboard-drivers-tab-close-profile-btn"
                onClick={closeProfileModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default B2B_DriversTab;
