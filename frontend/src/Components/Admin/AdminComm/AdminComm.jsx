"use client"

import { useState, useEffect } from "react"
import "./AdminComm.css"
import api from "../../../utils/api"

function AdminComm() {
  const [activeTab, setActiveTab] = useState("whatsapp")
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const [sentMessages, setSentMessages] = useState([])
  const [emailConfig, setEmailConfig] = useState({
    smtpHost: '',
    smtpPort: '',
    username: '',
    password: '',
    active: false
  })
  const [whatsappConfig, setWhatsappConfig] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
    active: false
  })

  // WhatsApp state
  const [selectedTemplate, setSelectedTemplate] = useState("promo")
  const [recipientNumber, setRecipientNumber] = useState("")
  const [whatsappMessage, setWhatsappMessage] = useState("")

  // Email state
  const [emailTemplate, setEmailTemplate] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")

  useEffect(() => {
    fetchCommData()
  }, [])

  const fetchCommData = async () => {
    try {
      setLoading(true)
      
      // Fetch templates
      const templatesResponse = await api.get('/admin/comm/templates')
      setTemplates(templatesResponse.data.templates)

      // Fetch sent messages
      const messagesResponse = await api.get('/admin/comm/messages')
      setSentMessages(messagesResponse.data.messages)

      // Fetch configurations
      const configResponse = await api.get('/admin/comm/config')
      setEmailConfig(configResponse.data.emailConfig)
      setWhatsappConfig(configResponse.data.whatsappConfig)
      
    } catch (error) {
      console.error("Error fetching communication data:", error)
    } finally {
      setLoading(false)
    }
  }

  const insertVariable = (variable) => {
    if (activeTab === "whatsapp") {
      setWhatsappMessage((prev) => prev + `{{${variable}}}`)
    } else if (activeTab === "email") {
      setEmailBody((prev) => prev + `{{${variable}}}`)
    }
  }

  const handleSendMessage = async () => {
    try {
      if (activeTab === "whatsapp") {
        await api.post('/admin/comm/whatsapp/send', {
          recipientNumber,
          message: whatsappMessage,
          templateId: selectedTemplate
        })
      } else if (activeTab === "email") {
        await api.post('/admin/comm/email/send', {
          recipientEmail,
          subject: emailSubject,
          body: emailBody,
          templateId: emailTemplate
        })
      }
      
      // Reset form
      if (activeTab === "whatsapp") {
        setRecipientNumber("")
        setWhatsappMessage("")
      } else {
        setRecipientEmail("")
        setEmailSubject("")
        setEmailBody("")
      }
      
      // Refresh messages
      fetchCommData()
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleConfigUpdate = async (type, config) => {
    try {
      await api.put(`/admin/comm/config/${type}`, config)
      fetchCommData()
    } catch (error) {
      console.error("Error updating config:", error)
    }
  }

  const renderWhatsApp = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>WhatsApp Communication</h3>
        <div className="comm-stats">
          <div className="stat-item">
            <span className="stat-number">{sentMessages.filter(m => m.type === 'whatsapp').length}</span>
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

          <div className="form-group">
            <label>Recipient Number</label>
            <input
              type="tel"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              placeholder="+965 XXXXXXXX"
            />
          </div>

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
              <button onClick={() => insertVariable('userName')}>User Name</button>
              <button onClick={() => insertVariable('bookingId')}>Booking ID</button>
              <button onClick={() => insertVariable('amount')}>Amount</button>
              <button onClick={() => insertVariable('date')}>Date</button>
            </div>
          </div>

          <button className="send-btn" onClick={handleSendMessage}>
            Send WhatsApp Message
          </button>
        </div>

        <div className="recent-messages">
          <h4>Recent Messages</h4>
          <div className="message-list">
            {sentMessages.filter(m => m.type === 'whatsapp').map(message => (
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
  )

  const renderEmail = () => (
    <div className="comm-section">
      <div className="comm-header">
        <h3>Email Communication</h3>
        <div className="comm-stats">
          <div className="stat-item">
            <span className="stat-number">{sentMessages.filter(m => m.type === 'email').length}</span>
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
              {templates.filter(t => t.type === 'email').map(template => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

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
              <button onClick={() => insertVariable('userName')}>User Name</button>
              <button onClick={() => insertVariable('bookingId')}>Booking ID</button>
              <button onClick={() => insertVariable('amount')}>Amount</button>
              <button onClick={() => insertVariable('date')}>Date</button>
            </div>
          </div>

          <button className="send-btn" onClick={handleSendMessage}>
            Send Email
          </button>
        </div>

        <div className="recent-messages">
          <h4>Recent Emails</h4>
          <div className="message-list">
            {sentMessages.filter(m => m.type === 'email').map(message => (
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
  )

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
                value={emailConfig?.smtpHost || ''}
                onChange={(e) => setEmailConfig({...emailConfig, smtpHost: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>SMTP Port</label>
              <input
                type="text"
                value={emailConfig?.smtpPort || ''}
                onChange={(e) => setEmailConfig({...emailConfig, smtpPort: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input
                type="email"
                value={emailConfig?.username || ''}
                onChange={(e) => setEmailConfig({...emailConfig, username: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={emailConfig?.password || ''}
                onChange={(e) => setEmailConfig({...emailConfig, password: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={emailConfig?.active || false}
                  onChange={(e) => setEmailConfig({...emailConfig, active: e.target.checked})}
                />
                Active
              </label>
            </div>
            <button 
              className="save-btn"
              onClick={() => handleConfigUpdate('email', emailConfig)}
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
                value={whatsappConfig?.accountSid || ''}
                onChange={(e) => setWhatsappConfig({...whatsappConfig, accountSid: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Auth Token</label>
              <input
                type="password"
                value={whatsappConfig?.authToken || ''}
                onChange={(e) => setWhatsappConfig({...whatsappConfig, authToken: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={whatsappConfig?.phoneNumber || ''}
                onChange={(e) => setWhatsappConfig({...whatsappConfig, phoneNumber: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={whatsappConfig?.active || false}
                  onChange={(e) => setWhatsappConfig({...whatsappConfig, active: e.target.checked})}
                />
                Active
              </label>
            </div>
            <button 
              className="save-btn"
              onClick={() => handleConfigUpdate('whatsapp', whatsappConfig)}
            >
              Save WhatsApp Config
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="admin-comm">
        <div className="loading">Loading communication data...</div>
      </div>
    )
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
          className={`comm-tab ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          Configuration
        </button>
      </div>

      <div className="comm-content">
        {activeTab === "whatsapp" && renderWhatsApp()}
        {activeTab === "email" && renderEmail()}
        {activeTab === "config" && renderConfiguration()}
      </div>
    </div>
  )
}

export default AdminComm
