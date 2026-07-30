"use client";

import { useState, useEffect } from "react";
import "./AdminComm.css";
import api from "../../../utils/api";
import { notify } from "../../../utils/toast";

function AdminComm() {
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [emailConfig, setEmailConfig] = useState({
    smtpHost: "",
    smtpPort: "",
    username: "",
    password: "",
    active: false,
  });
  const [whatsappConfig, setWhatsappConfig] = useState({
    accountSid: "",
    authToken: "",
    phoneNumber: "",
    active: false,
  });
  const [smsConfig, setSmsConfig] = useState({
    accountSid: "",
    authToken: "",
    phoneNumber: "",
    active: false,
  });

  // Messaging mode: 'single' or 'bulk'
  const [messagingMode, setMessagingMode] = useState("single");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userFilter, setUserFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkRecipients, setBulkRecipients] = useState(""); // For manual entry
  const [sendingProgress, setSendingProgress] = useState({
    sending: false,
    sent: 0,
    total: 0,
    failed: 0,
  });

  // SMS state
  const [smsRecipientNumber, setSmsRecipientNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");

  // WhatsApp state
  const [selectedTemplate, setSelectedTemplate] = useState("promo");
  const [recipientNumber, setRecipientNumber] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");

  // Email state
  const [emailTemplate, setEmailTemplate] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  useEffect(() => {
    fetchCommData();
  }, []);

  const fetchCommData = async () => {
    try {
      setLoading(true);

      // Fetch templates
      const templatesResponse = await api.get("/admin/comm/templates");
      setTemplates(templatesResponse.data.templates);

      // Fetch sent messages
      const messagesResponse = await api.get("/admin/comm/messages");
      setSentMessages(messagesResponse.data.messages);

      // Fetch configurations
      const configResponse = await api.get("/admin/comm/config");
      setEmailConfig(configResponse.data.emailConfig);
      setWhatsappConfig(configResponse.data.whatsappConfig);
      setSmsConfig(configResponse.data.smsConfig);

      // Fetch users for bulk messaging
      try {
        const usersResponse = await api.get("/admin/users?limit=1000");
        setUsers(usersResponse.data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    } catch (error) {
      console.error("Error fetching communication data:", error);
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable) => {
    if (activeTab === "whatsapp") {
      setWhatsappMessage((prev) => prev + `{{${variable}}}`);
    } else if (activeTab === "email") {
      setEmailBody((prev) => prev + `{{${variable}}}`);
    } else if (activeTab === "sms") {
      setSmsMessage((prev) => prev + `{{${variable}}}`);
    }
  };

  // Get recipients based on mode
  const getRecipients = () => {
    if (messagingMode === "single") {
      if (activeTab === "whatsapp") return [{ phone: recipientNumber }];
      if (activeTab === "email") return [{ email: recipientEmail }];
      if (activeTab === "sms") return [{ phone: smsRecipientNumber }];
    } else {
      // Bulk mode - combine selected users and manual entries
      let recipients = [];

      // Add selected users
      selectedUsers.forEach((userId) => {
        const user = users.find((u) => u._id === userId);
        if (user) {
          if (activeTab === "email") {
            recipients.push({
              email: user.email,
              name: user.fullName,
              userId: user._id,
            });
          } else {
            recipients.push({
              phone: user.phone || user.whatsappNumber,
              name: user.fullName,
              userId: user._id,
            });
          }
        }
      });

      // Add manual bulk entries
      if (bulkRecipients.trim()) {
        const manualEntries = bulkRecipients
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter((e) => e);
        manualEntries.forEach((entry) => {
          if (activeTab === "email") {
            recipients.push({ email: entry });
          } else {
            recipients.push({ phone: entry });
          }
        });
      }

      return recipients;
    }
    return [];
  };

  const handleSendMessage = async () => {
    const recipients = getRecipients();

    if (recipients.length === 0) {
      notify("Please add at least one recipient");
      return;
    }

    // For bulk sending, use bulk API
    if (messagingMode === "bulk" && recipients.length > 1) {
      setSendingProgress({
        sending: true,
        sent: 0,
        total: recipients.length,
        failed: 0,
      });

      try {
        if (activeTab === "whatsapp") {
          const response = await api.post("/admin/comm/whatsapp/send-bulk", {
            recipients: recipients.map((r) => ({
              phone: r.phone,
              name: r.name,
              userId: r.userId,
            })),
            message: whatsappMessage,
            templateId: selectedTemplate,
          });
          setSendingProgress({
            sending: false,
            sent: response.data.sent,
            total: recipients.length,
            failed: response.data.failed,
          });
        } else if (activeTab === "email") {
          const response = await api.post("/admin/comm/email/send-bulk", {
            recipients: recipients.map((r) => ({
              email: r.email,
              name: r.name,
              userId: r.userId,
            })),
            subject: emailSubject,
            body: emailBody,
            templateId: emailTemplate,
          });
          setSendingProgress({
            sending: false,
            sent: response.data.sent,
            total: recipients.length,
            failed: response.data.failed,
          });
        } else if (activeTab === "sms") {
          const response = await api.post("/admin/comm/sms/send-bulk", {
            recipients: recipients.map((r) => ({
              phone: r.phone,
              name: r.name,
              userId: r.userId,
            })),
            message: smsMessage,
            templateId: smsTemplate,
          });
          setSendingProgress({
            sending: false,
            sent: response.data.sent,
            total: recipients.length,
            failed: response.data.failed,
          });
        }

        // Reset selections
        setSelectedUsers([]);
        setBulkRecipients("");
        fetchCommData();
      } catch (error) {
        console.error("Error sending bulk messages:", error);
        setSendingProgress({
          sending: false,
          sent: 0,
          total: recipients.length,
          failed: recipients.length,
        });
      }
      return;
    }

    // Single recipient
    try {
      if (activeTab === "whatsapp") {
        await api.post("/admin/comm/whatsapp/send", {
          recipientNumber,
          message: whatsappMessage,
          templateId: selectedTemplate,
        });
      } else if (activeTab === "email") {
        await api.post("/admin/comm/email/send", {
          recipientEmail,
          subject: emailSubject,
          body: emailBody,
          templateId: emailTemplate,
        });
      } else if (activeTab === "sms") {
        await api.post("/admin/comm/sms/send", {
          recipientNumber: smsRecipientNumber,
          message: smsMessage,
          templateId: smsTemplate,
        });
      }

      // Reset form
      if (activeTab === "whatsapp") {
        setRecipientNumber("");
        setWhatsappMessage("");
      } else if (activeTab === "email") {
        setRecipientEmail("");
        setEmailSubject("");
        setEmailBody("");
      } else if (activeTab === "sms") {
        setSmsRecipientNumber("");
        setSmsMessage("");
      }

      // Refresh messages
      fetchCommData();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Filter users based on search and filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);

    const matchesFilter = userFilter === "all" || user.role === userFilter;

    return matchesSearch && matchesFilter;
  });

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Select all filtered users
  const selectAllUsers = () => {
    const filteredIds = filteredUsers.map((u) => u._id);
    setSelectedUsers((prev) => {
      const allSelected = filteredIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      } else {
        return [...new Set([...prev, ...filteredIds])];
      }
    });
  };

  // Render recipient selector (shared component)
  const renderRecipientSelector = () => (
    <div className="recipient-selector">
      <div className="mode-toggle">
        <button
          className={`mode-btn ${messagingMode === "single" ? "active" : ""}`}
          onClick={() => setMessagingMode("single")}
        >
          Single Recipient
        </button>
        <button
          className={`mode-btn ${messagingMode === "bulk" ? "active" : ""}`}
          onClick={() => setMessagingMode("bulk")}
        >
          Bulk Recipients
        </button>
      </div>

      {messagingMode === "single" ? (
        <div className="single-recipient">
          {activeTab === "email" ? (
            <div className="form-group">
              <label>Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Recipient Phone Number</label>
              <input
                type="tel"
                value={
                  activeTab === "whatsapp"
                    ? recipientNumber
                    : smsRecipientNumber
                }
                onChange={(e) =>
                  activeTab === "whatsapp"
                    ? setRecipientNumber(e.target.value)
                    : setSmsRecipientNumber(e.target.value)
                }
                placeholder="+965 XXXXXXXX"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bulk-recipient">
          <div className="bulk-tabs">
            <div className="user-selection">
              <div className="selection-header">
                <h4>Select Users ({selectedUsers.length} selected)</h4>
                <div className="selection-controls">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Users</option>
                    <option value="corporate_employee">
                      Corporate Employees
                    </option>
                    <option value="commuter">Commuters</option>
                    <option value="partner">Partners</option>
                    <option value="driver">Drivers</option>
                  </select>
                  <button className="select-all-btn" onClick={selectAllUsers}>
                    {filteredUsers.every((u) => selectedUsers.includes(u._id))
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              </div>

              <div className="user-list">
                {filteredUsers.slice(0, 100).map((user) => (
                  <div
                    key={user._id}
                    className={`user-item ${selectedUsers.includes(user._id) ? "selected" : ""}`}
                    onClick={() => toggleUserSelection(user._id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => {}}
                    />
                    <div className="user-info">
                      <span className="user-name">
                        {user.fullName || "Unknown"}
                      </span>
                      <span className="user-contact">
                        {activeTab === "email"
                          ? user.email
                          : user.phone || user.whatsappNumber || "No phone"}
                      </span>
                    </div>
                    <span className="user-role">{user.role}</span>
                  </div>
                ))}
                {filteredUsers.length > 100 && (
                  <div className="more-users">
                    +{filteredUsers.length - 100} more users (use search to find
                    specific users)
                  </div>
                )}
              </div>
            </div>

            <div className="manual-entry">
              <h4>Or Enter Manually</h4>
              <textarea
                value={bulkRecipients}
                onChange={(e) => setBulkRecipients(e.target.value)}
                placeholder={
                  activeTab === "email"
                    ? "Enter email addresses (one per line, or comma/semicolon separated)\n\nExample:\nuser1@example.com\nuser2@example.com, user3@example.com"
                    : "Enter phone numbers (one per line, or comma/semicolon separated)\n\nExample:\n+965XXXXXXXX\n+965YYYYYYYY, +965ZZZZZZZZ"
                }
                rows={6}
              />
              <small>
                {bulkRecipients.split(/[\n,;]+/).filter((e) => e.trim()).length}{" "}
                manual entries
              </small>
            </div>
          </div>

          <div className="bulk-summary">
            <strong>
              Total Recipients:{" "}
              {selectedUsers.length +
                bulkRecipients.split(/[\n,;]+/).filter((e) => e.trim()).length}
            </strong>
          </div>
        </div>
      )}
    </div>
  );

  const handleConfigUpdate = async (type, config) => {
    try {
      await api.put(`/admin/comm/config/${type}`, config);
      fetchCommData();
    } catch (error) {
      console.error("Error updating config:", error);
    }
  };

  const renderWhatsApp = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>WhatsApp Communication</h3>
        <div className="comm-stats">
          <div className="stat-item">
            <span className="stat-number">
              {sentMessages.filter((m) => m.type === "whatsapp").length}
            </span>
            <span className="stat-label">Messages Sent</span>
          </div>
        </div>
      </div>

      <div className="comm-content">
        <div className="message-form">
          <div className="form-group">
            <label>Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              <option value="promo">Promotional</option>
              <option value="booking">Booking Confirmation</option>
              <option value="payment">Payment Reminder</option>
              <option value="support">Support</option>
            </select>
          </div>

          {renderRecipientSelector()}

          <div className="form-group">
            <label>Message</label>
            <textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              placeholder="Enter your message..."
              rows={6}
            />
          </div>

          <div className="variables">
            <label>Insert Variables:</label>
            <div className="variable-buttons">
              <button onClick={() => insertVariable("userName")}>
                User Name
              </button>
              <button onClick={() => insertVariable("bookingId")}>
                Booking ID
              </button>
              <button onClick={() => insertVariable("amount")}>Amount</button>
              <button onClick={() => insertVariable("date")}>Date</button>
            </div>
          </div>

          {sendingProgress.sending && (
            <div className="sending-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(sendingProgress.sent / sendingProgress.total) * 100}%`,
                  }}
                />
              </div>
              <span>
                Sending... {sendingProgress.sent}/{sendingProgress.total}
              </span>
            </div>
          )}

          {!sendingProgress.sending && sendingProgress.total > 0 && (
            <div className="send-result">
              Sent: {sendingProgress.sent} | Failed: {sendingProgress.failed}
            </div>
          )}

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={sendingProgress.sending}
          >
            {sendingProgress.sending
              ? "Sending..."
              : `Send WhatsApp Message${messagingMode === "bulk" ? "s" : ""}`}
          </button>
        </div>

        <div className="recent-messages">
          <h4>Recent Messages</h4>
          <div className="message-list">
            {sentMessages
              .filter((m) => m.type === "whatsapp")
              .map((message) => (
                <div key={message._id} className="message-item">
                  <div className="message-header">
                    <span className="recipient">{message.recipient}</span>
                    <span className="status">{message.status}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                  <div className="message-time">
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmail = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>Email Communication</h3>
        <div className="comm-stats">
          <div className="stat-item">
            <span className="stat-number">
              {sentMessages.filter((m) => m.type === "email").length}
            </span>
            <span className="stat-label">Emails Sent</span>
          </div>
        </div>
      </div>

      <div className="comm-content">
        <div className="message-form">
          <div className="form-group">
            <label>Template</label>
            <select
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
            >
              <option value="">Select Template</option>
              {templates
                .filter((t) => t.type === "email")
                .map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name}
                  </option>
                ))}
            </select>
          </div>

          {renderRecipientSelector()}

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Enter subject"
            />
          </div>

          <div className="form-group">
            <label>Message Body</label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Enter your message..."
              rows={8}
            />
          </div>

          <div className="variables">
            <label>Insert Variables:</label>
            <div className="variable-buttons">
              <button onClick={() => insertVariable("userName")}>
                User Name
              </button>
              <button onClick={() => insertVariable("bookingId")}>
                Booking ID
              </button>
              <button onClick={() => insertVariable("amount")}>Amount</button>
              <button onClick={() => insertVariable("date")}>Date</button>
            </div>
          </div>

          {sendingProgress.sending && (
            <div className="sending-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(sendingProgress.sent / sendingProgress.total) * 100}%`,
                  }}
                />
              </div>
              <span>
                Sending... {sendingProgress.sent}/{sendingProgress.total}
              </span>
            </div>
          )}

          {!sendingProgress.sending && sendingProgress.total > 0 && (
            <div className="send-result">
              Sent: {sendingProgress.sent} | Failed: {sendingProgress.failed}
            </div>
          )}

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={sendingProgress.sending}
          >
            {sendingProgress.sending
              ? "Sending..."
              : `Send Email${messagingMode === "bulk" ? "s" : ""}`}
          </button>
        </div>

        <div className="recent-messages">
          <h4>Recent Emails</h4>
          <div className="message-list">
            {sentMessages
              .filter((m) => m.type === "email")
              .map((message) => (
                <div key={message._id} className="message-item">
                  <div className="message-header">
                    <span className="recipient">{message.recipient}</span>
                    <span className="subject">{message.subject}</span>
                    <span className="status">{message.status}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                  <div className="message-time">
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSMS = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>SMS Communication</h3>
        <div className="comm-stats">
          <div className="stat-item">
            <span className="stat-number">
              {sentMessages.filter((m) => m.type === "sms").length}
            </span>
            <span className="stat-label">SMS Sent</span>
          </div>
        </div>
      </div>

      <div className="comm-content">
        <div className="message-form">
          <div className="form-group">
            <label>Template</label>
            <select
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
            >
              <option value="">Select Template (Optional)</option>
              <option value="promo">Promotional</option>
              <option value="booking">Booking Confirmation</option>
              <option value="payment">Payment Reminder</option>
              <option value="otp">OTP Verification</option>
              <option value="alert">Alert/Notification</option>
            </select>
          </div>

          {renderRecipientSelector()}

          <div className="form-group">
            <label>Message (Max 160 characters for single SMS)</label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Enter your SMS message..."
              rows={4}
              maxLength={480}
            />
            <div className="char-count">
              {smsMessage.length}/480 characters (
              {Math.ceil(smsMessage.length / 160) || 1} SMS)
            </div>
          </div>

          <div className="variables">
            <label>Insert Variables:</label>
            <div className="variable-buttons">
              <button onClick={() => insertVariable("userName")}>
                User Name
              </button>
              <button onClick={() => insertVariable("bookingId")}>
                Booking ID
              </button>
              <button onClick={() => insertVariable("amount")}>Amount</button>
              <button onClick={() => insertVariable("otp")}>OTP</button>
            </div>
          </div>

          {sendingProgress.sending && (
            <div className="sending-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(sendingProgress.sent / sendingProgress.total) * 100}%`,
                  }}
                />
              </div>
              <span>
                Sending... {sendingProgress.sent}/{sendingProgress.total}
              </span>
            </div>
          )}

          {!sendingProgress.sending && sendingProgress.total > 0 && (
            <div className="send-result">
              Sent: {sendingProgress.sent} | Failed: {sendingProgress.failed}
            </div>
          )}

          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={sendingProgress.sending}
          >
            {sendingProgress.sending
              ? "Sending..."
              : `Send SMS${messagingMode === "bulk" ? "s" : ""}`}
          </button>
        </div>

        <div className="recent-messages">
          <h4>Recent SMS Messages</h4>
          <div className="message-list">
            {sentMessages
              .filter((m) => m.type === "sms")
              .map((message) => (
                <div key={message._id} className="message-item">
                  <div className="message-header">
                    <span className="recipient">{message.recipient}</span>
                    <span className="status">{message.status}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                  <div className="message-time">
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfiguration = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>Communication Configuration</h3>
      </div>

      <div className="comm-content">
        <div className="config-section">
          <h4>Email Configuration</h4>
          <div className="config-form">
            <div className="form-group">
              <label>SMTP Host</label>
              <input
                type="text"
                value={emailConfig?.smtpHost || ""}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpHost: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>SMTP Port</label>
              <input
                type="text"
                value={emailConfig?.smtpPort || ""}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, smtpPort: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input
                type="email"
                value={emailConfig?.username || ""}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, username: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={emailConfig?.password || ""}
                onChange={(e) =>
                  setEmailConfig({ ...emailConfig, password: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={emailConfig?.active || false}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <button
              className="save-btn"
              onClick={() => handleConfigUpdate("email", emailConfig)}
            >
              Save Email Config
            </button>
          </div>
        </div>

        <div className="config-section">
          <h4>WhatsApp Configuration</h4>
          <div className="config-form">
            <div className="form-group">
              <label>Account SID</label>
              <input
                type="text"
                value={whatsappConfig?.accountSid || ""}
                onChange={(e) =>
                  setWhatsappConfig({
                    ...whatsappConfig,
                    accountSid: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Auth Token</label>
              <input
                type="password"
                value={whatsappConfig?.authToken || ""}
                onChange={(e) =>
                  setWhatsappConfig({
                    ...whatsappConfig,
                    authToken: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={whatsappConfig?.phoneNumber || ""}
                onChange={(e) =>
                  setWhatsappConfig({
                    ...whatsappConfig,
                    phoneNumber: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={whatsappConfig?.active || false}
                  onChange={(e) =>
                    setWhatsappConfig({
                      ...whatsappConfig,
                      active: e.target.checked,
                    })
                  }
                />
                Active
              </label>
            </div>
            <button
              className="save-btn"
              onClick={() => handleConfigUpdate("whatsapp", whatsappConfig)}
            >
              Save WhatsApp Config
            </button>
          </div>
        </div>

        <div className="config-section">
          <h4>SMS Configuration (Twilio)</h4>
          <p className="config-description">
            Configure Twilio SMS service to send text messages to users.
          </p>
          <div className="config-form">
            <div className="form-group">
              <label>Twilio Account SID</label>
              <input
                type="text"
                value={smsConfig?.accountSid || ""}
                onChange={(e) =>
                  setSmsConfig({ ...smsConfig, accountSid: e.target.value })
                }
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </div>
            <div className="form-group">
              <label>Twilio Auth Token</label>
              <input
                type="password"
                value={smsConfig?.authToken || ""}
                onChange={(e) =>
                  setSmsConfig({ ...smsConfig, authToken: e.target.value })
                }
                placeholder="Your Twilio Auth Token"
              />
            </div>
            <div className="form-group">
              <label>Twilio Phone Number (From)</label>
              <input
                type="tel"
                value={smsConfig?.phoneNumber || ""}
                onChange={(e) =>
                  setSmsConfig({ ...smsConfig, phoneNumber: e.target.value })
                }
                placeholder="+1XXXXXXXXXX"
              />
              <small>
                This is your Twilio phone number that will be used to send SMS
              </small>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={smsConfig?.active || false}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <button
              className="save-btn"
              onClick={() => handleConfigUpdate("sms", smsConfig)}
            >
              Save SMS Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="admin-comm">
        <div className="loading">Loading communication data...</div>
      </div>
    );
  }

  return (
    <div className="admin-comm">
      <div className="comm-tabs">
        <button
          className={`comm-tab ${activeTab === "whatsapp" ? "active" : ""}`}
          onClick={() => setActiveTab("whatsapp")}
        >
          WhatsApp
        </button>
        <button
          className={`comm-tab ${activeTab === "email" ? "active" : ""}`}
          onClick={() => setActiveTab("email")}
        >
          Email
        </button>
        <button
          className={`comm-tab ${activeTab === "sms" ? "active" : ""}`}
          onClick={() => setActiveTab("sms")}
        >
          SMS
        </button>
        <button
          className={`comm-tab ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          Configuration
        </button>
      </div>

      <div className="comm-content">
        {activeTab === "whatsapp" && renderWhatsApp()}
        {activeTab === "email" && renderEmail()}
        {activeTab === "sms" && renderSMS()}
        {activeTab === "config" && renderConfiguration()}
      </div>
    </div>
  );
}

export default AdminComm;
