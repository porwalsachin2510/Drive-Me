const DetailRow = ({ label, value }) => {
  return (
    <div className="detail-row">
      <span className="label">{label}:</span>
      <span className="value">{value || "—"}</span>
    </div>
  );
};

export default DetailRow;
