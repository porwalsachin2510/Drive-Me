"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../utils/api";
import "./mostrequestedroutes.css";

/**
 * Most Requested Routes
 * ---------------------
 * Shown on the commuter search page. Surfaces the corridors that the most
 * commuters (in the viewer's own country) are asking for, so a commuter who
 * wants the same route can simply "Show Interest" and join the existing demand
 * instead of creating a duplicate route request. Higher demand = higher chance
 * a partner opens the route.
 */
const MostRequestedRoutes = ({ onRequestRoute }) => {
  const auth = useSelector((state) => state.auth);
  const isCommuter = auth?.user?.role === "COMMUTER";

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  // Per-corridor busy / joined state keyed by requestId.
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type, message }

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/route-requests/most-requested", {
        params: { limit: 6 },
      });
      setRoutes(res.data?.data?.routes || []);
    } catch (error) {
      console.error("Error fetching most requested routes:", error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleShowInterest = async (route) => {
    if (!auth?.token && !localStorage.getItem("token")) {
      if (onRequestRoute) onRequestRoute();
      return;
    }
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
        type: "success",
        message:
          res.data?.message ||
          "Interest registered! You've joined the demand for this route.",
      });
      // Reflect the new demand locally + refresh counts from the server.
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

  // Only commuters can join demand; hide entirely if there's nothing to show.
  if (!loading && routes.length === 0) return null;

  return (
    <section
      className="most-requested"
      aria-labelledby="most-requested-heading"
    >
      <div className="most-requested-header">
        <div>
          <h2 id="most-requested-heading" className="most-requested-title">
            Most Requested Routes
          </h2>
          <p className="most-requested-subtitle">
            These routes are in high demand near you. Show interest to help get
            them launched sooner &mdash; no need to create a duplicate request.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`most-requested-feedback most-requested-feedback-${feedback.type}`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="most-requested-grid">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="most-requested-card most-requested-card-skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="most-requested-grid">
          {routes.map((route) => (
            <article className="most-requested-card" key={route.requestId}>
              <div className="most-requested-card-top">
                <span className="most-requested-demand-badge">
                  {route.demandCount}{" "}
                  {route.demandCount === 1 ? "commuter" : "commuters"}
                </span>
                {route.status === "OPEN" && (
                  <span className="most-requested-open-badge">
                    Open to partners
                  </span>
                )}
              </div>

              <div className="most-requested-corridor">
                <span className="most-requested-loc">
                  {route.pickupLocation}
                </span>
                <span className="most-requested-arrow" aria-hidden="true">
                  &rarr;
                </span>
                <span className="most-requested-loc">
                  {route.dropoffLocation}
                </span>
              </div>

              <div className="most-requested-meta">
                <span className="most-requested-meta-item">
                  {route.preferredTime || "Flexible"}
                </span>
                <span className="most-requested-meta-dot" aria-hidden="true">
                  &bull;
                </span>
                <span className="most-requested-meta-item">
                  {route.requestType || "MONTHLY"}
                </span>
              </div>

              {isCommuter ? (
                route.alreadyRequested ? (
                  <button
                    type="button"
                    className="most-requested-btn most-requested-btn-joined"
                    disabled
                  >
                    Interest registered
                  </button>
                ) : (
                  <button
                    type="button"
                    className="most-requested-btn"
                    onClick={() => handleShowInterest(route)}
                    disabled={busyId === route.requestId}
                  >
                    {busyId === route.requestId
                      ? "Joining..."
                      : "Show Interest"}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="most-requested-btn most-requested-btn-joined"
                  disabled
                  title="Sign in as a commuter to join this route's demand"
                >
                  Commuters only
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default MostRequestedRoutes;
