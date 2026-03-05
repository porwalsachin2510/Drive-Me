import "./PriceComparison.css";

const PriceComparison = ({ pricing }) => {
  if (!pricing) return null;

  const calculateSavings = () => {
    const comparisons = [];

    // Daily vs Monthly
    if (pricing.daily?.baseRate && pricing.monthly?.baseRate) {
      const dailyFor30Days = pricing.daily.baseRate * 30;
      const monthly = pricing.monthly.baseRate;
      const savings = dailyFor30Days - monthly;
      const percentage = ((savings / dailyFor30Days) * 100).toFixed(0);

      comparisons.push({
        type: "Daily vs Monthly",
        daily: dailyFor30Days,
        comparison: monthly,
        savings,
        percentage,
        label: "30 days usage",
      });
    }

    // Weekly vs Monthly
    if (pricing.weekly?.baseRate && pricing.monthly?.baseRate) {
      const weeklyFor4Weeks = pricing.weekly.baseRate * 4;
      const monthly = pricing.monthly.baseRate;
      const savings = weeklyFor4Weeks - monthly;
      const percentage = ((savings / weeklyFor4Weeks) * 100).toFixed(0);

      comparisons.push({
        type: "Weekly vs Monthly",
        weekly: weeklyFor4Weeks,
        comparison: monthly,
        savings,
        percentage,
        label: "4 weeks usage",
      });
    }

    // Daily vs Weekly
    if (pricing.daily?.baseRate && pricing.weekly?.baseRate) {
      const dailyFor7Days = pricing.daily.baseRate * 7;
      const weekly = pricing.weekly.baseRate;
      const savings = dailyFor7Days - weekly;
      const percentage = ((savings / dailyFor7Days) * 100).toFixed(0);

      comparisons.push({
        type: "Daily vs Weekly",
        daily: dailyFor7Days,
        comparison: weekly,
        savings,
        percentage,
        label: "7 days usage",
      });
    }

    return comparisons.filter((c) => c.savings > 0);
  };

  // eslint-disable-next-line no-unused-vars
  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KWD",
      minimumFractionDigits: 0,
    }).replace("KWD", "KD");
  };

  const comparisons = calculateSavings();

  if (comparisons.length === 0) return null;

  return (
    <div className="price-comparison">
      <div className="comparison-header">
        <i className="fas fa-chart-line"></i>
        <h3>Price Comparison & Savings</h3>
      </div>

      <div className="comparison-grid">
        {comparisons.map((comparison, index) => (
          <div key={index} className="comparison-card">
            <div className="comparison-type">{comparison.type}</div>
            <div className="comparison-label">{comparison.label}</div>

            <div className="comparison-details">
              {comparison.daily && (
                <div className="price-row">
                  <span className="price-label">Daily Rate:</span>
                  <span className="price-value">
                    {formatPrice(comparison.daily)}
                  </span>
                </div>
              )}
              {comparison.weekly && (
                <div className="price-row">
                  <span className="price-label">Weekly Rate:</span>
                  <span className="price-value">
                    {formatPrice(comparison.weekly)}
                  </span>
                </div>
              )}
              <div className="price-row">
                <span className="price-label">
                  {comparison.type.includes("Monthly")
                    ? "Monthly Rate:"
                    : "Weekly Rate:"}
                </span>
                <span className="price-value highlight">
                  {formatPrice(comparison.comparison)}
                </span>
              </div>
            </div>

            <div className="savings-box">
              <div className="savings-amount">
                <i className="fas fa-piggy-bank"></i>
                <span>Save {formatPrice(comparison.savings)}</span>
              </div>
              <div className="savings-percentage">
                {comparison.percentage}% Off
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="comparison-note">
        <i className="fas fa-info-circle"></i>
        <p>
          Longer rental periods offer better value for money. Choose monthly
          rentals for maximum savings!
        </p>
      </div>
    </div>
  );
};

export default PriceComparison;
