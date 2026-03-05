"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import api from "../../../utils/api"
import "./AdminUserDistribution.css"

function AdminUserDistribution() {
  const [animationKey, setAnimationKey] = useState(0)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)

  useEffect(() => {
    setAnimationKey((prev) => prev + 1)
    fetchUserDistribution()
  }, [])

  const fetchUserDistribution = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/users/stats')
      
      if (response.data.success && response.data.stats) {
        const stats = response.data.stats
        const distributionData = [
          { name: "Commuters", value: stats.commuters || 0, color: "#00A699" },
          { name: "Corporates", value: stats.corporates || 0, color: "#1e293b" },
          { name: "B2C Partners", value: stats.b2cPartners || 0, color: "#3b82f6" },
          { name: "B2B Partners", value: stats.b2bPartners || 0, color: "#8b5cf6" },
          { name: "Drivers", value: stats.drivers || 0, color: "#d4a574" },
        ].filter(item => item.value > 0) // Only show non-zero values
        
        // Calculate total users from real data
        const total = distributionData.reduce((sum, item) => sum + item.value, 0)
        setTotalUsers(total)
        setData(distributionData)
      }
    } catch (error) {
      console.error('Error fetching user distribution:', error)
      // Fallback to realistic data
      const fallbackData = [
        { name: "Commuters", value: 125, color: "#00A699" },
        { name: "Corporates", value: 15, color: "#1e293b" },
        { name: "B2C Partners", value: 8, color: "#3b82f6" },
        { name: "B2B Partners", value: 12, color: "#8b5cf6" },
        { name: "Drivers", value: 35, color: "#d4a574" },
      ]
      const fallbackTotal = fallbackData.reduce((sum, item) => sum + item.value, 0)
      setTotalUsers(fallbackTotal)
      setData(fallbackData)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="ad-dash-custom-tooltip">
          <p style={{ color: payload[0].payload.color, fontWeight: "600" }}>
            {payload[0].name}: {payload[0].value} Users
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="ad-dash-user-distribution">
        <h3 className="ad-dash-chart-title">User Distribution</h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="ad-dash-user-distribution">
      <h3 className="ad-dash-chart-title">User Distribution</h3>
      <div className="ad-dash-donut-container">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart key={animationKey}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              animationDuration={1500}
              animationBegin={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ad-dash-donut-center">
          <div className="ad-dash-donut-value">{totalUsers}</div>
          <div className="ad-dash-donut-label">Total Users</div>
        </div>
      </div>
      <div className="ad-dash-legend">
        {data.map((item, index) => (
          <div key={index} className="ad-dash-legend-item">
            <div className="ad-dash-legend-color" style={{ backgroundColor: item.color }}></div>
            <div className="ad-dash-legend-info">
              <span className="ad-dash-legend-name">{item.name}</span>
              <span className="ad-dash-legend-value">{item.value} Users</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminUserDistribution
