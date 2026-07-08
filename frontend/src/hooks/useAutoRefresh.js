import { useEffect, useRef, useCallback } from "react";
import { useSocket } from "./useSocket";

/**
 * useAutoRefresh
 *
 * Standardized "live data" behavior for any data view in the app.
 *
 * It combines three techniques so users never have to manually refresh:
 *   1. Silent background polling on an interval (no loading spinners).
 *   2. Instant refetch when a relevant Socket.io event arrives (event-driven).
 *   3. Pause polling while the tab is hidden, and refetch immediately on
 *      focus / when the tab becomes visible again.
 *
 * Socket events act as the "fast path" (near real-time) while polling is the
 * reliable fallback in case an event is missed or the socket is disconnected.
 *
 * @param {Function} callback   Function that refetches data. Called with an
 *                              object: { silent, reason }. `silent` is true for
 *                              background refreshes so callers can skip spinners.
 * @param {Object}   options
 * @param {number}   options.interval        Poll interval in ms. Default 25000.
 * @param {string[]} options.socketEvents    Socket event names that trigger an
 *                                           instant refetch.
 * @param {boolean}  options.enabled         Master switch. Default true.
 * @param {boolean}  options.refetchOnFocus  Refetch when tab regains focus/visibility. Default true.
 * @param {boolean}  options.pauseWhenHidden Skip polling while tab hidden. Default true.
 * @param {Array}    options.deps            Extra deps that should re-arm the timer (e.g. active filter/tab).
 */
export const useAutoRefresh = (callback, options = {}) => {
    const {
        interval = 25000,
        socketEvents = [],
        enabled = true,
        refetchOnFocus = true,
        pauseWhenHidden = true,
        deps = [],
    } = options;

    const { socket } = useSocket();

    // Keep the latest callback in a ref so the polling/socket effects don't
    // tear down and re-arm every render (which would reset the interval).
    const callbackRef = useRef(callback);
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Debounce timer so a burst of socket events triggers a single refetch.
    const debounceRef = useRef(null);

    const runRefresh = useCallback((reason) => {
        // Never poll in the background while the tab is hidden.
        if (pauseWhenHidden && document.hidden && reason === "poll") return;
        try {
            callbackRef.current?.({ silent: true, reason });
        } catch (err) {
            console.log("[v0] useAutoRefresh callback error:", err?.message);
        }
    }, [pauseWhenHidden]);

    const debouncedRefresh = useCallback((reason) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runRefresh(reason), 400);
    }, [runRefresh]);

    // ---- Interval polling ----
    useEffect(() => {
        if (!enabled || !interval) return;

        const id = setInterval(() => runRefresh("poll"), interval);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, interval, runRefresh, ...deps]);

    // ---- Refetch on tab focus / visibility ----
    useEffect(() => {
        if (!enabled || !refetchOnFocus) return;

        const onVisible = () => {
            if (!document.hidden) runRefresh("focus");
        };
        window.addEventListener("focus", onVisible);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onVisible);
            document.removeEventListener("visibilitychange", onVisible);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, refetchOnFocus, runRefresh]);

    // ---- Instant refetch on relevant socket events ----
    useEffect(() => {
        if (!enabled || !socket || socketEvents.length === 0) return;

        const handler = () => debouncedRefresh("socket");
        socketEvents.forEach((evt) => socket.on(evt, handler));
        return () => {
            socketEvents.forEach((evt) => socket.off(evt, handler));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, socket, debouncedRefresh, socketEvents.join(",")]);

    // Cleanup debounce on unmount.
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Expose a manual trigger for callers that want to force a refresh.
    const refreshNow = useCallback(() => runRefresh("manual"), [runRefresh]);

    return { refreshNow };
};

export default useAutoRefresh;
