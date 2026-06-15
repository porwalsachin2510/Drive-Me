"use client";

import { useState, useEffect } from "react";
import B2B_MetricsCard from "../B2B_Common/B2B_MetricsCard/B2B_MetricsCard";
import B2B_ContractCard from "../B2B_Common/B2B_ContractCard/B2B_ContractCard";
import B2B_BarChart from "../B2B_Common/B2B_BarChart/B2B_BarChart";
import B2B_LineChart from "../B2B_Common/B2B_LineChart/B2B_LineChart";
import "./b2b_overview.css";
import api from "../../../utils/api";

function B2B_Overview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2b-partner/overview");
      setOverview(response.data.data.overview);
    } catch (error) {
      console.error("Error fetching overview data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="drivemego-b2b_overview-b2b-overview">
        <div className="drivemego-b2b_overview-loading">
          Loading overview...
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="drivemego-b2b_overview-b2b-overview">
        <div className="drivemego-b2b_overview-error">
          Failed to load overview data
        </div>
      </div>
    );
  }

  const currency = overview.revenue?.currency || "AED";

  const metrics = [
    {
      label: "ACTIVE VEHICLES",
      value: `${overview.vehicles?.active || 0}/${overview.vehicles?.total || 0}`,
      icon: "🚗",
    },
    {
      label: "ACTIVE CONTRACTS",
      value: overview.contracts?.active || 0,
      icon: "📄",
    },
    {
      label: "REVENUE (MO)",
      value: `${overview.revenue?.monthly || 0} ${currency}`,
      icon: "📈",
    },
    {
      label: "FLEET HEALTH",
      value: overview.vehicles?.utilization || "0%",
      icon: "✓",
    },
  ];

  // Use real chart data from backend, fallback to zero-filled full year if none available
  const chartData = overview.revenue?.chartData || {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    revenue: new Array(12).fill(0),
    expenses: new Array(12).fill(0),
    profit: new Array(12).fill(0),
  };

  return (
    <div className="drivemego-b2b_overview-b2b-overview">
      <div className="drivemego-b2b_overview-metrics-grid">
        {metrics.map((metric, index) => (
          <B2B_MetricsCard
            key={index}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
          />
        ))}
      </div>

      <div className="drivemego-b2b_overview-charts-section">
        <div className="drivemego-b2b_overview-chart-container">
          <h3>Monthly Revenue</h3>
          <B2B_BarChart data={chartData} />
        </div>
        <div className="drivemego-b2b_overview-chart-container">
          <h3>Profit Trend</h3>
          <B2B_LineChart data={chartData} />
        </div>
      </div>

      <div className="drivemego-b2b_overview-contracts-section">
        <h3>Recent Contracts</h3>
        <div className="drivemego-b2b_overview-contracts-grid">
          {overview.contracts?.recent?.map((contract) => (
            <B2B_ContractCard key={contract._id} contract={contract} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default B2B_Overview;
