import "./LoadingSpinner.css";

const LoadingSpinner = ({ size = "medium", fullScreen = false }) => {
  if (fullScreen) {
    return (
      <div className="loading-spinner-fullscreen">
        <div className={`spinner spinner-${size}`}>
          <div className="spinner-circle"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-spinner-container">
      <div className={`spinner spinner-${size}`}>
        <div className="spinner-circle"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
