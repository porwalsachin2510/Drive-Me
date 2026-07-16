import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import QuotationCard from "../../../Components/QuotationCard/QuotationCard";
import "./MyQuotations.css";

// Group quotations that belong to the same multi-partner request (they share a
// requestGroupNumber) into a single collapsible block, while leaving standalone
// single-partner quotations rendered on their own. Order is preserved based on
// the first time each group/quotation appears in the list.
const buildQuotationGroups = (quotations) => {
  const groups = [];
  const indexByKey = {};

  quotations.forEach((q) => {
    const groupNumber = q.requestGroupNumber;
    if (groupNumber) {
      if (indexByKey[groupNumber] === undefined) {
        indexByKey[groupNumber] = groups.length;
        groups.push({ isGroup: true, key: groupNumber, items: [] });
      }
      groups[indexByKey[groupNumber]].items.push(q);
    } else {
      groups.push({ isGroup: false, key: q._id, items: [q] });
    }
  });

  return groups;
};

const MyQuotationsContent = () => {
  const [quotations, setQuotations] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState("all");
  const [filters, setFilters] = useState({
    status: "",
    page: 1,
    limit: 10,
  });
  const [pagination, setPagination] = useState(null);

  const fetchQuotations = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setInitialLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filters.status) params.append("status", filters.status);
        params.append("page", filters.page);
        params.append("limit", filters.limit);

        const response = await api.post(
          `/quotations/getcorporateownerquotations?${params}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            withCredentials: true,
          },
        );

        if (response.data.success) {
          setQuotations(response.data.data.quotations || []);
          setPagination(response.data.data.pagination);
          setSummary(response.data.data.summary);
        }
      } catch (err) {
        if (!isSilent) {
          setError(err.response?.data?.message || "Failed to fetch quotations");
        }
        console.error("Error fetching quotations:", err);
      } finally {
        if (!isSilent) setInitialLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchQuotations(false);
  }, [fetchQuotations]);

  // Live auto-refresh: silent background polling that pauses when the tab is
  // hidden, refetches on focus, and reacts instantly to quotation events.
  const refreshQuotations = useCallback(
    ({ silent } = {}) => fetchQuotations(!!silent),
    [fetchQuotations],
  );

  useAutoRefresh(refreshQuotations, {
    interval: 15000,
    socketEvents: ["new-notification"],
    deps: [filters],
  });

  const handleFilterChange = (filterValue) => {
    setFilter(filterValue);
    const statusMap = {
      all: "",
      pending: "REQUESTED",
      responded: "QUOTED",
      accepted: "ACCEPTED",
      rejected: "REJECTED",
    };
    setFilters({ ...filters, status: statusMap[filterValue] || "", page: 1 });
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  const getStatusCount = (status) => {
    if (!summary) return 0;
    const countMap = {
      all: summary.total || 0,
      pending: summary.requested || 0,
      responded: summary.quoted || 0,
      accepted: summary.accepted || 0,
      rejected: summary.rejected || 0,
    };
    return countMap[status] || 0;
  };

  if (initialLoading && quotations.length === 0) {
    return (
      <div
        className="drivemego-corporate-my-quotations-container"
        style={{ padding: "24px" }}
      >
        <div className="drivemego-corporate-quotations-loading">
          <div className="drivemego-corporate-loading-spinner"></div>
          <div className="drivemego-corporate-loading-text">
            Loading quotations...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="drivemego-corporate-my-quotations-container"
        style={{ padding: "24px" }}
      >
        <div className="drivemego-corporate-quotations-error">
          <h3>Error Loading Quotations</h3>
          <p>{error}</p>
          <button onClick={() => fetchQuotations(false)} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="drivemego-corporate-my-quotations-container"
      style={{ padding: "0" }}
    >
      <div className="drivemego-corporate-quotations-header">
        <h1>My Quotations</h1>
        <div className="drivemego-corporate-filter-tabs">
          <button
            className={filter === "all" ? "drivemego-corporate-active" : ""}
            onClick={() => handleFilterChange("all")}
          >
            All ({getStatusCount("all")})
          </button>
          <button
            className={filter === "pending" ? "drivemego-corporate-active" : ""}
            onClick={() => handleFilterChange("pending")}
          >
            Pending ({getStatusCount("pending")})
          </button>
          <button
            className={
              filter === "responded" ? "drivemego-corporate-active" : ""
            }
            onClick={() => handleFilterChange("responded")}
          >
            Responded ({getStatusCount("responded")})
          </button>
          <button
            className={
              filter === "accepted" ? "drivemego-corporate-active" : ""
            }
            onClick={() => handleFilterChange("accepted")}
          >
            Accepted ({getStatusCount("accepted")})
          </button>
          <button
            className={
              filter === "rejected" ? "drivemego-corporate-active" : ""
            }
            onClick={() => handleFilterChange("rejected")}
          >
            Rejected ({getStatusCount("rejected")})
          </button>
        </div>
      </div>

      {summary && (
        <div className="drivemego-corporate-quotations-summary">
          <div className="drivemego-corporate-summary-card">
            <div className="drivemego-corporate-summary-content">
              <span className="drivemego-corporate-summary-label">
                Total Quotations
              </span>
              <span className="drivemego-corporate-summary-value">
                {summary.total || 0}
              </span>
            </div>
          </div>
          <div className="drivemego-corporate-summary-card">
            <div className="drivemego-corporate-summary-content">
              <span className="drivemego-corporate-summary-label">Pending</span>
              <span className="drivemego-corporate-summary-value">
                {summary.requested || 0}
              </span>
            </div>
          </div>
          <div className="drivemego-corporate-summary-card">
            <div className="drivemego-corporate-summary-content">
              <span className="drivemego-corporate-summary-label">
                Accepted
              </span>
              <span className="drivemego-corporate-summary-value">
                {summary.accepted || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="drivemego-corporate-quotations-grid">
        {quotations.length === 0 ? (
          <div className="drivemego-corporate-no-quotations">
            <h3>No quotations found</h3>
            <p>
              {filter === "all"
                ? "Start by searching for vehicles and requesting quotations"
                : `No ${filter} quotations at the moment`}
            </p>
          </div>
        ) : (
          buildQuotationGroups(quotations).map((group) =>
            group.isGroup ? (
              <div
                key={group.key}
                className="drivemego-corporate-quotation-group"
              >
                <div className="drivemego-corporate-quotation-group-header">
                  <span className="drivemego-corporate-quotation-group-badge">
                    Multi-partner request
                  </span>
                  <span className="drivemego-corporate-quotation-group-number">
                    {group.key}
                  </span>
                  <span className="drivemego-corporate-quotation-group-meta">
                    {group.items.length} partner quotation(s)
                  </span>
                </div>
                <div className="drivemego-corporate-quotation-group-items">
                  {group.items.map((quotation) => (
                    <QuotationCard key={quotation._id} quotation={quotation} />
                  ))}
                </div>
              </div>
            ) : (
              <QuotationCard
                key={group.items[0]._id}
                quotation={group.items[0]}
              />
            ),
          )
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="drivemego-corporate-pagination">
          <button
            className="drivemego-corporate-pagination-btn"
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page === 1}
          >
            Previous
          </button>
          <div className="drivemego-corporate-pagination-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <button
            className="drivemego-corporate-pagination-btn"
            onClick={() => handlePageChange(filters.page + 1)}
            disabled={filters.page === pagination.totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default MyQuotationsContent;
