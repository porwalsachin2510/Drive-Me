import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiBell, FiCheck } from "react-icons/fi";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/demandPortalAPI";

/**
 * In-app notification bell for the Staff Portal topbar. Polls the portal
 * notifications endpoint so field reps (e.g. Rahul) are alerted the moment a
 * lead is auto-assigned to them — no manual refresh needed.
 */
const POLL_MS = 20000;

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getMyNotifications();
      setItems(res.data || []);
      setUnread(res.unreadCount || 0);
    } catch {
      // Silent — the bell is non-critical chrome.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const handleReadOne = async (n) => {
    if (n.isRead) return;
    try {
      await markNotificationRead(n._id);
      setItems((list) =>
        list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((list) => list.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="sp-bell" ref={ref} style={{ position: "relative" }}>
      <button
        className="sp-btn sp-btn-sm"
        onClick={handleOpen}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        style={{ position: "relative" }}
      >
        <FiBell />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#dc2626",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              minWidth: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 340,
            maxWidth: "90vw",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Notifications
            </strong>
            {unread > 0 && (
              <button
                onClick={handleReadAll}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <FiCheck /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 14,
                }}
              >
                No notifications yet.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleReadOne(n)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    background: n.isRead ? "#fff" : "#eff6ff",
                    border: "none",
                    borderLeft: n.isRead
                      ? "3px solid transparent"
                      : "3px solid #2563eb",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}
                  >
                    {n.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
