"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../utils/api";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import "./FleetOwnerPortfolio.css";
import FleetPortfolioVehicleCard from "../../../Components/FleetPortfolioVehicleCard/FleetPortfolioVehicleCard";

const FleetOwnerPortfolio = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fleetOwner, setFleetOwner] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("vehicles");

  console.log("first vehicles", vehicles);

  useEffect(() => {
    fetchFleetOwnerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFleetOwnerData = async () => {
    try {
      setLoading(true);
      const vehiclesRes = await api.get(`/vehicles/fleet-owner/${id}`);

      console.log("My fleetOwner data", vehiclesRes.data.data.fleetOwner);
      console.log("My vehicles data", vehiclesRes.data.data.vehicles);

      setFleetOwner(vehiclesRes.data.data.fleetOwner);
      setVehicles(vehiclesRes.data.data.vehicles);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load fleet owner data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter vehicles based on active tab
  const displayedVehicles =
    activeTab === "vehicles"
      ? vehicles.filter((v) => v.status === "AVAILABLE")
      : vehicles;

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-page">{error}</div>;
  if (!fleetOwner)
    return <div className="error-page">Fleet owner not found</div>;

  return (
    <div className="portfolio-container">
      <div className="portfolio-content">
        {/* Header Section */}
        <div className="portfolio-header">
          <div className="owner-profile">
            <img
              src={fleetOwner.profileImage || "/default-avatar.png"}
              alt={fleetOwner.name}
              className="profile-image"
            />
            <div className="profile-info">
              <h1>{fleetOwner.name}</h1>
              <p className="company-name">{fleetOwner.companyName}</p>
              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{vehicles.length}</span>
                  <span className="stat-label">Vehicles</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {fleetOwner.completedContracts || 0}
                  </span>
                  <span className="stat-label">Completed Contracts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {fleetOwner.rating || "N/A"}
                  </span>
                  <span className="stat-label">Rating</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {fleetOwner.yearsInBusiness || "N/A"}
                  </span>
                  <span className="stat-label">Years in Business</span>
                </div>
              </div>
            </div>
          </div>

          {fleetOwner.description && (
            <div className="owner-description">
              <h3>About</h3>
              <p>{fleetOwner.description}</p>
            </div>
          )}

          <div className="owner-contact">
            <h3>Contact Information</h3>
            <div className="contact-grid">
              <div className="contact-item">
                <span className="contact-label">Email:</span>
                <span className="contact-value">{fleetOwner.email}</span>
              </div>
              {fleetOwner.phone && (
                <div className="contact-item">
                  <span className="contact-label">Phone:</span>
                  <span className="contact-value">{fleetOwner.phone}</span>
                </div>
              )}
              {fleetOwner.location && (
                <div className="contact-item">
                  <span className="contact-label">Location:</span>
                  <span className="contact-value">{fleetOwner.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="portfolio-tabs">
          <button
            className={activeTab === "vehicles" ? "active" : ""}
            onClick={() => setActiveTab("vehicles")}
          >
            Available Vehicles
          </button>
          <button
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
          >
            All Vehicles
          </button>
        </div>

        {/* Vehicles Grid */}
        <div className="portfolio-vehicles">
          <div className="vehicles-grid">
            {displayedVehicles.length > 0 ? (
              displayedVehicles.map((vehicle) => (
                <FleetPortfolioVehicleCard
                  key={vehicle._id}
                  vehicle={vehicle}
                  fleetOwner={fleetOwner}
                  onClick={() => navigate(`/vehicle/${vehicle._id}`)}
                />
              ))
            ) : (
              <div className="no-vehicles">
                <p>
                  {activeTab === "vehicles"
                    ? "No available vehicles at the moment"
                    : "No vehicles found"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetOwnerPortfolio;
