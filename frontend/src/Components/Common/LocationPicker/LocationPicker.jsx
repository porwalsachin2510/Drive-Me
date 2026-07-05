import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../../../utils/api";
import "./LocationPicker.css";

/**
 * LocationPicker
 * --------------
 * A free, OpenStreetMap + Leaflet based address/pickup-point picker.
 *   - Type an address -> Nominatim (via our backend proxy) suggests places.
 *   - Click a suggestion OR drag the marker to set the exact point.
 *   - Dragging reverse-geocodes to fill the resolved address.
 *   - If an `officePoint` is provided, draws the road route (OSRM) from the
 *     picked point to the office with distance/duration.
 *
 * No API key, no credit card. Attribution to OpenStreetMap is shown on the map.
 */

// Leaflet's default marker icons break under bundlers because the image paths
// are resolved relative to the CSS. Point them at the CDN so markers render.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const officeIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "lp-office-marker",
});

// Default center: Dubai (works for the UAE/Kuwait region).
const DEFAULT_CENTER = [25.2048, 55.2708];

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

function ClickToPlace({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({
  open,
  title = "Pin location",
  initial = null, // { lat, lng, formattedAddress }
  officePoint = null, // { lat, lng } to draw a route to (optional)
  onClose,
  onSave,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [point, setPoint] = useState(null); // { lat, lng }
  const [address, setAddress] = useState("");
  const [routeInfo, setRouteInfo] = useState(null); // { coordinates, distanceMeters, durationSeconds }
  const [error, setError] = useState("");
  const searchTimer = useRef(null);

  // Seed from initial value each time the modal opens.
  useEffect(() => {
    if (!open) return;
    if (
      initial &&
      Number.isFinite(initial.lat) &&
      Number.isFinite(initial.lng)
    ) {
      setPoint({ lat: initial.lat, lng: initial.lng });
      setAddress(initial.formattedAddress || "");
    } else {
      setPoint(null);
      setAddress("");
    }
    setQuery("");
    setResults([]);
    setRouteInfo(null);
    setError("");
  }, [open, initial]);

  /* -------------------------- address search --------------------------- */
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearching(true);
        setError("");
        const res = await api.get("/geocode/search", { params: { q } });
        if (res.data.success) setResults(res.data.data || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Search unavailable. Drop the pin on the map instead.",
        );
      } finally {
        setSearching(false);
      }
    }, 600); // debounce; keeps us well under the 1 req/sec upstream limit
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [query, open]);

  const reverse = useCallback(async (lat, lng) => {
    try {
      const res = await api.get("/geocode/reverse", { params: { lat, lng } });
      if (res.data.success) setAddress(res.data.data.displayName || "");
    } catch {
      // Non-fatal: keep the coordinates even if reverse geocoding fails.
    }
  }, []);

  const placeAt = useCallback(
    (lat, lng, resolvedAddress) => {
      setPoint({ lat, lng });
      if (resolvedAddress !== undefined) {
        setAddress(resolvedAddress);
      } else {
        reverse(lat, lng);
      }
    },
    [reverse],
  );

  const handleSelectResult = (r) => {
    placeAt(r.lat, r.lng, r.displayName);
    setResults([]);
    setQuery("");
  };

  const handleDragEnd = (e) => {
    const { lat, lng } = e.target.getLatLng();
    placeAt(lat, lng);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => placeAt(pos.coords.latitude, pos.coords.longitude),
      () => setError("Could not get your location. Please pin it manually."),
    );
  };

  /* ----------------------- route to office (OSRM) ---------------------- */
  useEffect(() => {
    if (!open || !point || !officePoint) {
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/geocode/route", {
          params: {
            from: `${point.lat},${point.lng}`,
            to: `${officePoint.lat},${officePoint.lng}`,
          },
        });
        if (!cancelled && res.data.success) setRouteInfo(res.data.data);
      } catch {
        if (!cancelled) setRouteInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, point, officePoint]);

  const center = useMemo(() => {
    if (point) return [point.lat, point.lng];
    if (initial && Number.isFinite(initial.lat))
      return [initial.lat, initial.lng];
    return DEFAULT_CENTER;
  }, [point, initial]);

  if (!open) return null;

  const km = routeInfo ? (routeInfo.distanceMeters / 1000).toFixed(1) : null;
  const mins = routeInfo ? Math.round(routeInfo.durationSeconds / 60) : null;

  return (
    <div className="lp-overlay" role="dialog" aria-modal="true">
      <div className="lp-modal">
        <div className="lp-head">
          <h3>{title}</h3>
          <button className="lp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="lp-search-row">
          <input
            className="lp-search"
            placeholder="Search address, building, area…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="lp-btn ghost"
            onClick={handleUseMyLocation}
          >
            Use my location
          </button>
        </div>

        {searching && <div className="lp-hint">Searching…</div>}
        {results.length > 0 && (
          <ul className="lp-results">
            {results.map((r, idx) => (
              <li key={idx}>
                <button type="button" onClick={() => handleSelectResult(r)}>
                  {r.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="lp-map">
          <MapContainer
            center={center}
            zoom={point ? 15 : 11}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Recenter lat={point?.lat} lng={point?.lng} />
            <ClickToPlace onPick={(lat, lng) => placeAt(lat, lng)} />
            {point && (
              <Marker
                position={[point.lat, point.lng]}
                draggable
                eventHandlers={{ dragend: handleDragEnd }}
              />
            )}
            {officePoint &&
              Number.isFinite(officePoint.lat) &&
              Number.isFinite(officePoint.lng) && (
                <Marker
                  position={[officePoint.lat, officePoint.lng]}
                  icon={officeIcon}
                />
              )}
            {routeInfo?.coordinates?.length > 1 && (
              <Polyline
                positions={routeInfo.coordinates}
                pathOptions={{ color: "#2c47e0", weight: 5, opacity: 0.75 }}
              />
            )}
          </MapContainer>
        </div>

        <p className="lp-tip">
          Tip: click the map or drag the pin to set the exact pickup point.
          Address formats vary in the UAE/Kuwait, so the pin is what matters.
        </p>

        {error && <div className="lp-error">{error}</div>}

        <div className="lp-selected">
          {point ? (
            <>
              <div className="lp-selected-addr">
                {address || "Pinned location"}
              </div>
              <div className="lp-selected-coords">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                {km ? ` · ${km} km / ~${mins} min to office (by road)` : ""}
              </div>
            </>
          ) : (
            <div className="lp-selected-coords">No point selected yet.</div>
          )}
        </div>

        <div className="lp-actions">
          <button type="button" className="lp-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="lp-btn primary"
            disabled={!point}
            onClick={() =>
              onSave({
                lat: point.lat,
                lng: point.lng,
                formattedAddress: address || "",
                source: "PINNED",
              })
            }
          >
            Save location
          </button>
        </div>
      </div>
    </div>
  );
}
