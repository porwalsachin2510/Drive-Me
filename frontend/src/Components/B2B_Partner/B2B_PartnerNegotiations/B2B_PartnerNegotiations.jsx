import { getActiveCurrency } from "../../../config/localeConfig";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { SocketContext } from "../../../context/SocketContext";
import api from "../../../utils/api";
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
  Eye,
  RefreshCw,
  ChevronRight,
  FileText,
  Calendar,
  ArrowRight,
  Percent,
} from "lucide-react";
import { handleB2BResponse } from "../../../services/adminAPI";
import "./B2B_PartnerNegotiations.css";

const B2B_PartnerNegotiations = () => {
  const [searchParams] = useSearchParams();
  const negotiationIdFromUrl = searchParams.get("id");
  const { socket } = useContext(SocketContext) || {};
  const { user } = useSelector((state) => state.auth);
  const [negotiations, setNegotiations] = useState([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [counterPrice, setCounterPrice] = useState("");
  const [responseType, setResponseType] = useState("ACCEPTED"); // ACCEPTED, REJECTED, or COUNTER_OFFERED
  const [responseLoading, setResponseLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    rejected: 0,
    totalSavings: 0,
  });

  const calculateStats = (negotiationsList) => {
    if (!negotiationsList || !Array.isArray(negotiationsList)) {
      return {
        total: 0,
        pending: 0,
        completed: 0,
        rejected: 0,
        totalSavings: 0,
      };
    }

    const statsData = {
      total: negotiationsList.length,
      pending: negotiationsList.filter(
        (n) => n.status === "REQUESTED" || n.status === "IN_PROGRESS",
      ).length,
      completed: negotiationsList.filter((n) => n.status === "COMPLETED")
        .length,
      rejected: negotiationsList.filter(
        (n) => n.status === "FAILED" || n.status === "CANCELLED",
      ).length,
      totalSavings: negotiationsList
        .filter((n) => n.status === "COMPLETED")
        .reduce((sum, n) => sum + (n.priceSaved || 0), 0),
    };
    setStats(statsData);
  };

  const fetchNegotiations = useCallback(async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      // Get B2B Partner's negotiations using the correct endpoint
      const response = await api.get("/partner-negotiations");

      if (response.data.success) {
        console.log(response.data.data.negotiations);
        const negList = response.data.data.negotiations || [];
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
  }, []);

  useEffect(() => {
    fetchNegotiations();
  }, [fetchNegotiations]);

  // Listen for real-time negotiation updates
  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleNegotiationUpdate = (data) => {
      console.log("[v0] B2B Partner received negotiation update:", data);
      // Refresh negotiations when we receive an update
      fetchNegotiations();
      // Show a message
      setMessage({
        type: "info",
        text: data.message || "New negotiation update received",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    // Dedicated live-update event fired by the backend on EVERY negotiation
    // mutation. Refresh quietly (no banner) so the open modal updates in real
    // time via the modal-sync effect below.
    const handleLiveUpdate = (data) => {
      console.log("[v0] B2B Partner received negotiation_updated:", data);
      fetchNegotiations();
    };

    // Listen for negotiation-related events
    socket.on("negotiation_updated", handleLiveUpdate);
    socket.on("negotiation_offer", handleNegotiationUpdate);
    socket.on("negotiation_started", handleNegotiationUpdate);
    socket.on("negotiation_message", handleNegotiationUpdate);
    socket.on("negotiation_completed", handleNegotiationUpdate);
    socket.on("new-notification", (notification) => {
      if (notification.type?.includes("NEGOTIATION")) {
        handleNegotiationUpdate(notification);
      }
    });

    return () => {
      socket.off("negotiation_updated", handleLiveUpdate);
      socket.off("negotiation_offer", handleNegotiationUpdate);
      socket.off("negotiation_started", handleNegotiationUpdate);
      socket.off("negotiation_message", handleNegotiationUpdate);
      socket.off("negotiation_completed", handleNegotiationUpdate);
    };
  }, [socket, user?._id, fetchNegotiations]);

  // Keep the OPEN modal's negotiation in sync with the freshly fetched list, so
  // real-time socket refreshes update the timeline/prices live without the B2B
  // Partner having to close and reopen the modal.
  useEffect(() => {
    if (!showModal || !selectedNegotiation?._id) return;
    const fresh = negotiations.find((n) => n._id === selectedNegotiation._id);
    if (fresh && fresh !== selectedNegotiation) {
      setSelectedNegotiation((prev) => ({ ...prev, ...fresh }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negotiations]);

  // Auto-open negotiation if id is in URL
  useEffect(() => {
    if (negotiationIdFromUrl && negotiations.length > 0) {
      const negotiation = negotiations.find(
        (n) => n._id === negotiationIdFromUrl,
      );
      if (negotiation) {
        handleViewNegotiation(negotiation);
      }
    }
  }, [negotiationIdFromUrl, negotiations]);

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

  const handleViewNegotiation = (negotiation) => {
    setSelectedNegotiation(negotiation);
    setShowModal(true);
    setResponseMessage("");
    // Set counter price to the latest admin proposed price
    const latestPrice = getLatestProposedPrice(negotiation);
    setCounterPrice(latestPrice);
    setResponseType("ACCEPTED");
  };

  const formatCurrency = (amount, currency = getActiveCurrency()) => {
    return `${currency} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      REQUESTED: "#FFA500",
      IN_PROGRESS: "#3B82F6",
      COMPLETED: "#10B981",
      FAILED: "#EF4444",
      CANCELLED: "#6B7280",
    };
    return colors[status] || "#9CA3AF";
  };

  const getStatusLabel = (status) => {
    const labels = {
      REQUESTED: "Requested",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    };
    return labels[status] || status;
  };

  const handleB2BPartnerResponse = async () => {
    if (!selectedNegotiation || !responseMessage) {
      setMessage({ type: "error", text: "Please provide a response message" });
      return;
    }

    try {
      setResponseLoading(true);

      // Map UI response types to backend expected values
      // Backend expects: ACCEPTED, REJECTED, COUNTER_OFFERED
      let backendResponse = responseType;

      // If rejecting with a counter price, it's a counter offer
      if (responseType === "COUNTER_OFFERED" && counterPrice) {
        backendResponse = "COUNTER_OFFERED";
      }

      const responseData = {
        response: backendResponse,
        message: responseMessage,
      };

      // Add counter price for counter offers
      if (responseType === "COUNTER_OFFERED" && counterPrice) {
        responseData.counterPrice = parseFloat(counterPrice);
      }

      const response = await handleB2BResponse(
        selectedNegotiation._id,
        responseData,
      );

      if (response.success) {
        setMessage({
          type: "success",
          text: "Your response has been sent to Admin",
        });
        setShowModal(false);
        fetchNegotiations();
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      }
    } catch (error) {
      console.error("Error sending response:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          error.message ||
          "Failed to send response",
      });
    } finally {
      setResponseLoading(false);
    }
  };

  const canRespond = (negotiation) => {
    return (
      negotiation.status === "REQUESTED" || negotiation.status === "IN_PROGRESS"
    );
  };

  if (loading) {
    return (
      <div className="b2b-negotiations-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading negotiations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="b2b-negotiations-container">
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: "", text: "" })}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Negotiations</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending Response</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon completed">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon savings">
            <TrendingDown size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {getActiveCurrency()} {stats.totalSavings.toFixed(0)}
            </div>
            <div className="stat-label">Corporate Savings</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="search-filter-section">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search negotiation number or corporate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-dropdown">
          <Filter size={18} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="REQUESTED">Requested</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <button
          className="refresh-btn"
          onClick={fetchNegotiations}
          disabled={loading}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Negotiations List */}
      <div className="negotiations-list">
        {filteredNegotiations.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No Negotiations Found</h3>
            <p>You don&apos;t have any negotiations yet.</p>
          </div>
        ) : (
          filteredNegotiations.map((negotiation) => (
            <div key={negotiation._id} className="negotiation-card">
              <div className="negotiation-header">
                <div className="negotiation-title">
                  <h3>{negotiation.negotiationNumber}</h3>
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(negotiation.status),
                    }}
                  >
                    {getStatusLabel(negotiation.status)}
                  </span>
                </div>
                <div className="negotiation-meta">
                  <span className="date">
                    <Calendar size={14} /> {formatDate(negotiation.createdAt)}
                  </span>
                </div>
              </div>

              <div className="negotiation-body">
                <div className="party-info">
                  <div className="party">
                    <Building2 size={18} />
                    <div>
                      <label>Corporate</label>
                      <p>{negotiation.corporateId?.companyName}</p>
                    </div>
                  </div>
                </div>

                <div className="price-info">
                  <div className="price-item">
                    <label>Original Price</label>
                    <p className="original">
                      {formatCurrency(
                        negotiation.originalPrice,
                        negotiation.currency,
                      )}
                    </p>
                  </div>
                  <ArrowRight size={16} />
                  <div className="price-item">
                    <label>Proposed Price</label>
                    <p className="proposed">
                      {formatCurrency(
                        getLatestProposedPrice(negotiation),
                        negotiation.currency,
                      )}
                    </p>
                  </div>
                  <div className="price-item">
                    <label>Savings</label>
                    <p className="savings">
                      {formatCurrency(
                        negotiation.originalPrice -
                          getLatestProposedPrice(negotiation),
                        negotiation.currency,
                      )}
                    </p>
                  </div>
                </div>

                {/* <div className="negotiation-message">
                  <MessageSquare size={14} />
                  <p>
                    {negotiation.corporateRequest ||
                      "No specific request provided"}
                  </p>
                </div> */}

                <div className="negotiation-message">
                  <MessageSquare size={14} />

                  <div className="request-content">
                    <p>
                      {negotiation.corporateRequest?.message ||
                        "No specific request provided"}
                    </p>

                    {negotiation.corporateRequest?.expectedPrice && (
                      <small>
                        Expected Price:{" "}
                        {formatCurrency(
                          negotiation.corporateRequest.expectedPrice,
                          negotiation.currency,
                        )}
                      </small>
                    )}

                    {negotiation.corporateRequest?.requestedAt && (
                      <small>
                        Requested On:{" "}
                        {formatDate(negotiation.corporateRequest.requestedAt)}
                      </small>
                    )}
                  </div>
                </div>
              </div>

              <div className="negotiation-footer">
                {canRespond(negotiation) && (
                  <button
                    className="btn-respond"
                    onClick={() => handleViewNegotiation(negotiation)}
                  >
                    <Send size={16} /> Respond Now
                  </button>
                )}
                <button
                  className="btn-view"
                  onClick={() => handleViewNegotiation(negotiation)}
                >
                  <Eye size={16} /> View Details
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Response Modal */}
      {showModal && selectedNegotiation && (
        <div
          className="drivemego-negotiations-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="drivemego-negotiations-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drivemego-negotiations-modal-header">
              <h2>Respond to Negotiation</h2>
              <button onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="drivemego-negotiations-modal-body">
              <div className="drivemego-negotiations-negotiation-details">
                <div className="drivemego-negotiations-detail-row">
                  <span>Negotiation #:</span>
                  <strong>{selectedNegotiation.negotiationNumber}</strong>
                </div>
                <div className="drivemego-negotiations-detail-row">
                  <span>Corporate:</span>
                  <strong>
                    {selectedNegotiation.corporateId?.companyName}
                  </strong>
                </div>
                <div className="drivemego-negotiations-detail-row">
                  <span>Original Price:</span>
                  <strong>
                    {formatCurrency(selectedNegotiation.originalPrice)}
                  </strong>
                </div>
                <div className="drivemego-negotiations-detail-row">
                  <span>Admin Proposed:</span>
                  <strong>
                    {formatCurrency(
                      getLatestProposedPrice(selectedNegotiation),
                      selectedNegotiation.currency,
                    )}
                  </strong>
                </div>
                {/* Show savings */}
                {selectedNegotiation.originalPrice >
                  getLatestProposedPrice(selectedNegotiation) && (
                  <div className="drivemego-negotiations-detail-row drivemego-negotiations-savings-row">
                    <span>Potential Savings:</span>
                    <strong className="drivemego-negotiations-savings-amount">
                      {formatCurrency(
                        selectedNegotiation.originalPrice -
                          getLatestProposedPrice(selectedNegotiation),
                        selectedNegotiation.currency,
                      )}
                    </strong>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              {selectedNegotiation.adminActions?.length > 0 && (
                <div className="drivemego-negotiations-activity-timeline">
                  <h4>Negotiation History</h4>
                  <div className="drivemego-negotiations-timeline-list">
                    {selectedNegotiation.adminActions.map((action, index) => (
                      <div
                        key={index}
                        className="drivemego-negotiations-timeline-item drivemego-negotiations-admin-action"
                      >
                        <div className="drivemego-negotiations-timeline-marker"></div>
                        <div className="drivemego-negotiations-timeline-content">
                          <span className="drivemego-negotiations-timeline-actor">
                            Admin: {action.action.replace(/_/g, " ")}
                          </span>
                          {action.message && (
                            <p className="drivemego-negotiations-timeline-message">
                              {action.message}
                            </p>
                          )}
                          {action.proposedPrice && (
                            <span className="drivemego-negotiations-timeline-price">
                              Proposed:{" "}
                              {formatCurrency(
                                action.proposedPrice,
                                selectedNegotiation.currency,
                              )}
                            </span>
                          )}
                          <span className="drivemego-negotiations-timeline-date">
                            {formatDate(action.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedNegotiation.b2bPartnerResponses?.map(
                      (resp, index) => (
                        <div
                          key={`b2b-${index}`}
                          className="drivemego-negotiations-timeline-item drivemego-negotiations-b2b-response"
                        >
                          <div className="drivemego-negotiations-timeline-marker"></div>
                          <div className="drivemego-negotiations-timeline-content">
                            <span className="drivemego-negotiations-timeline-actor">
                              Your Response: {resp.response.replace(/_/g, " ")}
                            </span>
                            {resp.message && (
                              <p className="drivemego-negotiations-timeline-message">
                                {resp.message}
                              </p>
                            )}
                            {resp.counterPrice && (
                              <span className="drivemego-negotiations-timeline-price">
                                Counter Price:{" "}
                                {formatCurrency(
                                  resp.counterPrice,
                                  selectedNegotiation.currency,
                                )}
                              </span>
                            )}
                            <span className="drivemego-negotiations-timeline-date">
                              {formatDate(resp.timestamp)}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {!canRespond(selectedNegotiation) && (
                <div className="drivemego-negotiations-closed-note">
                  {selectedNegotiation.status === "COMPLETED"
                    ? "This negotiation has been completed. The final price has been applied to the quotation."
                    : `This negotiation is ${getStatusLabel(selectedNegotiation.status)} and can no longer be responded to.`}
                </div>
              )}

              {canRespond(selectedNegotiation) && (
                <div className="drivemego-negotiations-response-section">
                  <div className="drivemego-negotiations-form-group">
                    <label>Your Response</label>
                    <div className="drivemego-negotiations-response-type-selector">
                      <label className="drivemego-negotiations-radio">
                        <input
                          type="radio"
                          value="ACCEPTED"
                          checked={responseType === "ACCEPTED"}
                          onChange={(e) => setResponseType(e.target.value)}
                        />
                        <span className="drivemego-negotiations-agree-label">
                          Accept Price
                        </span>
                      </label>
                      <label className="drivemego-negotiations-radio">
                        <input
                          type="radio"
                          value="COUNTER_OFFERED"
                          checked={responseType === "COUNTER_OFFERED"}
                          onChange={(e) => setResponseType(e.target.value)}
                        />
                        <span className="drivemego-negotiations-reject-label">
                          Reject / Counter Offer
                        </span>
                      </label>
                    </div>
                  </div>

                  {responseType === "ACCEPTED" && (
                    <div className="drivemego-negotiations-form-group">
                      <label>Confirmation Message</label>
                      <textarea
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        placeholder="We accept this price and are ready to proceed..."
                        rows="4"
                      />
                    </div>
                  )}

                  {responseType === "COUNTER_OFFERED" && (
                    <>
                      <div className="drivemego-negotiations-form-group">
                        <label>
                          Counter Price ({selectedNegotiation.currency})
                        </label>
                        <input
                          type="number"
                          value={counterPrice}
                          onChange={(e) => setCounterPrice(e.target.value)}
                          placeholder="Enter your counter price"
                        />
                      </div>
                      <div className="drivemego-negotiations-form-group">
                        <label>Message / Reason</label>
                        <textarea
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Explain why you cannot accept this price..."
                          rows="4"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="drivemego-negotiations-modal-footer">
              <button
                className="drivemego-negotiations-btn-cancel"
                onClick={() => setShowModal(false)}
              >
                {canRespond(selectedNegotiation) ? "Cancel" : "Close"}
              </button>
              {canRespond(selectedNegotiation) && (
                <button
                  className="drivemego-negotiations-btn-submit"
                  onClick={handleB2BPartnerResponse}
                  disabled={responseLoading || !responseMessage}
                >
                  {responseLoading ? "Sending..." : "Send Response"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2B_PartnerNegotiations;
