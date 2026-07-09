"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../utils/api";
import "./alreadyrequestedroutes.css";

/**
 * Already Requested Routes
 * ------------------------
 * Rendered at the top of the "Request a Route" modal (and optionally elsewhere).
 * Surfaces the corridors that OTHER commuters — in the viewer's own country —
 * have already requested, so instead of filling the form and creating a
 * duplicate request, the commuter can simply "Show Interest" and join the
 * existing demand. Higher demand = higher chance a partner launches the route.
 *
 * Corridors that a partner has already launched (APPROVED/FULFILLED) are shown
 * as "Available now" so the commuter books them rather than re-requesting.
 *
 * Props:
 *  - layout: "list" (compact, for the modal) | "grid" (cards). Default "list".
 *  - onInterestRegistered: optional callback after demand is joined.
 */
const AlreadyRequestedRoutes = ({ layout = "list", onInterestRegistered }) => {
  const auth = useSelector((state) => state.auth);
  const isCommuter = auth?.user?.role === "COMMUTER";

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type, message }

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/route-requests/most-requested", {
        params: { limit: 12 },
      });
      setRoutes(res.data?.data?.routes || []);
    } catch (error) {
      console.error("Error fetching already requested routes:", error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleShowInterest = async (route) => {
    try {
      setBusyId(route.requestId);
      setFeedback(null);
      const res = await api.post("/route-requests/show-interest", {
        pickupLocation: route.pickupLocation,
        dropoffLocation: route.dropoffLocation,
        preferredTime: route.preferredTime,
        requestType: route.requestType,
        travelDays: route.travelDays,
      });
      setFeedback({
        type: res.data?.launched ? "info" : "success",
        message:
          res.data?.message ||
          "Interest registered! You've joined the demand for this route.",
      });
      // Optimistically mark as joined and bump the distinct-commuter count.
      setRoutes((prev) =>
        prev.map((r) =>
          r.requestId === route.requestId
            ? {
                ...r,
                alreadyRequested: true,
                demandCount: r.alreadyRequested
                  ? r.demandCount
                  : r.demandCount + 1,
              }
            : r,
        ),
      );
      fetchRoutes();
      if (onInterestRegistered) onInterestRegistered();
    } catch (error) {
      console.error("Error showing interest:", error);
      setFeedback({
        type: "error",
        message:
          error.response?.data?.message ||
          "Could not register your interest. Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to show → render nothing (so the modal just shows the form).
  if (!loading && routes.length === 0) return null;

  const renderAction = (route) => {
    if (!isCommuter) {
      return (
        <button
          type="button"
          className="arr-btn arr-btn-muted"
          disabled
          title="Sign in as a commuter to join this route's demand"
        >
          Commuters only
        </button>
      );
    }
    if (route.launched) {
      return (
        <span className="arr-available">
          Available now &mdash; search to book
        </span>
      );
    }
    if (route.alreadyRequested) {
      return (
        <button type="button" className="arr-btn arr-btn-joined" disabled>
          Interest registered
        </button>
      );
    }
    return (
      <button
        type="button"
        className="arr-btn"
        onClick={() => handleShowInterest(route)}
        disabled={busyId === route.requestId}
      >
        {busyId === route.requestId ? "Joining..." : "Show Interest"}
      </button>
    );
  };

  return (
    <section className={`arr arr-${layout}`} aria-labelledby="arr-heading">
      <div className="arr-header">
        <h3 id="arr-heading" className="arr-title">
          Already Requested Routes
        </h3>
        <p className="arr-subtitle">
          Other commuters have already asked for these routes. Show interest to
          add your demand &mdash; no need to create a duplicate request.
        </p>
      </div>

      {feedback && (
        <div
          className={`arr-feedback arr-feedback-${feedback.type}`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="arr-list">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="arr-item arr-item-skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="arr-list">
          {routes.map((route) => (
            <article className="arr-item" key={route.requestId}>
              <div className="arr-item-main">
                <div className="arr-corridor">
                  <span className="arr-loc">{route.pickupLocation}</span>
                  <span className="arr-arrow" aria-hidden="true">
                    &rarr;
                  </span>
                  <span className="arr-loc">{route.dropoffLocation}</span>
                </div>
                <div className="arr-meta">
                  <span className="arr-demand-badge">
                    {route.demandCount}{" "}
                    {route.demandCount === 1 ? "commuter" : "commuters"}
                  </span>
                  <span className="arr-meta-item">
                    {route.preferredTime || "Flexible"}
                  </span>
                  <span className="arr-meta-dot" aria-hidden="true">
                    &bull;
                  </span>
                  <span className="arr-meta-item">
                    {route.requestType || "MONTHLY"}
                  </span>
                  {route.stage === "OPEN" && (
                    <span className="arr-open-badge">Open to partners</span>
                  )}
                </div>
              </div>
              <div className="arr-item-action">{renderAction(route)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default AlreadyRequestedRoutes;
