import React from "react";
import {
  FaTimes,
  FaExclamationTriangle,
  FaLock,
  FaArrowRight,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./roleRestrictionModal.css";

const RoleRestrictionModal = ({
  isOpen,
  onClose,
  title,
  message,
  requiredRole,
  currentRole,
  onLogin,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLoginClick = () => {
    if (onLogin) {
      onLogin();
    } else {
      navigate("/login");
    }
    onClose();
  };

  const getRoleDisplayName = (role) => {
    if (role === "CORPORATE") return "Corporate";
    if (role === "COMMUTER") return "Commuter";
    return role;
  };

  return (
    <div className="role-restriction-overlay" onClick={onClose}>
      <div
        className="role-restriction-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button className="role-restriction-close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        {/* Icon Container */}
        <div className="role-restriction-icon-container">
          <div className="role-restriction-icon">
            <FaLock />
          </div>
        </div>

        {/* Content */}
        <div className="role-restriction-content">
          <h2 className="role-restriction-title">{title}</h2>
          <p className="role-restriction-message">{message}</p>

          {/* Role Info */}
          <div className="role-restriction-info-box">
            <div className="role-info-item">
              <span className="role-label">Required Account:</span>
              <span className="role-value required">
                {getRoleDisplayName(requiredRole)}
              </span>
            </div>
            {currentRole && (
              <div className="role-info-item">
                <span className="role-label">Current Account:</span>
                <span className="role-value current">
                  {getRoleDisplayName(currentRole)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="role-restriction-actions">
            <button
              className="role-restriction-btn cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="role-restriction-btn login-btn"
              onClick={handleLoginClick}
            >
              <FaArrowRight className="btn-icon" />
              Login with {getRoleDisplayName(requiredRole)} Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleRestrictionModal;
