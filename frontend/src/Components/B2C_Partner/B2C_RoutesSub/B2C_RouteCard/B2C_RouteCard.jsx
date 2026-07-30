/* eslint-disable no-unused-vars */
"use client";

import { getActiveCurrency } from "../../../../config/localeConfig";
import { useState, useEffect } from "react";
import "./b2c_routecard.css";
import api from "../../../../utils/api";
import B2C_TripModal from "../B2C_TripModal/B2C_TripModal.jsx";
import B2C_EditRouteModal from "../B2C_EditRouteModal/B2C_EditRouteModal.jsx";
import B2C_ChangeAssignmentModal from "../B2C_ChangeAssignmentModal/B2C_ChangeAssignmentModal.jsx";
import { notify } from "../../../../utils/toast";

function B2C_RouteCard({ route, onRouteUpdated, onAddSchedule }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // "driver" | "vehicle" | null — controls the Change Driver/Vehicle modal.
  const [changeMode, setChangeMode] = useState(null);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduleCount, setScheduleCount] = useState(0); // Track number of schedules
  const [allSchedules, setAllSchedules] = useState([]); // Store all schedules
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  // Bumped to re-fetch schedules/trips after a driver/vehicle change.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const checkScheduleAndTrips = async () => {
      try {
        const scheduleResponse = await api.get(
          `/b2c-schedules/schedules?routeId=${route._id}`,
        );
        const schedules = scheduleResponse.data.schedules || [];
        const hasScheduleData =
          scheduleResponse.data.success && schedules.length > 0;
        if (cancelled) return;
        setHasSchedule(hasScheduleData);
        setScheduleCount(schedules.length);
        setAllSchedules(schedules);

        if (hasScheduleData) {
          const tripsResponse = await api.get(
            `/b2c-trips/trips/today?routeId=${route._id}`,
          );
          if (!cancelled && tripsResponse.data.success) {
            setUpcomingTrips(tripsResponse.data.trips || []);
          }
        }
      } catch (error) {
        console.error("Error checking schedule/trips:", error);
      }
    };
    checkScheduleAndTrips();
    return () => {
      cancelled = true;
    };
  }, [route._id, refreshKey]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "#10b981";
      case "Inactive":
        return "#ef4444";
      case "Scheduled":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getTripTypeColor = (type) => {
    switch (type) {
      case "One Way":
        return "#3b82f6";
      case "Round Trip":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  };

  // Check dependencies before showing delete warning
  const handleDeleteClick = async () => {
    setCheckingDependencies(true);
    try {
      const response = await api.get(
        `/b2c-schedules/routes/${route._id}/dependencies`,
      );
      if (response.data.success) {
        setDependencies(response.data);
        setShowDeleteWarning(true);
      }
    } catch (error) {
      console.error("Error checking dependencies:", error);
      // If dependency check fails, show simple confirmation
      if (
        window.confirm(
          "Are you sure you want to delete this route? This action cannot be undone.",
        )
      ) {
        await performDelete(false);
      }
    } finally {
      setCheckingDependencies(false);
    }
  };

  // Perform the actual deletion
  const performDelete = async (forceDelete = false) => {
    setDeleting(true);
    setShowDeleteWarning(false);
    try {
      const url = forceDelete
        ? `/b2c-schedules/routes/${route._id}?forceDelete=true`
        : `/b2c-schedules/routes/${route._id}`;
      const { data } = await api.delete(url);

      // Surface refund outcome to the operator so they know what was settled.
      const refunds = data?.refunds;
      if (refunds && refunds.passesRefunded > 0) {
        const currency = refunds.details?.[0]?.currency || getActiveCurrency();
        const lines = [
          "Route deleted.",
          "",
          `${refunds.passesRefunded} commuter pass(es) were refunded for their unused trips (no cancellation fee).`,
          `Total refunded to commuters' in-app wallets: ${currency} ${Number(
            refunds.totalRefundedToCommuters || 0,
          ).toFixed(2)}.`,
        ];
        if (Number(refunds.totalEarningsReversed || 0) > 0) {
          lines.push(
            `Unused-trip earnings deducted from your wallet: ${currency} ${Number(
              refunds.totalEarningsReversed,
            ).toFixed(
              2,
            )}. (For cash passes you keep the passenger's cash for those trips.)`,
          );
        }
        if (Number(refunds.totalAdminCommissionReversed || 0) > 0) {
          lines.push(
            `Commission reversed from the admin wallet: ${currency} ${Number(
              refunds.totalAdminCommissionReversed,
            ).toFixed(2)}.`,
          );
        }
        notify(lines.join("\n"));
      }
      if (onRouteUpdated) onRouteUpdated();
    } catch (error) {
      console.error("Error deleting route:", error);
      if (error.response?.data?.dependencies) {
        // Backend returned dependency info
        setDependencies({
          ...error.response.data,
          hasCriticalDependencies: true,
        });
        setShowDeleteWarning(true);
      } else {
        notify(error.response?.data?.message || "Failed to delete route");
      }
    } finally {
      setDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Flatten every trip time across all loaded schedules into a single list so the
  // card can show ALL of the route's start times (the route in the screenshot has
  // one schedule with multiple trip times, but only the first was being displayed).
  const allTripTimes = allSchedules.flatMap((sch) =>
    (sch.tripTimes || []).map((tt) => ({
      departureTime: tt.departureTime,
      arrivalTime: tt.arrivalTime,
      tripType: tt.tripType,
      // effectiveDriver / effectiveVehicle are computed by the backend with a
      // fallback to the schedule-level assignment.
      driverName:
        tt.effectiveDriver?.name ||
        tt.tripDriverInfo?.name ||
        sch.driverInfo?.name ||
        null,
      vehicleModel:
        tt.effectiveVehicle?.model ||
        tt.tripVehicleInfo?.model ||
        sch.assignedVehicle?.model ||
        null,
      // Round Trip only: the dedicated RETURN (aane) leg can use a different
      // driver/vehicle from the onward leg. Collect these too so the card lists
      // EVERY driver/vehicle serving the route, not just the onward ones.
      returnDriverName:
        tt.tripType === "Round Trip"
          ? tt.effectiveReturnDriver?.name || tt.returnDriverInfo?.name || null
          : null,
      returnVehicleModel:
        tt.tripType === "Round Trip"
          ? tt.effectiveReturnVehicle?.model ||
            tt.returnVehicleInfo?.model ||
            null
          : null,
    })),
  );

  // Build a readable label for each trip time, e.g. "7:00 AM" or
  // "7:00 AM → 10:00 AM" for round trips.
  const formatTripTimeLabel = (tt) =>
    tt.tripType === "Round Trip" && tt.arrivalTime
      ? `${tt.departureTime} → ${tt.arrivalTime}`
      : tt.departureTime;

  // Unique vehicle models and driver names actually assigned across the trips,
  // covering BOTH the onward and return legs of every round trip.
  const assignedVehicleNames = [
    ...new Set(
      allTripTimes
        .flatMap((tt) => [tt.vehicleModel, tt.returnVehicleModel])
        .filter(Boolean),
    ),
  ];
  const assignedDriverNames = [
    ...new Set(
      allTripTimes
        .flatMap((tt) => [tt.driverName, tt.returnDriverName])
        .filter(Boolean),
    ),
  ];

  // Vehicle display: prefer per-trip assignments, fall back to route-level fields.
  const vehicleDisplay =
    assignedVehicleNames.length > 0
      ? assignedVehicleNames.join(", ")
      : route.assignedVehicle?.model || "Not Assigned";

  // Driver display: prefer per-trip assignments, fall back to route-level / self.
  const driverDisplay =
    assignedDriverNames.length > 0
      ? assignedDriverNames.join(", ")
      : route.driverInfo?.name ||
        route.assignedDriver?.name ||
        (route.isSelfDriver ? "Self" : "Not Assigned");

  return (
    <div className="b2c-route-card">
      <div className="b2c-route-header">
        <div className="b2c-route-info">
          <div className="b2c-route-locations">
            <div className="b2c-location">
              <span className="b2c-location-dot b2c-from"></span>
              <span className="b2c-location-text">{route.fromLocation}</span>
            </div>
            <div className="b2c-route-arrow">{"→"}</div>
            <div className="b2c-location">
              <span className="b2c-location-dot b2c-to"></span>
              <span className="b2c-location-text">{route.toLocation}</span>
            </div>
          </div>
        </div>
        <div className="b2c-badges-wrapper">
          <span
            className="b2c-status-badge"
            style={{ backgroundColor: getStatusColor(route.status) }}
          >
            {route.status}
          </span>
        </div>
      </div>

      <div className="b2c-route-details">
        {/* Show all schedule times when multiple schedules exist */}
        {scheduleCount > 1 ? (
          <div
            className="b2c-detail-row"
            style={{ flexDirection: "column", gap: "8px" }}
          >
            <div className="b2c-detail-item" style={{ width: "100%" }}>
              <span className="b2c-detail-label">
                Schedules ({scheduleCount}):
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "4px",
                }}
              >
                {allSchedules.flatMap((sch, sIdx) =>
                  (sch.tripTimes || []).map((tt, tIdx) => (
                    <span
                      key={`${sch._id || sIdx}-${tIdx}`}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#eff6ff",
                        borderRadius: "4px",
                        fontSize: "12px",
                        color: "#1e40af",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {tt.departureTime || "N/A"}
                      {tt.tripType === "Round Trip" && tt.arrivalTime && (
                        <span style={{ color: "#6b7280" }}>
                          {" "}
                          / {tt.arrivalTime}
                        </span>
                      )}
                    </span>
                  )),
                )}
              </div>
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">Available Days:</span>
              <span className="b2c-detail-value">
                {allSchedules[0]?.availableDays?.join(", ") ||
                  route.availableDays?.join(", ") ||
                  "Daily"}
              </span>
            </div>
          </div>
        ) : (
          <div className="b2c-detail-row">
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">
                {allTripTimes.length > 1 ? "Start Times:" : "Start Time:"}
              </span>
              {allTripTimes.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  {allTripTimes.map((tt, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#eff6ff",
                        borderRadius: "4px",
                        fontSize: "12px",
                        color: "#1e40af",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {formatTripTimeLabel(tt)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="b2c-detail-value">
                  {route.startTime || "N/A"}
                </span>
              )}
            </div>
            <div className="b2c-detail-item">
              <span className="b2c-detail-label">Available Days:</span>
              <span className="b2c-detail-value">
                {(route.availableDays?.length > 0
                  ? route.availableDays.join(", ")
                  : allSchedules[0]?.availableDays?.join(", ") ||
                    route.schedules?.[0]?.availableDays?.join(", ")) || "Daily"}
              </span>
            </div>
          </div>
        )}
        <div className="b2c-detail-row">
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Total Seats:</span>
            <span className="b2c-detail-value">{route.totalSeats}</span>
          </div>
          <div className="b2c-detail-item">
            <span className="b2c-detail-label">Available:</span>
            <span className="b2c-detail-value">{route.availableSeats}</span>
          </div>
        </div>
        <div className="b2c-pricing-row">
          {/* Show the FIXED MONTHLY price the partner set. Fall back to the legacy
              per-day price only for old routes created before monthly pricing. */}
          {(() => {
            const currencyCode = route.pricing?.currency || getActiveCurrency();
            const monthlyOneWay =
              route.pricing?.monthlyOneWayPrice ??
              route.monthlyOneWayPrice ??
              0;
            const monthlyRoundTrip =
              route.pricing?.monthlyRoundTripPrice ??
              route.monthlyRoundTripPrice ??
              0;
            const legacyOneWay = route.pricing?.oneWayPrice ?? 0;
            const legacyRoundTrip = route.pricing?.roundTripPrice ?? 0;

            const oneWayValue =
              monthlyOneWay > 0 ? monthlyOneWay : legacyOneWay;
            const roundTripValue =
              monthlyRoundTrip > 0 ? monthlyRoundTrip : legacyRoundTrip;
            const usingMonthly = monthlyOneWay > 0 || monthlyRoundTrip > 0;

            return (
              <>
                <div className="b2c-price-item">
                  <span className="b2c-price-label">
                    {usingMonthly ? "One Way (Monthly):" : "One Way:"}
                  </span>
                  <span className="b2c-price-value">
                    {currencyCode} {Number(oneWayValue).toFixed(2)}
                    {usingMonthly ? "/month" : ""}
                  </span>
                </div>
                {roundTripValue > 0 && (
                  <div className="b2c-price-item">
                    <span className="b2c-price-label">
                      {usingMonthly ? "Round Trip (Monthly):" : "Round Trip:"}
                    </span>
                    <span className="b2c-price-value">
                      {currencyCode} {Number(roundTripValue).toFixed(2)}
                      {usingMonthly ? "/month" : ""}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {route.stopPoints && route.stopPoints.length > 0 && (
          <div className="b2c-stop-points">
            <div className="b2c-stop-header">
              <button
                className="b2c-toggle-details"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Hide" : "Show"} Stop Points (
                {route.stopPoints.length})
              </button>
              <span
                className="b2c-trip-type-badge"
                style={{ backgroundColor: getTripTypeColor(route.tripType) }}
              >
                {route.tripType}
              </span>
            </div>
            {showDetails && (
              <div className="b2c-stop-points-list">
                {route.stopPoints.map((stop, index) => (
                  <div key={index} className="b2c-stop-point">
                    <span className="b2c-stop-number">{index + 1}</span>
                    <span className="b2c-stop-location">{stop.location}</span>
                    <span className="b2c-stop-time">{stop.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Each column shows the assignment AND the matching change button right
            below it: Vehicles → Change Vehicle, Driver → Change Driver. The
            buttons open a per-trip modal so a single schedule's driver/vehicle
            can be swapped without affecting the route's other trips. */}
        <div className="b2c-route-assignments">
          <div className="b2c-assignment-item">
            <span className="b2c-assignment-label">
              {assignedVehicleNames.length > 1 ? "Vehicles:" : "Vehicle:"}
            </span>
            <span className="b2c-assignment-value">{vehicleDisplay}</span>
            <button
              type="button"
              className="b2c-change-btn"
              onClick={() => setChangeMode("vehicle")}
            >
              Change Vehicle
            </button>
          </div>
          <div className="b2c-assignment-item">
            <span className="b2c-assignment-label">
              {assignedDriverNames.length > 1 ? "Drivers:" : "Driver:"}
            </span>
            <span className="b2c-assignment-value">{driverDisplay}</span>
            <button
              type="button"
              className="b2c-change-btn"
              onClick={() => setChangeMode("driver")}
            >
              Change Driver
            </button>
          </div>
        </div>
      </div>

      <div className="b2c-route-actions">
        <button
          className="b2c-action-btn b2c-edit-btn"
          onClick={() => setShowEditModal(true)}
        >
          Edit
        </button>
        {/* <button
          className="b2c-action-btn b2c-schedule-btn"
          onClick={() => onAddSchedule && onAddSchedule(route)}
        >
          {hasSchedule
            ? `Manage Schedule${scheduleCount > 1 ? ` (${scheduleCount})` : ""}`
            : "Add Schedule"}
        </button> */}
        {/* {hasSchedule ? (
          <button
            className="b2c-action-btn b2c-view-trips-btn"
            onClick={() => setShowTripModal(true)}
          >
            View Trips ({upcomingTrips.length})
          </button>
        ) : (
          <button
            className="b2c-action-btn b2c-trip-btn"
            onClick={() => setShowCreateTripModal(true)}
          >
            Create Trip
          </button>
        )} */}
        {hasSchedule && (
          <button
            className="b2c-action-btn b2c-view-trips-btn"
            onClick={() => setShowTripModal(true)}
          >
            View Trips ({upcomingTrips.length})
          </button>
        )}

        <button
          className="b2c-action-btn b2c-delete-btn"
          onClick={handleDeleteClick}
          disabled={deleting || checkingDependencies}
        >
          {checkingDependencies
            ? "Checking..."
            : deleting
              ? "Deleting..."
              : "Delete"}
        </button>
      </div>

      {/* Edit Route Modal - Comprehensive */}
      {showEditModal && (
        <B2C_EditRouteModal
          route={route}
          onClose={() => setShowEditModal(false)}
          onRouteUpdated={onRouteUpdated}
        />
      )}

      {showTripModal && (
        <B2C_TripModal route={route} onClose={() => setShowTripModal(false)} />
      )}

      {changeMode && (
        <B2C_ChangeAssignmentModal
          route={route}
          mode={changeMode}
          onClose={() => setChangeMode(null)}
          onChanged={() => {
            setRefreshKey((k) => k + 1);
            if (onRouteUpdated) onRouteUpdated();
          }}
        />
      )}

      {/* Delete Warning Modal */}
      {showDeleteWarning && dependencies && (
        <div
          className="b2c-modal-overlay"
          onClick={() => setShowDeleteWarning(false)}
        >
          <div
            className="b2c-delete-warning-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="b2c-modal-header"
              style={{
                backgroundColor: dependencies.hasCriticalDependencies
                  ? "#fef2f2"
                  : "#f0fdf4",
              }}
            >
              <h2
                style={{
                  color: dependencies.hasCriticalDependencies
                    ? "#dc2626"
                    : "#16a34a",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {dependencies.hasCriticalDependencies ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      stroke="#dc2626"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke="#16a34a"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {dependencies.hasCriticalDependencies
                  ? "Warning: Active Dependencies Found"
                  : "Safe to Delete"}
              </h2>
              <button
                className="b2c-modal-close"
                onClick={() => setShowDeleteWarning(false)}
              >
                ×
              </button>
            </div>

            <div
              className="b2c-modal-body"
              style={{ maxHeight: "60vh", overflowY: "auto" }}
            >
              <p
                style={{
                  marginBottom: "16px",
                  fontSize: "14px",
                  color: "#4b5563",
                }}
              >
                <strong>Route:</strong> {dependencies.routeName}
              </p>

              {dependencies.hasCriticalDependencies && (
                <div
                  style={{
                    backgroundColor: "#fef3c7",
                    border: "1px solid #fcd34d",
                    borderRadius: "8px",
                    padding: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <p style={{ margin: 0, color: "#92400e", fontSize: "14px" }}>
                    <strong>Warning:</strong> This route has active
                    subscriptions and bookings. Because <strong>you</strong> are
                    deleting the route, every affected commuter will be{" "}
                    <strong>
                      automatically refunded for their unused trips into their
                      in-app wallet
                    </strong>{" "}
                    (so they can withdraw it from the app) with{" "}
                    <strong>no cancellation fee</strong>. You keep earnings only
                    for trips already used. The unused-trip amount is{" "}
                    <strong>deducted from your wallet</strong> and the matching
                    commission is reversed from the admin wallet. For{" "}
                    <strong>cash passes</strong>, you keep the passenger&apos;s
                    physical cash for those unused trips, and your wallet is
                    debited by the same amount because the refund is paid to the
                    commuter&apos;s wallet on your behalf.
                  </p>
                  {dependencies.dependencies?.activePasses
                    ?.totalEstimatedRefund > 0 && (
                    <p
                      style={{
                        margin: "10px 0 0 0",
                        color: "#991b1b",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      Estimated total refund to commuters:{" "}
                      {dependencies.dependencies.activePasses.currency}{" "}
                      {Number(
                        dependencies.dependencies.activePasses
                          .totalEstimatedRefund,
                      ).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Active Monthly Passes */}
              {dependencies.dependencies?.activePasses?.count > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h3
                    style={{
                      color: "#dc2626",
                      fontSize: "16px",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z"
                        stroke="#dc2626"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Active Monthly Passes (
                    {dependencies.dependencies.activePasses.count})
                  </h3>
                  <div
                    style={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f9fafb" }}>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Passenger
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Pass Type
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Valid Until
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Trips Left
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "right",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Amount
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "right",
                              borderBottom: "1px solid #e5e7eb",
                              color: "#dc2626",
                            }}
                          >
                            Est. Refund
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.dependencies.activePasses.details.map(
                          (pass, idx) => (
                            <tr
                              key={pass.passId || idx}
                              style={{ borderBottom: "1px solid #e5e7eb" }}
                            >
                              <td style={{ padding: "10px" }}>
                                <div>{pass.passengerName}</div>
                                <div
                                  style={{ fontSize: "11px", color: "#6b7280" }}
                                >
                                  {pass.passengerPhone}
                                </div>
                              </td>
                              <td style={{ padding: "10px" }}>
                                {pass.passType}
                              </td>
                              <td style={{ padding: "10px" }}>
                                {formatDate(pass.endDate)}
                              </td>
                              <td style={{ padding: "10px" }}>
                                {pass.remainingTrips ||
                                  (pass.totalTrips || 0) -
                                    (pass.usedTrips || 0)}
                              </td>
                              <td
                                style={{ padding: "10px", textAlign: "right" }}
                              >
                                {pass.currency} {pass.totalAmount}
                              </td>
                              <td
                                style={{
                                  padding: "10px",
                                  textAlign: "right",
                                  color: "#dc2626",
                                  fontWeight: 600,
                                }}
                              >
                                {pass.currency}{" "}
                                {Number(pass.estimatedRefund || 0).toFixed(2)}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                    {dependencies.dependencies.activePasses.totalValue > 0 && (
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: "#fef2f2",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "right",
                          fontWeight: "600",
                        }}
                      >
                        Total Value:{" "}
                        {dependencies.dependencies.activePasses.currency}{" "}
                        {dependencies.dependencies.activePasses.totalValue}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Trips with Bookings */}
              {dependencies.dependencies?.upcomingTripsWithBookings?.count >
                0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h3
                    style={{
                      color: "#f59e0b",
                      fontSize: "16px",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Upcoming Trips with Bookings (
                    {dependencies.dependencies.upcomingTripsWithBookings.count})
                  </h3>
                  <div
                    style={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f9fafb" }}>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Date
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Time
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "center",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Booked Seats
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.dependencies.upcomingTripsWithBookings.details.map(
                          (trip, idx) => (
                            <tr
                              key={trip.tripId || idx}
                              style={{ borderBottom: "1px solid #e5e7eb" }}
                            >
                              <td style={{ padding: "10px" }}>
                                {formatDate(trip.tripDate)}
                              </td>
                              <td style={{ padding: "10px" }}>
                                {trip.startTime}
                              </td>
                              <td
                                style={{ padding: "10px", textAlign: "center" }}
                              >
                                {trip.bookedSeats} / {trip.totalSeats}
                              </td>
                              <td style={{ padding: "10px" }}>{trip.status}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                    <div
                      style={{
                        padding: "10px",
                        backgroundColor: "#fffbeb",
                        borderTop: "1px solid #e5e7eb",
                        textAlign: "right",
                      }}
                    >
                      Total Booked Seats:{" "}
                      {
                        dependencies.dependencies.upcomingTripsWithBookings
                          .totalBookedSeats
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Bookings */}
              {dependencies.dependencies?.pendingBookings?.count > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h3
                    style={{
                      color: "#3b82f6",
                      fontSize: "16px",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Pending Bookings (
                    {dependencies.dependencies.pendingBookings.count})
                  </h3>
                  <div
                    style={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f9fafb" }}>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Passenger
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Type
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Status
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "right",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.dependencies.pendingBookings.details.map(
                          (booking, idx) => (
                            <tr
                              key={booking.bookingId || idx}
                              style={{ borderBottom: "1px solid #e5e7eb" }}
                            >
                              <td style={{ padding: "10px" }}>
                                <div>{booking.passengerName}</div>
                                <div
                                  style={{ fontSize: "11px", color: "#6b7280" }}
                                >
                                  {booking.passengerPhone}
                                </div>
                              </td>
                              <td style={{ padding: "10px" }}>
                                {booking.isMonthlyPass
                                  ? "Monthly Pass"
                                  : booking.bookingType}
                              </td>
                              <td style={{ padding: "10px" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    backgroundColor:
                                      booking.bookingStatus === "ACCEPTED"
                                        ? "#dcfce7"
                                        : "#fef3c7",
                                    color:
                                      booking.bookingStatus === "ACCEPTED"
                                        ? "#166534"
                                        : "#92400e",
                                  }}
                                >
                                  {booking.bookingStatus}
                                </span>
                              </td>
                              <td
                                style={{ padding: "10px", textAlign: "right" }}
                              >
                                {booking.currency} {booking.paymentAmount}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                    {dependencies.dependencies.pendingBookings.totalValue >
                      0 && (
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: "#eff6ff",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "right",
                          fontWeight: "600",
                        }}
                      >
                        Total Value:{" "}
                        {dependencies.dependencies.pendingBookings.details[0]
                          ?.currency || getActiveCurrency()}{" "}
                        {dependencies.dependencies.pendingBookings.totalValue}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div
                style={{
                  backgroundColor: "#f3f4f6",
                  borderRadius: "8px",
                  padding: "16px",
                  marginTop: "20px",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", color: "#374151" }}>
                  Deletion Summary
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                    fontSize: "14px",
                  }}
                >
                  <div>
                    Schedules to delete:{" "}
                    <strong>
                      {dependencies.dependencies?.totalSchedules || 0}
                    </strong>
                  </div>
                  <div>
                    Trips to delete:{" "}
                    <strong>
                      {dependencies.dependencies?.totalTrips || 0}
                    </strong>
                  </div>
                  <div>
                    Passes to cancel:{" "}
                    <strong>
                      {dependencies.dependencies?.activePasses?.count || 0}
                    </strong>
                  </div>
                  <div>
                    Bookings to cancel:{" "}
                    <strong>
                      {dependencies.dependencies?.pendingBookings?.count || 0}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="b2c-modal-footer"
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                padding: "16px 20px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => setShowDeleteWarning(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fff",
                  color: "#374151",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              {dependencies.hasCriticalDependencies ? (
                <button
                  onClick={() => performDelete(true)}
                  disabled={deleting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#fff",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting
                    ? "Deleting & Refunding..."
                    : "Delete & Refund Commuters (No Cancellation Fee)"}
                </button>
              ) : (
                <button
                  onClick={() => performDelete(false)}
                  disabled={deleting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#fff",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontWeight: "500",
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete Route"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default B2C_RouteCard;
