import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../../../utils/api";
import EmployeeSOSButton from "../EmployeeSOS/EmployeeSOSButton";
import "./employeelivetracking.css";

// Custom marker icons (avoids Leaflet's broken default image paths under bundlers)
const busIcon = L.divIcon({
  className: "dmg-map-marker dmg-map-marker-bus",
  html: '<div class="dmg-marker-pin dmg-marker-bus"><span>BUS</span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});
const meIcon = L.divIcon({
  className: "dmg-map-marker dmg-map-marker-me",
  html: '<div class="dmg-marker-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Recenter/fit the map whenever the tracked points change.
function MapFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter((p) => p && p.lat != null && p.lng != null);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 15, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

const EMPTY = { trip: null };

export default function EmployeeLiveTracking() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myLocation, setMyLocation] = useState(null); // employee's own coords
  const [liveEta, setLiveEta] = useState(null);
  const [liveDistance, setLiveDistance] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const pollRef = useRef(null);

  const trip = data.trip;
  const tripId = trip?.tripId;

  // Keep the latest socket-driven driver location without re-fetching
  const [driverLocState, setDriverLocState] = useState(null);

  const effectiveDriverLoc =
    driverLocState ||
    (trip?.driverLocation
      ? { lat: trip.driverLocation.lat, lng: trip.driverLocation.lng }
      : null);

  // Haversine (km) for a client-side ETA fallback
  const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const recomputeEta = (dLoc, mLoc) => {
    const km = haversineKm(dLoc, mLoc);
    if (km == null) return;
    setLiveDistance(km);
    setLiveEta(Math.max(1, Math.round((km / 30) * 60))); // 30 km/h urban avg
  };

  const fetchActiveTrip = async (coords) => {
    try {
      setError("");
      const params = coords ? { lat: coords.lat, lng: coords.lng } : {};
      const res = await api.get("/trips/my-active-trip", { params });
      if (res.data.success) {
        setData(res.data.data || EMPTY);
        const t = res.data.data?.trip;
        if (t?.driverLocation?.lat != null) {
          setDriverLocState({
            lat: t.driverLocation.lat,
            lng: t.driverLocation.lng,
          });
        }
        if (t?.etaMinutes != null) setLiveEta(t.etaMinutes);
      } else {
        setError(res.data.message || "Could not load your trip");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Could not load your trip");
    } finally {
      setLoading(false);
    }
  };

  // Get the employee's own geolocation (used as the ETA target)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(c);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Initial load + polling fallback (every 15s)
  useEffect(() => {
    fetchActiveTrip(myLocation);
    pollRef.current = setInterval(() => fetchActiveTrip(myLocation), 15000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLocation]);

  // Recompute ETA whenever driver or my location changes
  useEffect(() => {
    if (effectiveDriverLoc && myLocation)
      recomputeEta(effectiveDriverLoc, myLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocState, myLocation]);

  // Live socket updates
  useEffect(() => {
    if (!tripId) return;
    const socket = api.getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit("join-booking-room", tripId);
      socket.emit("join_booking_room", tripId);
    };
    if (socket.connected) onConnect();
    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnected(false));

    const onLocation = (payload) => {
      if (!payload || (payload.tripId && payload.tripId !== tripId)) return;
      if (payload.location?.lat != null) {
        setDriverLocState({
          lat: payload.location.lat,
          lng: payload.location.lng,
        });
      }
      if (payload.etaMinutes != null) setLiveEta(payload.etaMinutes);
    };
    socket.on("managed_trip_location", onLocation);
    socket.on("driver-location-update", onLocation);

    return () => {
      socket.off("connect", onConnect);
      socket.off("managed_trip_location", onLocation);
      socket.off("driver-location-update", onLocation);
    };
  }, [tripId]);

  if (loading) {
    return (
      <div className="dmg-track-wrap">
        <div className="dmg-track-loading">
          <div className="dmg-spinner" />
          <p>Loading your ride...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="dmg-track-wrap">
        <div className="dmg-track-empty">
          <h3>No active ride right now</h3>
          <p>
            Your live tracking will appear here once you have a scheduled trip
            for today.
          </p>
          {error && <p className="dmg-track-error">{error}</p>}
        </div>
      </div>
    );
  }

  const isInProgress =
    trip.status === "IN_PROGRESS" || trip.status === "InProgress";
  const center = effectiveDriverLoc ||
    myLocation || { lat: 29.3759, lng: 47.9774 }; // Kuwait City default
  const points = [effectiveDriverLoc, myLocation].filter(Boolean);

  return (
    <div className="dmg-track-wrap">
      <div className="dmg-track-header">
        <div>
          <h2>Track My Ride</h2>
          <p className="dmg-track-route">
            {trip.fromLocation} &rarr; {trip.toLocation}
          </p>
        </div>
        <span
          className={`dmg-track-status dmg-status-${(trip.status || "").toLowerCase()}`}
        >
          {isInProgress ? "On the way" : trip.status}
        </span>
      </div>

      <div className="dmg-track-grid">
        <div className="dmg-track-map-card">
          <div className="dmg-track-map">
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={14}
              scrollWheelZoom
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {effectiveDriverLoc && (
                <Marker
                  position={[effectiveDriverLoc.lat, effectiveDriverLoc.lng]}
                  icon={busIcon}
                >
                  <Popup>
                    {trip.driver?.name || "Driver"}
                    {trip.vehicle?.plate ? ` · ${trip.vehicle.plate}` : ""}
                  </Popup>
                </Marker>
              )}
              {myLocation && (
                <Marker
                  position={[myLocation.lat, myLocation.lng]}
                  icon={meIcon}
                >
                  <Popup>Your location</Popup>
                </Marker>
              )}
              {effectiveDriverLoc && myLocation && (
                <Polyline
                  positions={[
                    [effectiveDriverLoc.lat, effectiveDriverLoc.lng],
                    [myLocation.lat, myLocation.lng],
                  ]}
                  pathOptions={{
                    color: "#2563eb",
                    weight: 3,
                    dashArray: "6 8",
                  }}
                />
              )}
              <MapFitter points={points} />
            </MapContainer>

            {!effectiveDriverLoc && (
              <div className="dmg-track-map-overlay">
                <p>
                  {isInProgress
                    ? "Waiting for the driver to share location..."
                    : "Live location starts when your trip begins."}
                </p>
              </div>
            )}
          </div>

          <div className="dmg-track-live-bar">
            <span className={`dmg-live-dot ${connected ? "on" : ""}`} />
            {connected ? "Live" : "Reconnecting..."}
          </div>
        </div>

        <div className="dmg-track-side">
          <div className="dmg-eta-card">
            <span className="dmg-eta-label">
              Estimated arrival at your location
            </span>
            <span className="dmg-eta-value">
              {liveEta != null
                ? `${liveEta} min`
                : isInProgress
                  ? "Calculating..."
                  : "--"}
            </span>
            {liveDistance != null && (
              <span className="dmg-eta-sub">
                {liveDistance.toFixed(1)} km away
              </span>
            )}
          </div>

          <div className="dmg-info-card">
            <h4>Trip details</h4>
            <div className="dmg-info-row">
              <span>Pickup stop</span>
              <strong>{trip.pickupStop || "As assigned"}</strong>
            </div>
            <div className="dmg-info-row">
              <span>Scheduled</span>
              <strong>{trip.startTime || "TBD"}</strong>
            </div>
            {trip.seatNumber && (
              <div className="dmg-info-row">
                <span>Seat</span>
                <strong>{trip.seatNumber}</strong>
              </div>
            )}
          </div>

          <div className="dmg-info-card">
            <h4>Driver &amp; vehicle</h4>
            <div className="dmg-info-row">
              <span>Driver</span>
              <strong>{trip.driver?.name || "To be assigned"}</strong>
            </div>
            <div className="dmg-info-row">
              <span>Vehicle</span>
              <strong>{trip.vehicle?.name || "Assigned"}</strong>
            </div>
            <div className="dmg-info-row">
              <span>Plate</span>
              <strong>{trip.vehicle?.plate || "N/A"}</strong>
            </div>
            {trip.driver?.phone && (
              <a className="dmg-call-btn" href={`tel:${trip.driver.phone}`}>
                Call driver
              </a>
            )}
          </div>

          <EmployeeSOSButton tripId={tripId} myLocation={myLocation} />
        </div>
      </div>
    </div>
  );
}
