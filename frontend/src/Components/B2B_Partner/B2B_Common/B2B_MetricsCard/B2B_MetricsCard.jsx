import "./b2b_metricscard.css";

function B2B_MetricsCard({ label, value, icon }) {
  return (
    <div className="metrics-card">
      <div className="metrics-icon">{icon}</div>
      <div className="metrics-content">
        <p className="metrics-label">{label}</p>
        <p className="metrics-value">{value}</p>
      </div>
    </div>
  );
}

export default B2B_MetricsCard;
