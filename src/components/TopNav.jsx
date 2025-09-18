// src/components/TopNav.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

const linkStyle = (active) => ({
  padding: "8px 12px",
  textDecoration: "none",
  color: active ? "#14b8a6" : "#e5e7eb",
  borderBottom: active ? "2px solid #14b8a6" : "2px solid transparent",
  fontWeight: active ? 600 : 500,
});

export default function TopNav() {
  const { pathname } = useLocation();

  return (
    <nav
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "#0b1020",
        borderBottom: "1px solid #1f2937",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link to="/" style={linkStyle(pathname === "/")}>Dashboard</Link>
        <Link to="/pricing" style={linkStyle(pathname === "/pricing")}>Pricing</Link>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Link to="/login" style={linkStyle(pathname === "/login")}>Login</Link>
        <Link to="/register" style={linkStyle(pathname === "/register")}>Register</Link>
      </div>
    </nav>
  );
}
