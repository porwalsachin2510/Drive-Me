import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { refineLocaleByLocation } from "../../Redux/slices/localeSlice";
import "./CommuterLocationBadge.css";

/**
 * CommuterLocationBadge — shows the country a COMMUTER is CURRENTLY IN, detected
 * AUTOMATICALLY from their real location. There is deliberately no manual
 * country picker: exactly like Uber/Careem, one account works across every
 * served country, but you only ever see the routes/prices of the country you
 * are physically in. A commuter in the UAE can no longer hand-pick Kuwait to
 * book Kuwait routes.
 *
 * How detection works:
 *   1. On mount it asks the browser Geolocation API for precise coordinates and
 *      sends them to the backend, which reverse-geocodes them, persists the
 *      resolved served country to the profile and returns the locale.
 *   2. If the user denies permission or GPS is unavailable, it falls back to
 *      server-side IP detection (no coordinates sent).
 *   3. A small refresh button lets them re-detect (e.g. after actually
 *      travelling from the UAE to Kuwait).
 */
function CommuterLocationBadge() {
  const dispatch = useDispatch();
  const locale = useSelector((state) => state.locale);
  const [detecting, setDetecting] = useState(false);
  const [denied, setDenied] = useState(false);
  // Guard so the automatic geolocation prompt only fires once per mount.
  const didInit = useRef(false);

  const displayName = locale?.displayName || locale?.country || "Detecting…";
  const currency = locale?.currency;
  const serviceAvailable = locale?.serviceAvailable;

  const detect = useCallback(() => {
    setDetecting(true);
    setDenied(false);

    const finishWithIp = () =>
      dispatch(refineLocaleByLocation({})).finally(() => setDetecting(false));

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      finishWithIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        dispatch(
          refineLocaleByLocation({ lat: latitude, lng: longitude }),
        ).finally(() => setDetecting(false));
      },
      (err) => {
        // Permission denied / unavailable / timeout -> IP fallback.
        if (err && err.code === err.PERMISSION_DENIED) setDenied(true);
        finishWithIp();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [dispatch]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    detect();
  }, [detect]);

  const title = denied
    ? "Location access is off — showing your region by network. Enable location for accurate results, then refresh."
    : "Your country is detected automatically from your location.";

  return (
    <div
      className={`clb-badge ${serviceAvailable === false ? "clb-unavailable" : ""}`}
      title={title}
    >
      <span className="clb-pin" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>

      <span className="clb-current">
        <span className="clb-country">{displayName}</span>
        <span className="clb-meta">
          {serviceAvailable === false ? "Not available here" : currency}
        </span>
      </span>

      <button
        type="button"
        className={`clb-refresh ${detecting ? "clb-refreshing" : ""}`}
        onClick={detect}
        disabled={detecting}
        aria-label="Re-detect my location"
        title="Re-detect my location"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  );
}

export default CommuterLocationBadge;
