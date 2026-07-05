import { useEffect, useState } from "react";
import api from "../../../utils/api";
import "./employeesos.css";

const EMERGENCY_TYPES = [
  { value: "SOS", label: "General SOS" },
  { value: "MEDICAL", label: "Medical emergency" },
  { value: "SAFETY", label: "Safety concern" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "VEHICLE_BREAKDOWN", label: "Vehicle breakdown" },
];

// Employee-facing panic button used on the live tracking screen. Raises a real
// SOS alert (persisted server-side) and shows the live status of the active one.
export default function EmployeeSOSButton({ tripId, myLocation }) {
  const [open, setOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("SOS");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [error, setError] = useState("");

  // Load any already-active alert so the button reflects real state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/sos/my-active");
        if (!cancelled && res.data.success) {
          setActiveAlert(res.data.data?.alert || null);
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect resolution/updates pushed over the socket
  useEffect(() => {
    const socket = api.getSocket();
    if (!socket) return;
    const onAlert = (payload) => {
      if (!payload) return;
      if (activeAlert && payload.alertId === activeAlert._id) {
        if (["RESOLVED", "CANCELLED", "FALSE_ALARM"].includes(payload.status)) {
          setActiveAlert(null);
        } else {
          setActiveAlert((prev) =>
            prev ? { ...prev, status: payload.status } : prev,
          );
        }
      }
    };
    socket.on("sos_alert", onAlert);
    return () => socket.off("sos_alert", onAlert);
  }, [activeAlert]);

  const raiseAlert = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/sos/raise", {
        tripId: tripId || undefined,
        emergencyType,
        message: message.trim() || undefined,
        location: myLocation
          ? { lat: myLocation.lat, lng: myLocation.lng }
          : undefined,
      });
      if (res.data.success) {
        setActiveAlert(res.data.data?.alert || null);
        setOpen(false);
        setMessage("");
      } else {
        setError(res.data.message || "Could not raise SOS");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Could not raise SOS");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAlert = async () => {
    if (!activeAlert) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/sos/${activeAlert._id}/cancel`);
      if (res.data.success) setActiveAlert(null);
    } catch (e) {
      setError(e.response?.data?.message || "Could not cancel");
    } finally {
      setSubmitting(false);
    }
  };

  if (activeAlert) {
    return (
      <div className="dmg-sos-active" role="alert">
        <div className="dmg-sos-active-head">
          <span className="dmg-sos-pulse" />
          <div>
            <strong>SOS active</strong>
            <span className="dmg-sos-num">{activeAlert.alertNumber}</span>
          </div>
        </div>
        <p className="dmg-sos-active-status">
          Status: <strong>{activeAlert.status}</strong>. Your company&apos;s ops
          team and Drive Me support have been alerted.
        </p>
        <button
          className="dmg-sos-cancel"
          onClick={cancelAlert}
          disabled={submitting}
        >
          {submitting ? "Cancelling..." : "I'm safe / Cancel"}
        </button>
      </div>
    );
  }

  return (
    <div className="dmg-sos-wrap">
      {!open ? (
        <button
          className="dmg-sos-trigger"
          onClick={() => setOpen(true)}
          aria-label="Raise an emergency SOS alert"
        >
          <span className="dmg-sos-icon" aria-hidden="true">
            !
          </span>
          Emergency SOS
        </button>
      ) : (
        <div className="dmg-sos-panel">
          <h4>Raise an emergency alert</h4>
          <label className="dmg-sos-field">
            <span>Type</span>
            <select
              value={emergencyType}
              onChange={(e) => setEmergencyType(e.target.value)}
            >
              {EMERGENCY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="dmg-sos-field">
            <span>Details (optional)</span>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Briefly describe the situation"
            />
          </label>
          {error && <p className="dmg-sos-error">{error}</p>}
          <div className="dmg-sos-actions">
            <button
              className="dmg-sos-confirm"
              onClick={raiseAlert}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send SOS now"}
            </button>
            <button
              className="dmg-sos-dismiss"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
