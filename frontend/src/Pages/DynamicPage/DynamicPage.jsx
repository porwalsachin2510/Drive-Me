import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import api from "../../utils/api";
import Navbar from "../../Components/Navbar/Navbar";
import Footer from "../../Components/Footer/Footer";
import "./DynamicPage.css";

function DynamicPage() {
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine slug from params or pathname
  const getSlug = () => {
    if (paramSlug) return paramSlug;
    // Extract slug from path like /terms-and-conditions
    const pathSlug = location.pathname.replace("/", "");
    return pathSlug;
  };

  const currentSlug = getSlug();

  useEffect(() => {
    if (currentSlug) {
      fetchPage();
    }
  }, [currentSlug]);

  const fetchPage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/pages/public/${currentSlug}`);
      if (response.data.success) {
        setPage(response.data.data);
      } else {
        setError("Page not found");
      }
    } catch (err) {
      console.error("Error fetching page:", err);
      setError("Page not found or not published");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dynamic-page-wrapper">
        <Navbar />
        <div className="dynamic-page-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="dynamic-page-wrapper">
        <Navbar />
        <div className="dynamic-page-container">
          <div className="page-not-found">
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>
              The page you are looking for does not exist or has not been
              published yet.
            </p>
            <Link to="/" className="back-home-btn">
              Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Get page type icon based on slug
  const getPageIcon = () => {
    switch (currentSlug) {
      case "privacy-policy":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case "terms-and-conditions":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case "refund-policy":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        );
      case "contact-us":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.32 1.62.56 2.41a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.79.24 1.6.43 2.41.56A2 2 0 0 1 22 16.92z" />
          </svg>
        );
      default:
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  const getPageTypeName = () => {
    switch (currentSlug) {
      case "privacy-policy":
        return "Privacy Policy";
      case "terms-and-conditions":
        return "Legal Document";
      case "refund-policy":
        return "Policy Document";
      case "contact-us":
        return "Contact Information";
      default:
        return "Information";
    }
  };

  return (
    <div className="dynamic-page-wrapper">
      <Navbar />
      <div className="dynamic-page-container">
        <article className="dynamic-page-content">
          <header className="page-header">
            <div className="page-header-content">
              <span className="page-type-badge">
                {getPageIcon()}
                {getPageTypeName()}
              </span>
              <h1>{page.title}</h1>
              {page.updatedAt && (
                <p className="last-updated">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Last updated:{" "}
                  {new Date(page.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </header>
          <div
            className="page-body"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
          <footer className="page-footer">
            <div className="page-footer-info">
              <span>Have questions about this policy?</span>
            </div>
            <div className="page-footer-actions">
              <Link to="/contact-us" className="page-action-btn">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Contact Us
              </Link>
              <Link to="/" className="page-action-btn">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Back to Home
              </Link>
            </div>
          </footer>
        </article>
      </div>
      <Footer />
    </div>
  );
}

export default DynamicPage;
