"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../../../utils/api";
import "./AdminBookingTrends.css";

function AdminBookingTrends() {
  const [animationKey, setAnimationKey] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("12");

  // Build a zero-filled rolling window ending at the current month
  const emptyWindow = useCallback(() => {
    const monthNames = [
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
    ];
    const monthsToShow = period === "3" ? 3 : period === "6" ? 6 : 12;
    const now = new Date();
    const result = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        month: monthNames[d.getMonth()],
        bookings: 0,
        b2cBookings: 0,
        corporateBookings: 0,
      });
    }
    return result;
  }, [period]);

  const fetchBookingTrends = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch real booking trend data from backend
      const response = await api.get(`/admin/bookings/trends?period=${period}`);

      if (
        response.data.success &&
        Array.isArray(response.data.data) &&
        response.data.data.length > 0
      ) {
        setData(response.data.data);
      } else {
        // No data yet: show real zeros instead of random demo values
        setData(emptyWindow());
      }
    } catch (error) {
      console.error("Error fetching booking trends:", error);
      setData(emptyWindow());
    } finally {
      setLoading(false);
    }
  }, [period, emptyWindow]);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
    fetchBookingTrends();
  }, [fetchBookingTrends]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="ad-dash-custom-tooltip">
          <p className="ad-dash-tooltip-month">{payload[0].payload.month}</p>
          <p style={{ color: "#d4a574", fontWeight: "600" }}>
            Total Bookings: {payload[0].value}
          </p>
          <p style={{ color: "#4f86c6" }}>
            B2C: {payload[0].payload.b2cBookings ?? 0}
          </p>
          <p style={{ color: "#374151" }}>
            Corporate: {payload[0].payload.corporateBookings ?? 0}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="ad-dash-booking-trends">
        <div className="ad-dash-booking-header">
          <h3 className="ad-dash-chart-title">Monthly Booking Trends</h3>
          <select
            className="ad-dash-period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="12">Last 12 Months</option>
            <option value="6">Last 6 Months</option>
            <option value="3">Last 3 Months</option>
          </select>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "300px",
          }}
        >
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-dash-booking-trends">
      <div className="ad-dash-booking-header">
        <h3 className="ad-dash-chart-title">Monthly Booking Trends</h3>
        <select
          className="ad-dash-period-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="12">Last 12 Months</option>
          <option value="6">Last 6 Months</option>
          <option value="3">Last 3 Months</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          key={animationKey}
          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
            label={{
              value: "Month",
              position: "insideBottom",
              offset: -5,
              fill: "#6b7280",
              fontSize: 12,
            }}
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
            allowDecimals={false}
            width={50}
            label={{
              value: "Bookings",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "#6b7280", fontSize: 12 },
            }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(212, 165, 116, 0.1)" }}
          />
          <Bar
            dataKey="bookings"
            fill="#d4a574"
            radius={[8, 8, 0, 0]}
            animationDuration={1000}
            animationBegin={0}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AdminBookingTrends;
