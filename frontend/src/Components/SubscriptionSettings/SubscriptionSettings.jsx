import { getActiveCurrency } from "../../config/localeConfig";
import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import "./SubscriptionSettings.css";

// Map backend renewal method <-> UI select value
const METHOD_TO_UI = {
  SAME_CARD: "CARD",
  WALLET: "WALLET",
  CASH: "CASH",
  MANUAL: "MANUAL",
};
const UI_TO_BACKEND = {
  CARD: "SAME_CARD",
  WALLET: "WALLET",
  CASH: "CASH",
  MANUAL: "MANUAL",
};

const SubscriptionSettings = () => {
  const [settings, setSettings] = useState({
    autoRenewal: false,
    renewalReminderDays: 7,
    paymentMethod: "CARD",
    emailNotifications: true,
    smsNotifications: false,
  });
  const [activePass, setActivePass] = useState(null);
  const [activePasses, setActivePasses] = useState([]);
  const [selectedPassId, setSelectedPassId] = useState("");
  // How many months the commuter wants to renew for (minimum 1, no fixed max).
  const [renewalMonths, setRenewalMonths] = useState(1);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState(getActiveCurrency());
  const [pendingCash, setPendingCash] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/subscription-settings/settings");
      if (response.data.success) {
        const s = response.data.data.settings;
        setSettings({
          autoRenewal: !!s.autoRenewal,
          renewalReminderDays: s.renewalReminderDays || 7,
          paymentMethod: METHOD_TO_UI[s.renewalPaymentMethod] || "CARD",
          emailNotifications: s.emailNotifications?.renewalReminder ?? true,
          smsNotifications: s.smsNotifications?.renewalReminder ?? false,
        });
        const passes = Array.isArray(s.activePasses) ? s.activePasses : [];
        setActivePasses(passes);
        // Preserve current selection if it still exists, else default to first pass
        setSelectedPassId((prev) => {
          if (prev && passes.some((p) => String(p._id) === String(prev)))
            return prev;
          return passes[0] ? String(passes[0]._id) : "";
        });
        setActivePass(s.activePass || passes[0] || null);
        setPendingCash(
          s.pendingCashRenewal?.requested ? s.pendingCashRenewal : null,
        );
        setHistory(
          Array.isArray(s.renewalHistory)
            ? [...s.renewalHistory].reverse()
            : [],
        );
        setWalletBalance(response.data.data.walletBalance || 0);
        setWalletCurrency(response.data.data.walletCurrency || getActiveCurrency());
      } else {
        setError(response.data.message || "Failed to fetch settings");
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Network error. Please try again.");
    }
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        autoRenewal: settings.autoRenewal,
        renewalReminderDays: Number(settings.renewalReminderDays),
        renewalPaymentMethod:
          UI_TO_BACKEND[settings.paymentMethod] || "SAME_CARD",
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        selectedPassId: selectedPassId || undefined,
      };
      const response = await api.put(
        "/subscription-settings/settings",
        payload,
      );
      if (response.data.success) {
        flashSuccess("Settings updated successfully!");
        fetchSettings();
      } else {
        setError(response.data.message || "Failed to update settings");
      }
    } catch (err) {
      console.error("Error updating settings:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRenewNow = async () => {
    setRenewing(true);
    setError("");
    setSuccess("");
    try {
      const backendMethod =
        UI_TO_BACKEND[settings.paymentMethod] || "SAME_CARD";
      const response = await api.post("/subscription-settings/renew", {
        paymentMethod: backendMethod,
        passId: selectedPassId || undefined,
        renewalMonths: Number(renewalMonths) || 1,
      });
      if (response.data.success) {
        const data = response.data.data;
        if (data?.paymentRequired && data?.payment?.paymentUrl) {
          // Card renewal -> redirect to the secure payment page
          flashSuccess("Redirecting to secure payment...");
          if (window.self !== window.top) {
            window.open(data.payment.paymentUrl, "_blank");
          } else {
            window.location.href = data.payment.paymentUrl;
          }
        } else {
          flashSuccess(
            response.data.message || "Monthly pass renewed successfully!",
          );
          fetchSettings();
        }
      } else {
        setError(response.data.message || "Failed to renew");
      }
    } catch (err) {
      console.error("Error renewing:", err);
      setError(
        err.response?.data?.message || "Network error. Please try again.",
      );
    } finally {
      setRenewing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }
    try {
      const response = await api.post("/subscription-settings/cancel", {
        reason: cancelReason,
      });
      if (response.data.success) {
        flashSuccess("Subscription cancelled successfully");
        setShowCancelModal(false);
        setCancelReason("");
        setSettings((prev) => ({ ...prev, autoRenewal: false }));
        fetchSettings();
      } else {
        setError(response.data.message || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setError("Network error. Please try again.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  const renewActionLabel = () => {
    switch (settings.paymentMethod) {
      case "WALLET":
        return "Renew with Wallet";
      case "CASH":
        return "Request Cash Renewal";
      default:
        return "Renew with Card";
    }
  };

  // The pass the commuter is currently managing/renewing
  const selectedPass =
    activePasses.find((p) => String(p._id) === String(selectedPassId)) ||
    activePass;

  // Per-month price (fall back to dividing the stored total by its duration).
  const perMonthAmount = selectedPass
    ? (selectedPass.monthlyAmount ??
      (selectedPass.totalAmount || 0) /
        Math.max(1, selectedPass.durationMonths || 1))
    : 0;

  // The renewal amount is the per-month price multiplied by the chosen months.
  const computedRenewalAmount = perMonthAmount * (Number(renewalMonths) || 1);

  const walletInsufficient =
    settings.paymentMethod === "WALLET" &&
    selectedPass &&
    walletBalance < computedRenewalAmount;

  return (
    <div className="ss-subscription-settings-container">
      <div className="ss-settings-header">
        <h2>Subscription Settings</h2>
        <p>Manage your monthly pass and renewal preferences</p>
      </div>

      {error && <div className="ss-error-message">{error}</div>}
      {success && <div className="ss-success-message">{success}</div>}

      {/* Current pass status */}
      <div className="ss-settings-section">
        <h3>Current Monthly Pass</h3>

        {activePasses.length > 1 && (
          <div className="ss-setting-item ss-pass-selector">
            <label>Select pass to manage / renew</label>
            <select
              value={selectedPassId}
              onChange={(e) => setSelectedPassId(e.target.value)}
            >
              {activePasses.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.routeLabel} — valid until {formatDate(p.endDate)} (
                  {p.currency} {Number(p.totalAmount || 0).toFixed(2)})
                </option>
              ))}
            </select>
            <p className="ss-setting-description">
              You have {activePasses.length} active passes. Choose which one to
              renew or update.
            </p>
          </div>
        )}

        {selectedPass ? (
          <div className="ss-status-grid">
            {selectedPass.routeLabel && (
              <div className="ss-status-card">
                <span className="ss-status-label">Route</span>
                <span className="ss-status-value">
                  {selectedPass.routeLabel}
                </span>
              </div>
            )}
            <div className="ss-status-card">
              <span className="ss-status-label">Status</span>
              <span className="ss-status-value ss-status-active">
                {selectedPass.status}
              </span>
            </div>
            <div className="ss-status-card">
              <span className="ss-status-label">Valid Until</span>
              <span className="ss-status-value">
                {formatDate(selectedPass.endDate)}
              </span>
            </div>
            <div className="ss-status-card">
              <span className="ss-status-label">Days Remaining</span>
              <span className="ss-status-value">
                {selectedPass.daysRemaining ?? "—"}
              </span>
            </div>
            <div className="ss-status-card">
              <span className="ss-status-label">Renewal Amount</span>
              <span className="ss-status-value">
                {selectedPass.currency}{" "}
                {Number(computedRenewalAmount || 0).toFixed(2)}
              </span>
            </div>
          </div>
        ) : // placeholder branch handled below
        null}

        {selectedPass && !pendingCash && (
          <div className="ss-setting-item ss-renewal-duration">
            <label>Renew for how many months?</label>
            <div className="ss-duration-control">
              <button
                type="button"
                className="ss-duration-btn"
                onClick={() =>
                  setRenewalMonths((m) => Math.max(1, Number(m) - 1))
                }
                disabled={Number(renewalMonths) <= 1}
                aria-label="Decrease months"
              >
                {"\u2212"}
              </button>
              <input
                type="number"
                min="1"
                max="12"
                value={renewalMonths}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value));
                  if (!Number.isFinite(v)) return setRenewalMonths(1);
                  setRenewalMonths(Math.min(12, Math.max(1, v)));
                }}
                className="ss-duration-input"
              />
              <button
                type="button"
                className="ss-duration-btn"
                onClick={() =>
                  setRenewalMonths((m) => Math.min(12, Number(m) + 1))
                }
                disabled={Number(renewalMonths) >= 12}
                aria-label="Increase months"
              >
                +
              </button>
              <span className="ss-duration-suffix">
                month{Number(renewalMonths) > 1 ? "s" : ""}
              </span>
            </div>
            <p className="ss-setting-description">
              Choose any number of months (minimum 1). You&apos;ll be charged{" "}
              {selectedPass.currency} {Number(perMonthAmount || 0).toFixed(2)} ×{" "}
              {renewalMonths} ={" "}
              <strong>
                {selectedPass.currency}{" "}
                {Number(computedRenewalAmount || 0).toFixed(2)}
              </strong>
              . Your pass will be extended from its current expiry date.
            </p>
          </div>
        )}

        {!selectedPass && (
          <p className="ss-setting-description">
            You don&apos;t have an active monthly pass yet. Purchase a pass to
            manage renewals here.
          </p>
        )}

        {pendingCash && (
          <div className="ss-pending-banner">
            Cash renewal of {walletCurrency}{" "}
            {Number(pendingCash.amount || 0).toFixed(2)} is awaiting admin
            confirmation (requested {formatDate(pendingCash.requestedAt)}). Your
            renewed pass activates once the admin confirms your cash payment.
          </div>
        )}
      </div>

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
              Your monthly pass will automatically renew at the end of each
              billing cycle using your preferred payment method. (Cash renewals
              are always confirmed manually by the admin.)
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
            <option value="CARD">Credit / Debit Card</option>
            <option value="WALLET">
              Wallet Balance ({walletCurrency}{" "}
              {Number(walletBalance).toFixed(2)})
            </option>
            <option value="CASH">Cash to Admin</option>
          </select>
          <p className="ss-setting-description">
            {settings.paymentMethod === "CARD" &&
              "A secure payment link is generated each cycle. You confirm the charge to renew."}
            {settings.paymentMethod === "WALLET" &&
              "The renewal amount is deducted from your wallet balance automatically."}
            {settings.paymentMethod === "CASH" &&
              "You pay the admin in cash; your pass activates once the admin confirms the payment."}
          </p>
          {walletInsufficient && (
            <p className="ss-warning-text">
              Your wallet balance ({walletCurrency}{" "}
              {Number(walletBalance).toFixed(2)}) is lower than the renewal
              amount. Please top up your wallet to use wallet renewal.
            </p>
          )}
        </div>

        {selectedPass && !pendingCash && (
          <button
            className="ss-renew-btn"
            onClick={handleRenewNow}
            disabled={renewing}
          >
            {renewing ? "Processing..." : renewActionLabel()}
          </button>
        )}
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
              Receive trip updates, renewal reminders, and promotional offers
              via email
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

      {history.length > 0 && (
        <div className="ss-settings-section">
          <h3>Renewal History</h3>
          <div className="ss-history-list">
            {history.slice(0, 5).map((h, idx) => (
              <div className="ss-history-row" key={idx}>
                <span className="ss-history-date">{formatDate(h.date)}</span>
                <span
                  className={`ss-history-status ss-status-${(h.status || "").toLowerCase()}`}
                >
                  {h.status}
                </span>
                <span className="ss-history-method">
                  {(h.paymentMethod || "").replace("_", " ")}
                </span>
                <span className="ss-history-amount">
                  {walletCurrency} {Number(h.amount || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ss-settings-actions">
        <button
          className="ss-save-btn"
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Settings"}
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
