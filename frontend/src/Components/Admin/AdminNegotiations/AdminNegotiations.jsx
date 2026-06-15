import React, { useState, useEffect, useCallback, useContext } from "react";
import { useSelector } from "react-redux";
import { SocketContext } from "../../../context/SocketContext";
import {
  Search,
  Filter,
  MessageSquare,
  Send,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingDown,
  Users,
  Building2,
  Truck,
  Eye,
  RefreshCw,
  ChevronRight,
  FileText,
  Calendar,
  ArrowRight,
  Percent,
  Wallet,
  BadgeDollarSign,
} from "lucide-react";
import {
  getAllNegotiations,
  getNegotiationDetails,
  takeNegotiationAction,
  completeNegotiation,
  cancelNegotiation,
} from "../../../services/adminAPI";
import "./AdminNegotiations.css";

const AdminNegotiations = () => {
  const { socket } = useContext(SocketContext) || {};
  const { user } = useSelector((state) => state.auth);
  const [negotiations, setNegotiations] = useState([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    totalSavings: 0,
    totalCommissionEarned: 0,
    pendingCommission: 0,
    paidCommission: 0,
  });

  // Action form states
  const [actionType, setActionType] = useState("SENT_MESSAGE");
  const [actionMessage, setActionMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [corporateCommissionRate, setCorporateCommissionRate] = useState(25);
  // Source of the prefilled commission rate (custom_rule | configured | default | stored)
  const [commissionRateSource, setCommissionRateSource] = useState("default");

  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "REQUESTED", label: "Requested", color: "#f59e0b" },
    { value: "IN_PROGRESS", label: "In Progress", color: "#3b82f6" },
    { value: "COMPLETED", label: "Completed", color: "#10b981" },
    { value: "FAILED", label: "Failed", color: "#ef4444" },
    { value: "CANCELLED", label: "Cancelled", color: "#6b7280" },
  ];

  const fetchNegotiations = useCallback(async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const response = await getAllNegotiations({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: searchTerm,
      });

      if (response.success) {
        const negList = response.negotiations || [];
        setNegotiations(negList);
        setFilteredNegotiations(negList);
        calculateStats(negList);
      } else {
        setNegotiations([]);
        setFilteredNegotiations([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error("Error fetching negotiations:", error);
      setMessage({ type: "error", text: "Failed to load negotiations" });
      setNegotiations([]);
      setFilteredNegotiations([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchNegotiations();
  }, [fetchNegotiations]);

  // Listen for real-time negotiation updates
  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleNegotiationUpdate = (data) => {
      console.log("[v0] Admin received negotiation update:", data);
      // Refresh negotiations when we receive an update
      fetchNegotiations();
      // Show a message
      setMessage({
        type: "info",
        text: data.message || "New negotiation update received",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    // Listen for negotiation-related events
    socket.on("negotiation_request", handleNegotiationUpdate);
    socket.on("negotiation_accepted", handleNegotiationUpdate);
    socket.on("negotiation_rejected", handleNegotiationUpdate);
    socket.on("negotiation_counter_offer", handleNegotiationUpdate);
    socket.on("new-notification", (notification) => {
      if (notification.type?.includes("NEGOTIATION")) {
        handleNegotiationUpdate(notification);
      }
    });

    return () => {
      socket.off("negotiation_request", handleNegotiationUpdate);
      socket.off("negotiation_accepted", handleNegotiationUpdate);
      socket.off("negotiation_rejected", handleNegotiationUpdate);
      socket.off("negotiation_counter_offer", handleNegotiationUpdate);
    };
  }, [socket, user?._id, fetchNegotiations]);

  useEffect(() => {
    let filtered = negotiations || [];

    if (searchTerm && filtered.length > 0) {
      filtered = filtered.filter(
        (n) =>
          n.negotiationNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          n.corporateId?.fullName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          n.b2bPartnerId?.fullName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          n.corporateId?.companyName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    if (statusFilter !== "ALL" && filtered.length > 0) {
      filtered = filtered.filter((n) => n.status === statusFilter);
    }

    setFilteredNegotiations(filtered);
  }, [searchTerm, statusFilter, negotiations]);

  const calculateStats = (negotiationsList) => {
    if (!negotiationsList || !Array.isArray(negotiationsList)) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        totalSavings: 0,
        totalCommissionEarned: 0,
        pendingCommission: 0,
        paidCommission: 0,
      };
    }

    const completedNegotiations = negotiationsList.filter(
      (n) => n.status === "COMPLETED",
    );

    // Calculate commission stats
    const totalCommissionEarned = completedNegotiations.reduce(
      (sum, n) => sum + (n.adminCommissionFromCorporate?.amount || 0),
      0,
    );
    const pendingCommission = completedNegotiations
      .filter((n) => n.adminCommissionFromCorporate?.status === "PENDING")
      .reduce(
        (sum, n) => sum + (n.adminCommissionFromCorporate?.amount || 0),
        0,
      );
    const paidCommission = completedNegotiations
      .filter((n) => n.adminCommissionFromCorporate?.status === "PAID")
      .reduce(
        (sum, n) => sum + (n.adminCommissionFromCorporate?.amount || 0),
        0,
      );

    const stats = {
      total: negotiationsList.length,
      pending: negotiationsList.filter((n) => n.status === "REQUESTED").length,
      inProgress: negotiationsList.filter((n) => n.status === "IN_PROGRESS")
        .length,
      completed: completedNegotiations.length,
      totalSavings: completedNegotiations.reduce(
        (sum, n) => sum + (n.priceSaved || 0),
        0,
      ),
      totalCommissionEarned,
      pendingCommission,
      paidCommission,
    };
    setStats(stats);
  };

  // Get the latest proposed price from admin actions
  const getLatestProposedPrice = (negotiation) => {
    if (!negotiation?.adminActions || negotiation.adminActions.length === 0) {
      return negotiation?.originalPrice || 0;
    }
    // Find the last admin action with a proposed price
    for (let i = negotiation.adminActions.length - 1; i >= 0; i--) {
      if (negotiation.adminActions[i].proposedPrice) {
        return negotiation.adminActions[i].proposedPrice;
      }
    }
    return negotiation?.originalPrice || 0;
  };

  const handleViewNegotiation = async (negotiation) => {
    try {
      const response = await getNegotiationDetails(negotiation._id);

      if (response.success) {
        setSelectedNegotiation(response.negotiation);
        setShowModal(true);
        setActionMessage("");
        // Use the latest proposed price from admin actions
        const latestPrice = getLatestProposedPrice(response.negotiation);
        setProposedPrice(
          latestPrice || response.negotiation.originalPrice || "",
        );
        // Prefill with the Corporate user's EFFECTIVE configured negotiation
        // commission rate (active custom rule -> configured rate -> default),
        // resolved by the backend. Fall back to any rate already stored on a
        // completed negotiation, then 25%. Admin can still rewrite this value.
        const resolvedRate =
          response.negotiation.status === "COMPLETED"
            ? (response.negotiation.adminCommissionFromCorporate?.rate ??
              response.effectiveCommissionRate ??
              25)
            : (response.effectiveCommissionRate ??
              response.negotiation.adminCommissionFromCorporate?.rate ??
              25);
        setCorporateCommissionRate(resolvedRate);
        setCommissionRateSource(response.commissionRateSource || "default");
      }
    } catch (error) {
      console.error("Error fetching negotiation details:", error);
      setMessage({ type: "error", text: "Failed to load negotiation details" });
    }
  };

  const handleAdminAction = async () => {
    if (!selectedNegotiation) return;

    try {
      setActionLoading(true);

      const actionData = {
        message: actionMessage,
      };

      if (actionType === "SENT_OFFER" && proposedPrice) {
        actionData.proposedPrice = parseFloat(proposedPrice);
      }

      const response = await takeNegotiationAction(
        selectedNegotiation._id,
        actionType,
        actionData,
      );

      if (response.success) {
        setMessage({ type: "success", text: "Action sent successfully!" });
        // Use the updated negotiation from response (response.data)
        const updatedNegotiation = response.data || response.negotiation;
        setSelectedNegotiation(updatedNegotiation);
        setActionMessage("");
        // Update proposed price to the latest value
        if (actionType === "SENT_OFFER" && proposedPrice) {
          setProposedPrice(proposedPrice);
        }
        fetchNegotiations();
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      console.error("Error performing action:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to perform action",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteNegotiation = async () => {
    if (!selectedNegotiation || !proposedPrice) return;

    try {
      setActionLoading(true);

      const response = await completeNegotiation(selectedNegotiation._id, {
        finalPrice: parseFloat(proposedPrice),
        corporateCommissionRate: parseFloat(corporateCommissionRate),
        message: actionMessage || "Negotiation completed successfully!",
      });

      if (response.success) {
        setMessage({
          type: "success",
          text: "Negotiation completed! Quotation price has been updated.",
        });
        setShowModal(false);
        fetchNegotiations();
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      console.error("Error completing negotiation:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to complete negotiation",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelNegotiation = async () => {
    if (!selectedNegotiation) return;

    if (!window.confirm("Are you sure you want to cancel this negotiation?"))
      return;

    try {
      setActionLoading(true);

      const response = await cancelNegotiation(
        selectedNegotiation._id,
        actionMessage || "Cancelled by Admin",
      );

      if (response.success) {
        setMessage({ type: "success", text: "Negotiation cancelled" });
        setShowModal(false);
        fetchNegotiations();
      }
    } catch (error) {
      console.error("Error cancelling negotiation:", error);
      setMessage({ type: "error", text: error.message || "Failed to cancel" });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      REQUESTED: {
        color: "#f59e0b",
        bg: "#fef3c7",
        icon: Clock,
        label: "Requested",
      },
      IN_PROGRESS: {
        color: "#3b82f6",
        bg: "#dbeafe",
        icon: MessageSquare,
        label: "In Progress",
      },
      COMPLETED: {
        color: "#10b981",
        bg: "#d1fae5",
        icon: CheckCircle,
        label: "Completed",
      },
      FAILED: {
        color: "#ef4444",
        bg: "#fee2e2",
        icon: XCircle,
        label: "Failed",
      },
      CANCELLED: {
        color: "#6b7280",
        bg: "#f3f4f6",
        icon: X,
        label: "Cancelled",
      },
    };

    const config = statusConfig[status] || statusConfig.REQUESTED;
    const Icon = config.icon;

    return (
      <span
        className="status-badge"
        style={{ background: config.bg, color: config.color }}
      >
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount, currency = "AED") => {
    return `${currency} ${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="drivemego-negotiation-admin-negotiations">
      {/* Header */}
      <div className="drivemego-negotiation-negotiations-header">
        <div className="drivemego-negotiation-header-content">
          <h1>Negotiation Management</h1>
          <p>
            Manage price negotiations between Corporate users and B2B Partners
          </p>
        </div>
        <button
          className="drivemego-negotiation-refresh-btn"
          onClick={fetchNegotiations}
          disabled={loading}
        >
          <RefreshCw
            size={18}
            className={loading ? "drivemego-negotiation-spinning" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="drivemego-negotiation-negotiations-stats">
        <div className="drivemego-negotiation-stat-card">
          <div className="drivemego-negotiation-stat-icon drivemego-negotiation-total-icon">
            <MessageSquare size={24} />
          </div>
          <div className="drivemego-negotiation-stat-content">
            <span className="drivemego-negotiation-stat-value">
              {stats.total}
            </span>
            <span className="drivemego-negotiation-stat-label">
              Total Negotiations
            </span>
          </div>
        </div>
        <div className="drivemego-negotiation-stat-card">
          <div className="drivemego-negotiation-stat-icon drivemego-negotiation-pending-icon">
            <Clock size={24} />
          </div>
          <div className="drivemego-negotiation-stat-content">
            <span className="drivemego-negotiation-stat-value">
              {stats.pending}
            </span>
            <span className="drivemego-negotiation-stat-label">
              Pending Action
            </span>
          </div>
        </div>
        <div className="drivemego-negotiation-stat-card">
          <div className="drivemego-negotiation-stat-icon progress-icon">
            <Users size={24} />
          </div>
          <div className="drivemego-negotiation-stat-content">
            <span className="drivemego-negotiation-stat-value">
              {stats.inProgress}
            </span>
            <span className="drivemego-negotiation-stat-label">
              In Progress
            </span>
          </div>
        </div>
        <div className="drivemego-negotiation-stat-card">
          <div className="drivemego-negotiation-stat-icon drivemego-negotiation-savings-icon">
            <TrendingDown size={24} />
          </div>
          <div className="drivemego-negotiation-stat-content">
            <span className="drivemego-negotiation-stat-value">
              {formatCurrency(stats.totalSavings)}
            </span>
            <span className="drivemego-negotiation-stat-label">
              Total Savings
            </span>
          </div>
        </div>
        <div className="drivemego-negotiation-stat-card">
          <div className="drivemego-negotiation-stat-icon drivemego-negotiation-commission-icon">
            <Wallet size={24} />
          </div>
          <div className="drivemego-negotiation-stat-content">
            <span className="drivemego-negotiation-stat-value commission-value">
              {formatCurrency(stats.totalCommissionEarned)}
            </span>
            <span className="drivemego-negotiation-stat-label">
              Total Commission
            </span>
            <div className="drivemego-negotiation-stat-breakdown">
              <span className="paid-amount">
                Paid: {formatCurrency(stats.paidCommission)}
              </span>
              <span className="pending-amount">
                Pending: {formatCurrency(stats.pendingCommission)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`drivemego-negotiation-negotiations-message ${message.type}`}
        >
          {message.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="drivemego-negotiation-negotiations-filters">
        <div className="drivemego-negotiation-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by negotiation #, company, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="drivemego-negotiation-filter-box">
          <Filter size={18} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Negotiations List */}
      <div className="drivemego-negotiation-negotiations-list">
        {loading ? (
          <div className="drivemego-negotiation-loading-state">
            <RefreshCw size={32} className="drivemego-negotiation-spinning" />
            <span>Loading negotiations...</span>
          </div>
        ) : filteredNegotiations.length === 0 ? (
          <div className="drivemego-negotiation-empty-state">
            <MessageSquare size={48} />
            <h3>No negotiations found</h3>
            <p>There are no negotiations matching your criteria.</p>
          </div>
        ) : (
          filteredNegotiations.map((negotiation) => (
            <div
              key={negotiation._id}
              className="drivemego-negotiation-negotiation-card"
            >
              <div className="drivemego-negotiation-card-header">
                <div className="drivemego-negotiation-card-title">
                  <span className="drivemego-negotiation-negotiation-number">
                    #{negotiation.negotiationNumber}
                  </span>
                  {getStatusBadge(negotiation.status)}
                </div>
                <span className="drivemego-negotiation-card-date">
                  <Calendar size={14} />
                  {formatDate(negotiation.createdAt)}
                </span>
              </div>

              <div className="drivemego-negotiation-card-parties">
                <div className="drivemego-negotiation-party corporate">
                  <Building2 size={18} />
                  <div className="drivemego-negotiation-party-info">
                    <span className="drivemego-negotiation-party-label">
                      Corporate
                    </span>
                    <span className="drivemego-negotiation-party-name">
                      {negotiation.corporateId?.fullName || "N/A"}
                    </span>
                    <span className="drivemego-negotiation-party-company">
                      {negotiation.corporateId?.companyName || ""}
                    </span>
                  </div>
                </div>
                <div className="drivemego-negotiation-party-arrow">
                  <ArrowRight size={20} />
                </div>
                <div className="drivemego-negotiation-party b2b">
                  <Truck size={18} />
                  <div className="drivemego-negotiation-party-info">
                    <span className="drivemego-negotiation-party-label">
                      B2B Partner
                    </span>
                    <span className="drivemego-negotiation-party-name">
                      {negotiation.b2bPartnerId?.fullName || "N/A"}
                    </span>
                    <span className="drivemego-negotiation-party-company">
                      {negotiation.b2bPartnerId?.companyName || ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="drivemego-negotiation-card-prices">
                <div className="drivemego-negotiation-price-item">
                  <span className="drivemego-negotiation-price-label">
                    Original Price
                  </span>
                  <span className="drivemego-negotiation-price-value original">
                    {formatCurrency(
                      negotiation.originalPrice,
                      negotiation.currency,
                    )}
                  </span>
                </div>
                {/* Show latest proposed price from admin actions or negotiated price */}
                <div className="drivemego-negotiation-price-item">
                  <span className="drivemego-negotiation-price-label">
                    {negotiation.status === "COMPLETED"
                      ? "Final Price"
                      : "Current Proposed"}
                  </span>
                  <span className="drivemego-negotiation-price-value negotiated">
                    {formatCurrency(
                      getLatestProposedPrice(negotiation),
                      negotiation.currency,
                    )}
                  </span>
                </div>
                {negotiation.originalPrice >
                  getLatestProposedPrice(negotiation) && (
                  <div className="drivemego-negotiation-price-item drivemego-negotiation-savings">
                    <span className="drivemego-negotiation-price-label">
                      Potential Savings
                    </span>
                    <span className="drivemego-negotiation-price-value">
                      {formatCurrency(
                        negotiation.originalPrice -
                          getLatestProposedPrice(negotiation),
                        negotiation.currency,
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="drivemego-negotiation-card-footer">
                <div className="drivemego-negotiation-quotation-ref">
                  <FileText size={14} />
                  Quotation: {negotiation.quotationId?.quotationNumber || "N/A"}
                </div>
                <button
                  className="drivemego-negotiation-view-btn"
                  onClick={() => handleViewNegotiation(negotiation)}
                >
                  <Eye size={16} />
                  View Details
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedNegotiation && (
        <div
          className="drivemego-negotiation-negotiation-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="drivemego-negotiation-negotiation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-negotiation-modal-header">
              <div className="drivemego-negotiation-modal-title">
                <h2>Negotiation #{selectedNegotiation.negotiationNumber}</h2>
                {getStatusBadge(selectedNegotiation.status)}
              </div>
              <button
                className="drivemego-negotiation-close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drivemego-negotiation-modal-body">
              {/* Parties Info */}
              <div className="drivemego-negotiation-modal-section">
                <h3>Parties Involved</h3>
                <div className="drivemego-negotiation-parties-grid">
                  <div className="drivemego-negotiation-party-card">
                    <div className="drivemego-negotiation-party-icon drivemego-negotiation-corporate">
                      <Building2 size={24} />
                    </div>
                    <div className="drivemego-negotiation-party-details">
                      <span className="drivemego-negotiation-party-type">
                        Corporate User
                      </span>
                      <span className="drivemego-negotiation-party-name">
                        {selectedNegotiation.corporateId?.fullName}
                      </span>
                      <span className="drivemego-negotiation-party-company">
                        {selectedNegotiation.corporateId?.companyName}
                      </span>
                      <span className="drivemego-negotiation-party-email">
                        {selectedNegotiation.corporateId?.email}
                      </span>
                    </div>
                  </div>
                  <div className="drivemego-negotiation-party-card">
                    <div className="drivemego-negotiation-party-icon drivemego-negotiation-b2b">
                      <Truck size={24} />
                    </div>
                    <div className="drivemego-negotiation-party-details">
                      <span className="drivemego-negotiation-party-type">
                        B2B Partner
                      </span>
                      <span className="drivemego-negotiation-party-name">
                        {selectedNegotiation.b2bPartnerId?.fullName}
                      </span>
                      <span className="party-company">
                        {selectedNegotiation.b2bPartnerId?.companyName}
                      </span>
                      <span className="drivemego-negotiation-party-email">
                        {selectedNegotiation.b2bPartnerId?.email}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Info */}
              <div className="drivemego-negotiation-modal-section">
                <h3>Price Information</h3>
                <div className="drivemego-negotiation-price-info-grid">
                  <div className="drivemego-negotiation-price-box">
                    <span className="drivemego-negotiation-price-label">
                      Original Price
                    </span>
                    <span className="drivemego-negotiation-price-amount drivemego-negotiation-original">
                      {formatCurrency(
                        selectedNegotiation.originalPrice,
                        selectedNegotiation.currency,
                      )}
                    </span>
                  </div>
                  {selectedNegotiation.corporateRequest?.expectedPrice && (
                    <div className="drivemego-negotiation-price-box">
                      <span className="drivemego-negotiation-price-label">
                        Expected Price
                      </span>
                      <span className="drivemego-negotiation-price-amount drivemego-negotiation-expected">
                        {formatCurrency(
                          selectedNegotiation.corporateRequest.expectedPrice,
                          selectedNegotiation.currency,
                        )}
                      </span>
                    </div>
                  )}
                  {selectedNegotiation.negotiatedPrice && (
                    <div className="drivemego-negotiation-price-box">
                      <span className="drivemego-negotiation-price-label">
                        Current Negotiated
                      </span>
                      <span className="drivemego-negotiation-price-amount drivemego-negotiation-negotiated">
                        {formatCurrency(
                          selectedNegotiation.negotiatedPrice,
                          selectedNegotiation.currency,
                        )}
                      </span>
                    </div>
                  )}
                  {selectedNegotiation.priceSaved > 0 && (
                    <div className="drivemego-negotiation-price-box drivemego-negotiation-savings">
                      <span className="drivemego-negotiation-price-label">
                        Total Savings
                      </span>
                      <span className="drivemego-negotiation-price-amount">
                        {formatCurrency(
                          selectedNegotiation.priceSaved,
                          selectedNegotiation.currency,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Corporate Request */}
              {selectedNegotiation.corporateRequest?.message && (
                <div className="drivemego-negotiation-modal-section">
                  <h3>Corporate Request</h3>
                  <div className="drivemego-negotiation-request-message">
                    <p>{selectedNegotiation.corporateRequest.message}</p>
                    <span className="drivemego-negotiation-request-date">
                      Requested on{" "}
                      {formatDate(
                        selectedNegotiation.corporateRequest.requestedAt,
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div className="drivemego-negotiation-modal-section">
                <h3>Activity Timeline</h3>
                <div className="drivemego-negotiation-timeline">
                  {selectedNegotiation.adminActions?.length > 0 ? (
                    selectedNegotiation.adminActions.map((action, index) => (
                      <div
                        key={index}
                        className="drivemego-negotiation-timeline-item admin"
                      >
                        <div className="drivemego-negotiation-timeline-marker"></div>
                        <div className="drivemego-negotiation-timeline-content">
                          <span className="drivemego-negotiation-timeline-action">
                            Admin: {action.action}
                          </span>
                          {action.message && (
                            <p className="drivemego-negotiation-timeline-message">
                              {action.message}
                            </p>
                          )}
                          {action.proposedPrice && (
                            <span className="drivemego-negotiation-timeline-price">
                              Proposed:{" "}
                              {formatCurrency(
                                action.proposedPrice,
                                selectedNegotiation.currency,
                              )}
                            </span>
                          )}
                          <span className="drivemego-negotiation-timeline-date">
                            {formatDate(action.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="drivemego-negotiation-no-activity">
                      No admin actions yet
                    </div>
                  )}

                  {selectedNegotiation.b2bPartnerResponses &&
                  selectedNegotiation.b2bPartnerResponses.length > 0
                    ? selectedNegotiation.b2bPartnerResponses.map(
                        (response, index) => (
                          <div
                            key={`b2b-${index}`}
                            className="drivemego-negotiation-timeline-item drivemego-negotiation-b2b"
                          >
                            <div className="drivemego-negotiation-timeline-marker"></div>
                            <div className="drivemego-negotiation-timeline-content">
                              <span className="drivemego-negotiation-timeline-action">
                                B2B Partner: {response.response}
                              </span>
                              {response.message && (
                                <p className="drivemego-negotiation-timeline-message">
                                  {response.message}
                                </p>
                              )}
                              {response.counterPrice && (
                                <span className="drivemego-negotiation-timeline-price">
                                  Counter:{" "}
                                  {formatCurrency(
                                    response.counterPrice,
                                    selectedNegotiation.currency,
                                  )}
                                </span>
                              )}
                              <span className="drivemego-negotiation-timeline-date">
                                {formatDate(response.timestamp)}
                              </span>
                            </div>
                          </div>
                        ),
                      )
                    : null}
                </div>
              </div>

              {/* Admin Action Form - Only show for active negotiations */}
              {["REQUESTED", "IN_PROGRESS"].includes(
                selectedNegotiation.status,
              ) && (
                <div className="drivemego-negotiation-modal-section drivemego-negotiation-action-section">
                  <h3>Take Action</h3>
                  <div className="drivemego-negotiation-action-form">
                    <div className="drivemego-negotiation-form-row">
                      <div className="drivemego-negotiation-form-group">
                        <label>Action Type</label>
                        <select
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value)}
                        >
                          <option value="SENT_MESSAGE">Send Message</option>
                          <option value="SENT_OFFER">
                            Send Price Offer to B2B
                          </option>
                          <option value="STARTED">Start Negotiation</option>
                        </select>
                      </div>
                      {actionType === "SENT_OFFER" && (
                        <div className="drivemego-negotiation-form-group">
                          <label>
                            Proposed Price ({selectedNegotiation.currency})
                          </label>
                          <input
                            type="number"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                            placeholder="Enter proposed price"
                          />
                        </div>
                      )}
                    </div>
                    <div className="drivemego-negotiation-form-group">
                      <label>Message</label>
                      <textarea
                        value={actionMessage}
                        onChange={(e) => setActionMessage(e.target.value)}
                        placeholder="Enter message for B2B Partner..."
                        rows={3}
                      />
                    </div>
                    <button
                      className="drivemego-negotiation-action-btn drivemego-negotiation-primary"
                      onClick={handleAdminAction}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <RefreshCw
                          size={16}
                          className="drivemego-negotiation-spinning"
                        />
                      ) : (
                        <Send size={16} />
                      )}
                      Send Action
                    </button>
                  </div>

                  {/* Complete Negotiation Section */}
                  <div className="drivemego-negotiation-complete-section">
                    <h4>Complete Negotiation</h4>
                    <p>
                      When B2B Partner agrees, complete the negotiation to
                      update the quotation price.
                    </p>
                    <div className="drivemego-negotiation-form-row">
                      <div className="drivemego-negotiation-form-group">
                        <label>
                          Final Price ({selectedNegotiation.currency})
                        </label>
                        <input
                          type="number"
                          value={proposedPrice}
                          onChange={(e) => setProposedPrice(e.target.value)}
                          placeholder="Final negotiated price"
                        />
                      </div>
                      <div className="drivemego-negotiation-form-group">
                        <label>Commission from Corporate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={corporateCommissionRate}
                          onChange={(e) => {
                            setCorporateCommissionRate(e.target.value);
                            setCommissionRateSource("admin_override");
                          }}
                          placeholder="Commission rate"
                        />
                        <span className="drivemego-negotiation-form-hint">
                          {commissionRateSource === "custom_rule" && (
                            <>
                              Using the Corporate&apos;s active custom
                              negotiation rule rate. You can rewrite it below.
                              <br />
                            </>
                          )}
                          {commissionRateSource === "configured" && (
                            <>
                              Using the Corporate&apos;s configured negotiation
                              commission rate. You can rewrite it below.
                              <br />
                            </>
                          )}
                          {commissionRateSource === "default" && (
                            <>
                              No custom rate set for this Corporate &mdash;
                              using the default rate. You can rewrite it below.
                              <br />
                            </>
                          )}
                          You will earn{" "}
                          {formatCurrency(
                            ((selectedNegotiation.originalPrice -
                              parseFloat(proposedPrice || 0)) *
                              parseFloat(corporateCommissionRate || 0)) /
                              100,
                            selectedNegotiation.currency,
                          )}{" "}
                          commission from savings
                        </span>
                      </div>
                    </div>
                    <div className="drivemego-negotiation-complete-actions">
                      <button
                        className="drivemego-negotiation-action-btn drivemego-negotiation-success"
                        onClick={handleCompleteNegotiation}
                        disabled={actionLoading || !proposedPrice}
                      >
                        <CheckCircle size={16} />
                        Complete & Update Quotation
                      </button>
                      <button
                        className="drivemego-negotiation-action-btn drivemego-negotiation-danger"
                        onClick={handleCancelNegotiation}
                        disabled={actionLoading}
                      >
                        <XCircle size={16} />
                        Cancel Negotiation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Commission Info for Completed */}
              {selectedNegotiation.status === "COMPLETED" &&
                selectedNegotiation.adminCommissionFromCorporate && (
                  <div className="drivemego-negotiation-modal-section drivemego-negotiation-commission-section">
                    <h3>Commission Details</h3>
                    <div className="drivemego-negotiation-commission-info">
                      <div className="drivemego-negotiation-commission-item">
                        <Percent size={18} />
                        <span className="drivemego-negotiation-commission-label">
                          Commission Rate
                        </span>
                        <span className="drivemego-negotiation-commission-value">
                          {
                            selectedNegotiation.adminCommissionFromCorporate
                              .rate
                          }
                          %
                        </span>
                      </div>
                      <div className="drivemego-negotiation-commission-item">
                        <DollarSign size={18} />
                        <span className="drivemego-negotiation-commission-label">
                          Commission Amount
                        </span>
                        <span className="drivemego-negotiation-commission-value">
                          {formatCurrency(
                            selectedNegotiation.adminCommissionFromCorporate
                              .amount,
                            selectedNegotiation.currency,
                          )}
                        </span>
                      </div>
                      <div className="drivemego-negotiation-commission-item">
                        <CheckCircle size={18} />
                        <span className="drivemego-negotiation-commission-label">
                          Status
                        </span>
                        <span
                          className={`drivemego-negotiation-commission-status ${selectedNegotiation.adminCommissionFromCorporate.status?.toLowerCase()}`}
                        >
                          {
                            selectedNegotiation.adminCommissionFromCorporate
                              .status
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="drivemego-negotiation-modal-footer">
              <button
                className="drivemego-negotiation-btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNegotiations;
