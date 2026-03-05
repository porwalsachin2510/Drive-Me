import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import QuotationCard from "../../../Components/QuotationCard/QuotationCard";
import "./MyQuotations.css";

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
          }
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
    [filters]
  );

  useEffect(() => {
    fetchQuotations(false);
  }, [fetchQuotations]);

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      fetchQuotations(true);
    }, 5000);
    return () => clearInterval(pollingInterval);
  }, [fetchQuotations]);

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
      <div className="my-quotations-container" style={{ padding: "24px" }}>
        <div className="quotations-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading quotations...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-quotations-container" style={{ padding: "24px" }}>
        <div className="quotations-error">
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
    <div className="my-quotations-container" style={{ padding: "0" }}>
      <div className="quotations-header">
        <h1>My Quotations</h1>
        <div className="filter-tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => handleFilterChange("all")}>
            All ({getStatusCount("all")})
          </button>
          <button className={filter === "pending" ? "active" : ""} onClick={() => handleFilterChange("pending")}>
            Pending ({getStatusCount("pending")})
          </button>
          <button className={filter === "responded" ? "active" : ""} onClick={() => handleFilterChange("responded")}>
            Responded ({getStatusCount("responded")})
          </button>
          <button className={filter === "accepted" ? "active" : ""} onClick={() => handleFilterChange("accepted")}>
            Accepted ({getStatusCount("accepted")})
          </button>
          <button className={filter === "rejected" ? "active" : ""} onClick={() => handleFilterChange("rejected")}>
            Rejected ({getStatusCount("rejected")})
          </button>
        </div>
      </div>

      {summary && (
        <div className="quotations-summary">
          <div className="summary-card">
            <div className="summary-content">
              <span className="summary-label">Total Quotations</span>
              <span className="summary-value">{summary.total || 0}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-content">
              <span className="summary-label">Pending</span>
              <span className="summary-value">{summary.requested || 0}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-content">
              <span className="summary-label">Accepted</span>
              <span className="summary-value">{summary.accepted || 0}</span>
            </div>
          </div>
        </div>
      )}

      <div className="quotations-grid">
        {quotations.length === 0 ? (
          <div className="no-quotations">
            <h3>No quotations found</h3>
            <p>
              {filter === "all"
                ? "Start by searching for vehicles and requesting quotations"
                : `No ${filter} quotations at the moment`}
            </p>
          </div>
        ) : (
          quotations.map((quotation) => (
            <QuotationCard key={quotation._id} quotation={quotation} />
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page === 1}
          >
            Previous
          </button>
          <div className="pagination-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <button
            className="pagination-btn"
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
