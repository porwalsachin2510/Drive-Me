import "./historytripcard.css";

function HistoryTripCard({ trip }) {
  return (
    <div className="history-trip-card">
      <div className="card-header">
        <span className={`status-badge ${trip.status}`}>
          {trip.status === "completed" ? "Completed" : "Cancelled"}
        </span>
        <div className="trip-meta">
          <span className="trip-id">{trip.id}</span>
          <div className="trip-datetime">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle
                cx="6"
                cy="6"
                r="5"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path
                d="M6 3V6L8 7"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </svg>
            {trip.date} • {trip.time}
          </div>
        </div>
      </div>

      <div className="card-fare">{trip.fare}</div>

      <div className="card-locations">
        <div className="location">
          <div className="dot pickup"></div>
          <div>
            <span className="label">PICKUP</span>
            <p className="name">{trip.pickup}</p>
          </div>
        </div>

        <div className="location">
          <div className="dot dropoff"></div>
          <div>
            <span className="label">DROPOFF</span>
            <p className="name">{trip.dropoff}</p>
          </div>
        </div>
      </div>

      <div className="card-passenger">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M2 14C2 11.5 4.7 10 8 10C11.3 10 14 11.5 14 14"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        {trip.passenger}
      </div>

      <div className="card-status-text">Trip Closed</div>
    </div>
  );
}

export default HistoryTripCard;
