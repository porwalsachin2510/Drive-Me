import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './RouteRequest.css';

const PREFERRED_TIMES = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM",
  "5:00 PM", "6:00 PM", "7:00 PM"
];

const DAY_OPTIONS = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
  { value: "SUN", label: "Sun" },
];

const RouteRequest = ({ isOpen, onClose, searchParams, onRequestSubmitted }) => {
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    preferredTime: '8:00 AM',
    requestType: 'MONTHLY',
    travelDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    expectedStartDate: '',
    additionalNotes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pre-fill from search params when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        pickupLocation: searchParams?.pickupLocation || searchParams?.pickup || '',
        dropoffLocation: searchParams?.dropoffLocation || searchParams?.dropoff || '',
      }));
      setError('');
      setSuccess('');
    }
  }, [isOpen, searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleDay = (day) => {
    setFormData(prev => {
      const days = prev.travelDays.includes(day)
        ? prev.travelDays.filter(d => d !== day)
        : [...prev.travelDays, day];
      return { ...prev, travelDays: days };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Client-side validation
    if (!formData.pickupLocation || !formData.dropoffLocation) {
      setError('Pickup and dropoff locations are required.');
      setLoading(false);
      return;
    }
    if (!formData.expectedStartDate) {
      setError('Expected start date is required.');
      setLoading(false);
      return;
    }
    if (formData.travelDays.length === 0) {
      setError('Please select at least one travel day.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        pickupLocation: formData.pickupLocation,
        dropoffLocation: formData.dropoffLocation,
        preferredTime: formData.preferredTime,
        requestType: formData.requestType,
        travelDays: formData.travelDays,
        expectedStartDate: formData.expectedStartDate,
      };

      const response = await api.post('/route-requests/request', payload);

      if (response.data.success) {
        setSuccess('Route request submitted successfully! We will notify you when this route becomes available.');
        setTimeout(() => {
          if (onRequestSubmitted) onRequestSubmitted();
          onClose();
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to submit route request');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Network error. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="route-request-overlay">
      <div className="route-request-modal">
        <div className="route-request-header">
          <h3>Request a New Route</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="route-request-form">
          <div className="form-group">
            <label>Pickup Location <span className="required">*</span></label>
            <input
              type="text"
              name="pickupLocation"
              value={formData.pickupLocation}
              onChange={handleChange}
              required
              placeholder="Enter pickup location"
            />
          </div>

          <div className="form-group">
            <label>Dropoff Location <span className="required">*</span></label>
            <input
              type="text"
              name="dropoffLocation"
              value={formData.dropoffLocation}
              onChange={handleChange}
              required
              placeholder="Enter destination"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preferred Time <span className="required">*</span></label>
              <select
                name="preferredTime"
                value={formData.preferredTime}
                onChange={handleChange}
              >
                {PREFERRED_TIMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Request Type <span className="required">*</span></label>
              <select
                name="requestType"
                value={formData.requestType}
                onChange={handleChange}
              >
                <option value="MONTHLY">Monthly Pass</option>
                <option value="WEEKLY">Weekly</option>
                <option value="ONE_TIME">One Time</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Travel Days <span className="required">*</span></label>
            <div className="days-toggle-row">
              {DAY_OPTIONS.map(day => (
                <button
                  key={day.value}
                  type="button"
                  className={`day-toggle-btn ${formData.travelDays.includes(day.value) ? 'active' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Expected Start Date <span className="required">*</span></label>
            <input
              type="date"
              name="expectedStartDate"
              value={formData.expectedStartDate}
              onChange={handleChange}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RouteRequest;
