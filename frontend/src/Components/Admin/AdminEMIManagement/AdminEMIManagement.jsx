import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllEMIPaymentsAdmin,
  sendEMIWarning,
  toggleServiceStatus,
} from "../../../Redux/slices/emiPaymentSlice";
import {
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Ban,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import "./AdminEMIManagement.css";

const AdminEMIManagement = () => {
  const dispatch = useDispatch();
  const { adminEMIPayments, loading } = useSelector(
    (state) => state.emiPayment,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("overdueFirst");
  const [expandedRows, setExpandedRows] = useState({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchEMIPayments = useCallback(() => {
    dispatch(
      getAllEMIPaymentsAdmin({
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
    );
  }, [dispatch, statusFilter]);

  useEffect(() => {
    fetchEMIPayments();
  }, [fetchEMIPayments]);

  const formatCurrency = (amount, currency = "AED") => {
    return `${currency} ${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      ACTIVE: { bg: "#dcfce7", color: "#166534", label: "Active" },
      COMPLETED: { bg: "#dbeafe", color: "#1e40af", label: "Completed" },
      OVERDUE: { bg: "#fee2e2", color: "#991b1b", label: "Overdue" },
      SUSPENDED: { bg: "#fef3c7", color: "#92400e", label: "Suspended" },
      CANCELLED: { bg: "#f3f4f6", color: "#374151", label: "Cancelled" },
    };
    const style = statusStyles[status] || statusStyles.ACTIVE;
    return (
      <span
        className="emi-status-badge"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {style.label}
      </span>
    );
  };

  const toggleRowExpand = (emiId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [emiId]: !prev[emiId],
    }));
  };

  const handleSendWarning = async () => {
    if (!selectedEMI || !warningMessage.trim()) {
      alert("Please provide a warning message");
      return;
    }

    setProcessing(true);
    try {
      await dispatch(
        sendEMIWarning({
          emiPaymentId: selectedEMI._id,
          warningType: "OVERDUE_PAYMENT",
          message: warningMessage,
        }),
      ).unwrap();
      alert("Warning email sent successfully to the Corporate user");
      setShowWarningModal(false);
      setWarningMessage("");
      setSelectedEMI(null);
      fetchEMIPayments();
    } catch (error) {
      alert(error || "Failed to send warning");
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspendServices = async () => {
    if (!selectedEMI || !suspendReason.trim()) {
      alert("Please provide a reason for suspension");
      return;
    }

    setProcessing(true);
    try {
      await dispatch(
        toggleServiceStatus({
          emiPaymentId: selectedEMI._id,
          action: "SUSPEND",
          reason: suspendReason,
        }),
      ).unwrap();
      alert("Corporate services suspended successfully");
      setShowSuspendModal(false);
      setSuspendReason("");
      setSelectedEMI(null);
      fetchEMIPayments();
    } catch (error) {
      alert(error || "Failed to suspend services");
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivateServices = async () => {
    if (!selectedEMI) return;

    setProcessing(true);
    try {
      await dispatch(
        toggleServiceStatus({
          emiPaymentId: selectedEMI._id,
          action: "REACTIVATE",
          reason: "Services reactivated by admin",
        }),
      ).unwrap();
      alert("Corporate services reactivated successfully");
      setShowReactivateModal(false);
      setSelectedEMI(null);
      fetchEMIPayments();
    } catch (error) {
      alert(error || "Failed to reactivate services");
    } finally {
      setProcessing(false);
    }
  };

  const filteredPayments = (adminEMIPayments || [])
    .filter((emi) => {
      if (statusFilter !== "ALL" && emi.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const corporateName =
          emi.corporateId?.companyName || emi.corporateId?.fullName || "";
        const contractNumber = emi.contractId?.contractNumber || "";
        return (
          corporateName.toLowerCase().includes(search) ||
          contractNumber.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "overdueFirst") {
        const aOverdue = a.overdueInstallments?.length || 0;
        const bOverdue = b.overdueInstallments?.length || 0;
        return bOverdue - aOverdue;
      }
      if (sortBy === "amountHighest") {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (sortBy === "dueDateNearest") {
        const aDue = a.nextDueDate
          ? new Date(a.nextDueDate)
          : new Date("2099-12-31");
        const bDue = b.nextDueDate
          ? new Date(b.nextDueDate)
          : new Date("2099-12-31");
        return aDue - bDue;
      }
      return 0;
    });

  const overdueCount = filteredPayments.filter(
    (e) => (e.overdueInstallments?.length || 0) > 0,
  ).length;
  const suspendedCount = filteredPayments.filter(
    (e) => e.status === "SUSPENDED",
  ).length;
  const totalOutstanding = filteredPayments.reduce(
    (sum, e) => sum + (e.remainingAmount || 0),
    0,
  );

  return (
    <div className="admin-emi-management">
      <div className="emi-management-header">
        <div className="header-title">
          <DollarSign size={28} />
          <div>
            <h1>EMI Payment Management</h1>
            <p>
              Monitor and manage Corporate EMI payments, send warnings, and
              manage service status
            </p>
          </div>
        </div>
        <button
          className="refresh-btn"
          onClick={fetchEMIPayments}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? "spinning" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="emi-stats-grid">
        <div className="emi-stat-card">
          <div className="stat-icon total">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{filteredPayments.length}</span>
            <span className="stat-label">Total EMI Plans</span>
          </div>
        </div>
        <div className="emi-stat-card">
          <div className="stat-icon overdue">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{overdueCount}</span>
            <span className="stat-label">With Overdue EMIs</span>
          </div>
        </div>
        <div className="emi-stat-card">
          <div className="stat-icon suspended">
            <Ban size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{suspendedCount}</span>
            <span className="stat-label">Suspended Services</span>
          </div>
        </div>
        <div className="emi-stat-card">
          <div className="stat-icon amount">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {formatCurrency(totalOutstanding)}
            </span>
            <span className="stat-label">Total Outstanding</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="emi-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by company name or contract number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={18} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="overdueFirst">Most Overdue First</option>
            <option value="amountHighest">Highest Amount</option>
            <option value="dueDateNearest">Nearest Due Date</option>
          </select>
        </div>
      </div>

      {/* EMI Table */}
      <div className="emi-table-container">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spinning" />
            <p>Loading EMI payments...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No EMI payments found</h3>
            <p>There are no EMI payment plans matching your filters.</p>
          </div>
        ) : (
          <table className="emi-table">
            <thead>
              <tr>
                <th></th>
                <th>Corporate</th>
                <th>Contract</th>
                <th>Plan</th>
                <th>Progress</th>
                <th>Overdue</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((emi) => (
                <React.Fragment key={emi._id}>
                  <tr
                    className={`emi-row ${(emi.overdueInstallments?.length || 0) > 0 ? "has-overdue" : ""}`}
                  >
                    <td>
                      <button
                        className="expand-btn"
                        onClick={() => toggleRowExpand(emi._id)}
                      >
                        {expandedRows[emi._id] ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="corporate-info">
                        <User size={16} />
                        <div>
                          <strong>
                            {emi.corporateId?.companyName ||
                              emi.corporateId?.fullName ||
                              "N/A"}
                          </strong>
                          <span className="corporate-email">
                            {emi.corporateId?.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="contract-number">
                        {emi.contractId?.contractNumber || "N/A"}
                      </span>
                    </td>
                    <td>
                      <div className="plan-info">
                        <strong>{emi.tenure} months</strong>
                        <span>{formatCurrency(emi.monthlyEMI)}/month</span>
                      </div>
                    </td>
                    <td>
                      <div className="progress-info">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${((emi.installmentsPaid || 0) / emi.tenure) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span>
                          {emi.installmentsPaid || 0}/{emi.tenure} paid
                        </span>
                      </div>
                    </td>
                    <td>
                      {(emi.overdueInstallments?.length || 0) > 0 ? (
                        <span className="overdue-count">
                          <AlertTriangle size={14} />
                          {emi.overdueInstallments.length} overdue
                        </span>
                      ) : (
                        <span className="no-overdue">
                          <CheckCircle size={14} />
                          None
                        </span>
                      )}
                    </td>
                    <td>{getStatusBadge(emi.status)}</td>
                    <td>
                      <div className="action-buttons">
                        {(emi.overdueInstallments?.length || 0) > 0 &&
                          emi.status !== "SUSPENDED" && (
                            <button
                              className="action-btn warning"
                              title="Send Warning Email"
                              onClick={() => {
                                setSelectedEMI(emi);
                                setWarningMessage(
                                  `Dear ${emi.corporateId?.companyName || "Customer"},\n\nYour EMI payment for Contract ${emi.contractId?.contractNumber} is overdue. You have ${emi.overdueInstallments?.length} pending installment(s).\n\nPlease make the payment at your earliest convenience to avoid service disruption.\n\nTotal Due: ${formatCurrency(emi.overdueInstallments?.reduce((sum, i) => sum + (i.totalAmountDue || i.emiAmount), 0))}\n\nRegards,\nDrive Me Admin Team`,
                                );
                                setShowWarningModal(true);
                              }}
                            >
                              <Mail size={16} />
                            </button>
                          )}
                        {(emi.overdueInstallments?.length || 0) >= 2 &&
                          emi.status !== "SUSPENDED" && (
                            <button
                              className="action-btn suspend"
                              title="Suspend Services"
                              onClick={() => {
                                setSelectedEMI(emi);
                                setSuspendReason(
                                  `Multiple EMI payments overdue (${emi.overdueInstallments?.length} installments)`,
                                );
                                setShowSuspendModal(true);
                              }}
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        {emi.status === "SUSPENDED" && (
                          <button
                            className="action-btn reactivate"
                            title="Reactivate Services"
                            onClick={() => {
                              setSelectedEMI(emi);
                              setShowReactivateModal(true);
                            }}
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRows[emi._id] && (
                    <tr className="expanded-row">
                      <td colSpan="8">
                        <div className="expanded-content">
                          <div className="expanded-section">
                            <h4>Payment Summary</h4>
                            <div className="summary-grid">
                              <div className="summary-item">
                                <span className="label">Total Amount</span>
                                <span className="value">
                                  {formatCurrency(emi.totalAmount)}
                                </span>
                              </div>
                              <div className="summary-item">
                                <span className="label">Amount Paid</span>
                                <span className="value paid">
                                  {formatCurrency(emi.totalPaid)}
                                </span>
                              </div>
                              <div className="summary-item">
                                <span className="label">Remaining</span>
                                <span className="value remaining">
                                  {formatCurrency(emi.remainingAmount)}
                                </span>
                              </div>
                              <div className="summary-item">
                                <span className="label">
                                  Late Fees Collected
                                </span>
                                <span className="value">
                                  {formatCurrency(emi.totalLateFees)}
                                </span>
                              </div>
                              <div className="summary-item">
                                <span className="label">Next Due Date</span>
                                <span className="value">
                                  {formatDate(emi.nextDueDate)}
                                </span>
                              </div>
                              <div className="summary-item">
                                <span className="label">Warnings Sent</span>
                                <span className="value">
                                  {emi.warningsSent || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {(emi.overdueInstallments?.length || 0) > 0 && (
                            <div className="expanded-section overdue-section">
                              <h4>
                                <AlertTriangle size={16} />
                                Overdue Installments
                              </h4>
                              <div className="overdue-list">
                                {emi.overdueInstallments.map((inst, idx) => (
                                  <div key={idx} className="overdue-item">
                                    <span className="inst-number">
                                      #{inst.installmentNumber}
                                    </span>
                                    <span className="inst-due">
                                      Due: {formatDate(inst.dueDate)}
                                    </span>
                                    <span className="inst-amount">
                                      {formatCurrency(inst.emiAmount)}
                                    </span>
                                    {inst.lateFee > 0 && (
                                      <span className="inst-late-fee">
                                        +{formatCurrency(inst.lateFee)} late fee
                                      </span>
                                    )}
                                    <span className="inst-total">
                                      Total:{" "}
                                      {formatCurrency(inst.totalAmountDue)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="expanded-section">
                            <h4>B2B Partner</h4>
                            <p>
                              <strong>
                                {emi.fleetOwnerId?.companyName ||
                                  emi.fleetOwnerId?.fullName ||
                                  "N/A"}
                              </strong>
                              <br />
                              {emi.fleetOwnerId?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Warning Modal */}
      {showWarningModal && selectedEMI && (
        <div
          className="emi-modal-overlay"
          onClick={() => setShowWarningModal(false)}
        >
          <div className="emi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <Mail size={24} />
              <h2>Send Warning Email</h2>
              <button
                className="close-btn"
                onClick={() => setShowWarningModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Sending warning to:{" "}
                <strong>
                  {selectedEMI.corporateId?.companyName ||
                    selectedEMI.corporateId?.fullName}
                </strong>
                <br />
                Email: <strong>{selectedEMI.corporateId?.email}</strong>
              </p>
              <div className="form-group">
                <label>Warning Message</label>
                <textarea
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  rows={8}
                  placeholder="Enter warning message..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowWarningModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="btn-warning"
                onClick={handleSendWarning}
                disabled={processing || !warningMessage.trim()}
              >
                {processing ? "Sending..." : "Send Warning Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedEMI && (
        <div
          className="emi-modal-overlay"
          onClick={() => setShowSuspendModal(false)}
        >
          <div className="emi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header suspend">
              <Ban size={24} />
              <h2>Suspend Corporate Services</h2>
              <button
                className="close-btn"
                onClick={() => setShowSuspendModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="warning-box">
                <AlertCircle size={20} />
                <p>
                  This action will suspend all services for{" "}
                  <strong>{selectedEMI.corporateId?.companyName}</strong>. Their
                  employees will not be able to use the transportation services
                  until reactivated.
                </p>
              </div>
              <div className="form-group">
                <label>Reason for Suspension</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={4}
                  placeholder="Enter reason for suspending services..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowSuspendModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleSuspendServices}
                disabled={processing || !suspendReason.trim()}
              >
                {processing ? "Suspending..." : "Suspend Services"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && selectedEMI && (
        <div
          className="emi-modal-overlay"
          onClick={() => setShowReactivateModal(false)}
        >
          <div className="emi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header reactivate">
              <CheckCircle size={24} />
              <h2>Reactivate Corporate Services</h2>
              <button
                className="close-btn"
                onClick={() => setShowReactivateModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Reactivating services for:{" "}
                <strong>
                  {selectedEMI.corporateId?.companyName ||
                    selectedEMI.corporateId?.fullName}
                </strong>
              </p>
              <div className="info-box">
                <p>
                  This will restore all services for this Corporate user. Their
                  employees will be able to use the transportation services
                  again.
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowReactivateModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="btn-success"
                onClick={handleReactivateServices}
                disabled={processing}
              >
                {processing ? "Reactivating..." : "Reactivate Services"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEMIManagement;
