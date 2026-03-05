"use client";

import { useState, useEffect } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./b2b_barchart.css";

function B2B_BarChart({ data }) {
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
        Revenue: data.revenue?.[index] || data.profit?.[index] || 0,
        Expenses: data.expenses?.[index] || 0,
        Profit: data.profit?.[index] || 0,
      }));
      setChartData(formattedData);
      setIsAnimating(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bar-chart">
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          className={isAnimating ? "animate-in" : ""}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
          <XAxis dataKey="name" stroke="#999" />
          <YAxis stroke="#999" />
          <Tooltip
            // eslint-disable-next-line react-hooks/static-components
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />
          <Legend />
          <Bar
            dataKey="Revenue"
            fill="#16a085"
            radius={[8, 8, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
          />
          <Bar
            dataKey="Expenses"
            fill="#e74c3c"
            radius={[8, 8, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default B2B_BarChart;
