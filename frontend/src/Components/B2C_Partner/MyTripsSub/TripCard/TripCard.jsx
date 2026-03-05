import "./tripcard.css";

function TripCard({ trip, showButton, buttonText, buttonStyle }) {
  return (
    <div className="trip-card">
      <div className="trip-card-header">
        <span className="trip-status-badge available">Available</span>
        <div className="trip-meta">
          <span className="trip-id">{trip.id}</span>
          <div className="trip-time">
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

      <div className="trip-fare">
        <span className="fare-amount">{trip.fare}</span>
      </div>

      <div className="trip-locations">
        <div className="location-item">
          <div className="location-dot pickup"></div>
          <div>
            <p className="location-label">PICKUP</p>
            <p className="location-name">{trip.pickup}</p>
          </div>
        </div>

        <div className="location-item">
          <div className="location-dot dropoff"></div>
          <div>
            <p className="location-label">DROPOFF</p>
            <p className="location-name">{trip.dropoff}</p>
          </div>
        </div>
      </div>

      {showButton && (
        <button className={`trip-action-btn ${buttonStyle}`}>
          {buttonText}
        </button>
      )}
    </div>
  );
}

export default TripCard;
