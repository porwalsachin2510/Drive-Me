"use client";

import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logout, setUser } from "../../Redux/slices/authSlice";
import api from "../../utils/api";
import WalletIcon from "../Navbar/WalletIcon";
import NotificationIcon from "../Navbar/NotificationIcon";
import Logo from "../../assets/Logo.png";
import "./DashboardLayout.css";

// Menu configurations for each role
const menuConfigs = {
  COMMUTER: [
    { id: "my-rides", label: "My Rides", icon: "rides" },
    { id: "find-routes", label: "Find Routes", icon: "routes" },
    { id: "wallet", label: "Wallet", icon: "wallet" },
    { id: "alerts", label: "Alerts", icon: "alerts" },
    { id: "travel-history", label: "Travel History", icon: "history" },
    {
      id: "subscription-settings",
      label: "Subscriptions",
      icon: "subscription",
    },
    { id: "route-requests", label: "Route Requests", icon: "requests" },
    { id: "settings", label: "Settings", icon: "settings" },
  ],
  B2C_PARTNER: [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "trips", label: "My Trips", icon: "trips" },
    // { id: "daily-trips", label: "Daily Trips", icon: "calendar" },
    { id: "earnings", label: "Earnings", icon: "earnings" },
    { id: "vehicles", label: "Fleet & Drivers", icon: "vehicles" },
    { id: "routes", label: "Routes", icon: "routes" },
    { id: "route-requests", label: "Route Requests", icon: "requests" },
    { id: "account", label: "Account", icon: "account" },
  ],
  B2B_PARTNER: [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "fleet", label: "Fleet & Drivers", icon: "vehicles" },
    { id: "contracts", label: "Contracts", icon: "contracts" },
    { id: "My Quotation", label: "My Quotation", icon: "quotation" },
    { id: "negotiations", label: "Negotiations", icon: "negotiation" },
    { id: "requirements", label: "Requirements", icon: "requirements" },
    { id: "analytics", label: "Analytics", icon: "analytics" },
    { id: "invoices", label: "Invoices", icon: "invoices" },
    { id: "settings", label: "Settings", icon: "settings" },
  ],
  CORPORATE: [
    { id: "company-profile", label: "Company Profile", icon: "profile" },
    { id: "my-quotations", label: "My Quotations", icon: "quotation" },
    { id: "contracts", label: "Contracts", icon: "contracts" },
    { id: "employee-management", label: "Employees", icon: "employees" },
    { id: "employee-bookings", label: "Bookings", icon: "bookings" },
    {
      id: "requirement-management",
      label: "Requirements",
      icon: "requirements",
    },
    { id: "routes", label: "Active Routes", icon: "routes" },
    { id: "billing", label: "Billing", icon: "billing" },
    { id: "account-settings", label: "Account Settings", icon: "settings" },
  ],
  CORPORATE_EMPLOYEE: [
    { id: "trip-info", label: "Trip Info", icon: "trips" },
    { id: "my-bookings", label: "My Bookings", icon: "bookings" },
    { id: "history", label: "History", icon: "history" },
    { id: "notifications", label: "Notifications", icon: "alerts" },
    { id: "feedback", label: "Rate & Feedback", icon: "feedback" },
    { id: "route-change", label: "Route Change", icon: "routes" },
  ],
  B2C_PARTNER_DRIVER: [
    { id: "bookings", label: "Bookings", icon: "bookings" },
    { id: "daily-trips", label: "Daily Trips", icon: "calendar" },
    { id: "location", label: "Live Location", icon: "location" },
  ],
  B2B_PARTNER_DRIVER: [
    { id: "bookings", label: "Bookings", icon: "bookings" },
    { id: "notifications", label: "Notifications", icon: "alerts" },
    { id: "location", label: "Live Location", icon: "location" },
  ],
  CORPORATE_DRIVER: [
    { id: "bookings", label: "Bookings", icon: "bookings" },
    { id: "notifications", label: "Notifications", icon: "alerts" },
    { id: "location", label: "Live Location", icon: "location" },
  ],
  ADMIN: [
    {
      id: "overview",
      label: "Overview",
      icon: "overview",
      moduleKey: "overview",
    },
    {
      id: "b2c",
      label: "B2C Management",
      icon: "b2c",
      moduleKey: "b2cManagement",
    },
    {
      id: "ride-pooling",
      label: "Ride Pooling",
      icon: "ridepooling",
      moduleKey: "ridePooling",
    },
    { id: "b2b", label: "B2B Listings", icon: "b2b", moduleKey: "b2bListings" },
    { id: "users", label: "Users", icon: "users", moduleKey: "users" },
    { id: "wallets", label: "Wallets", icon: "wallet", moduleKey: "wallets" },
    {
      id: "vehicle-approval",
      label: "Vehicle Approval",
      icon: "vehicles",
      moduleKey: "vehicleApproval",
    },
    {
      id: "commission-settings",
      label: "Commission",
      icon: "commission",
      moduleKey: "commission",
    },
    {
      id: "negotiations",
      label: "Negotiations",
      icon: "negotiation",
      moduleKey: "negotiations",
    },
    {
      id: "settlement",
      label: "Settlement",
      icon: "settlement",
      moduleKey: "settlement",
    },
    {
      id: "dropdowns",
      label: "Dropdowns",
      icon: "dropdowns",
      moduleKey: "dropdowns",
    },
    { id: "reports", label: "Reports", icon: "reports", moduleKey: "reports" },
    { id: "finance", label: "Finance", icon: "finance", moduleKey: "finance" },
    {
      id: "comm",
      label: "Communication",
      icon: "comm",
      moduleKey: "communication",
    },
    { id: "ads", label: "Ads", icon: "ads", moduleKey: "ads" },
    {
      id: "Payment Verification",
      label: "Payment Verification",
      icon: "payment",
      moduleKey: "paymentVerification",
    },
    { id: "content", label: "Content", icon: "content", moduleKey: "content" },
    {
      id: "admin-management",
      label: "Admin Management",
      icon: "adminManagement",
      moduleKey: "adminManagement",
    },
    {
      id: "terms-management",
      label: "Terms & Conditions",
      icon: "terms",
      moduleKey: "termsAndConditions",
    },
  ],
};

const getIcon = (iconType) => {
  const icons = {
    overview: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    rides: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    ),
    trips: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z" />
      </svg>
    ),
    routes: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="10" r="3" />
        <path d="M12 2a8 8 0 00-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" />
      </svg>
    ),
    wallet: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 10H18a2 2 0 000 4h4" />
      </svg>
    ),
    alerts: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
    history: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    subscription: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 8V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-2" />
        <path d="M12 2v4M8 2v4M16 2v4" />
        <path d="M3 10h18" />
      </svg>
    ),
    settings: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    earnings: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    vehicles: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2" />
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
      </svg>
    ),
    requests: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="12" y2="13" />
      </svg>
    ),
    account: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    contracts: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    quotation: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    requirements: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
    analytics: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    invoices: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <line x1="8" y1="9" x2="16" y2="9" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
      </svg>
    ),
    profile: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
      </svg>
    ),
    employees: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    bookings: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    billing: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    calendar: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
    ),
    location: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
      </svg>
    ),
    feedback: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    users: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    b2c: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-4" />
      </svg>
    ),
    ridepooling: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <circle cx="17" cy="11" r="3" />
        <path d="M21 21v-1.5a3 3 0 00-3-3h-1" />
      </svg>
    ),
    b2b: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
    settlement: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    dropdowns: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    ),
    reports: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    finance: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    comm: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
    ads: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    ),
    payment: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    content: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    layoutSidebar: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
    layoutTop: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
      </svg>
    ),
    adminManagement: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    commission: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8l-8 8" />
        <circle cx="9" cy="9" r="2" />
        <circle cx="15" cy="15" r="2" />
      </svg>
    ),
    negotiation: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    terms: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  };
  return icons[iconType] || icons.overview;
};

export default function DashboardLayout({
  children,
  activeTab,
  setActiveTab,
  showStats = false,
  statsComponent = null,
  headerComponent = null,
}) {
  const user = useSelector((state) => state.auth.user);
  const auth = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // eslint-disable-next-line no-unused-vars
  const location = useLocation();

  // Get menu layout preference from user or default to sidebar
  const [menuLayout, setMenuLayout] = useState(
    user?.uiPreferences?.menuLayout || "sidebar",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    user?.uiPreferences?.sidebarCollapsed || false,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formattedLastLogin, setFormattedLastLogin] = useState("");
  const [isUpdatingLayout, setIsUpdatingLayout] = useState(false);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);

  // Get menu items based on user role and filter by admin permissions if applicable
  const getFilteredMenuItems = () => {
    const baseMenuItems = menuConfigs[user?.role] || [];

    // If not an admin or is a super admin, return all menu items
    if (user?.role !== "ADMIN" || user?.adminPermissions?.isSuperAdmin) {
      return baseMenuItems;
    }

    // Filter menu items based on admin module permissions
    const adminModules = user?.adminPermissions?.modules || {};
    return baseMenuItems.filter((item) => {
      // If the item has a moduleKey, check if the user has permission
      if (item.moduleKey) {
        return adminModules[item.moduleKey] === true;
      }
      // If no moduleKey, allow the item (shouldn't happen with proper config)
      return true;
    });
  };

  const menuItems = getFilteredMenuItems();

  // Update local state when user preferences change
  useEffect(() => {
    if (user?.uiPreferences?.menuLayout) {
      setMenuLayout(user.uiPreferences.menuLayout);
    }
    if (user?.uiPreferences?.sidebarCollapsed !== undefined) {
      setSidebarCollapsed(user.uiPreferences.sidebarCollapsed);
    }
  }, [user?.uiPreferences]);

  // Format last login time
  useEffect(() => {
    if (auth.user?.lastLogin) {
      const loginDate = new Date(auth.user.lastLogin);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateString = "";

      if (loginDate.toDateString() === today.toDateString()) {
        dateString = "Today";
      } else if (loginDate.toDateString() === yesterday.toDateString()) {
        dateString = "Yesterday";
      } else {
        dateString = loginDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      const timeString = loginDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      setFormattedLastLogin(`${dateString}, ${timeString}`);
    }
  }, [auth.user?.lastLogin]);

  const getRoleDisplayName = (role) => {
    const roleMap = {
      ADMIN: "Admin",
      COMMUTER: "Commuter",
      CORPORATE: "Corporate",
      B2C_PARTNER: "B2C Partner",
      B2B_PARTNER: "B2B Partner",
      CORPORATE_DRIVER: "Corporate Driver",
      B2B_PARTNER_DRIVER: "B2B Partner Driver",
      CORPORATE_EMPLOYEE: "Corporate Employee",
      B2C_PARTNER_DRIVER: "B2C Partner Driver",
    };
    return roleMap[role] || role;
  };

  // Update menu layout preference in database
  const handleLayoutChange = async (newLayout) => {
    if (newLayout === menuLayout || isUpdatingLayout) return;

    setIsUpdatingLayout(true);
    setMenuLayout(newLayout);
    setShowLayoutDropdown(false);

    try {
      const response = await api.put("/users/menu-layout", {
        menuLayout: newLayout,
      });

      if (response.data.success) {
        // Update Redux store with new user data
        dispatch(setUser(response.data.user));
      }
    } catch (error) {
      console.error("Failed to update menu layout:", error);
      // Revert on error
      setMenuLayout(user?.uiPreferences?.menuLayout || "sidebar");
    } finally {
      setIsUpdatingLayout(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      dispatch(logout());

      await api.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const handleMenuClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const userInitial =
    user?.fullName?.[0]?.toUpperCase() ||
    user?.name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  const showWallet =
    user?.role &&
    ["COMMUTER", "B2C_PARTNER", "B2B_PARTNER", "ADMIN"].includes(user.role);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLayoutDropdown && !event.target.closest(".dm-layout-toggle")) {
        setShowLayoutDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLayoutDropdown]);

  // Render Top Navigation Layout
  if (menuLayout === "top") {
    return (
      <div className="dm-dashboard-layout dm-layout-top">
        {/* Top Header Bar with Navigation */}
        <header className="dm-dashboard-header dm-header-top">
          <div className="dm-header-left">
            <button
              className="dm-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="dm-header-logo" onClick={() => navigate("/")}>
              <img src={Logo} alt="DriveMe" className="dm-logo-image" />
            </div>
          </div>

          <div className="dm-header-right">
            {/* Layout Toggle */}
            <div className="dm-layout-toggle">
              <button
                className="dm-layout-toggle-btn"
                onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                title="Change menu layout"
              >
                {getIcon(
                  menuLayout === "sidebar" ? "layoutSidebar" : "layoutTop",
                )}
              </button>
              {showLayoutDropdown && (
                <div className="dm-layout-dropdown">
                  <button
                    className={`dm-layout-option ${menuLayout === "sidebar" ? "dm-active" : ""}`}
                    onClick={() => handleLayoutChange("sidebar")}
                  >
                    {getIcon("layoutSidebar")}
                    <span>Sidebar</span>
                  </button>
                  <button
                    className={`dm-layout-option ${menuLayout === "top" ? "dm-active" : ""}`}
                    onClick={() => handleLayoutChange("top")}
                  >
                    {getIcon("layoutTop")}
                    <span>Top Menu</span>
                  </button>
                </div>
              )}
            </div>

            {showWallet && <WalletIcon />}
            <NotificationIcon />
            <div className="dm-user-info">
              <div className="dm-user-avatar">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user?.fullName || "User"}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <span style={{ display: user?.profileImage ? "none" : "flex" }}>
                  {userInitial}
                </span>
              </div>
            </div>
            <button
              className="dm-header-logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Top Navigation Menu */}
        <nav
          className={`ad-dash-navigation ${mobileMenuOpen ? "dm-mobile-open" : ""}`}
        >
          <div className="ad-dash-nav-content">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`ad-dash-nav-item ${activeTab === item.id ? "ad-dash-nav-item-active" : ""}`}
                onClick={() => handleMenuClick(item.id)}
                title={item.label}
              >
                <span className="ad-dash-nav-icon">{getIcon(item.icon)}</span>
                <span className="ad-dash-nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile Overlay for Top Navigation */}
        {mobileMenuOpen && (
          <div
            className="dm-mobile-overlay dm-top-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area - Full Width */}
        <main className="dm-main-content dm-content-full">
          {/* Optional Header Component */}
          {headerComponent && (
            <div className="dm-content-header">{headerComponent}</div>
          )}

          {/* Optional Stats Section */}
          {showStats && statsComponent && (
            <div className="dm-stats-section">{statsComponent}</div>
          )}

          {/* Main Content */}
          <div className="dm-content-area">{children}</div>
        </main>
      </div>
    );
  }

  // Render Sidebar Layout (default)
  return (
    <div className="dm-dashboard-layout">
      {/* Top Header Bar */}
      <header className="dm-dashboard-header">
        <div className="dm-header-left">
          <button
            className="dm-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="dm-header-logo" onClick={() => navigate("/")}>
            <img src={Logo} alt="DriveMe" className="dm-logo-image" />
          </div>
        </div>

        <div className="dm-header-right">
          {/* Layout Toggle */}
          <div className="dm-layout-toggle">
            <button
              className="dm-layout-toggle-btn"
              onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
              title="Change menu layout"
            >
              {getIcon(
                menuLayout === "sidebar" ? "layoutSidebar" : "layoutTop",
              )}
            </button>
            {showLayoutDropdown && (
              <div className="dm-layout-dropdown">
                <button
                  className={`dm-layout-option ${menuLayout === "sidebar" ? "dm-active" : ""}`}
                  onClick={() => handleLayoutChange("sidebar")}
                >
                  {getIcon("layoutSidebar")}
                  <span>Sidebar</span>
                </button>
                <button
                  className={`dm-layout-option ${menuLayout === "top" ? "dm-active" : ""}`}
                  onClick={() => handleLayoutChange("top")}
                >
                  {getIcon("layoutTop")}
                  <span>Top Menu</span>
                </button>
              </div>
            )}
          </div>

          {showWallet && <WalletIcon />}
          <NotificationIcon />
          <div className="dm-user-info">
            <div className="dm-user-avatar">
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user?.fullName || "User"}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <span style={{ display: user?.profileImage ? "none" : "flex" }}>
                {userInitial}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="dm-dashboard-body">
        {/* Sidebar Navigation */}
        <aside
          className={`dm-sidebar ${sidebarCollapsed ? "dm-collapsed" : ""} ${mobileMenuOpen ? "dm-mobile-open" : ""}`}
        >
          {/* User Profile Section */}
          <div className="dm-sidebar-profile">
            <div className="dm-profile-avatar-container">
              <div className="dm-profile-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt={user?.fullName || "User"} />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              <div className="dm-online-indicator"></div>
            </div>
            {!sidebarCollapsed && (
              <div className="dm-profile-info">
                <h3 className="dm-profile-name">
                  {user?.fullName || user?.name || "User"}
                </h3>
                <p className="dm-profile-role">
                  {getRoleDisplayName(user?.role)}
                </p>
                <p className="dm-profile-login">
                  Last login: {formattedLastLogin || "Never"}
                </p>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="dm-sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`dm-nav-item ${activeTab === item.id ? "dm-active" : ""}`}
                onClick={() => handleMenuClick(item.id)}
                title={sidebarCollapsed ? item.label : ""}
              >
                <span className="dm-nav-icon">{getIcon(item.icon)}</span>
                {!sidebarCollapsed && (
                  <span className="dm-nav-label">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="dm-sidebar-footer">
            <button
              className="dm-sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transform: sidebarCollapsed
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 0.3s ease",
                }}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {!sidebarCollapsed && <span>Collapse</span>}
            </button>
            <button className="dm-logout-btn" onClick={handleLogout}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="dm-mobile-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="dm-main-content">
          {/* Optional Header Component */}
          {headerComponent && (
            <div className="dm-content-header">{headerComponent}</div>
          )}

          {/* Optional Stats Section */}
          {showStats && statsComponent && (
            <div className="dm-stats-section">{statsComponent}</div>
          )}

          {/* Main Content */}
          <div className="dm-content-area">{children}</div>
        </main>
      </div>
    </div>
  );
}
