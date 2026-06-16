"use client";

import { useEffect, useState } from "react";
import api from "../../utils/api";
import "./serviceunavailable.css";

const AVAILABLE_COUNTRIES = [
  {
    code: "UAE",
    name: "United Arab Emirates",
    cities: "Dubai · Abu Dhabi · Sharjah",
  },
  {
    code: "KW",
    name: "Kuwait",
    cities: "Kuwait City · Salmiya · Hawally",
  },
];

const FEATURES = [
  {
    title: "Verified commute partners",
    desc: "Ride with background-checked drivers and trusted B2C partners on fixed daily routes.",
    icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    title: "Affordable monthly passes",
    desc: "Lock in your seat for the whole month at a flat, transparent price — no surge, no surprises.",
    icon: (
      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    ),
  },
  {
    title: "Routes built around you",
    desc: "Tell us where you commute and we'll prioritise launching the corridors people need most.",
    icon: (
      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
];

export default function ServiceUnavailable({ country, onRequestRoute }) {
  const displayCountry = country || "your country";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [waitingCount, setWaitingCount] = useState(null);

  // Load how many people from this country are already waiting.
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      if (!country) return;
      try {
        const res = await api.get(
          `/expansion-waitlist/stats?country=${encodeURIComponent(country)}`,
        );
        if (active && res.data?.success) {
          setWaitingCount(res.data.countryCount ?? 0);
        }
      } catch (err) {
        // Stats are non-critical; fail silently.
        console.log("[v0] waitlist stats unavailable", err?.message);
      }
    };
    loadStats();
    return () => {
      active = false;
    };
  }, [country]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");
      const res = await api.post("/expansion-waitlist/join", {
        email: trimmed,
        country: displayCountry,
        source: "home_page",
      });

      if (res.data?.success) {
        setStatus("success");
        setMessage(res.data.message);
        if (typeof res.data.countryCount === "number") {
          setWaitingCount(res.data.countryCount);
        }
        setEmail("");
      } else {
        setStatus("error");
        setMessage(res.data?.message || "Something went wrong. Try again.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        err.response?.data?.message || "Network error. Please try again.",
      );
    }
  };

  return (
    <section className="dmg-coming">
      <div className="dmg-coming-hero">
        <span className="dmg-coming-badge">
          <span className="dmg-coming-badge-dot" />
          Launching soon
        </span>

        <h1 className="dmg-coming-title">
          Drive Me Go isn&apos;t in{" "}
          <span className="dmg-coming-country">{displayCountry}</span> yet
        </h1>

        <p className="dmg-coming-subtitle">
          We&apos;re currently live in the UAE and Kuwait, and we&apos;re
          expanding fast. Leave your email and you&apos;ll be the first to know
          the day we roll into {displayCountry}.
        </p>

        {waitingCount !== null && waitingCount > 0 && (
          <p className="dmg-coming-social">
            <strong>{waitingCount.toLocaleString()}</strong>{" "}
            {waitingCount === 1 ? "commuter is" : "commuters are"} already
            waiting in {displayCountry}.
          </p>
        )}

        {/* Notify form */}
        {status === "success" ? (
          <div className="dmg-coming-success" role="status">
            <svg
              className="dmg-coming-success-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <p>{message}</p>
          </div>
        ) : (
          <form className="dmg-coming-form" onSubmit={handleSubmit} noValidate>
            <div className="dmg-coming-input-wrap">
              <label htmlFor="dmg-waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                id="dmg-waitlist-email"
                type="email"
                className={`dmg-coming-input ${
                  status === "error" ? "dmg-coming-input-error" : ""
                }`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                aria-invalid={status === "error"}
                disabled={status === "loading"}
              />
              <button
                type="submit"
                className="dmg-coming-submit"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Joining..." : "Notify Me"}
              </button>
            </div>
            {status === "error" && message && (
              <p className="dmg-coming-error">{message}</p>
            )}
          </form>
        )}

        <button
          type="button"
          className="dmg-coming-secondary"
          onClick={onRequestRoute}
        >
          Or request a specific route
        </button>
      </div>

      {/* Where we are live */}
      <div className="dmg-coming-live">
        <h2 className="dmg-coming-section-title">Where you can ride today</h2>
        <div className="dmg-coming-countries">
          {AVAILABLE_COUNTRIES.map((c) => (
            <div className="dmg-coming-country-card" key={c.code}>
              <span className="dmg-coming-country-code">{c.code}</span>
              <div className="dmg-coming-country-info">
                <span className="dmg-coming-country-name">{c.name}</span>
                <span className="dmg-coming-country-cities">{c.cities}</span>
              </div>
              <span className="dmg-coming-live-pill">
                <span className="dmg-coming-live-dot" />
                Live
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* What to expect */}
      <div className="dmg-coming-features">
        <h2 className="dmg-coming-section-title">
          What&apos;s coming to {displayCountry}
        </h2>
        <div className="dmg-coming-feature-grid">
          {FEATURES.map((f) => (
            <div className="dmg-coming-feature" key={f.title}>
              <span className="dmg-coming-feature-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                </svg>
              </span>
              <h3 className="dmg-coming-feature-title">{f.title}</h3>
              <p className="dmg-coming-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
