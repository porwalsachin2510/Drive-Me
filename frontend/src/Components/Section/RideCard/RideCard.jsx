"use client";
import { useLocale } from "../../../hooks/useLocale";
import "./ride-card.css";

export default function RideCard({ ride }) {
  const { currency } = useLocale();
  const getStatusBadge = (status) => {
    const statusConfig = {
      ongoing: { label: "Ongoing", color: "#4B9EFF" },
      upcoming: { label: "Upcoming", color: "#FFB800" },
      completed: { label: "Completed", color: "#00B074" },
      cancelled: { label: "Cancelled", color: "#EF4444" },
    };
    return statusConfig[status] || statusConfig.upcoming;
  };

  const statusBadge = getStatusBadge(ride.status);

  return (
    <div className="ride-card" style={{ borderLeftColor: ride.borderColor }}>
      <div className="ride-card-header">
        <h3 className="ride-title">{ride.route}</h3>
        <button className="ride-menu-btn">⋮</button>
      </div>

      <div className="ride-info">
        <p className="ride-company">{ride.company}</p>
        <p className="ride-booking">{ride.bookingId}</p>
      </div>

      <div className="ride-details">
        <div className="detail-item">
          <label>DATE</label>
          <p>📅 {ride.date}</p>
        </div>
        <div className="detail-item">
          <label>TIME</label>
          <p>🕐 {ride.time}</p>
        </div>
        <div className="detail-item">
          <label>PRICE</label>
          <p>
            {ride.price} {ride.currency || currency}
          </p>
        </div>
      </div>

      <div className="ride-footer">
        <span
          className="status-badge"
          style={{
            backgroundColor: `${statusBadge.color}20`,
            color: statusBadge.color,
          }}
        >
          ⏱️ {statusBadge.label}
        </span>
        {ride.showViewTicket && (
          <button className="view-ticket-btn">View Ticket</button>
        )}
        {ride.showRateButton && <button className="rate-btn">Rate Ride</button>}
      </div>
    </div>
  );
}
