"use client";

import { useState } from "react";
import "./ManagedServiceBrief.css";
import "./ManagedServiceBriefModal.css";

/**
 * ManagedServiceBriefModal
 * ------------------------
 * Captured at "Request Quotation for Selected" time for MANAGED-service
 * requests. The corporate spells out exactly what the partner must operate —
 * work locations & shifts, the routes to cover, and (optionally) the employee
 * roster with pass durations — BEFORE the quotation ever reaches the partner.
 *
 * This is intentionally a self-contained local form: the quotation does not
 * exist yet, so there is no id to save against. On submit it hands the cleaned
 * brief back to the caller, which sends it together with the quotation request
 * in a single atomic backend call. The backend then stores it as a SUBMITTED
 * brief so the partner sees the requirements the first time they open the quote.
 *
 * At least one work location and at least one route request are required — the
 * whole point is that the partner can decide whether it can serve those routes
 * before it prices anything.
 */

const DAYS_HINT = "e.g. MON, TUE, WED, THU, FRI";

const toArr = (str) =>
  (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const emptyLocation = () => ({
  name: "",
  address: "",
  city: "",
  shifts: [],
});

const emptyShift = () => ({
  label: "",
  loginTime: "",
  logoutTime: "",
  workingDays: [],
});

const emptyRoute = () => ({
  label: "",
  fromArea: "",
  toWorkLocation: "",
  direction: "BOTH",
  stops: [],
  operatingDays: [],
  pickupWindowStart: "",
  pickupWindowEnd: "",
  headcount: 0,
  preferredVehicleType: "",
  notes: "",
});

const emptyEmployee = () => ({
  name: "",
  email: "",
  phone: "",
  employeeCode: "",
  department: "",
  homeAddress: "",
  pickupArea: "",
  workLocation: "",
  shiftLabel: "",
  passMonths: 1,
  preferredRouteLabel: "",
  assignmentHint: "",
});

const ManagedServiceBriefModal = ({
  fleetOwnerName = "the partner",
  defaultServiceStartDate = "",
  submitting = false,
  onSubmit,
  onClose,
}) => {
  const [summary, setSummary] = useState("");
  const [serviceStartDate, setServiceStartDate] = useState(
    defaultServiceStartDate || "",
  );
  const [pointOfContact, setPointOfContact] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [sla, setSla] = useState({
    targetCompletionDate: "",
    fulfillmentSlaHours: 72,
  });
  const [workLocations, setWorkLocations] = useState([emptyLocation()]);
  const [routeRequests, setRouteRequests] = useState([emptyRoute()]);
  const [employeeRoster, setEmployeeRoster] = useState([]);
  const [error, setError] = useState("");

  /* ------------------------------ list helpers ----------------------------- */
  const updateItem = (setter, index, patch) =>
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });

  const removeItem = (setter, index) =>
    setter((prev) => prev.filter((_, i) => i !== index));

  const updateShift = (locIndex, shiftIndex, patch) =>
    setWorkLocations((prev) => {
      const next = [...prev];
      const shifts = [...(next[locIndex].shifts || [])];
      shifts[shiftIndex] = { ...shifts[shiftIndex], ...patch };
      next[locIndex] = { ...next[locIndex], shifts };
      return next;
    });

  const addShift = (locIndex) =>
    setWorkLocations((prev) => {
      const next = [...prev];
      next[locIndex] = {
        ...next[locIndex],
        shifts: [...(next[locIndex].shifts || []), emptyShift()],
      };
      return next;
    });

  const removeShift = (locIndex, shiftIndex) =>
    setWorkLocations((prev) => {
      const next = [...prev];
      next[locIndex] = {
        ...next[locIndex],
        shifts: next[locIndex].shifts.filter((_, i) => i !== shiftIndex),
      };
      return next;
    });

  /* -------------------------------- submit --------------------------------- */
  const handleSubmit = () => {
    setError("");

    const cleanedLocations = workLocations.filter((l) => l.name.trim());
    if (cleanedLocations.length === 0) {
      setError(
        "Add at least one work location (with a name) so the partner knows where employees work.",
      );
      return;
    }

    const cleanedRoutes = routeRequests.filter((r) => r.label.trim());
    if (cleanedRoutes.length === 0) {
      setError(
        "Add at least one route (with a label) so the partner can confirm it can operate that route before quoting.",
      );
      return;
    }

    const brief = {
      summary: summary.trim(),
      serviceStartDate: serviceStartDate || null,
      sla: {
        targetCompletionDate: sla.targetCompletionDate || null,
        fulfillmentSlaHours: Number(sla.fulfillmentSlaHours) || 72,
      },
      pointOfContact,
      workLocations: cleanedLocations,
      routeRequests: cleanedRoutes,
      employeeRoster: employeeRoster.filter((e) => e.name.trim()),
    };

    onSubmit(brief);
  };

  return (
    <div
      className="msb-modal-overlay"
      onClick={submitting ? undefined : onClose}
    >
      <div className="msb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="msb-modal-header">
          <div>
            <h2>Managed Service Brief</h2>
            <p className="msb-subtitle" style={{ margin: "6px 0 0" }}>
              Tell {fleetOwnerName} exactly what to operate — your work
              locations &amp; shifts and the routes you need covered — so they
              can confirm they can serve those routes and price accurately{" "}
              <strong>before</strong> they quote.
            </p>
          </div>
          <button
            className="msb-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="msb-modal-body">
          {error && <p className="msb-error">{error}</p>}

          {/* Overview */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Overview</h3>
            </div>
            <div className="msb-field">
              <label>Objectives / summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Daily home-to-office pickup & drop for 40 employees across 3 shifts."
              />
            </div>
            <div className="msb-grid">
              <div className="msb-field">
                <label>Desired service start date</label>
                <input
                  type="date"
                  value={serviceStartDate}
                  onChange={(e) => setServiceStartDate(e.target.value)}
                />
              </div>
              <div className="msb-field">
                <label>Contact name</label>
                <input
                  value={pointOfContact.name}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact phone</label>
                <input
                  value={pointOfContact.phone}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact email</label>
                <input
                  value={pointOfContact.email}
                  onChange={(e) =>
                    setPointOfContact({
                      ...pointOfContact,
                      email: e.target.value,
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Target go-live date (SLA)</label>
                <input
                  type="date"
                  value={sla.targetCompletionDate}
                  onChange={(e) =>
                    setSla({ ...sla, targetCompletionDate: e.target.value })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Per-item SLA (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={sla.fulfillmentSlaHours}
                  onChange={(e) =>
                    setSla({
                      ...sla,
                      fulfillmentSlaHours: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Work locations & shifts */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Work Locations &amp; Shifts</h3>
              <button
                type="button"
                className="msb-btn secondary small"
                onClick={() =>
                  setWorkLocations((prev) => [...prev, emptyLocation()])
                }
              >
                + Add location
              </button>
            </div>
            <p className="msb-section-hint">
              Where employees work and the shift timings the transport must
              cover. (At least one required.)
            </p>
            {workLocations.map((loc, i) => (
              <div className="msb-item" key={i}>
                <div className="msb-item-head">
                  <span className="msb-item-title">
                    {loc.name || `Location ${i + 1}`}
                  </span>
                  {workLocations.length > 1 && (
                    <button
                      type="button"
                      className="msb-btn danger small"
                      onClick={() => removeItem(setWorkLocations, i)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="msb-grid">
                  <div className="msb-field">
                    <label>Location name *</label>
                    <input
                      value={loc.name}
                      onChange={(e) =>
                        updateItem(setWorkLocations, i, {
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>City</label>
                    <input
                      value={loc.city}
                      onChange={(e) =>
                        updateItem(setWorkLocations, i, {
                          city: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="msb-field">
                  <label>Address</label>
                  <input
                    value={loc.address}
                    onChange={(e) =>
                      updateItem(setWorkLocations, i, {
                        address: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="msb-section-head">
                  <span className="msb-spec-label">Shifts</span>
                  <button
                    type="button"
                    className="msb-btn secondary small"
                    onClick={() => addShift(i)}
                  >
                    + Add shift
                  </button>
                </div>
                {(loc.shifts || []).map((sh, si) => (
                  <div
                    className="msb-grid"
                    key={si}
                    style={{ marginBottom: 8 }}
                  >
                    <div className="msb-field">
                      <label>Shift label</label>
                      <input
                        value={sh.label}
                        onChange={(e) =>
                          updateShift(i, si, { label: e.target.value })
                        }
                      />
                    </div>
                    <div className="msb-field">
                      <label>Login</label>
                      <input
                        type="time"
                        value={sh.loginTime}
                        onChange={(e) =>
                          updateShift(i, si, { loginTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="msb-field">
                      <label>Logout</label>
                      <input
                        type="time"
                        value={sh.logoutTime}
                        onChange={(e) =>
                          updateShift(i, si, { logoutTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="msb-field">
                      <label>Working days ({DAYS_HINT})</label>
                      <input
                        value={(sh.workingDays || []).join(", ")}
                        onChange={(e) =>
                          updateShift(i, si, {
                            workingDays: toArr(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div
                      className="msb-field"
                      style={{ justifyContent: "end" }}
                    >
                      <button
                        type="button"
                        className="msb-btn danger small"
                        onClick={() => removeShift(i, si)}
                      >
                        Remove shift
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Route / coverage requests */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Route / Coverage Requests</h3>
              <button
                type="button"
                className="msb-btn secondary small"
                onClick={() =>
                  setRouteRequests((prev) => [...prev, emptyRoute()])
                }
              >
                + Add route
              </button>
            </div>
            <p className="msb-section-hint">
              The routes you need the partner to operate — from a residential
              area to a work location, with stops, timing windows and expected
              headcount. (At least one required.)
            </p>
            {routeRequests.map((r, i) => (
              <div className="msb-item" key={i}>
                <div className="msb-item-head">
                  <span className="msb-item-title">
                    {r.label || `Route ${i + 1}`}
                  </span>
                  {routeRequests.length > 1 && (
                    <button
                      type="button"
                      className="msb-btn danger small"
                      onClick={() => removeItem(setRouteRequests, i)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="msb-grid">
                  <div className="msb-field">
                    <label>Route label *</label>
                    <input
                      value={r.label}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          label: e.target.value,
                        })
                      }
                      placeholder="e.g. Whitefield → HQ Morning"
                    />
                  </div>
                  <div className="msb-field">
                    <label>From area</label>
                    <input
                      value={r.fromArea}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          fromArea: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>To work location</label>
                    <input
                      value={r.toWorkLocation}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          toWorkLocation: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Direction</label>
                    <select
                      value={r.direction}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          direction: e.target.value,
                        })
                      }
                    >
                      <option value="PICKUP">Pickup only</option>
                      <option value="DROP">Drop only</option>
                      <option value="BOTH">Both</option>
                    </select>
                  </div>
                  <div className="msb-field">
                    <label>Pickup window start</label>
                    <input
                      type="time"
                      value={r.pickupWindowStart}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          pickupWindowStart: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Pickup window end</label>
                    <input
                      type="time"
                      value={r.pickupWindowEnd}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          pickupWindowEnd: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Expected headcount</label>
                    <input
                      type="number"
                      min="0"
                      value={r.headcount}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          headcount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Preferred vehicle type</label>
                    <input
                      value={r.preferredVehicleType}
                      onChange={(e) =>
                        updateItem(setRouteRequests, i, {
                          preferredVehicleType: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="msb-field">
                  <label>Stops (comma separated)</label>
                  <input
                    value={(r.stops || []).join(", ")}
                    onChange={(e) =>
                      updateItem(setRouteRequests, i, {
                        stops: toArr(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="msb-field">
                  <label>Operating days ({DAYS_HINT})</label>
                  <input
                    value={(r.operatingDays || []).join(", ")}
                    onChange={(e) =>
                      updateItem(setRouteRequests, i, {
                        operatingDays: toArr(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="msb-field">
                  <label>Notes</label>
                  <textarea
                    value={r.notes}
                    onChange={(e) =>
                      updateItem(setRouteRequests, i, { notes: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Employee roster (optional) */}
          <div className="msb-section">
            <div className="msb-section-head">
              <h3>Employee Roster &amp; Passes</h3>
              <button
                type="button"
                className="msb-btn secondary small"
                onClick={() =>
                  setEmployeeRoster((prev) => [...prev, emptyEmployee()])
                }
              >
                + Add employee
              </button>
            </div>
            <p className="msb-section-hint">
              Optional now — who to onboard, their pickup address, which route
              they should ride, and how many months of pass to issue. You can
              also add these later.
            </p>
            {employeeRoster.length === 0 && (
              <p className="msb-empty">No employees added yet.</p>
            )}
            {employeeRoster.map((emp, i) => (
              <div className="msb-item" key={i}>
                <div className="msb-item-head">
                  <span className="msb-item-title">
                    {emp.name || `Employee ${i + 1}`}
                  </span>
                  <button
                    type="button"
                    className="msb-btn danger small"
                    onClick={() => removeItem(setEmployeeRoster, i)}
                  >
                    Remove
                  </button>
                </div>
                <div className="msb-grid">
                  <div className="msb-field">
                    <label>Name</label>
                    <input
                      value={emp.name}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Email</label>
                    <input
                      value={emp.email}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Phone</label>
                    <input
                      value={emp.phone}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Pickup area</label>
                    <input
                      value={emp.pickupArea}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          pickupArea: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Work location</label>
                    <input
                      value={emp.workLocation}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          workLocation: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Pass duration (months)</label>
                    <input
                      type="number"
                      min="0"
                      value={emp.passMonths}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          passMonths: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="msb-field">
                    <label>Preferred route</label>
                    <input
                      value={emp.preferredRouteLabel}
                      onChange={(e) =>
                        updateItem(setEmployeeRoster, i, {
                          preferredRouteLabel: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="msb-modal-footer">
          <button
            type="button"
            className="msb-btn secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="msb-btn primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send request with brief"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagedServiceBriefModal;
