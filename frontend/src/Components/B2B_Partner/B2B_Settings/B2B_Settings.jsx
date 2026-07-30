"use client";

import { useState, useEffect } from "react";
import "./b2b_settings.css";
import api from "../../../utils/api";
import { notify } from "../../../utils/toast";

function B2B_Settings() {
  const [formData, setFormData] = useState({
    companyName: "",
    tradeLicense: "",
    officeAddress: "",
    email: "",
    phone: "",
    website: "",
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: true,
    bookingAlerts: true,
    paymentAlerts: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get("/b2b-partner/settings");
      const settings = response.data.data.settings;

      setFormData({
        companyName: settings.companyName || "",
        tradeLicense: settings.tradeLicense || "",
        officeAddress: settings.officeAddress || "",
        email: settings.email || "",
        phone: settings.phone || "",
        website: settings.website || "",
      });

      setNotifications(
        settings.notifications || {
          emailNotifications: true,
          smsNotifications: true,
          bookingAlerts: true,
          paymentAlerts: true,
        },
      );
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNotificationChange = (key) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put("/b2b-partner/settings", {
        companyInfo: formData,
        notifications,
      });
      notify("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      notify("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !dataLoaded) {
    return (
      <div className="b2b-operator-dashboard-b2b-settings">
        <div className="b2b-operator-dashboard-loading">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="b2b-operator-dashboard-b2b-settings">
      <div className="b2b-operator-dashboard-b2b-settings-grid">
        <div className="b2b-operator-dashboard-b2b-settings-section">
          <div className="b2b-operator-dashboard-b2b-section-header">
            <div className="b2b-operator-dashboard-b2b-section-icon">🏢</div>
            <h2>Company Profile</h2>
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Company Name</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              placeholder="Enter company name"
            />
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Trade License</label>
            <input
              type="text"
              name="tradeLicense"
              value={formData.tradeLicense}
              onChange={handleInputChange}
              placeholder="Enter trade license number"
            />
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Office Address</label>
            <textarea
              name="officeAddress"
              value={formData.officeAddress}
              onChange={handleInputChange}
              placeholder="Enter office address"
              rows={3}
            />
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
            />
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter phone number"
            />
          </div>
          <div className="b2b-operator-dashboard-b2b-form-group">
            <label>Website</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="Enter website URL"
            />
          </div>
        </div>

        <div className="b2b-operator-dashboard-b2b-settings-section">
          <div className="b2b-operator-dashboard-b2b-section-header">
            <div className="b2b-operator-dashboard-b2b-section-icon">🔔</div>
            <h2>Notification Preferences</h2>
          </div>
          <div className="b2b-operator-dashboard-b2b-notification-item">
            <label className="b2b-operator-dashboard-b2b-switch">
              <input
                type="checkbox"
                checked={notifications.contracts}
                onChange={() => handleNotificationChange("contracts")}
              />
              <span className="b2b-operator-dashboard-b2b-slider"></span>
            </label>
            <div className="b2b-operator-dashboard-b2b-notification-info">
              <h4>Contract Notifications</h4>
              <p>Get notified about new contracts and renewals</p>
            </div>
          </div>
          <div className="b2b-operator-dashboard-b2b-notification-item">
            <label className="b2b-operator-dashboard-b2b-switch">
              <input
                type="checkbox"
                checked={notifications.maintenance}
                onChange={() => handleNotificationChange("maintenance")}
              />
              <span className="b2b-operator-dashboard-b2b-slider"></span>
            </label>
            <div className="b2b-operator-dashboard-b2b-notification-info">
              <h4>Maintenance Alerts</h4>
              <p>Receive alerts for vehicle maintenance schedules</p>
            </div>
          </div>
          <div className="b2b-operator-dashboard-b2b-notification-item">
            <label className="b2b-operator-dashboard-b2b-switch">
              <input
                type="checkbox"
                checked={notifications.drivers}
                onChange={() => handleNotificationChange("drivers")}
              />
              <span className="b2b-operator-dashboard-b2b-slider"></span>
            </label>
            <div className="b2b-operator-dashboard-b2b-notification-info">
              <h4>Driver Updates</h4>
              <p>Get updates about driver availability and performance</p>
            </div>
          </div>
          <div className="b2b-operator-dashboard-b2b-notification-item">
            <label className="b2b-operator-dashboard-b2b-switch">
              <input
                type="checkbox"
                checked={notifications.marketing}
                onChange={() => handleNotificationChange("marketing")}
              />
              <span className="b2b-operator-dashboard-b2b-slider"></span>
            </label>
            <div className="b2b-operator-dashboard-b2b-notification-info">
              <h4>Marketing Communications</h4>
              <p>Receive promotional offers and platform updates</p>
            </div>
          </div>
        </div>
      </div>

      <div className="b2b-operator-dashboard-b2b-settings-actions">
        <button
          className="b2b-operator-dashboard-b2b-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default B2B_Settings;
