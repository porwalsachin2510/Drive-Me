import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../Components/Navbar/Navbar";
import Footer from "../../../Components/Footer/Footer";
import ManagedServiceBriefModal from "../../../Components/Corporate/ManagedServiceBrief/ManagedServiceBriefModal";
import { createGroupedQuotations } from "../../../Redux/slices/quotationSlice";
import {
  selectCartPartners,
  selectCartRequirement,
  updateVehicleQty,
  removeVehicleFromCart,
  setPartnerBrief,
  clearPartner,
  clearCart,
} from "../../../Redux/slices/requestCartSlice";
import "./RequestReview.css";

// Convert the UI rental-duration label into the backend enum.
const getDurationType = (rentalType) => {
  const typeLower = String(rentalType || "").toLowerCase();
  if (typeLower === "daily" || typeLower === "day") return "DAILY";
  if (typeLower === "weekly" || typeLower === "week") return "WEEKLY";
  if (typeLower === "monthly" || typeLower === "month") return "MONTHLY";
  if (
    typeLower === "long-term" ||
    typeLower === "yearly" ||
    typeLower === "year"
  )
    return "LONG_TERM";
  return "MONTHLY";
};

// Compute an end date from a start date + duration.
const calculateEndDate = (startDate, rentalType, durationValue) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  const value = parseInt(durationValue) || 1;
  const typeLower = String(rentalType || "").toLowerCase();
  const end = new Date(start);
  if (typeLower.includes("day")) end.setDate(start.getDate() + value);
  else if (typeLower.includes("week")) end.setDate(start.getDate() + value * 7);
  else if (typeLower.includes("year") || typeLower.includes("long"))
    end.setFullYear(start.getFullYear() + value);
  else end.setMonth(start.getMonth() + value);
  return end.toISOString();
};

const formatCategory = (category) =>
  String(category || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const RequestReview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const partners = useSelector(selectCartPartners);
  const requirement = useSelector(selectCartRequirement);
  const submittingGroup = useSelector((s) => s.quotation.submittingGroup);

  const [briefPartnerId, setBriefPartnerId] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const isManaged =
    String(requirement?.serviceType || "").toLowerCase() === "managed" ||
    requirement?.serviceMode === "MANAGED";

  const partnerEntries = Object.entries(partners || {});

  const partnerUnitCount = (partner) =>
    Object.values(partner.vehicles || {}).reduce(
      (sum, v) => sum + (v.quantity || 0),
      0,
    );

  const totalUnits = partnerEntries.reduce(
    (sum, [, p]) => sum + partnerUnitCount(p),
    0,
  );

  const handleQtyChange = (fleetOwnerId, vehicleId, quantity) => {
    dispatch(
      updateVehicleQty({
        fleetOwnerId,
        vehicleId,
        quantity: parseInt(quantity),
      }),
    );
  };

  const handleRemoveVehicle = (fleetOwnerId, vehicleId) => {
    dispatch(removeVehicleFromCart({ fleetOwnerId, vehicleId }));
  };

  const handleBriefSubmit = (brief) => {
    if (briefPartnerId) {
      dispatch(setPartnerBrief({ fleetOwnerId: briefPartnerId, brief }));
    }
    setBriefPartnerId(null);
  };

  const buildRentalPeriod = () => ({
    startDate: requirement?.startDate || null,
    endDate: calculateEndDate(
      requirement?.startDate,
      requirement?.rentalDuration,
      requirement?.durationValue,
    ),
    durationType: getDurationType(requirement?.rentalDuration),
    duration: parseInt(requirement?.durationValue) || 1,
  });

  const handleSubmitAll = async () => {
    setSubmitError("");

    if (partnerEntries.length === 0) return;

    // For managed-service requests every partner needs an operations brief.
    if (isManaged) {
      const missing = partnerEntries.find(
        ([, p]) =>
          !p.managedServiceBrief ||
          !p.managedServiceBrief.workLocations?.length ||
          !p.managedServiceBrief.routeRequests?.length,
      );
      if (missing) {
        setSubmitError(
          "Every partner in a managed-service request needs an operations brief (work locations & routes) before you can submit.",
        );
        return;
      }
    }

    const payload = {
      serviceType: requirement?.serviceType || "passenger",
      serviceMode: isManaged ? "MANAGED" : "STANDARD",
      rentalPeriod: buildRentalPeriod(),
      requirements: {
        withDriver: Boolean(requirement?.driverRequired),
        fuelIncluded: Boolean(requirement?.fuelIncluded),
      },
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      requirementSnapshot: {
        rentalDurationType: getDurationType(requirement?.rentalDuration),
        durationValue: parseInt(requirement?.durationValue) || null,
        startDate: requirement?.startDate || null,
        location: requirement?.location || null,
        budgetRange: requirement?.budgetRange || null,
        driverRequired: Boolean(requirement?.driverRequired),
        fuelIncluded: Boolean(requirement?.fuelIncluded),
        vehicleTypes: requirement?.vehicleTypes || [],
        features: requirement?.features || [],
      },
      partners: partnerEntries.map(([fleetOwnerId, p]) => ({
        fleetOwnerId,
        vehicles: Object.entries(p.vehicles || {}).map(([vehicleId, v]) => ({
          vehicleId,
          quantity: v.quantity,
        })),
        managedServiceBrief: isManaged ? p.managedServiceBrief : undefined,
      })),
    };

    try {
      const result = await dispatch(createGroupedQuotations(payload)).unwrap();
      dispatch(clearCart());
      navigate("/corporate-profile?tab=my-quotations", {
        state: { requestGroupNumber: result?.requestGroupNumber },
      });
    } catch (error) {
      setSubmitError(
        typeof error === "string"
          ? error
          : error?.message || "Failed to submit request. Please try again.",
      );
    }
  };

  return (
    <>
      <Navbar />
      <main className="request-review">
        <header className="request-review-header">
          <h1>Review Your Request</h1>
          <p>
            Combine vehicles from multiple partners into a single request. Each
            partner receives its own quotation and contract.
          </p>
        </header>

        {partnerEntries.length === 0 ? (
          <div className="request-review-empty">
            <p>Your request is empty.</p>
            <button
              className="request-review-btn-primary"
              onClick={() => navigate("/service-selection")}
            >
              Start a new search
            </button>
          </div>
        ) : (
          <div className="request-review-content">
            <section className="request-review-partners">
              {partnerEntries.map(([fleetOwnerId, partner]) => {
                const owner = partner.ownerData || {};
                const partnerName =
                  owner.companyName || owner.fullName || "Partner";
                const vehicles = Object.entries(partner.vehicles || {});
                return (
                  <article
                    key={fleetOwnerId}
                    className="request-review-partner-card"
                  >
                    <div className="request-review-partner-head">
                      <div>
                        <h2>{partnerName}</h2>
                        <span className="request-review-partner-meta">
                          {partnerUnitCount(partner)} vehicle(s) ·{" "}
                          {vehicles.length} type(s)
                        </span>
                      </div>
                      <button
                        className="request-review-btn-link-danger"
                        onClick={() => dispatch(clearPartner(fleetOwnerId))}
                      >
                        Remove partner
                      </button>
                    </div>

                    <ul className="request-review-vehicle-list">
                      {vehicles.map(([vehicleId, item]) => {
                        const v = item.data || {};
                        return (
                          <li
                            key={vehicleId}
                            className="request-review-vehicle-row"
                          >
                            <div className="request-review-vehicle-info">
                              <span className="request-review-vehicle-name">
                                {v.vehicleName || "Vehicle"}
                              </span>
                              <span className="request-review-vehicle-cat">
                                {formatCategory(v.vehicleCategory)}
                              </span>
                            </div>
                            <div className="request-review-vehicle-actions">
                              <label className="request-review-qty-label">
                                Qty
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      fleetOwnerId,
                                      vehicleId,
                                      e.target.value,
                                    )
                                  }
                                  className="request-review-qty-input"
                                />
                              </label>
                              <button
                                className="request-review-btn-link-danger"
                                onClick={() =>
                                  handleRemoveVehicle(fleetOwnerId, vehicleId)
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {isManaged && (
                      <div className="request-review-brief-row">
                        {partner.managedServiceBrief ? (
                          <span className="request-review-brief-ok">
                            Operations brief attached ·{" "}
                            {partner.managedServiceBrief.routeRequests
                              ?.length || 0}{" "}
                            route(s),{" "}
                            {partner.managedServiceBrief.workLocations
                              ?.length || 0}{" "}
                            location(s)
                          </span>
                        ) : (
                          <span className="request-review-brief-missing">
                            Operations brief required before submitting.
                          </span>
                        )}
                        <button
                          className="request-review-btn-secondary"
                          onClick={() => setBriefPartnerId(fleetOwnerId)}
                        >
                          {partner.managedServiceBrief
                            ? "Edit brief"
                            : "Add operations brief"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <aside className="request-review-summary">
              <h3>Request Summary</h3>
              <div className="request-review-summary-row">
                <span>Partners</span>
                <span>{partnerEntries.length}</span>
              </div>
              <div className="request-review-summary-row">
                <span>Total vehicles</span>
                <span>{totalUnits}</span>
              </div>
              <div className="request-review-summary-row">
                <span>Service</span>
                <span>{isManaged ? "Managed" : "Standard"}</span>
              </div>
              {requirement?.location && (
                <div className="request-review-summary-row">
                  <span>Location</span>
                  <span>{requirement.location}</span>
                </div>
              )}
              {requirement?.startDate && (
                <div className="request-review-summary-row">
                  <span>Start date</span>
                  <span>{requirement.startDate}</span>
                </div>
              )}

              {submitError && (
                <p className="request-review-error">{submitError}</p>
              )}

              <button
                className="request-review-btn-primary request-review-submit"
                onClick={handleSubmitAll}
                disabled={submittingGroup}
              >
                {submittingGroup
                  ? "Submitting…"
                  : `Send request to ${partnerEntries.length} partner(s)`}
              </button>
              <button
                className="request-review-btn-secondary"
                onClick={() => navigate(-1)}
                disabled={submittingGroup}
              >
                Add more vehicles
              </button>
            </aside>
          </div>
        )}
      </main>

      {briefPartnerId && (
        <ManagedServiceBriefModal
          fleetOwnerName={
            partners[briefPartnerId]?.ownerData?.companyName ||
            partners[briefPartnerId]?.ownerData?.fullName ||
            "the partner"
          }
          defaultServiceStartDate={requirement?.startDate || ""}
          submitting={false}
          onSubmit={handleBriefSubmit}
          onClose={() => setBriefPartnerId(null)}
        />
      )}

      <Footer />
    </>
  );
};

export default RequestReview;
