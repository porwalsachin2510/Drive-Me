import "./LoadingSpinner.css";

const LoadingSpinner = ({ size = "medium", fullScreen = false }) => {
  if (fullScreen) {
    return (
      <div className="drivemego-loading-spinner-fullscreen">
        <div className={`drivemego-spinner drivemego-spinner-${size}`}>
          <div className="drivemego-spinner-circle"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="drivemego-loading-spinner-container">
      <div className={`drivemego-spinner spinner-${size}`}>
        <div className="drivemego-spinner-circle"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
