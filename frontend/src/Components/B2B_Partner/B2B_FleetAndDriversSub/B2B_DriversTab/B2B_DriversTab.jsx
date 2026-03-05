import "./b2b_driverstab.css";

function B2B_DriversTab({ drivers }) {

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
        {drivers.map((driver) => (
          <div key={driver._id} className="driver-card">
            <div className="driver-avatar">{formatDriverName(driver.name)}</div>
            <h3 className="driver-name">{driver.name || "Unknown Driver"}</h3>
            <p className="driver-id">ID: {driver.licenseNumber || "N/A"}</p>
            <span className={`driver-status ${getStatusColor(driver.status)}`}>
              {formatStatus(driver.status)}
            </span>

            <div className="driver-details">
              <div className="rating-row">
                <span className="label">Rating</span>
                <span className="value">{driver.ratings?.average || 0} ⭐</span>
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
            >
              View Profile & Logs
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default B2B_DriversTab;
