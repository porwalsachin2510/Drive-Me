import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../utils/api";
import "./sosalertspanel.css";

// Ops-facing SOS board shared by the corporate owner and the managing B2B
// partner. Lists live safety alerts and lets a responder acknowledge / resolve
// them. Updates in real time via the `sos_alert` socket event.
export default function SOSAlertsPanel({ contractId }) {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    active: 0,
    acknowledged: 0,
    resolvedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const params = contractId ? { contractId } : {};
      const res = await api.get("/sos", { params });
      if (res.data.success) {
        setAlerts(res.data.data.alerts || []);
        setSummary(
          res.data.data.summary || {
            active: 0,
            acknowledged: 0,
            resolvedToday: 0,
          },
        );
      }
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load SOS alerts");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh on any SOS socket event
  useEffect(() => {
    const socket = api.getSocket();
    if (!socket) return;
    socketRef.current = socket;
    const onAlert = () => load();
    socket.on("sos_alert", onAlert);
    return () => socket.off("sos_alert", onAlert);
  }, [load]);

  const acknowledge = async (id) => {
    setBusyId(id);
    try {
      await api.patch(`/sos/${id}/acknowledge`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Could not acknowledge");
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (id) => {
    const note = window.prompt("Resolution notes (what was done):", "");
    if (note === null) return;
    setBusyId(id);
    try {
      await api.patch(`/sos/${id}/resolve`, { resolutionNotes: note });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Could not resolve");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="dmg-sosops-loading">Loading safety alerts...</div>;
  }

  return (
    <div className="dmg-sosops">
      <div className="dmg-sosops-summary">
        <div className="dmg-sosops-stat dmg-sosops-stat-active">
          <span className="dmg-sosops-stat-num">{summary.active}</span>
          <span className="dmg-sosops-stat-label">Active</span>
        </div>
        <div className="dmg-sosops-stat dmg-sosops-stat-ack">
          <span className="dmg-sosops-stat-num">{summary.acknowledged}</span>
          <span className="dmg-sosops-stat-label">Acknowledged</span>
        </div>
        <div className="dmg-sosops-stat dmg-sosops-stat-res">
          <span className="dmg-sosops-stat-num">{summary.resolvedToday}</span>
          <span className="dmg-sosops-stat-label">Resolved today</span>
        </div>
      </div>

      {error && <p className="dmg-sosops-error">{error}</p>}

      {alerts.length === 0 ? (
        <div className="dmg-sosops-empty">
          <p>No safety alerts. All clear.</p>
        </div>
      ) : (
        <ul className="dmg-sosops-list">
          {alerts.map((a) => (
            <li
              key={a._id}
              className={`dmg-sosops-card dmg-sosops-${a.status.toLowerCase()}`}
            >
              <div className="dmg-sosops-card-head">
                <div>
                  <span className="dmg-sosops-type">{a.emergencyType}</span>
                  <span className="dmg-sosops-num">{a.alertNumber}</span>
                </div>
                <span
                  className={`dmg-sosops-badge dmg-sosops-badge-${a.status.toLowerCase()}`}
                >
                  {a.status}
                </span>
              </div>

              <div className="dmg-sosops-body">
                <p className="dmg-sosops-who">
                  <strong>
                    {a.raisedByName || a.raisedByUserId?.fullName || "Employee"}
                  </strong>
                  {a.raisedByPhone && <span> · {a.raisedByPhone}</span>}
                </p>
                {a.message && <p className="dmg-sosops-msg">{a.message}</p>}
                <p className="dmg-sosops-meta">
                  Raised {new Date(a.createdAt).toLocaleString()}
                </p>
                {a.location?.lat != null && (
                  <a
                    className="dmg-sosops-maplink"
                    href={`https://www.google.com/maps?q=${a.location.lat},${a.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View location on map
                  </a>
                )}
              </div>

              {(a.status === "ACTIVE" || a.status === "ACKNOWLEDGED") && (
                <div className="dmg-sosops-actions">
                  {a.status === "ACTIVE" && (
                    <button
                      className="dmg-sosops-btn dmg-sosops-btn-ack"
                      onClick={() => acknowledge(a._id)}
                      disabled={busyId === a._id}
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    className="dmg-sosops-btn dmg-sosops-btn-res"
                    onClick={() => resolve(a._id)}
                    disabled={busyId === a._id}
                  >
                    Resolve
                  </button>
                </div>
              )}

              {a.status === "RESOLVED" && a.resolutionNotes && (
                <p className="dmg-sosops-resolution">
                  Resolution: {a.resolutionNotes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
