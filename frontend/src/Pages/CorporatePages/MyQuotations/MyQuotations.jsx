import { useState, useEffect, useCallback } from "react";
import api from "../../../utils/api";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import QuotationCard from "../../../Components/QuotationCard/QuotationCard";
import "./MyQuotations.css";

const MyQuotations = () => {
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
  const [activeTab, setActiveTab] = useState("commuters");

  // Fetch quotations
  // const fetchQuotations = async () => {
  //   try {
  //     setLoading(true);
  //     setError(null);

  //     // Build query string
  //     const params = new URLSearchParams();
  //     if (filters.status) params.append("status", filters.status);
  //     params.append("page", filters.page);
  //     params.append("limit", filters.limit);

  //     const response = await api.post(
  //       `/quotations/getcorporateownerquotations?${params}`,
  //       {},
  //       {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem("token")}`,
  //         },
  //         withCredentials: true,
  //       },
  //     );

  //     if (response.data.success) {
  //       setQuotations(response.data.data.quotations || []);
  //       setPagination(response.data.data.pagination);
  //       setSummary(response.data.data.summary);
  //     }
  //   } catch (err) {
  //     setError(err.response?.data?.message || "Failed to fetch quotations");
  //     console.error("Error fetching quotations:", err);
  //     setQuotations([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   fetchQuotations();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [filters]);

  // Fetch quotations
  const fetchQuotations = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) {
          setInitialLoading(true); // sirf first load
        }
        setError(null);

        // Build query string
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
        if (!isSilent) {
          setInitialLoading(false);
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchQuotations(false);
  }, [fetchQuotations]);

  // Poll quotations every 1000ms
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      fetchQuotations(true);
    }, 1000);

    return () => clearInterval(pollingInterval);
  }, [fetchQuotations]);

  // Handle filter change
  const handleFilterChange = (filterValue) => {
    setFilter(filterValue);

    // Map filter to status for API
    const statusMap = {
      all: "",
      pending: "REQUESTED",
      responded: "QUOTED",
      accepted: "ACCEPTED",
      rejected: "REJECTED",
    };

    setFilters({
      ...filters,
      status: statusMap[filterValue] || "",
      page: 1, // Reset to first page
    });
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setFilters({
      ...filters,
      page: newPage,
    });
  };

  // Get count for each status from summary
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
        <div className="my-quotations-container">
          <div className="quotations-loading">
            <div className="loading-spinner"></div>
            <div className="loading-text">Loading quotations...</div>
          </div>
        </div>
      );
    }
  if (error) {
    return (
      <div className="my-quotations-container">
        <div className="quotations-error">
          <i className="fas fa-exclamation-circle"></i>
          <h3>Error Loading Quotations</h3>
          <p>{error}</p>
          <button onClick={fetchQuotations} className="retry-btn">
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="my-quotations-container">
        <div className="quotations-header">
          <h1>My Quotations</h1>
          <div className="filter-tabs">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => handleFilterChange("all")}
            >
              All ({getStatusCount("all")})
            </button>
            <button
              className={filter === "pending" ? "active" : ""}
              onClick={() => handleFilterChange("pending")}
            >
              Pending ({getStatusCount("pending")})
            </button>
            <button
              className={filter === "responded" ? "active" : ""}
              onClick={() => handleFilterChange("responded")}
            >
              Responded ({getStatusCount("responded")})
            </button>
            <button
              className={filter === "accepted" ? "active" : ""}
              onClick={() => handleFilterChange("accepted")}
            >
              Accepted ({getStatusCount("accepted")})
            </button>
            <button
              className={filter === "rejected" ? "active" : ""}
              onClick={() => handleFilterChange("rejected")}
            >
              Rejected ({getStatusCount("rejected")})
            </button>
          </div>
        </div>

        {/* Summary Section */}
        {summary && (
          <div className="quotations-summary">
            <div className="summary-card">
              <i className="fas fa-file-invoice"></i>
              <div className="summary-content">
                <span className="summary-label">Total Quotations</span>
                <span className="summary-value">{summary.total || 0}</span>
              </div>
            </div>
            <div className="summary-card">
              <i className="fas fa-clock"></i>
              <div className="summary-content">
                <span className="summary-label">Pending</span>
                <span className="summary-value">{summary.requested || 0}</span>
              </div>
            </div>
            <div className="summary-card">
              <i className="fas fa-check-circle"></i>
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
              <i className="fas fa-inbox"></i>
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1}
            >
              <i className="fas fa-chevron-left"></i> Previous
            </button>

            <div className="pagination-info">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>

            <button
              className="pagination-btn"
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page === pagination.totalPages}
            >
              Next <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};;;

export default MyQuotations;
