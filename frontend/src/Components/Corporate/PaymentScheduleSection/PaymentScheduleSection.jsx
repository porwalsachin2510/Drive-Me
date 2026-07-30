"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getPaymentScheduleByContract } from "../../../Redux/slices/paymentScheduleSlice";
import { requestDueDateExtension } from "../../../Redux/slices/contractSlice";
import {
  FiCalendar,
  FiDollarSign,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
} from "react-icons/fi";
import "./PaymentScheduleSection.css";
import { notify } from "../../../utils/toast";

const PaymentScheduleSection = ({
  contractId,
  currency = getActiveCurrency(),
  contract,
}) => {
  const dispatch = useDispatch();
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionData, setExtensionData] = useState({
    newProposedDate: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const { currentSchedule, loading } = useSelector(
    (state) => state.paymentSchedule,
  );

  useEffect(() => {
    if (contractId) {
      dispatch(getPaymentScheduleByContract(contractId));
    }
  }, [dispatch, contractId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "PAID":
        return <FiCheckCircle className="status-icon status-paid" />;
      case "OVERDUE":
        return <FiAlertCircle className="status-icon status-overdue" />;
      case "PENDING":
        return <FiClock className="status-icon status-pending" />;
      default:
        return null;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "PAID":
        return "status-paid";
      case "OVERDUE":
        return "status-overdue";
      case "PENDING":
        return "status-pending";
      default:
        return "";
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isPaymentOverdue = (dueDate, status) => {
    return status === "PENDING" && new Date(dueDate) < new Date();
  };

  const handleRequestExtension = async () => {
    if (!extensionData.newProposedDate || !extensionData.reason) {
      notify("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const result = await dispatch(
        requestDueDateExtension({
          contractId,
          newProposedDate: extensionData.newProposedDate,
          reason: extensionData.reason,
        }),
      ).unwrap();

      notify("Due date extension request submitted successfully!");
      setShowExtensionModal(false);
      setExtensionData({ newProposedDate: "", reason: "" });

      // Refresh the schedule
      dispatch(getPaymentScheduleByContract(contractId));
    } catch (error) {
      notify(error || "Failed to submit extension request");
    } finally {
      setSubmitting(false);
    }
  };

  const hasPendingExtensionRequest =
    contract?.dueDateExtensionRequest?.isRequested &&
    contract?.dueDateExtensionRequest?.status === "PENDING";

  if (!currentSchedule || currentSchedule.length === 0) {
    return (
      <div className="payment-schedule-section">
        <div className="payment-schedule-header">
          <h3>Payment Schedule</h3>
          <p className="no-schedule-message">
            No payment schedule found for this contract.
          </p>
        </div>
      </div>
    );
  }

  const calculateTotals = () => {
    if (!Array.isArray(currentSchedule))
      return { total: 0, paid: 0, remaining: 0 };

    const total = currentSchedule.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const paid = currentSchedule
      .filter((item) => item.status === "PAID")
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const remaining = total - paid;

    return { total, paid, remaining };
  };

  const { total, paid, remaining } = calculateTotals();

  return (
    <div className="payment-schedule-section">
      <div className="payment-schedule-header">
        <h3>Payment Schedule</h3>
        <div className="schedule-summary">
          <div className="summary-item">
            <span className="summary-label">Total Amount:</span>
            <span className="summary-value">
              {currency} {total.toFixed(2)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Paid Amount:</span>
            <span className="summary-value paid">
              {currency} {paid.toFixed(2)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Remaining:</span>
            <span className="summary-value remaining">
              {currency} {remaining.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="payment-schedule-timeline">
        {currentSchedule.map((item, index) => {
          const isOverdue = isPaymentOverdue(item.dueDate, item.status);
          const actualStatus = isOverdue ? "OVERDUE" : item.status;

          return (
            <div
              key={item._id}
              className={`schedule-item ${getStatusClass(actualStatus)}`}
            >
              <div className="schedule-item-header">
                <div className="item-info">
                  {getStatusIcon(actualStatus)}
                  <div className="item-details">
                    <h4 className="item-title">
                      {item.scheduleType === "ADVANCE" &&
                        "Advance Payment (50%)"}
                      {item.scheduleType === "SECURITY_DEPOSIT" &&
                        "Security Deposit"}
                      {item.scheduleType === "INSTALLMENT" &&
                        `Installment ${index + 1}`}
                      {item.scheduleType === "FINAL" && "Final Payment (50%)"}
                    </h4>
                  </div>
                </div>
                <div className="item-amount">
                  <FiDollarSign />
                  <span>
                    {currency} {item.amount?.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="schedule-item-body">
                <div className="item-dates">
                  <div className="date-item">
                    <FiCalendar />
                    <span className="date-label">Due Date:</span>
                    <span className="date-value">
                      {formatDate(item.dueDate)}
                    </span>
                  </div>
                  {item.paidAt && (
                    <div className="date-item paid-date">
                      <FiCheckCircle />
                      <span className="date-label">Paid On:</span>
                      <span className="date-value">
                        {formatDate(item.paidAt)}
                      </span>
                    </div>
                  )}
                </div>

                {isOverdue && item.status === "PENDING" && (
                  <div className="overdue-warning">
                    <FiAlertCircle />
                    <span>
                      Payment is overdue! A late fee of 5% may be applied.
                    </span>
                  </div>
                )}

                {item.status === "PAID" && item.paymentId?.gatewayReference && (
                  <div className="payment-reference">
                    <span className="ref-label">Reference:</span>
                    <span className="ref-value">
                      {item.paymentId.gatewayReference}
                    </span>
                  </div>
                )}

                {/* Request Due Date Extension Button for Final Payment */}
                {item.scheduleType === "FINAL" && item.status !== "PAID" && (
                  <div className="extension-request-section">
                    {hasPendingExtensionRequest ? (
                      <div className="pending-extension-notice">
                        <FiClock />
                        <span>Due date extension request pending approval</span>
                      </div>
                    ) : contract?.dueDateExtensionRequest?.status ===
                      "APPROVED" ? (
                      <div className="approved-extension-notice">
                        <FiCheckCircle />
                        <span>Due date extended successfully</span>
                      </div>
                    ) : contract?.dueDateExtensionRequest?.status ===
                      "COUNTER_OFFERED" ? (
                      <div className="counter-offered-notice">
                        <FiCheckCircle />
                        <span>
                          Due date adjusted to{" "}
                          {formatDate(
                            contract?.dueDateExtensionRequest
                              ?.counterOfferedDate,
                          )}
                        </span>
                      </div>
                    ) : (
                      <button
                        className="request-extension-btn"
                        onClick={() => setShowExtensionModal(true)}
                      >
                        <FiEdit3 />
                        Request Due Date Extension
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Due Date Extension Modal */}
      {showExtensionModal && (
        <div className="extension-modal-overlay">
          <div className="extension-modal" onClick={(e) => e.stopPropagation()}>
            <div className="extension-modal-header">
              <h3>Request Due Date Extension</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowExtensionModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="extension-modal-body">
              <p className="modal-description">
                If you need more time to make the final payment, you can request
                a due date extension. The fleet owner will review your request.
              </p>

              <div className="form-group">
                <label htmlFor="newProposedDate">New Proposed Due Date *</label>
                <input
                  type="date"
                  id="newProposedDate"
                  value={extensionData.newProposedDate}
                  onChange={(e) =>
                    setExtensionData({
                      ...extensionData,
                      newProposedDate: e.target.value,
                    })
                  }
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reason">Reason for Extension *</label>
                <textarea
                  id="reason"
                  rows="4"
                  placeholder="Please explain why you need more time to make the payment..."
                  value={extensionData.reason}
                  onChange={(e) =>
                    setExtensionData({
                      ...extensionData,
                      reason: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="extension-modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowExtensionModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleRequestExtension}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentScheduleSection;
