import "./b2b_metricscard.css";

function B2B_MetricsCard({ label, value, icon, trend, tone = "teal" }) {
  return (
    <div className={`drivemego-b2b-metrics-card tone-${tone}`}>
      <div className="drivemego-b2b-metrics-top">
        <div className="drivemego-b2b-metrics-icon">{icon}</div>
        {trend ? (
          <span
            className={`drivemego-b2b-metrics-trend ${
              trend.direction === "down" ? "is-down" : "is-up"
            }`}
          >
            {trend.value}
          </span>
        ) : null}
      </div>
      <div className="drivemego-b2b-metrics-content">
        <p className="drivemego-b2b-metrics-label">{label}</p>
        <p className="drivemego-b2b-metrics-value">{value}</p>
      </div>
    </div>
  );
}

export default B2B_MetricsCard;
