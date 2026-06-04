"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { createContractFromQuotation } from "../../../Redux/slices/contractSlice";
import "./ContractRequestModal.css";

const ContractRequestModal = ({ quotation, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    notes: "",
    urgencyLevel: "normal",
    preferredDeliveryDate: "",
  });

  console.log("formData", formData);
  const [loading, setLoading] = useState(false);

  console.log("quotation", quotation._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await dispatch(
        createContractFromQuotation({
          quotationId: quotation._id,
          data: formData,
        }),
      );

      if (result.type === "contract/createFromQuotation/fulfilled") {
        // Check if onSuccess is provided before calling it
        if (onSuccess && typeof onSuccess === "function") {
          onSuccess(result.payload.data.contract);
        } else {
          // Fallback behavior if onSuccess is not provided
          alert("Contract created successfully!");
          onClose();
        }
      } else {
        alert("Failed to create contract request. Please try again.");
      }
    } catch (error) {
      console.error("Contract creation error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalVehicles = quotation.vehicles.reduce(
    (sum, v) => sum + v.quantity,
    0,
  );
  return (
    <div className="contract-request-modal-overlay">
      <div
        className="contract-request-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="contract-request-modal-header">
          <h2>Create Contract Request</h2>
          <button className="contract-request-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="contract-request-modal-body">
          <div className="contract-request-quotation-summary">
            <h3>Quotation Summary</h3>
            <div className="contract-request-summary-item">
              <span>Quotation #:</span>
              <strong>{quotation.quotationNumber}</strong>
            </div>
            <div className="contract-request-summary-item">
              <span>Fleet Owner:</span>
              <strong>
                {quotation.fleetOwnerId?.companyName ||
                  quotation.fleetOwnerId?.fullName}
              </strong>
            </div>
            <div className="contract-request-summary-item">
              <span>Total Amount:</span>
              <strong>
                {quotation.quotedPrice.currency || "AED"}{" "}
                {quotation.quotedPrice?.totalAmount?.toFixed(2)}
              </strong>
            </div>
            <div className="contract-request-summary-item">
              <span>Total Vehicles:</span>
              <strong>{totalVehicles}</strong>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contract-request-form">
            <div className="contract-request-form-group">
              <label>Urgency Level</label>
              <select
                value={formData.urgencyLevel}
                onChange={(e) =>
                  setFormData({ ...formData, urgencyLevel: e.target.value })
                }
                required
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="very-urgent">Very Urgent</option>
              </select>
            </div>

            <div className="contract-request-form-group">
              <label>Preferred Delivery Date</label>
              <input
                type="date"
                value={formData.preferredDeliveryDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferredDeliveryDate: e.target.value,
                  })
                }
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="contract-request-form-group">
              <label>Additional Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add any special requirements or notes for the fleet owner..."
                rows={4}
              />
            </div>

            <div className="contract-request-modal-footer">
              <button
                type="button"
                className="contract-request-btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="contract-request-btn-primary"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Contract Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContractRequestModal;
