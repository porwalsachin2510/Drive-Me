"use client";

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { updateWalletBalance } from "../../Redux/slices/walletSlice";
import api from "../../utils/api";
import "./WalletIcon.css";

function WalletIcon() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { balance, loading } = useSelector((state) => state.wallet);
  const { user } = useSelector((state) => state.auth);
  const [showDropdown, setShowDropdown] = useState(false);

  const walletAllowedRoles = [
    "COMMUTER",
    "B2C_PARTNER",
    "B2B_PARTNER",
    "ADMIN",
  ];

  const isAllowed = user && walletAllowedRoles.includes(user.role);

  useEffect(() => {
    if (!isAllowed) return;
    fetchWalletBalance();
    // Set up interval for real-time updates
    const interval = setInterval(fetchWalletBalance, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [isAllowed]);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/wallet/balance');
      const newBalance = response.data.data.balance;
      dispatch(updateWalletBalance(newBalance));
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      // Set default balance if API fails
      dispatch(updateWalletBalance(0));
    }
  };
  
  // Hide wallet for CORPORATE, ADMIN and other roles
  if (!isAllowed) {
    return null;
  }

  const handleWalletClick = () => {
    navigate('/wallet');
    setShowDropdown(false);
  };

  const handleAddFunds = () => {
    navigate('/wallet');
    setShowDropdown(false);
  };

  const handleTransactions = () => {
    navigate('/wallet');
    setShowDropdown(false);
  };

  // const formatCurrency = (amount) => {
  //   const currency = user?.currency || 'KWD';
  //   return `${currency} ${amount?.toFixed(3) || '0.000'}`;
  // };

  const formatCurrency = (amount) => {
    const currency = user?.country === "KW" ? "KWD" : "AED";
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: currency === "KWD" ? "KWD" : "AED",
      minimumFractionDigits: currency === "KWD" ? 3 : 2,
    }).format(amount);
  };

  const getBalanceColor = () => {
    if (balance > 1000) return '#10b981';
    if (balance > 100) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="wallet-icon-container">
      <button
        className="wallet-button"
        onClick={handleWalletClick}
        onMouseEnter={() => setShowDropdown(true)}
        onMouseLeave={() => setShowDropdown(false)}
      >
        <div className="purse-icon-wrapper">
          {/* Larger Purse Icon */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="purse-icon"
          >
            <path
              d="M20 7H4C2.89543 7 2 7.89543 2 9V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7Z"
              fill="#6b7280"
              stroke="#6b7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 10H22"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 15H9"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 15H14"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 15H19"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Purse clasp */}
            <circle cx="12" cy="8.5" r="1.5" fill="#ffffff" />
          </svg>

          {/* Smaller Amount Badge */}
          <div className="amount-badge">
            <span className="amount-text" style={{ color: getBalanceColor() }}>
              {loading ? "..." : formatCurrency(balance)}
            </span>
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="wallet-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-title">
              <div className="wallet-icon-large">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 7H4C2.89543 7 2 7.89543 2 9V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7Z"
                    fill="#6b7280"
                    stroke="#6b7280"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 10H22"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 15H9"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 15H14"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 15H19"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="8.8" r="1.5" fill="#ffffff" />
                </svg>
              </div>
              <div className="wallet-info">
                <span className="wallet-label">Available Balance</span>
                <span
                  className="wallet-total"
                  style={{ color: getBalanceColor() }}
                >
                  {loading ? "..." : formatCurrency(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* <div className="dropdown-menu">
            <button className="dropdown-item" onClick={handleWalletClick}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 7H4C2.89543 7 2 7.89543 2 9V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7Z" />
                <path d="M2 10H22" />
              </svg>
              <span className="item-text">Wallet Overview</span>
            </button>

            <button className="dropdown-item" onClick={handleAddFunds}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="item-text">Add Funds</span>
            </button>

            <button className="dropdown-item" onClick={handleTransactions}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className="item-text">Transactions</span>
            </button>

            <div className="dropdown-divider"></div>

            <button
              className="dropdown-item"
              onClick={() => {
                setShowDropdown(false);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="item-text">Wallet Settings</span>
            </button>
          </div> */}
        </div>
      )}
    </div>
  );
}

export default WalletIcon;
