"use client"

import { useState, useEffect } from "react"
import "./AdminCreateRouteModal.css"
import api from "../../../../../utils/api"

function AdminCreateRouteModal({ onClose, onCreateRoute }) {
  const [formData, setFormData] = useState({
    b2cPartnerId: "",
    fromLocation: "",
    toLocation: "",
    startTime: "",
    tripType: "One Way",
    routeStartDate: "",
    availableDays: [],
    totalSeats: 20,
    availableSeats: 20,
    pricing: {
      oneWayPrice: 0,
      roundTripPrice: 0,
      monthlyPrice: 0
    },
    description: "",
    assignedVehicle: "",
    assignedDriver: "",
    status: "Active",
    // Real transport fields
    stopPoints: [], // Multiple stops with timing
    tripSchedule: {
      frequency: "daily", // daily, weekdays, weekends, custom
      tripsPerDay: 1, // Number of trips per day
      firstTripTime: "",
      lastTripTime: "",
      intervalMinutes: 30 // Interval between trips
    },
    // Monthly pricing calculation fields
    pricingType: "perDay", // perDay, weekly, monthly
    selectedDays: [], // For custom day selection
    customPricing: {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    }
  })

  // Initialize pricing values as numbers
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        oneWayPrice: Number(prev.pricing.oneWayPrice) || 0,
        roundTripPrice: Number(prev.pricing.roundTripPrice) || 0,
        monthlyPrice: Number(prev.pricing.monthlyPrice) || 0
      }
    }))
  }, [])

  const [b2cPartners, setB2cPartners] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const daysOfWeek = [
    { id: "MON", label: "Monday" },
    { id: "TUE", label: "Tuesday" },
    { id: "WED", label: "Wednesday" },
    { id: "THU", label: "Thursday" },
    { id: "FRI", label: "Friday" },
    { id: "SAT", label: "Saturday" },
    { id: "SUN", label: "Sunday" }
  ]

  useEffect(() => {
    fetchB2cPartners()
  }, [])

  useEffect(() => {
    if (formData.b2cPartnerId) {
      fetchPartnerAssets()
    } else {
      setVehicles([])
      setDrivers([])
    }
  }, [formData.b2cPartnerId])

  const fetchB2cPartners = async () => {
    try {
      const response = await api.get('/admin/users?role=B2C_PARTNER&status=ACTIVE')
      if (response.data.success) {
        setB2cPartners(response.data.users || [])
      }
    } catch (error) {
      console.error("Error fetching B2C partners:", error)
    }
  }

  const fetchPartnerAssets = async () => {
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        api.get(`/admin/b2c/partners/${formData.b2cPartnerId}/vehicles`),
        api.get(`/admin/b2c/partners/${formData.b2cPartnerId}/drivers`)
      ])
      
      setVehicles(vehiclesRes.data.vehicles || [])
      setDrivers(driversRes.data.drivers || [])
    } catch (error) {
      console.error("Error fetching partner assets:", error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name.includes('.')) {
      const [parent, child] = name.split('.')
      // Handle pricing fields specially to ensure they're numbers
      if (parent === 'pricing') {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: parseFloat(value) || 0
          }
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }))
      }
    } else if (name.includes('customPricing.')) {
      const [parent, child] = name.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: parseFloat(value) || 0
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Add new stop point
  const addStopPoint = () => {
    setFormData(prev => ({
      ...prev,
      stopPoints: [
        ...prev.stopPoints,
        {
          location: "",
          time: "",
          order: prev.stopPoints.length + 1
        }
      ]
    }))
  }

  // Remove stop point
  const removeStopPoint = (index) => {
    setFormData(prev => ({
      ...prev,
      stopPoints: prev.stopPoints.filter((_, i) => i !== index)
        .map((stop, i) => ({ ...stop, order: i + 1 }))
    }))
  }

  // Update stop point
  const updateStopPoint = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      stopPoints: prev.stopPoints.map((stop, i) => 
        i === index ? { ...stop, [field]: value } : stop
      )
    }))
  }

  // Calculate monthly price based on pricing type and selection
  const calculateMonthlyPrice = () => {
    const { pricingType, availableDays, pricing, customPricing } = formData
    
    if (pricingType === "perDay") {
      // Per day pricing - user pays for selected days only
      return pricing.oneWayPrice * availableDays.length * 4 // Approx 4 weeks per month
    } else if (pricingType === "weekly") {
      // Weekly pricing - user pays for 5 days (Mon-Fri) regardless of selection
      return pricing.oneWayPrice * 5 * 4 // 5 days × 4 weeks
    } else if (pricingType === "monthly") {
      // Fixed monthly price - unlimited travel on all days
      return pricing.monthlyPrice || 0
    } else if (pricingType === "custom") {
      // Custom day pricing - user pays for selected days only
      return availableDays.reduce((total, day) => {
        const dayKey = day.toLowerCase()
        return total + (customPricing[dayKey] || 0)
      }, 0) * 4 // Approx 4 weeks per month
    }
    return 0
  }

  // Calculate round trip monthly price if round trip price is set
  const calculateRoundTripMonthlyPrice = () => {
    const { pricingType, availableDays, pricing, customPricing } = formData
    
    if (pricing.roundTripPrice === 0) return 0 // No round trip price set
    
    if (pricingType === "perDay") {
      return pricing.roundTripPrice * availableDays.length * 4
    } else if (pricingType === "weekly") {
      return pricing.roundTripPrice * 5 * 4
    } else if (pricingType === "monthly") {
      return pricing.roundTripPrice * 4 // 4 weeks
    } else if (pricingType === "custom") {
      return availableDays.reduce((total, day) => {
        const dayKey = day.toLowerCase()
        return total + (customPricing[dayKey] || 0)
      }, 0) * 4
    }
    return 0
  }

  // Update monthly price when pricing changes
  useEffect(() => {
    const monthlyPrice = calculateMonthlyPrice()
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        monthlyPrice: monthlyPrice
      }
    }))
  }, [formData.pricingType, formData.availableDays, formData.pricing.oneWayPrice, formData.pricing.roundTripPrice, formData.customPricing])

  const handleDayToggle = (dayId) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayId)
        ? prev.availableDays.filter(d => d !== dayId)
        : [...prev.availableDays, dayId]
    }))
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.b2cPartnerId) newErrors.b2cPartnerId = "B2C Partner is required"
    if (!formData.fromLocation) newErrors.fromLocation = "From location is required"
    if (!formData.toLocation) newErrors.toLocation = "To location is required"
    if (!formData.startTime) newErrors.startTime = "Start time is required"
    if (!formData.routeStartDate) newErrors.routeStartDate = "Route start date is required"
    if (formData.availableDays.length === 0) newErrors.availableDays = "At least one day must be selected"
    if (formData.totalSeats < 1) newErrors.totalSeats = "Total seats must be at least 1"
    if (formData.availableSeats < 0) newErrors.availableSeats = "Available seats cannot be negative"
    if (formData.pricing.oneWayPrice < 0) newErrors.oneWayPrice = "Price cannot be negative"
    
    // Validate stop points
    if (formData.stopPoints.length < 2) {
      newErrors.stopPoints = "At least 2 stop points are required (start and end point)"
    } else {
      formData.stopPoints.forEach((stop, index) => {
        if (!stop.location) {
          newErrors[`stopLocation_${index}`] = `Stop ${index + 1} location is required`
        }
        if (!stop.time) {
          newErrors[`stopTime_${index}`] = `Stop ${index + 1} time is required`
        }
      })
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      // Prepare data according to B2CPartnerRoute schema
      const routeData = {
        ...formData,
        routeStartDate: new Date(formData.routeStartDate),
        // Map to backend expected fields
        name: `${formData.fromLocation} to ${formData.toLocation}`,
        startPoint: formData.fromLocation,
        endPoint: formData.toLocation,
        departureTime: formData.startTime,
        capacity: formData.totalSeats,
        bookedSeats: formData.totalSeats - formData.availableSeats,
        price: formData.pricing.oneWayPrice,
        status: formData.status,
        featured: false,
        distance: "N/A",
        duration: "N/A",
        stops: [],
        schedule: [{
          days: formData.availableDays,
          time: formData.startTime,
          startDate: formData.routeStartDate
        }],
        tags: []
      }

      await onCreateRoute(routeData)
      onClose()
    } catch (error) {
      console.error("Error creating route:", error)
      setErrors({ submit: "Failed to create route. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="route-management-modal-overlay" onClick={onClose}>
      <div className="route-management-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="route-management-modal-header">
          <div>
            <h3 className="route-management-modal-title">Create B2C Route</h3>
            <p className="route-management-modal-subtitle">Create a new public transport route for B2C Partner</p>
          </div>
          <button className="route-management-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="route-management-modal-form">
          <div className="route-management-form-section">
            <h4 className="route-management-section-title">🚌 Basic Information</h4>
            
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">B2C Partner *</label>
                <select 
                  name="b2cPartnerId" 
                  value={formData.b2cPartnerId}
                  onChange={handleInputChange}
                  className={`route-management-form-select ${errors.b2cPartnerId ? 'error' : ''}`}
                  required
                >
                  <option value="">Select B2C Partner</option>
                  {b2cPartners.map(partner => (
                    <option key={partner._id} value={partner._id}>
                      {partner.companyName || partner.fullName}
                    </option>
                  ))}
                </select>
                {errors.b2cPartnerId && <span className="route-management-error">{errors.b2cPartnerId}</span>}
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Status *</label>
                <select 
                  name="status" 
                  value={formData.status}
                  onChange={handleInputChange}
                  className="route-management-form-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>
            </div>

            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">From Location *</label>
                <input 
                  type="text" 
                  name="fromLocation"
                  value={formData.fromLocation}
                  onChange={handleInputChange}
                  placeholder="e.g. Kuwait City"
                  className={`route-management-form-input ${errors.fromLocation ? 'error' : ''}`}
                  required
                />
                {errors.fromLocation && <span className="route-management-error">{errors.fromLocation}</span>}
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">To Location *</label>
                <input 
                  type="text" 
                  name="toLocation"
                  value={formData.toLocation}
                  onChange={handleInputChange}
                  placeholder="e.g. Salmiya"
                  className={`route-management-form-input ${errors.toLocation ? 'error' : ''}`}
                  required
                />
                {errors.toLocation && <span className="route-management-error">{errors.toLocation}</span>}
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">⏰ Schedule & Timing</h4>
            
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Trip Type *</label>
                <select 
                  name="tripType" 
                  value={formData.tripType}
                  onChange={handleInputChange}
                  className="route-management-form-select"
                >
                  <option value="One Way">One Way</option>
                  <option value="Round Trip">Round Trip</option>
                </select>
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Start Time *</label>
                <input 
                  type="time" 
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  className={`route-management-form-input ${errors.startTime ? 'error' : ''}`}
                  required
                />
                {errors.startTime && <span className="route-management-error">{errors.startTime}</span>}
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Route Start Date *</label>
                <input 
                  type="date" 
                  name="routeStartDate"
                  value={formData.routeStartDate}
                  onChange={handleInputChange}
                  className={`route-management-form-input ${errors.routeStartDate ? 'error' : ''}`}
                  required
                />
                {errors.routeStartDate && <span className="route-management-error">{errors.routeStartDate}</span>}
              </div>
            </div>

            <div className="route-management-form-group">
              <label className="route-management-form-label">Available Days *</label>
              <div className="route-management-days-grid">
                {daysOfWeek.map(day => (
                  <label key={day.id} className="route-management-day-checkbox">
                    <input 
                      type="checkbox"
                      checked={formData.availableDays.includes(day.id)}
                      onChange={() => handleDayToggle(day.id)}
                    />
                    <span className="route-management-day-label">{day.label}</span>
                  </label>
                ))}
              </div>
              {errors.availableDays && <span className="route-management-error">{errors.availableDays}</span>}
            </div>
          </div>

          {/* 🚌 Stop Points Section - REAL TRANSPORT */}
          <div className="route-management-form-section">
            <h4 className="route-management-section-title">🚌 Route Stop Points & Schedule</h4>
            
            <div className="route-management-stop-points">
              <div className="route-management-stop-points-header">
                <h5>Add Pickup/Drop Points with Timing</h5>
                <button 
                  type="button" 
                  onClick={addStopPoint}
                  className="route-management-add-stop-btn"
                >
                  + Add Stop Point
                </button>
              </div>

              {formData.stopPoints.length === 0 ? (
                <div className="route-management-no-stops">
                  <p>No stop points added. Add at least 2 stops (start and end point).</p>
                </div>
              ) : (
                <div className="route-management-stops-list">
                  {formData.stopPoints.map((stop, index) => (
                    <div key={index} className="route-management-stop-item">
                      <div className="route-management-stop-header">
                        <span className="route-management-stop-number">Stop {stop.order}</span>
                        {formData.stopPoints.length > 2 && (
                          <button 
                            type="button"
                            onClick={() => removeStopPoint(index)}
                            className="route-management-remove-stop-btn"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      <div className="route-management-form-row">
                        <div className="route-management-form-group">
                          <label className="route-management-form-label">Location *</label>
                          <input 
                            type="text"
                            value={stop.location}
                            onChange={(e) => updateStopPoint(index, 'location', e.target.value)}
                            placeholder="e.g. Kuwait City Bus Station"
                            className="route-management-form-input"
                            required
                          />
                        </div>
                        
                        <div className="route-management-form-group">
                          <label className="route-management-form-label">Time *</label>
                          <input 
                            type="time"
                            value={stop.time}
                            onChange={(e) => updateStopPoint(index, 'time', e.target.value)}
                            className="route-management-form-input"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="route-management-stop-help">
                <small>
                  <strong>📝 Instructions:</strong><br/>
                  • Add stops in order from start to end point<br/>
                  • Set pickup times for each stop<br/>
                  • Passenger can board/alight at any stop<br/>
                  • Times are for reference - actual arrival may vary
                </small>
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">💰 Pricing & Capacity</h4>
            
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Total Seats *</label>
                <input 
                  type="number" 
                  name="totalSeats"
                  value={formData.totalSeats}
                  onChange={handleInputChange}
                  placeholder="20"
                  min="1"
                  max="50"
                  className={`route-management-form-input ${errors.totalSeats ? 'error' : ''}`}
                  required
                />
                {errors.totalSeats && <span className="route-management-error">{errors.totalSeats}</span>}
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Available Seats *</label>
                <input 
                  type="number" 
                  name="availableSeats"
                  value={formData.availableSeats}
                  onChange={handleInputChange}
                  placeholder="20"
                  min="0"
                  max={formData.totalSeats}
                  className={`route-management-form-input ${errors.availableSeats ? 'error' : ''}`}
                  required
                />
                {errors.availableSeats && <span className="route-management-error">{errors.availableSeats}</span>}
              </div>
            </div>

            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">One Way Price (KWD) *</label>
                <input 
                  type="number" 
                  name="pricing.oneWayPrice"
                  value={formData.pricing.oneWayPrice}
                  onChange={handleInputChange}
                  placeholder="0.500"
                  step="0.001"
                  min="0"
                  className={`route-management-form-input ${errors.oneWayPrice ? 'error' : ''}`}
                  required
                />
                {errors.oneWayPrice && <span className="route-management-error">{errors.oneWayPrice}</span>}
                <small className="route-management-help-text">
                  Price for one-way journey
                </small>
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Round Trip Price (KWD)</label>
                <input 
                  type="number" 
                  name="pricing.roundTripPrice"
                  value={formData.pricing.roundTripPrice}
                  onChange={handleInputChange}
                  placeholder="0.900"
                  step="0.001"
                  min="0"
                  className="route-management-form-input"
                />
                <small className="route-management-help-text">
                  Price for round-trip journey (optional)
                </small>
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Monthly Price (KWD)</label>
                <input 
                  type="number" 
                  name="pricing.monthlyPrice"
                  value={formData.pricing.monthlyPrice}
                  onChange={handleInputChange}
                  placeholder="Auto-calculated"
                  step="0.001"
                  min="0"
                  className="route-management-form-input"
                  readOnly
                />
                <small className="route-management-help-text">
                  Auto-calculated based on pricing type
                </small>
              </div>
            </div>

            {/* Pricing Type Selection */}
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Monthly Pricing Type</label>
                <select 
                  name="pricingType" 
                  value={formData.pricingType}
                  onChange={handleInputChange}
                  className="route-management-form-select"
                >
                  <option value="perDay">Per Day (Selected Days Only)</option>
                  <option value="weekly">Weekly (Mon-Fri Only)</option>
                  <option value="monthly">Monthly (All Days Unlimited)</option>
                  <option value="custom">Custom Day Pricing</option>
                </select>
                <small className="route-management-help-text">
                  {formData.pricingType === "perDay" && "Passenger pays for selected days only"}
                  {formData.pricingType === "weekly" && "Passenger pays for Monday-Friday (5 days)"}
                  {formData.pricingType === "monthly" && "Passenger pays for unlimited travel on all days"}
                  {formData.pricingType === "custom" && "Passenger pays based on custom day pricing"}
                </small>
              </div>
            </div>

            {/* Custom Day Pricing */}
            {formData.pricingType === "custom" && (
              <div className="route-management-form-section">
                <h4 className="route-management-section-title">📅 Custom Day Pricing</h4>
                <div className="route-management-form-row">
                  {[
                    { key: 'monday', label: 'Monday' },
                    { key: 'tuesday', label: 'Tuesday' },
                    { key: 'wednesday', label: 'Wednesday' },
                    { key: 'thursday', label: 'Thursday' },
                    { key: 'friday', label: 'Friday' },
                    { key: 'saturday', label: 'Saturday' },
                    { key: 'sunday', label: 'Sunday' }
                  ].map(day => (
                    <div key={day.key} className="route-management-form-group">
                      <label className="route-management-form-label">{day.label} (KWD)</label>
                      <input 
                        type="number" 
                        name={`customPricing.${day.key}`}
                        value={formData.customPricing[day.key]}
                        onChange={handleInputChange}
                        placeholder="0.000"
                        step="0.001"
                        min="0"
                        className="route-management-form-input"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Calculation Display */}
            <div className="route-management-pricing-summary">
              <h4>💰 Pricing Summary - Monthly Pass</h4>
              <div className="route-management-pricing-breakdown">
                <div className="route-management-pricing-item">
                  <span>One Way Pass:</span>
                  <span className="route-management-price-highlight">KWD {Number(formData.pricing.oneWayPrice || 0).toFixed(3)}</span>
                </div>
                {formData.pricing.roundTripPrice > 0 && (
                  <div className="route-management-pricing-item">
                    <span>Round Trip Pass:</span>
                    <span className="route-management-price-highlight">KWD {Number(formData.pricing.roundTripPrice || 0).toFixed(3)}</span>
                  </div>
                )}
                <div className="route-management-pricing-item">
                  <span>Monthly Pass ({formData.pricingType}):</span>
                  <span className="route-management-monthly-price">KWD {Number(formData.pricing.monthlyPrice || 0).toFixed(3)}</span>
                </div>
                <div className="route-management-pricing-formula">
                  <small>
                    {formData.pricingType === "perDay" && `${formData.availableDays.length} selected days × KWD ${Number(formData.pricing.oneWayPrice || 0).toFixed(3)} × 4 weeks`}
                    {formData.pricingType === "weekly" && `5 days (Mon-Fri) × KWD ${Number(formData.pricing.oneWayPrice || 0).toFixed(3)} × 4 weeks`}
                    {formData.pricingType === "monthly" && `Fixed monthly price`}
                    {formData.pricingType === "custom" && `Custom pricing for selected days × 4 weeks`}
                  </small>
                </div>
                {formData.pricing.roundTripPrice > 0 && (
                  <div className="route-management-round-trip-formula">
                    <small>
                      <strong>Round Trip Option:</strong> Passenger can choose round trip pass for KWD {Number(formData.pricing.roundTripPrice || 0).toFixed(3)} per trip
                    </small>
                  </div>
                )}
                <div className="route-management-pricing-note">
                  <small>
                    <strong>Note:</strong> This is a monthly pass - passenger can travel unlimited times within the selected days
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">🚗 Assignment (Optional)</h4>
            
            <div className="route-management-form-row">
              <div className="route-management-form-group">
                <label className="route-management-form-label">Assigned Vehicle</label>
                <select 
                  name="assignedVehicle" 
                  value={formData.assignedVehicle}
                  onChange={handleInputChange}
                  className="route-management-form-select"
                  disabled={!formData.b2cPartnerId}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle._id} value={vehicle._id}>
                      {vehicle.make} {vehicle.model} - {vehicle.licensePlate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="route-management-form-group">
                <label className="route-management-form-label">Assigned Driver</label>
                <select 
                  name="assignedDriver" 
                  value={formData.assignedDriver}
                  onChange={handleInputChange}
                  className="route-management-form-select"
                  disabled={!formData.b2cPartnerId}
                >
                  <option value="">Select Driver</option>
                  {drivers.map(driver => (
                    <option key={driver._id} value={driver._id}>
                      {driver.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="route-management-form-section">
            <h4 className="route-management-section-title">📝 Description</h4>
            
            <div className="route-management-form-group">
              <label className="route-management-form-label">Route Description</label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the route, landmarks, special instructions..."
                className="route-management-form-textarea"
                rows="3"
              />
            </div>
          </div>

          {errors.submit && (
            <div className="route-management-error-message">
              {errors.submit}
            </div>
          )}

          <div className="route-management-modal-footer">
            <button 
              type="button" 
              className="route-management-btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="route-management-btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdminCreateRouteModal
