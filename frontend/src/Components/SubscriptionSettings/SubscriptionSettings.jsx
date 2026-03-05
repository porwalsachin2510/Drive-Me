import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './SubscriptionSettings.css';

const SubscriptionSettings = () => {
  const [settings, setSettings] = useState({
    autoRenewal: true,
    renewalReminderDays: 7,
    paymentMethod: 'CREDIT_CARD',
    emailNotifications: true,
    smsNotifications: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/subscription-settings/settings');
      if (response.data.success) {
        setSettings(response.data.data.settings);
      } else {
        setError(response.data.message || 'Failed to fetch settings');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Network error. Please try again.');
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.put('/subscription-settings/settings', settings);
      if (response.data.success) {
        setSuccess('Settings updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.message || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }
    try {
      const response = await api.post('/subscription-settings/cancel', { reason: cancelReason });
      if (response.data.success) {
        setSuccess('Subscription cancelled successfully');
        setShowCancelModal(false);
        setCancelReason('');
        setSettings(prev => ({ ...prev, autoRenewal: false }));
      } else {
        setError(response.data.message || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError('Network error. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="ss-subscription-settings-container">
      <div className="ss-settings-header">
        <h2>Subscription Settings</h2>
        <p>Manage your monthly pass and renewal preferences</p>
      </div>

      {error && <div className="ss-error-message">{error}</div>}
      {success && <div className="ss-success-message">{success}</div>}

      <div className="ss-settings-section">
        <h3>Auto-Renewal</h3>
        <div className="ss-setting-row">
          <div className="ss-setting-item">
            <label className="ss-checkbox-label">
              <input
                type="checkbox"
                name="autoRenewal"
                checked={settings.autoRenewal}
                onChange={handleInputChange}
              />
              <span className="ss-checkmark"></span>
              Enable automatic renewal
            </label>
            <p className="ss-setting-description">
              Your monthly pass will automatically renew at the end of each billing cycle.
            </p>
          </div>

          <div className="ss-setting-item">
            <label>Renewal Reminder</label>
            <select
              name="renewalReminderDays"
              value={settings.renewalReminderDays}
              onChange={handleInputChange}
              disabled={!settings.autoRenewal}
            >
              <option value={3}>3 days before</option>
              <option value={7}>7 days before</option>
              <option value={14}>14 days before</option>
              <option value={30}>30 days before</option>
            </select>
            <p className="ss-setting-description">
              When to send renewal reminder notifications
            </p>
          </div>
        </div>
      </div>

      <div className="ss-settings-section">
        <h3>Payment Method</h3>
        <div className="ss-setting-item">
          <label>Preferred payment method for renewals</label>
          <select
            name="paymentMethod"
            value={settings.paymentMethod}
            onChange={handleInputChange}
          >
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="DEBIT_CARD">Debit Card</option>
            <option value="WALLET">Wallet Balance</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
      </div>

      <div className="ss-settings-section">
        <h3>Notifications</h3>
        <div className="ss-setting-row">
          <div className="ss-setting-item">
            <label className="ss-checkbox-label">
              <input
                type="checkbox"
                name="emailNotifications"
                checked={settings.emailNotifications}
                onChange={handleInputChange}
              />
              <span className="ss-checkmark"></span>
              Email notifications
            </label>
            <p className="ss-setting-description">
              Receive trip updates, renewal reminders, and promotional offers via email
            </p>
          </div>

          <div className="ss-setting-item">
            <label className="ss-checkbox-label">
              <input
                type="checkbox"
                name="smsNotifications"
                checked={settings.smsNotifications}
                onChange={handleInputChange}
              />
              <span className="ss-checkmark"></span>
              SMS notifications
            </label>
            <p className="ss-setting-description">
              Receive important trip alerts via SMS
            </p>
          </div>
        </div>
      </div>

      <div className="ss-settings-actions">
        <button
          className="ss-save-btn"
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>

        <button
          className="ss-cancel-btn"
          onClick={() => setShowCancelModal(true)}
        >
          Cancel Subscription
        </button>
      </div>

      {showCancelModal && (
        <div className="ss-cancel-overlay">
          <div className="ss-cancel-modal">
            <div className="ss-cancel-header">
              <h3>Cancel Subscription</h3>
              <button 
                className="ss-close-btn" 
                onClick={() => setShowCancelModal(false)}
              >
                {"\u00D7"}
              </button>
            </div>
            
            <div className="ss-cancel-content">
              <p className="ss-cancel-warning">
                <strong>Warning:</strong> Cancelling your subscription will:
              </p>
              <ul className="ss-cancel-effects">
                <li>Stop automatic renewals</li>
                <li>Remove access to monthly passes</li>
                <li>{"You'll need to book individual trips"}</li>
                <li>Current benefits will end at billing cycle end</li>
              </ul>
              
              <div className="ss-form-group">
                <label>Reason for cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows="4"
                  placeholder="Please tell us why you're cancelling..."
                  required
                />
              </div>

              <div className="ss-cancel-actions">
                <button
                  className="ss-keep-btn"
                  onClick={() => setShowCancelModal(false)}
                >
                  Keep Subscription
                </button>
                <button
                  className="ss-confirm-cancel-btn"
                  onClick={handleCancelSubscription}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionSettings;
