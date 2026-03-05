"use client";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import "./sidebar.css";
import api from "../../../utils/api";

export default function Sidebar() {
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = useSelector((state) => state.auth);

  useEffect(() => {
    fetchSidebarData();
  }, []);

  const fetchSidebarData = async () => {
    try {
      setLoading(true);
      
      // Fetch profile data
      const profileResponse = await api.get('/commuter/profile');
      setProfileData(profileResponse.data.profile);
      
      // Fetch wallet data
      try {
        const walletResponse = await api.get('/wallet/balance');
        setWalletData(walletResponse.data.data?.wallet || walletResponse.data.wallet || { balance: 0 });
      } catch (walletError) {
        console.error("Error fetching wallet:", walletError);
        setWalletData({ balance: 0 });
      }
      
      // Fetch real stats from backend
      try {
        const statsResponse = await api.get('/commuter/stats');
        const statsData = statsResponse.data.stats || statsResponse.data.data?.stats || {};
        setStats({
          totalRides: statsData.totalRides || 0,
          savedCO2: statsData.savedCO2 || "0.0kg",
          isPremium: statsData.isPremium || false
        });
      } catch (statsError) {
        console.error("Error fetching stats:", statsError);
        setStats({
          totalRides: 0,
          savedCO2: "0.0kg",
          isPremium: false
        });
      }
      
    } catch (error) {
      console.error("Error fetching sidebar data:", error);
      // Fallback to basic data
      setStats({
        totalRides: 0,
        savedCO2: "0kg",
        isPremium: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = () => {
    // Navigate to wallet tab or open top-up modal
    window.location.hash = '#wallet';
  };

  if (loading) {
    return (
      <div className="commuter-sidebar">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="commuter-sidebar">
      <div className="sidebar-profile">
        <div className="profile-avatar-outer">
          <div className="profile-avatar">
            <img 
              src={profileData?.avatar || "https://i.pravatar.cc/100?img=3"} 
              alt="Profile" 
            />
            <div className="online-indicator"></div>
          </div>
        </div>

        <h2 className="profile-name">
          {profileData?.fullName || auth.user?.name || "Test Passenger"}
        </h2>
        <p className="profile-email">
          {profileData?.email || auth.user?.email || "passenger@driveme.com"}
        </p>
        
        {stats?.isPremium && (
          <span className="premium-badge">Premium Member</span>
        )}
      </div>

      <div className="sidebar-stats">
        <div className="stat-item">
          <p className="stat-label">TOTAL RIDES</p>
          <p className="stat-value">{stats?.totalRides || 0}</p>
        </div>
        <div className="stat-item">
          <p className="stat-label">SAVED CO2</p>
          <p className="stat-value green">{stats?.savedCO2 || "0kg"}</p>
        </div>
      </div>

      <div className="wallet-card">
        <p className="wallet-label">Wallet Balance</p>
        <p className="wallet-amount">
          KWD {walletData?.balance?.toFixed(3) || "0.000"}
        </p>
        <button className="topup-btn" onClick={handleTopUp}>
          <span>📋</span> Top Up Wallet
        </button>
      </div>
    </div>
  );
}
