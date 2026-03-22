import "./b2b_metricscard.css";

function B2B_MetricsCard({ label, value, icon }) {
  return (
    <div className="drivemego-b2b-metrics-card">
      <div className="drivemego-b2b-metrics-icon">{icon}</div>
      <div className="mdrivemego-b2b-etrics-content">
        <p className="drivemego-b2b-metrics-label">{label}</p>
        <p className="drivemego-b2b-metrics-value">{value}</p>
      </div>
    </div>
  );
}

export default B2B_MetricsCard;
