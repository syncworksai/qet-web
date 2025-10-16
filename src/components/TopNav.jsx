// src/components/TopNav.jsx
import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { PAYLINKS, STRIPE_ALL_LINK, SOCIAL } from "../config/commerce";
import logo from "../assets/QELOGO.png";
import { useSubscription } from "../context/SubscriptionContext";

function NavA({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-xl text-sm transition-colors ${
          isActive
            ? "text-white border border-white/20 bg-white/5"
            : "text-neutral-300 hover:text-white border border-transparent hover:border-white/10"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

const Icon = ({ d, label }) => (
  <svg aria-label={label} viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d={d} />
  </svg>
);

const icons = {
  yt: "M10 15l5.19-3L10 9v6zm11-3c0 3.87-3.13 7-7 7H10C6.13 19 3 15.87 3 12S6.13 5 10 5h4c3.87 0 7 3.13 7 7z",
  ig: "M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6-1a1 1 0 100 2 1 1 0 000-2z",
  fb: "M15 3h3V0h-3a5 5 0 00-5 5v3H7v3h3v10h3V11h3l1-3h-4V5a2 2 0 012-2z",
  tt: "M20 7.5c-.9.4-1.9.6-3 .6V4.4a7 7 0 01-2.6-.6v11.4c0 3-2.4 5.4-5.4 5.4S3.6 18.2 3.6 15.2c0-2.8 2-5.1 4.7-5.4v3a2.4 2.4 0 00-2.1 2.4 2.4 2.4 0 104.8 0V1.9c1 .6 2.1 1 3.3 1.2a6 6 0 003.7 3.2z",
};

export default function TopNav() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("access"));
  const { isActive, isAuthed: ctxAuthed } = useSubscription();

  useEffect(() => {
    const onStorage = () => setIsAuthed(!!localStorage.getItem("access"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (ctxAuthed !== undefined) setIsAuthed(Boolean(ctxAuthed));
  }, [ctxAuthed]);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setIsAuthed(false);
    navigate("/login");
  };

  const LockBadge = () =>
    ctxAuthed && !isActive ? (
      <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-300">
        LOCK
      </span>
    ) : null;

  // mailto
  const mailtoHref = (() => {
    const to = "quantum.edge.fx@gmail.com";
    const subject = encodeURIComponent("QEFX - Issue:");
    const body = encodeURIComponent(
      [
        "Describe the issue here (what happened, what you expected):",
        "",
        "Steps to reproduce:",
        "1.",
        "2.",
        "",
        "Your account email (if different):",
        "",
        "Screenshot / link (optional):",
      ].join("\n")
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  })();

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-black/50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center gap-3">
        {/* Brand */}
        <Link to={isAuthed ? "/" : "/"} className="flex items-center gap-2">
          <img src={logo} alt="QE" className="h-7" />
          <span className="font-semibold text-white">Quantum Edge</span>
        </Link>

        {/* Left nav */}
        <nav className="hidden md:flex items-center gap-2 ml-2">
          {isAuthed ? (
            <>
              <NavA to="/">Dashboard</NavA>
              <NavA to="/trade">
                <span className="inline-flex items-center">
                  Trade Desk <LockBadge />
                </span>
              </NavA>
              <NavA to="/traderlab">TraderLab</NavA>
              <NavA to="/backtesting">Backtesting</NavA>
              <NavA to="/psych-quiz">Psych&nbsp;Quiz</NavA>
              <NavA to="/courses">
                <span className="inline-flex items-center">
                  Courses <LockBadge />
                </span>
              </NavA>
            </>
          ) : (
            <>
              <NavA to="/pricing">Pricing</NavA>
            </>
          )}

          {/* Products dropdown */}
          <div className="relative group">
            <button className="px-3 py-2 rounded-xl text-sm text-neutral-300 hover:text-white border border-transparent hover:border-white/10">
              Products ▾
            </button>
            <div className="absolute hidden group-hover:block mt-2 w-56 rounded-xl border border-white/10 bg-[color:var(--card,#0B0B10)] p-2 shadow-xl">
              <a
                className="block px-3 py-2 rounded hover:bg-white/5"
                href={STRIPE_ALL_LINK}
                target="_blank"
                rel="noreferrer"
              >
                App + Add-ons (All-in-One)
              </a>
              <div className="h-px my-1 bg-white/10" />
              <a className="block px-3 py-2 rounded hover:bg:white/5" href={PAYLINKS.webinars} target="_blank" rel="noreferrer">
                Live Webinars
              </a>
              <a className="block px-3 py-2 rounded hover:bg-white/5" href={PAYLINKS.courses} target="_blank" rel="noreferrer">
                Courses
              </a>
              <a className="block px-3 py-2 rounded hover:bg-white/5" href={PAYLINKS.coaching} target="_blank" rel="noreferrer">
                Coaching / Mentorship
              </a>
              {PAYLINKS.app && (
                <a className="block px-3 py-2 rounded hover:bg-white/5" href={PAYLINKS.app} target="_blank" rel="noreferrer">
                  QE App (standalone)
                </a>
              )}
              <NavLink to="/pricing" className="block px-3 py-2 rounded hover:bg-white/5 mt-1">
                Pricing page
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {/* Socials */}
          <a href={SOCIAL.youtube}   target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-white" title="YouTube"><Icon d={icons.yt} label="YouTube" /></a>
          <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-white" title="Instagram"><Icon d={icons.ig} label="Instagram" /></a>
          <a href={SOCIAL.facebook}  target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-white" title="Facebook"><Icon d={icons.fb} label="Facebook" /></a>
          <a href={SOCIAL.tiktok}    target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-white" title="TikTok"><Icon d={icons.tt} label="TikTok" /></a>

          {/* NEW: Support */}
          <a
            href={mailtoHref}
            className="px-3 py-2 rounded-xl text-sm text-neutral-300 hover:text-white border border-transparent hover:border-white/10"
            title="Contact support"
          >
            Support
          </a>

          {/* Auth */}
          {isAuthed ? (
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl text-sm text-red-300 hover:text-red-200 border border-red-400/30"
            >
              Logout
            </button>
          ) : (
            <>
              <NavA to="/register">Register</NavA>
              <NavA to="/login">Login</NavA>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
