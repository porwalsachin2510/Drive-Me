import { getActiveCurrency } from "../../../config/localeConfig";
import React, { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./adminvehicleapproval.css";

function AdminVehicleApproval() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [viewingVehicle, setViewingVehicle] = useState(null); // For detail view modal
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  // Helper to get document type label
  const getDocumentTypeLabel = (type) => {
    const labels = {
      RC_COPY: "Registration Certificate (RC)",
      INSURANCE: "Insurance Certificate",
      FITNESS_CERTIFICATE: "Fitness/Inspection Certificate",
      PERMIT: "Permit Document",
      PUC: "Pollution Under Control (PUC)",
    };
    return labels[type] || type;
  };

  // Helper to check if file is an image
  const isImageFile = (url) => {
    if (!url) return false;
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
    const lowercaseUrl = url.toLowerCase();
    return imageExtensions.some((ext) => lowercaseUrl.includes(ext));
  };

  const fetchPendingVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/admin/vehicles/pending?page=${pagination.page}&limit=${pagination.limit}`,
      );

      if (response.data.success) {
        setVehicles(response.data.vehicles);
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
        }));
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      setError("Failed to load pending vehicles");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchPendingVehicles();
  }, [fetchPendingVehicles]);

  const approveVehicle = async (vehicleId) => {
    try {
      setActionLoading(true);
      const response = await api.put(`/admin/vehicles/${vehicleId}/approve`);

      if (response.data.success) {
        setVehicles(vehicles.filter((v) => v._id !== vehicleId));
        setSelectedVehicle(null);
        alert("Vehicle approved successfully!");
        fetchPendingVehicles();
      }
    } catch (err) {
      console.error("Error approving vehicle:", err);
      alert("Failed to approve vehicle");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectVehicle = async (vehicleId) => {
    if (!rejectionReason.trim()) {
      alert("Please enter a rejection reason");
      return;
    }

    try {
      setActionLoading(true);
      const response = await api.put(`/admin/vehicles/${vehicleId}/reject`, {
        rejectionReason,
      });

      if (response.data.success) {
        setVehicles(vehicles.filter((v) => v._id !== vehicleId));
        setSelectedVehicle(null);
        setRejectionReason("");
        alert("Vehicle rejected successfully!");
        fetchPendingVehicles();
      }
    } catch (err) {
      console.error("Error rejecting vehicle:", err);
      alert("Failed to reject vehicle");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="drivemego-adminvehicleapproval-vehicle-approval-loading">
        Loading pending vehicles...
      </div>
    );
  }

  return (
    <div className="drivemego-adminvehicleapproval-admin-vehicle-approval">
      <div className="drivemego-adminvehicleapproval-approval-header">
        <h2>Vehicle Approvals</h2>
        <p className="drivemego-adminvehicleapproval-pending-count">
          {pagination.total} pending vehicle{pagination.total !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <div className="drivemego-adminvehicleapproval-error-message">
          {error}
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="drivemego-adminvehicleapproval-no-vehicles">
          <p>No pending vehicles to approve</p>
        </div>
      ) : (
        <div className="drivemego-adminvehicleapproval-vehicles-list">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle._id}
              className="drivemego-adminvehicleapproval-vehicle-card"
            >
              <div className="drivemego-adminvehicleapproval-vehicle-header">
                <h3>{vehicle.vehicleName}</h3>
                <span className="drivemego-adminvehicleapproval-registration">
                  {vehicle.registrationNumber}
                </span>
              </div>

              <div className="drivemego-adminvehicleapproval-vehicle-details">
                <div className="drivemego-adminvehicleapproval-detail-row">
                  <span className="drivemego-adminvehicleapproval-label">
                    Category:
                  </span>
                  <span className="drivemego-adminvehicleapproval-value">
                    {vehicle.vehicleCategory}
                  </span>
                </div>
                <div className="drivemego-adminvehicleapproval-detail-row">
                  <span className="drivemego-adminvehicleapproval-label">
                    Service Type:
                  </span>
                  <span className="drivemego-adminvehicleapproval-value">
                    {vehicle.serviceType}
                  </span>
                </div>
                <div className="drivemego-adminvehicleapproval-detail-row">
                  <span className="drivemego-adminvehicleapproval-label">
                    Capacity:
                  </span>
                  <span className="drivemego-adminvehicleapproval-value">
                    {vehicle.capacity.seatingCapacity || "-"} seats
                  </span>
                </div>
                <div className="drivemego-adminvehicleapproval-detail-row">
                  <span className="drivemego-adminvehicleapproval-label">
                    Fleet Owner:
                  </span>
                  <span className="drivemego-adminvehicleapproval-value">
                    {vehicle.fleetOwnerId?.fullName || "Unknown"}
                  </span>
                </div>
                <div className="drivemego-adminvehicleapproval-detail-row">
                  <span className="drivemego-adminvehicleapproval-label">
                    Location:
                  </span>
                  <span className="drivemego-adminvehicleapproval-value">
                    {vehicle.location}
                  </span>
                </div>
              </div>

              {/* Quick Document Preview */}
              {vehicle.documents && vehicle.documents.length > 0 && (
                <div className="drivemego-adminvehicleapproval-documents-preview">
                  <span className="drivemego-adminvehicleapproval-docs-label">
                    Documents: {vehicle.documents.length} uploaded
                  </span>
                </div>
              )}

              {/* Vehicle Images Preview */}
              {vehicle.photos && vehicle.photos.length > 0 && (
                <div className="drivemego-adminvehicleapproval-images-preview">
                  <span className="drivemego-adminvehicleapproval-images-label">
                    Images: {vehicle.photos.length} uploaded
                  </span>
                </div>
              )}

              <div className="drivemego-adminvehicleapproval-vehicle-actions">
                <button
                  className="drivemego-adminvehicleapproval-btn-view-details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingVehicle(vehicle);
                    setActiveImageIndex(0);
                  }}
                >
                  View Details
                </button>
                <button
                  className="drivemego-adminvehicleapproval-btn-approve"
                  onClick={(e) => {
                    e.stopPropagation();
                    approveVehicle(vehicle._id);
                  }}
                  disabled={actionLoading}
                >
                  Approve
                </button>
                <button
                  className="drivemego-adminvehicleapproval-btn-reject"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVehicle(vehicle);
                  }}
                  disabled={actionLoading}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {selectedVehicle &&
        vehicles.find((v) => v._id === selectedVehicle._id) && (
          <div
            className="drivemego-adminvehicleapproval-rejection-modal-overlay"
            onClick={() => setSelectedVehicle(null)}
          >
            <div
              className="drivemego-adminvehicleapproval-rejection-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Reject Vehicle</h3>
              <p>
                Vehicle: {selectedVehicle.vehicleName} (
                {selectedVehicle.registrationNumber})
              </p>

              <textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="drivemego-adminvehicleapproval-rejection-input"
              />

              <div className="drivemego-adminvehicleapproval-modal-actions">
                <button
                  className="drivemego-adminvehicleapproval-btn-cancel"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setRejectionReason("");
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-adminvehicleapproval-btn-confirm-reject"
                  onClick={() => rejectVehicle(selectedVehicle._id)}
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Vehicle Detail Modal */}
      {viewingVehicle && (
        <div
          className="drivemego-adminvehicleapproval-detail-modal-overlay"
          onClick={() => setViewingVehicle(null)}
        >
          <div
            className="drivemego-adminvehicleapproval-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-adminvehicleapproval-detail-modal-header">
              <h3>Vehicle Details - {viewingVehicle.vehicleName}</h3>
              <button
                className="drivemego-adminvehicleapproval-modal-close"
                onClick={() => setViewingVehicle(null)}
              >
                &times;
              </button>
            </div>

            <div className="drivemego-adminvehicleapproval-detail-modal-content">
              {/* Vehicle Images Gallery */}
              {viewingVehicle.photos && viewingVehicle.photos.length > 0 && (
                <div className="drivemego-adminvehicleapproval-images-section">
                  <h4>Vehicle Images ({viewingVehicle.photos.length})</h4>
                  <div className="drivemego-adminvehicleapproval-main-image">
                    <img
                      src={viewingVehicle.photos[activeImageIndex]?.url}
                      alt={`Vehicle ${activeImageIndex + 1}`}
                    />
                  </div>
                  <div className="drivemego-adminvehicleapproval-image-thumbnails">
                    {viewingVehicle.photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo.url}
                        alt={`Thumbnail ${index + 1}`}
                        className={index === activeImageIndex ? "active" : ""}
                        onClick={() => setActiveImageIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle Information */}
              <div className="drivemego-adminvehicleapproval-info-section">
                <h4>Vehicle Information</h4>
                <div className="drivemego-adminvehicleapproval-info-grid">
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Vehicle Name</span>
                    <span className="value">{viewingVehicle.vehicleName}</span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Registration Number</span>
                    <span className="value">
                      {viewingVehicle.registrationNumber}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Category</span>
                    <span className="value">
                      {viewingVehicle.vehicleCategory}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Service Type</span>
                    <span className="value">{viewingVehicle.serviceType}</span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Manufacturing Year</span>
                    <span className="value">
                      {viewingVehicle.manufacturingYear}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Seating Capacity</span>
                    <span className="value">
                      {viewingVehicle.capacity?.seatingCapacity || "-"} seats
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Location</span>
                    <span className="value">{viewingVehicle.location}</span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Fleet Owner</span>
                    <span className="value">
                      {viewingVehicle.fleetOwnerId?.fullName || "Unknown"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="drivemego-adminvehicleapproval-info-section">
                <h4>
                  Pricing Details ({viewingVehicle.pricing?.currency || getActiveCurrency()})
                </h4>
                <div className="drivemego-adminvehicleapproval-info-grid">
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Daily Rate</span>
                    <span className="value">
                      {viewingVehicle.pricing?.dailyRate || 0}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Weekly Rate</span>
                    <span className="value">
                      {viewingVehicle.pricing?.weeklyRate || 0}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Monthly Rate</span>
                    <span className="value">
                      {viewingVehicle.pricing?.monthlyRate || 0}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Yearly Rate</span>
                    <span className="value">
                      {viewingVehicle.pricing?.yearlyRate || 0}
                    </span>
                  </div>
                  <div className="drivemego-adminvehicleapproval-info-item">
                    <span className="label">Per KM Charge</span>
                    <span className="value">
                      {viewingVehicle.pricing?.perKmCharge || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Facilities */}
              {viewingVehicle.facilities && (
                <div className="drivemego-adminvehicleapproval-info-section">
                  <h4>Facilities & Amenities</h4>
                  <div className="drivemego-adminvehicleapproval-facilities-grid">
                    {Object.entries(viewingVehicle.facilities).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className={`drivemego-adminvehicleapproval-facility-item ${value ? "active" : ""}`}
                        >
                          <span className="facility-icon">
                            {value ? "check" : "close"}
                          </span>
                          <span className="facility-name">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="drivemego-adminvehicleapproval-documents-section">
                <h4>
                  Uploaded Documents ({viewingVehicle.documents?.length || 0})
                </h4>
                {viewingVehicle.documents &&
                viewingVehicle.documents.length > 0 ? (
                  <div className="drivemego-adminvehicleapproval-documents-grid">
                    {viewingVehicle.documents.map((doc, index) => (
                      <div
                        key={index}
                        className="drivemego-adminvehicleapproval-document-card"
                      >
                        <div className="drivemego-adminvehicleapproval-document-icon">
                          {isImageFile(doc.documentUrl) ? "image" : "pdf"}
                        </div>
                        <div className="drivemego-adminvehicleapproval-document-info">
                          <span className="doc-type">
                            {getDocumentTypeLabel(doc.documentType)}
                          </span>
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="doc-link"
                          >
                            View Document
                          </a>
                        </div>
                        <div className="drivemego-adminvehicleapproval-document-status">
                          <span className="status-uploaded">Uploaded</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="drivemego-adminvehicleapproval-no-documents">
                    <span>warning</span>
                    <p>No documents uploaded for this vehicle</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="drivemego-adminvehicleapproval-detail-actions">
                <button
                  className="drivemego-adminvehicleapproval-btn-approve-large"
                  onClick={() => {
                    approveVehicle(viewingVehicle._id);
                    setViewingVehicle(null);
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Approve Vehicle"}
                </button>
                <button
                  className="drivemego-adminvehicleapproval-btn-reject-large"
                  onClick={() => {
                    setSelectedVehicle(viewingVehicle);
                    setViewingVehicle(null);
                  }}
                  disabled={actionLoading}
                >
                  Reject Vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="drivemego-adminvehicleapproval-pagination">
          <button
            disabled={pagination.page === 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of{" "}
            {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            disabled={
              pagination.page >= Math.ceil(pagination.total / pagination.limit)
            }
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminVehicleApproval;
