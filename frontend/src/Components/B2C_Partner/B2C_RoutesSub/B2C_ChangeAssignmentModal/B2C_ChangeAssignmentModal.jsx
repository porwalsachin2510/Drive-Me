"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../../../utils/api";
import "./b2c_changeassignmentmodal.css";

/**
 * B2C_ChangeAssignmentModal
 *
 * Lets a B2C Partner swap the DRIVER or VEHICLE assigned to a route when the
 * current one is unavailable (e.g. driver sick, vehicle broke down).
 *
 * The change cascades on the backend to every schedule trip-time, the route
 * record, all future generated daily trips and active commuter bookings, so the
 * newly-assigned driver/vehicle serves those booked trips going forward.
 *
 * Props:
 *  - route:     the route object (needs _id, fromLocation, toLocation)
 *  - mode:      "driver" | "vehicle"
 *  - onClose:   () => void
 *  - onChanged: () => void  (called after a successful change)
 */
function B2C_ChangeAssignmentModal({ route, mode, onClose, onChanged }) {
  const isDriver = mode === "driver";

  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState([]); // fleet drivers or vehicles
  // One row per schedule trip-time so each trip can be re-assigned independently.
  const [tripRows, setTripRows] = useState([]);
  const [selectedNew, setSelectedNew] = useState({}); // { [rowKey]: newId }
  const [submittingId, setSubmittingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const labelFor = useCallback(
    (item) => {
      if (!item) return "Unknown";
      if (isDriver) {
        const name = item.name || item.fullName || "Driver";
        return item.phoneNumber ? `${name} (${item.phoneNumber})` : name;
      }
      const model = item.model || "Vehicle";
      const plate = item.licensePlate ? ` (${item.licensePlate})` : "";
      const seats = item.seatingCapacity
        ? ` - ${item.seatingCapacity} seats`
        : "";
      return `${model}${plate}${seats}`;
    },
    [isDriver],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load fleet options + this route's schedules in parallel.
      const [optionsRes, schedulesRes] = await Promise.all([
        isDriver
          ? api.get("/b2c-partner/drivers")
          : api.get("/b2c-partner/fleet"),
        api.get(`/b2c-schedules/schedules?routeId=${route._id}`),
      ]);

      const opts = isDriver
        ? optionsRes.data.drivers || []
        : // Only Active vehicles may be re-assigned — Maintenance / Inactive
          // vehicles are excluded from the "Replace With" list.
          (optionsRes.data.fleet?.vehicles || []).filter(
            (v) => v.status === "Active",
          );
      setOptions(opts);

      // Build the re-assignable rows. Each row targets ONE leg of ONE trip-time
      // so it can be swapped independently:
      //  - One Way  -> a single row (outbound leg).
      //  - Round Trip -> TWO rows: the Onward (jaane) leg AND the Return (aane)
      //    leg, because a round trip can have a different driver/vehicle for each
      //    direction. Previously only the onward leg was shown/editable.
      const schedules = schedulesRes.data.schedules || [];
      const rows = [];
      schedules.forEach((sch) => {
        (sch.tripTimes || []).forEach((tt) => {
          const isRoundTrip = tt.tripType === "Round Trip" && !!tt.arrivalTime;
          const baseLabel = isRoundTrip
            ? `${tt.departureTime} → ${tt.arrivalTime}`
            : tt.departureTime;

          // Onward / outbound leg.
          const outEntity = isDriver ? tt.effectiveDriver : tt.effectiveVehicle;
          rows.push({
            rowKey: `${sch._id}_${tt._id}_outbound`,
            scheduleId: sch._id,
            tripTimeId: tt._id,
            tripType: tt.tripType,
            leg: "outbound",
            tripLabel: baseLabel,
            legLabel: isRoundTrip ? "Onward" : null,
            currentId: outEntity?._id ? outEntity._id.toString() : "",
            current: outEntity || null,
          });

          // Return / aane leg (Round Trip only).
          if (isRoundTrip) {
            const retEntity = isDriver
              ? tt.effectiveReturnDriver
              : tt.effectiveReturnVehicle;
            rows.push({
              rowKey: `${sch._id}_${tt._id}_return`,
              scheduleId: sch._id,
              tripTimeId: tt._id,
              tripType: tt.tripType,
              leg: "return",
              tripLabel: baseLabel,
              legLabel: "Return",
              currentId: retEntity?._id ? retEntity._id.toString() : "",
              current: retEntity || null,
            });
          }
        });
      });

      setTripRows(rows);
    } catch (err) {
      console.error("Error loading assignment data:", err);
      setError("Failed to load assignment information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isDriver, route._id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApply = async (row) => {
    const newId = selectedNew[row.rowKey];
    if (!newId) {
      setError("Please select a replacement first.");
      return;
    }
    setSubmittingId(row.rowKey);
    setError("");
    setSuccess("");
    try {
      const url = isDriver
        ? `/b2c-schedules/routes/${route._id}/change-trip-driver`
        : `/b2c-schedules/routes/${route._id}/change-trip-vehicle`;
      const body = isDriver
        ? {
            scheduleId: row.scheduleId,
            tripTimeId: row.tripTimeId,
            newDriverId: newId,
            leg: row.leg,
          }
        : {
            scheduleId: row.scheduleId,
            tripTimeId: row.tripTimeId,
            newVehicleId: newId,
            leg: row.leg,
          };

      const { data } = await api.put(url, body);
      if (data.success) {
        const legSuffix = row.legLabel ? ` (${row.legLabel})` : "";
        setSuccess(
          `${isDriver ? "Driver" : "Vehicle"} updated for the ${row.tripLabel}${legSuffix} trip.`,
        );
        await loadData();
        setSelectedNew({});
        if (onChanged) onChanged();
      } else {
        setError(data.message || "Failed to apply the change.");
      }
    } catch (err) {
      console.error("Error changing assignment:", err);
      setError(err.response?.data?.message || "Failed to apply the change.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="b2c-cam-overlay" onClick={onClose}>
      <div className="b2c-cam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="b2c-cam-header">
          <div>
            <h2 className="b2c-cam-title">
              {isDriver ? "Change Driver" : "Change Vehicle"}
            </h2>
            <p className="b2c-cam-subtitle">
              {route.fromLocation} {"→"} {route.toLocation}
            </p>
          </div>
          <button
            className="b2c-cam-close"
            onClick={onClose}
            aria-label="Close"
          >
            {"×"}
          </button>
        </div>

        <div className="b2c-cam-body">
          <p className="b2c-cam-note">
            Change the {isDriver ? "driver" : "vehicle"} for{" "}
            <strong>each trip individually</strong>. Updating one trip only
            affects that trip&apos;s upcoming generated trips and active
            bookings — other trips on this route are left untouched. Trips
            already started or completed are not changed.
          </p>

          {error && <div className="b2c-cam-alert b2c-cam-error">{error}</div>}
          {success && (
            <div className="b2c-cam-alert b2c-cam-success">{success}</div>
          )}

          {loading ? (
            <div className="b2c-cam-loading">Loading…</div>
          ) : tripRows.length === 0 ? (
            <div className="b2c-cam-empty">
              This route has no scheduled trips to update.
            </div>
          ) : (
            <div className="b2c-cam-list">
              {tripRows.map((row) => {
                const newId = selectedNew[row.rowKey] || "";
                return (
                  <div key={row.rowKey} className="b2c-cam-row">
                    <div className="b2c-cam-current">
                      <span className="b2c-cam-trip-badge">
                        {row.tripLabel}
                        <span className="b2c-cam-trip-type">
                          {row.tripType}
                        </span>
                        {row.legLabel && (
                          <span
                            className={`b2c-cam-leg-tag ${
                              row.leg === "return"
                                ? "b2c-cam-leg-return"
                                : "b2c-cam-leg-onward"
                            }`}
                          >
                            {row.legLabel}
                          </span>
                        )}
                      </span>
                      <span className="b2c-cam-label">
                        Currently Assigned {isDriver ? "Driver" : "Vehicle"}
                      </span>
                      <span className="b2c-cam-current-name">
                        {row.current ? labelFor(row.current) : "Not assigned"}
                      </span>
                    </div>

                    <div className="b2c-cam-arrow">{"→"}</div>

                    <div className="b2c-cam-select-wrap">
                      <span className="b2c-cam-label">
                        Replace With ({isDriver ? "Driver" : "Vehicle"})
                      </span>
                      <select
                        className="b2c-cam-select"
                        value={newId}
                        onChange={(e) =>
                          setSelectedNew((prev) => ({
                            ...prev,
                            [row.rowKey]: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Select a {isDriver ? "driver" : "vehicle"}
                        </option>
                        {options
                          .filter((opt) => opt._id.toString() !== row.currentId)
                          .map((opt) => {
                            const status =
                              opt.availability?.status ||
                              opt.availabilityStatus ||
                              "available";
                            const icon =
                              status === "available"
                                ? "🟢"
                                : status === "busy"
                                  ? "🔴"
                                  : "🟠";
                            return (
                              <option key={opt._id} value={opt._id}>
                                {icon} {labelFor(opt)}
                              </option>
                            );
                          })}
                      </select>
                      <button
                        className="b2c-cam-apply"
                        disabled={!newId || submittingId === row.rowKey}
                        onClick={() => handleApply(row)}
                      >
                        {submittingId === row.rowKey ? "Applying…" : "Change"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="b2c-cam-footer">
          <button className="b2c-cam-cancel" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default B2C_ChangeAssignmentModal;
