"use client";

import { useState, useEffect } from "react";
import api from "../../utils/api";
import "./CampaignBanner.css";

function CampaignBanner({ placement = "top" }) {
  const [campaigns, setCampaigns] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trackedViews, setTrackedViews] = useState(new Set());
  const [isPopupClosed, setIsPopupClosed] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [placement]);

  // Track view when a campaign is displayed (only once per session per campaign)
  useEffect(() => {
    if (campaigns.length > 0 && !loading) {
      const currentCampaign = campaigns[currentIndex];
      if (currentCampaign && !trackedViews.has(currentCampaign._id)) {
        trackView(currentCampaign._id);
        setTrackedViews((prev) => new Set([...prev, currentCampaign._id]));
      }
    }
  }, [currentIndex, campaigns, loading]);

  const trackView = async (campaignId) => {
    try {
      await api.post(`/admin/ads/public/campaigns/${campaignId}/view`);
    } catch (error) {
      // Silent fail for view tracking
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/admin/ads/public/campaigns?placement=${placement}`,
      );
      if (response.data.success) {
        setCampaigns(response.data.campaigns);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-rotate campaigns every 5 seconds
  useEffect(() => {
    if (campaigns.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns.length]);

  const handleCampaignClick = async (campaign) => {
    try {
      // Track click
      await api.post(`/admin/ads/public/campaigns/${campaign._id}/click`);

      // Open target URL if available
      if (campaign.targetUrl) {
        window.open(campaign.targetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error tracking campaign click:", error);
      // Still open the URL even if tracking fails
      if (campaign.targetUrl) {
        window.open(campaign.targetUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  if (loading) {
    return null;
  }

  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  // Don't render popup if user closed it
  if (placement === "popup" && isPopupClosed) {
    return null;
  }

  const currentCampaign = campaigns[currentIndex];

  const handleClosePopup = (e) => {
    e.stopPropagation();
    setIsPopupClosed(true);
  };

  return (
    <div className={`campaign-banner-container ${placement}`}>
      {/* Close button for popup */}
      {placement === "popup" && (
        <button
          className="campaign-close"
          onClick={handleClosePopup}
          aria-label="Close advertisement"
        >
          ×
        </button>
      )}
      <div
        className="campaign-banner"
        onClick={() => handleCampaignClick(currentCampaign)}
      >
        {currentCampaign.imageUrl ? (
          <img
            src={currentCampaign.imageUrl}
            alt={currentCampaign.title}
            className="campaign-image"
          />
        ) : (
          <div className="campaign-content">
            <div className="campaign-text">
              <h3 className="campaign-title">{currentCampaign.title}</h3>
              {currentCampaign.description && (
                <p className="campaign-description">
                  {currentCampaign.description}
                </p>
              )}
              {currentCampaign.provider && (
                <span className="campaign-provider">
                  by {currentCampaign.provider}
                </span>
              )}
            </div>
            {currentCampaign.targetUrl && (
              <button className="campaign-cta">Learn More</button>
            )}
          </div>
        )}

        <span className="campaign-ad-label">Ad</span>
      </div>

      {/* Navigation dots for multiple campaigns */}
      {campaigns.length > 1 && (
        <div className="campaign-dots">
          {campaigns.map((_, index) => (
            <button
              key={index}
              className={`campaign-dot ${index === currentIndex ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              aria-label={`Go to campaign ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CampaignBanner;
