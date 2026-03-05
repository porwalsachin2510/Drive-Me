"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { useSelector } from "react-redux";
import api from "../../../utils/api";
import { SocketContext } from "../../../context/SocketContext";
import "./driverlocationtracking.css";

function DriverLocationTracking() {
  const { user } = useSelector((state) => state.auth);
  const { socket } = useContext(SocketContext);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address: "",
    speed: 0,
  });
  const [tripStatus, setTripStatus] = useState("idle"); // idle, started, completed, emergency
  const [watchId, setWatchId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const locationIntervalRef = useRef(null);

  const fetchActiveTrip = async () => {
    try {
      const response = await api.get('/driver/active-trip');
      if (response.data.success && response.data.trip) {
        setCurrentTrip(response.data.trip);
        setTripStatus(response.data.trip.status === "In Progress" ? "started" : "idle");
      }
    } catch (error) {
      console.error("Error fetching active trip:", error);
    }
  };

  const stopLocationTracking = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    setIsTracking(false);
  };

  useEffect(() => {
    fetchActiveTrip();

    // Join driver room for socket events
    if (socket && user?._id) {
      socket.emit('join-driver-room', user._id);
    }

    return () => {
      stopLocationTracking();
    };
  }, [socket, user]);

  const startLocationTracking = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    try {
      // Get initial position
      const position = await getCurrentPosition();
      updateLocation(position);

      // Start watching position
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          updateLocation(position);
        },
        (error) => {
          console.error("Location tracking error:", error);
          alert("Unable to track location. Please check your location permissions.");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      setWatchId(watchId);
      setIsTracking(true);

      // Start periodic updates to server
      locationIntervalRef.current = setInterval(() => {
        sendLocationToServer();
      }, 10000); // Send location every 10 seconds
    } catch (error) {
      console.error("Error starting location tracking:", error);
      alert("Failed to start location tracking.");
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const updateLocation = (position) => {
    const { latitude, longitude, speed, heading } = position.coords;
    
    setLocation({
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      address: "", // Will be filled by geocoding
    });

    setLastUpdated(Date.now());

    // Get address from coordinates (geocoding)
    getAddressFromCoordinates(latitude, longitude);
  };

  const getAddressFromCoordinates = async (lat, lng) => {
    try {
      // Using OpenStreetMap Nominatim for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        setLocation(prev => ({
          ...prev,
          address: data.display_name,
        }));
      }
    } catch (error) {
      console.error("Error getting address:", error);
    }
  };

  const sendLocationToServer = async () => {
    if (!currentTrip || !location.latitude || !location.longitude) {
      return;
    }

    try {
      // Send via REST API for persistence
      await api.post('/driver/update-location', {
        tripId: currentTrip._id,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        speed: location.speed,
        timestamp: new Date().toISOString(),
      });

      // Also emit via socket for real-time tracking by passengers
      if (socket) {
        socket.emit('driver-location-update', {
          driverId: user?.driverId || user?._id,
          userId: user?._id,
          location: {
            lat: location.latitude,
            lng: location.longitude,
          },
          timestamp: new Date().toISOString(),
          bookingId: currentTrip.bookingId || currentTrip._id,
        });
      }
    } catch (error) {
      console.error("Error sending location to server:", error);
    }
  };

  const startTrip = async () => {
    if (!currentTrip) {
      alert("No active trip found");
      return;
    }

    try {
      const response = await api.post(`/driver/trips/${currentTrip._id}/start`);
      if (response.data.success) {
        setTripStatus("started");
        await startLocationTracking();

        // Emit socket event for real-time notification to passengers
        if (socket) {
          socket.emit('start-trip', {
            bookingId: currentTrip.bookingId || currentTrip._id,
            driverId: user?._id,
          });
        }
      }
    } catch (error) {
      console.error("Error starting trip:", error);
      alert("Failed to start trip");
    }
  };

  const completeTrip = async () => {
    if (!currentTrip) {
      alert("No active trip found");
      return;
    }

    try {
      const response = await api.post(`/driver/trips/${currentTrip._id}/complete`);
      if (response.data.success) {
        setTripStatus("completed");
        stopLocationTracking();

        // Emit socket event for real-time notification to passengers
        if (socket) {
          socket.emit('complete-trip', {
            bookingId: currentTrip.bookingId || currentTrip._id,
            driverId: user?._id,
          });
        }
      }
    } catch (error) {
      console.error("Error completing trip:", error);
      alert("Failed to complete trip");
    }
  };

  const reportEmergency = async () => {
    if (!currentTrip) {
      alert("No active trip found");
      return;
    }

    const emergencyType = prompt("Enter emergency type (accident/medical/breakdown/other):");
    const message = prompt("Enter emergency message:");

    if (!emergencyType || !message) {
      return;
    }

    try {
      const response = await api.post(`/driver/trips/${currentTrip._id}/emergency`, {
        emergencyType,
        message,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        },
      });

      if (response.data.success) {
        setTripStatus("emergency");
        alert("Emergency reported successfully!");
      }
    } catch (error) {
      console.error("Error reporting emergency:", error);
      alert("Failed to report emergency");
    }
  };

  const formatSpeed = (speed) => {
    return speed ? `${Math.round(speed * 3.6)} km/h` : "0 km/h";
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="driver-location-tracking">
      <div className="tracking-header">
        <h1>Driver Location Tracking</h1>
        <div className="status-badge">
          Status: <span className={`status ${tripStatus}`}>{tripStatus.toUpperCase()}</span>
        </div>
      </div>

      {currentTrip ? (
        <div className="trip-info">
          <div className="trip-details">
            <h3>Current Trip</h3>
            <div className="trip-route">
              <p><strong>From:</strong> {currentTrip.fromLocation}</p>
              <p><strong>To:</strong> {currentTrip.toLocation}</p>
              <p><strong>Start Time:</strong> {currentTrip.startTime}</p>
              <p><strong>Passengers:</strong> {currentTrip.passengers?.length || 0}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-trip">
          <p>No active trip found</p>
        </div>
      )}

      <div className="location-info">
        <h3>Current Location</h3>
        <div className="location-details">
          <div className="location-coords">
            <p><strong>Latitude:</strong> {location.latitude || "N/A"}</p>
            <p><strong>Longitude:</strong> {location.longitude || "N/A"}</p>
            <p><strong>Speed:</strong> {formatSpeed(location.speed)}</p>
          </div>
          <div className="location-address">
            <p><strong>Address:</strong> {location.address || "Getting address..."}</p>
          </div>
        </div>
      </div>

      <div className="tracking-controls">
        {tripStatus === "idle" && currentTrip && (
          <button className="control-btn start" onClick={startTrip}>
            🚀 Start Trip
          </button>
        )}

        {tripStatus === "started" && (
          <>
            <button 
              className={`control-btn ${isTracking ? "stop" : "start"}`}
              onClick={isTracking ? stopLocationTracking : startLocationTracking}
            >
              {isTracking ? "⏹ Stop Tracking" : "▶ Start Tracking"}
            </button>
            
            <button className="control-btn complete" onClick={completeTrip}>
              ✅ Complete Trip
            </button>
            
            <button className="control-btn emergency" onClick={reportEmergency}>
              🚨 Emergency
            </button>
          </>
        )}

        {tripStatus === "completed" && (
          <div className="trip-completed">
            <h3>✅ Trip Completed</h3>
            <button className="control-btn" onClick={fetchActiveTrip}>
              🔄 Check for New Trip
            </button>
          </div>
        )}

        {tripStatus === "emergency" && (
          <div className="emergency-active">
            <h3>🚨 Emergency Active</h3>
            <p>Help has been notified. Please stay safe.</p>
          </div>
        )}
      </div>

      <div className="tracking-status">
        <div className="status-item">
          <span className="status-label">Tracking:</span>
          <span className={`status-value ${isTracking ? "active" : "inactive"}`}>
            {isTracking ? "🟢 Active" : "🔴 Inactive"}
          </span>
        </div>
        
        <div className="status-item">
          <span className="status-label">Last Update:</span>
          <span className="status-value">
            {lastUpdated ? formatTime(lastUpdated) : "Never"}
          </span>
        </div>

        {isTracking && (
          <div className="status-item">
            <span className="status-label">GPS Accuracy:</span>
            <span className="status-value">📍 High</span>
          </div>
        )}
      </div>

      <div className="location-map">
        <h3>Live Map</h3>
        <div className="map-placeholder">
          {location.latitude && location.longitude ? (
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01},${location.latitude - 0.01},${location.longitude + 0.01},${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
              width="100%"
              height="400"
              style={{ border: 0, borderRadius: "8px" }}
              title="Live Location Map"
            />
          ) : (
            <div className="map-loading">
              <p>📍 Waiting for GPS signal...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DriverLocationTracking;
