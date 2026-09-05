"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Upload, FileSpreadsheet, RefreshCw } from "lucide-react";
import {
  fetchImportCandidates,
  fetchAssignedVehicleOptions,
  importRoutes,
} from "../../../services/briefImportService";
import { notify } from "../../../utils/toast";
import "./briefimport.css";

/**
 * Import routes straight out of a managed-service brief.
 *
 * A brief is never one route — the requirement document lists many, and each one
 * has to run on a specific vehicle. So this screen lists every candidate route
 * (structured brief rows AND rows parsed out of the attached document) and lets
 * the user pick the vehicle per route before creating them all in one action.
 *
 * Available to both parties: the customer (CORPORATE / SCHOOL_CUSTOMER) on its
 * own contract, and the partner (B2B_PARTNER / SCHOOL_PARTNER) operating on the
 * customer's behalf. They hold the same document.
 *
 * Props:
 *   contractId       (string, required) managed contract to import against
 *   defaultVehicleId (string) preselect this vehicle for every row (opened from
 *                    a specific vehicle card)
 *   onClose          (fn)
 *   onImported       (fn) called after at least one route was created
 */
export default function BriefRouteImportModal({
  contractId,
  defaultVehicleId = "",
  onClose,
  onImported,
}) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [counts, setCounts] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  // sourceKey -> { selected, vehicleIds: string[] }  (a route may run on many)
  const [rowState, setRowState] = useState({});
  const [bulkVehicleId, setBulkVehicleId] = useState(defaultVehicleId || "");
  const [failedRows, setFailedRows] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setFailedRows([]);
      const [data, vehicleOptions] = await Promise.all([
        fetchImportCandidates(contractId),
        fetchAssignedVehicleOptions(contractId),
      ]);

      const rows = data?.routes || [];
      setCandidates(rows);
      setWarnings(data?.warnings || []);
      setCounts(data?.counts || null);
      setVehicles(vehicleOptions);

      setBulkVehicleId(defaultVehicleId || "");

      // Default every row to ALL vehicles on the contract, so a shared route is
      // assigned to every bus in one click. The user can untick vehicles per
      // row as needed. (When the modal was opened from a specific vehicle card,
      // that vehicle is still included in the pre-selection.)
      const allVehicleIds = vehicleOptions.map((v) => v.id);

      const initial = {};
      rows.forEach((row) => {
        initial[row.sourceKey] = {
          // Rows that already exist as real routes start deselected so the user
          // doesn't create duplicates by accident.
          selected: !row.alreadyExists,
          vehicleIds: [...allVehicleIds],
        };
      });
      setRowState(initial);
    } catch (error) {
      setLoadError(
        error.response?.data?.message ||
          "Could not read the brief's importable routes.",
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, defaultVehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedKeys = useMemo(
    () => Object.keys(rowState).filter((key) => rowState[key]?.selected),
    [rowState],
  );

  const missingVehicleCount = useMemo(
    () =>
      selectedKeys.filter((key) => !(rowState[key]?.vehicleIds || []).length)
        .length,
    [selectedKeys, rowState],
  );

  const toggleRow = (sourceKey) => {
    setRowState((prev) => ({
      ...prev,
      [sourceKey]: {
        ...prev[sourceKey],
        selected: !prev[sourceKey]?.selected,
      },
    }));
  };

  // A route can run on several vehicles, so the picker toggles each vehicle in
  // and out of the row's selection instead of replacing a single choice.
  const toggleRowVehicle = (sourceKey, vehicleId) => {
    setRowState((prev) => {
      const current = prev[sourceKey]?.vehicleIds || [];
      const next = current.includes(vehicleId)
        ? current.filter((id) => id !== vehicleId)
        : [...current, vehicleId];
      return {
        ...prev,
        [sourceKey]: { ...prev[sourceKey], vehicleIds: next },
      };
    });
  };

  const selectAll = (onlyNew) => {
    setRowState((prev) => {
      const next = { ...prev };
      candidates.forEach((row) => {
        next[row.sourceKey] = {
          ...next[row.sourceKey],
          selected: onlyNew ? !row.alreadyExists : true,
        };
      });
      return next;
    });
  };

  const clearAll = () => {
    setRowState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...next[key], selected: false };
      });
      return next;
    });
  };

  // Add the chosen vehicle to every selected route (does not replace vehicles
  // a row already has, so you can build up multi-vehicle routes quickly).
  const applyBulkVehicle = () => {
    if (!bulkVehicleId) {
      notify("Pick a vehicle first.");
      return;
    }
    setRowState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key]?.selected) {
          const current = next[key]?.vehicleIds || [];
          next[key] = {
            ...next[key],
            vehicleIds: current.includes(bulkVehicleId)
              ? current
              : [...current, bulkVehicleId],
          };
        }
      });
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedKeys.length === 0) {
      notify("Select at least one route to import.");
      return;
    }
    if (missingVehicleCount > 0) {
      notify(
        `Pick at least one vehicle for ${missingVehicleCount} selected route(s) — every route must run on a vehicle.`,
      );
      return;
    }

    const byKey = new Map(candidates.map((row) => [row.sourceKey, row]));
    const items = selectedKeys.map((key) => ({
      ...byKey.get(key),
      // A route may be created on several vehicles at once.
      assignedVehicleIds: rowState[key].vehicleIds || [],
    }));

    try {
      setImporting(true);
      setFailedRows([]);
      const res = await importRoutes(contractId, items);
      const { created = 0, failed = 0, results = [] } = res?.data || {};

      if (created > 0) {
        notify(
          `Imported ${created} route(s) from the brief${
            failed ? `, ${failed} could not be created` : ""
          }.`,
        );
        if (typeof onImported === "function") await onImported();
      }

      const errors = results.filter((r) => r.error);
      setFailedRows(errors);

      if (created > 0 && errors.length === 0) {
        onClose?.();
      } else if (created === 0) {
        notify(res?.message || "No routes could be imported.");
        // Refresh so the list reflects anything that did change server-side.
        if (errors.length === 0) await load();
      } else {
        // Partial success: reload so imported rows show as already existing.
        await load();
      }
    } catch (error) {
      notify(error, "Failed to import routes from the brief.");
    } finally {
      setImporting(false);
    }
  };

  const vehicleLabel = (vehicle) =>
    `${vehicle.name}${vehicle.registration ? ` — ${vehicle.registration}` : ""}${
      vehicle.routeCount ? ` (${vehicle.routeCount} route(s))` : ""
    }`;

  return (
    <div className="bimp-overlay" role="presentation" onClick={onClose}>
      <div
        className="bimp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bimp-routes-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bimp-header">
          <div>
            <h3 id="bimp-routes-title">Import routes from the service brief</h3>
            <p>
              These are the routes listed in the brief and in the requirement
              document attached to it. Pick which ones to create and which
              assigned vehicle each route should run on. Rows that came from the
              structured brief are linked back to it automatically, so the
              customer sees them fulfilled.
            </p>
          </div>
          <button
            type="button"
            className="bimp-close"
            onClick={onClose}
            disabled={importing}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bimp-body">
          {loading ? (
            <div className="bimp-state">
              <Loader2 size={24} className="bimp-spin" />
              <span>Reading the brief and its attached document…</span>
            </div>
          ) : loadError ? (
            <div className="bimp-state">
              <span>{loadError}</span>
              <button type="button" className="bimp-btn bimp-btn-ghost" onClick={load}>
                <RefreshCw size={16} />
                <span>Try again</span>
              </button>
            </div>
          ) : (
            <>
              {counts && (
                <div className="bimp-chips">
                  <span className="bimp-chip brief">
                    {counts.routesFromBrief} from the brief
                  </span>
                  <span className="bimp-chip document">
                    <FileSpreadsheet size={13} />
                    {counts.routesFromDocuments} from the document
                  </span>
                  <span className="bimp-chip">
                    {selectedKeys.length} selected
                  </span>
                  {missingVehicleCount > 0 && (
                    <span className="bimp-chip warn">
                      {missingVehicleCount} need a vehicle
                    </span>
                  )}
                </div>
              )}

              {warnings.length > 0 && (
                <div className="bimp-warnings">
                  <h5>Some attachments could not be read fully</h5>
                  <ul>
                    {warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {vehicles.length === 0 ? (
                <div className="bimp-state">
                  <span>
                    No vehicles are assigned to this contract yet. Assign a
                    vehicle first — every route has to run on one.
                  </span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="bimp-state">
                  <span>
                    The brief has no routes and no readable routes in its
                    attachments. Add route requests to the brief, or attach the
                    filled-in Excel template, then try again.
                  </span>
                </div>
              ) : (
                <>
                  <div className="bimp-toolbar">
                    <div className="bimp-toolbar-group">
                      <button
                        type="button"
                        className="bimp-btn-link"
                        onClick={() => selectAll(true)}
                      >
                        Select new only
                      </button>
                      <button
                        type="button"
                        className="bimp-btn-link"
                        onClick={() => selectAll(false)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="bimp-btn-link"
                        onClick={clearAll}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="bimp-toolbar-group">
                      <span className="bimp-toolbar-label">
                        Assign selected to
                      </span>
                      <select
                        className="bimp-select"
                        value={bulkVehicleId}
                        onChange={(e) => setBulkVehicleId(e.target.value)}
                      >
                        <option value="">Choose a vehicle…</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicleLabel(vehicle)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="bimp-btn bimp-btn-ghost"
                        onClick={applyBulkVehicle}
                        disabled={!bulkVehicleId}
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="bimp-table-wrap">
                    <table className="bimp-table">
                      <thead>
                        <tr>
                          <th style={{ width: "36px" }} aria-label="Select" />
                          <th>Route</th>
                          <th>Source</th>
                          <th>Trip type &amp; timings</th>
                          <th>Days</th>
                          <th>Passengers</th>
                          <th style={{ minWidth: "240px" }}>Vehicle(s)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((row) => {
                          const state = rowState[row.sourceKey] || {};
                          return (
                            <tr
                              key={row.sourceKey}
                              className={
                                row.alreadyExists
                                  ? "exists"
                                  : state.selected
                                    ? "selected"
                                    : ""
                              }
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={Boolean(state.selected)}
                                  onChange={() => toggleRow(row.sourceKey)}
                                  aria-label={`Import ${row.label}`}
                                />
                              </td>
                              <td>
                                <span className="bimp-row-title">
                                  {row.label || "Untitled route"}
                                </span>
                                <span className="bimp-row-sub">
                                  {row.fromArea || "—"} to{" "}
                                  {row.toWorkLocation || "—"}
                                </span>
                                {row.stops?.length > 0 && (
                                  <span className="bimp-row-sub">
                                    Stops:{" "}
                                    {row.stops
                                      .map((stop) =>
                                        typeof stop === "string"
                                          ? stop
                                          : stop.location,
                                      )
                                      .filter(Boolean)
                                      .join(", ")}
                                  </span>
                                )}
                                {row.alreadyExists && (
                                  <span className="bimp-row-sub">
                                    <span className="bimp-flag">
                                      already created
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`bimp-source ${
                                    row.source === "BRIEF"
                                      ? "brief"
                                      : "document"
                                  }`}
                                >
                                  {row.source === "BRIEF" ? "BRIEF" : "DOCUMENT"}
                                </span>
                                {row.source === "DOCUMENT" && (
                                  <span className="bimp-row-sub">
                                    {row.documentName || "attachment"}
                                    {row.sourceRow ? ` · row ${row.sourceRow}` : ""}
                                  </span>
                                )}
                              </td>
                              <td>
                                {(() => {
                                  const isRound =
                                    String(row.tripType || "").toUpperCase() ===
                                      "ROUND_TRIP" ||
                                    (!row.tripType &&
                                      String(row.direction || "").toUpperCase() ===
                                        "BOTH" &&
                                      (row.returnStartTime || row.shiftLogoutTime));
                                  const pickupStart =
                                    row.pickupStartTime ||
                                    row.pickupWindowStart ||
                                    "--:--";
                                  const pickupEnd =
                                    row.pickupEndTime ||
                                    row.pickupWindowEnd ||
                                    row.shiftLoginTime ||
                                    "--:--";
                                  const returnStart =
                                    row.returnStartTime || row.shiftLogoutTime;
                                  const returnEnd = row.returnEndTime;
                                  return (
                                    <>
                                      <span className="bimp-row-title">
                                        {isRound ? "Round Trip" : "One Way"}
                                      </span>
                                      <span className="bimp-row-sub">
                                        Pickup {pickupStart} to {pickupEnd}
                                      </span>
                                      {isRound && returnStart && (
                                        <span className="bimp-row-sub">
                                          Return {returnStart}
                                          {returnEnd ? ` to ${returnEnd}` : ""}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td>{(row.operatingDays || []).join(", ")}</td>
                              <td>{row.headcount || "—"}</td>
                              <td>
                                <div
                                  className="bimp-vehicle-picker"
                                  role="group"
                                  aria-label={`Vehicles for ${row.label}`}
                                >
                                  {vehicles.length === 0 && (
                                    <span className="bimp-row-sub">
                                      No vehicles on this contract yet.
                                    </span>
                                  )}
                                  {vehicles.map((vehicle) => {
                                    const checked = (
                                      state.vehicleIds || []
                                    ).includes(vehicle.id);
                                    return (
                                      <label
                                        key={vehicle.id}
                                        className={`bimp-vehicle-option ${
                                          checked ? "checked" : ""
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!state.selected}
                                          onChange={() =>
                                            toggleRowVehicle(
                                              row.sourceKey,
                                              vehicle.id,
                                            )
                                          }
                                        />
                                        <span>{vehicleLabel(vehicle)}</span>
                                      </label>
                                    );
                                  })}
                                  {state.selected &&
                                    (state.vehicleIds || []).length > 1 && (
                                      <span className="bimp-row-sub">
                                        This route will be created on{" "}
                                        {(state.vehicleIds || []).length} vehicles.
                                      </span>
                                    )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {failedRows.length > 0 && (
                <div className="bimp-results">
                  <h5>{failedRows.length} route(s) could not be created</h5>
                  <ul>
                    {failedRows.map((row, idx) => (
                      <li key={idx}>
                        {row.label}: {row.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bimp-footer">
          <span className="bimp-footer-note">
            Each imported route also gets its operating schedule, exactly like
            adding one by hand.
          </span>
          <div className="bimp-footer-actions">
            <button
              type="button"
              className="bimp-btn bimp-btn-ghost"
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bimp-btn bimp-btn-primary"
              onClick={handleImport}
              disabled={
                importing ||
                loading ||
                selectedKeys.length === 0 ||
                vehicles.length === 0
              }
            >
              {importing ? (
                <Loader2 size={16} className="bimp-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span>
                {importing
                  ? "Importing…"
                  : `Import ${selectedKeys.length || ""} route(s)`.trim()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
