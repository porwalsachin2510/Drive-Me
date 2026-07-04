"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "./AdminRevenueChart.css";
import { useSelector } from "react-redux";
import useLocale from "../../../hooks/useLocale";
import api from "../../../utils/api";

function AdminRevenueChart() {
  const [animationKey, setAnimationKey] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useLocale();
  const country = useSelector((state) => state.locale?.country);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
    fetchRevenueData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // Build a full year of zero-filled months so the chart always has an X axis
  const emptyYear = () => {
    const months = [
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
    return months.map((month) => ({ month, total: 0, corporate: 0, b2c: 0 }));
  };

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      // Fetch real revenue data from backend, scoped to the selected country
      const response = await api.get("/admin/revenue/monthly", {
        params: country ? { country } : {},
      });

      if (
        response.data.success &&
        Array.isArray(response.data.data) &&
        response.data.data.length > 0
      ) {
        setData(response.data.data);
      } else {
        // No data yet: show real zeros instead of random demo values
        setData(emptyYear());
      }
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      setData(emptyYear());
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="ad-dash-custom-tooltip">
          <p className="ad-dash-tooltip-month">{payload[0].payload.month}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {currency} {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="ad-dash-revenue-chart">
        <h3 className="ad-dash-chart-title">Revenue Performance (YTD)</h3>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "350px",
          }}
        >
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-dash-revenue-chart">
      <h3 className="ad-dash-chart-title">Revenue Performance (YTD)</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart
          data={data}
          key={animationKey}
          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00A699" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00A699" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCorporate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#374151" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#374151" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
            width={70}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`
            }
            label={{
              value: `Revenue (${currency})`,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "#6b7280", fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#00A699"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTotal)"
            name="Total Revenue"
            animationDuration={1500}
            animationBegin={0}
          />
          <Area
            type="monotone"
            dataKey="corporate"
            stroke="#374151"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCorporate)"
            name="Corporate Revenue"
            animationDuration={1500}
            animationBegin={200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AdminRevenueChart;
