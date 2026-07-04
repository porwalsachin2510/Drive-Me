/* eslint-disable react-hooks/static-components */
"use client";

import { useState, useEffect } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getActiveCurrency } from "../../../../config/localeConfig";
import "./b2b_linechart.css";

function B2B_LineChart({ data, currency }) {
  const cur = currency || getActiveCurrency();
  const [chartData, setChartData] = useState([]);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Safety check inside useEffect
    if (!data || !data.labels || !Array.isArray(data.labels)) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAnimating(false);
    setChartData([]);

    const timer = setTimeout(() => {
      const formattedData = data.labels.map((label, index) => ({
        name: label,
        // Support both profit data and generic data field (for contracts trend)
        Profit: data.profit?.[index] || data.data?.[index] || 0,
      }));
      setChartData(formattedData);
      setIsAnimating(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="drivemego-b2b_linechart-custom-tooltip drivemego-b2b_linechart-line-tooltip">
          <p className="drivemego-b2b_linechart-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {cur} {Number(entry.value).toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="drivemego-b2b_linechart-line-chart">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 15, bottom: 25 }}
          className={isAnimating ? "drivemego-b2b_linechart-animate-in" : ""}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
          <XAxis
            dataKey="name"
            stroke="#999"
            label={{
              value: "Month",
              position: "insideBottom",
              offset: -10,
              fill: "#6b7280",
              fontSize: 12,
            }}
          />
          <YAxis
            stroke="#999"
            width={70}
            tickFormatter={(value) =>
              Math.abs(value) >= 1000
                ? `${(value / 1000).toFixed(1)}k`
                : `${value}`
            }
            label={{
              value: `Profit (${cur})`,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "#6b7280", fontSize: 12 },
            }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="Profit"
            stroke="#1677b8"
            dot={{ fill: "#1677b8", r: 5 }}
            activeDot={{ r: 7 }}
            strokeWidth={3}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default B2B_LineChart;
