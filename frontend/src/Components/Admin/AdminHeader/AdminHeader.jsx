"use client"

import { useState } from "react"
import Notifications from "./Notifications/Notifications"
import "./AdminHeader.css"

function AdminHeader() {
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="ad-dash-header">
      <div className="ad-dash-header-content">
        <div className="ad-dash-header-left">
          <div className="ad-dash-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" fill="#00A699" />
              <rect x="13" y="3" width="7" height="7" fill="#00A699" />
              <rect x="3" y="13" width="7" height="7" fill="#00A699" />
              <rect x="13" y="13" width="7" height="7" fill="#00A699" />
            </svg>
            <h1>Admin Control Center</h1>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <div className="ad-dash-user-info">
            <div className="ad-dash-user-details">
              <span className="ad-dash-user-name">Super Admin</span>
              <span className="ad-dash-user-login">Last login: Today, 09:41 AM</span>
            </div>
            <div className="notification-wrapper">
              <button className="ad-dash-notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2C6.68629 2 4 4.68629 4 8V11.5858L2.70711 12.8787C2.07714 13.5087 2.52331 14.6 3.41421 14.6H16.5858C17.4767 14.6 17.9229 13.5087 17.2929 12.8787L16 11.5858V8C16 4.68629 13.3137 2 10 2Z"
                    fill="currentColor"
                  />
                  <path d="M10 18C11.1046 18 12 17.1046 12 16H8C8 17.1046 8.89543 18 10 18Z" fill="currentColor" />
                </svg>
              </button>
              <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AdminHeader
