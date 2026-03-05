import React, { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import "./adminvehicleapproval.css";

function AdminVehicleApproval() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

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
      <div className="vehicle-approval-loading">
        Loading pending vehicles...
      </div>
    );
  }

  return (
    <div className="admin-vehicle-approval">
      <div className="approval-header">
        <h2>Vehicle Approvals</h2>
        <p className="pending-count">
          {pagination.total} pending vehicle{pagination.total !== 1 ? "s" : ""}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {vehicles.length === 0 ? (
        <div className="no-vehicles">
          <p>No pending vehicles to approve</p>
        </div>
      ) : (
        <div className="vehicles-list">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle._id}
              className="vehicle-card"
              onClick={() => setSelectedVehicle(vehicle)}
            >
              <div className="vehicle-header">
                <h3>{vehicle.vehicleName}</h3>
                <span className="registration">
                  {vehicle.registrationNumber}
                </span>
              </div>

              <div className="vehicle-details">
                <div className="detail-row">
                  <span className="label">Category:</span>
                  <span className="value">{vehicle.vehicleCategory}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Service Type:</span>
                  <span className="value">{vehicle.serviceType}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Capacity:</span>
                  <span className="value">
                    {vehicle.capacity.seatingCapacity || "-"} seats
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Fleet Owner:</span>
                  <span className="value">
                    {vehicle.fleetOwnerId?.fullName || "Unknown"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Location:</span>
                  <span className="value">{vehicle.location}</span>
                </div>
              </div>

              <div className="vehicle-actions">
                <button
                  className="btn-approve"
                  onClick={() => approveVehicle(vehicle._id)}
                  disabled={actionLoading}
                >
                  Approve
                </button>
                <button
                  className="btn-reject"
                  onClick={() => setSelectedVehicle(vehicle)}
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
            className="rejection-modal-overlay"
            onClick={() => setSelectedVehicle(null)}
          >
            <div
              className="rejection-modal"
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
                className="rejection-input"
              />

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setSelectedVehicle(null);
                    setRejectionReason("");
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm-reject"
                  onClick={() => rejectVehicle(selectedVehicle._id)}
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="pagination">
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
