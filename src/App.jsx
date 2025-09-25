// src/App.jsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ResetPasswordRequest from "./pages/ResetPasswordRequest.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import TraderLab from "./pages/TraderLab.jsx";
import Backtesting from "./pages/Backtesting.jsx";
import PsychQuiz from "./pages/PsychQuiz.jsx";
import Courses from "./pages/Courses.jsx";
import PricingMulti from "./pages/PricingMulti.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import logo from "./assets/QELOGO.png";

/* ---------------- Auth guard ---------------- */
function ProtectedRoute({ children }) {
  const location = useLocation();
  const access = localStorage.getItem("access");
  if (!access) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/* ---------------- Navbar ---------------- */
function Navbar() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem("access"));

  useEffect(() => {
    const onStorage = () => setIsAuthed(!!localStorage.getItem("access"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setIsAuthed(false);
    navigate("/login");
  };

  const linkBase =
    "inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-white/10 text-neutral-200 hover:text-neutral-100 hover:bg-white/5 transition-colors";

  return (
    // darker bar + softer divider
    <div className="w-full border-b border-white/10" style={{ background: "#0a0f18" }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* LEFT: brand + Pricing */}
        <div className="flex items-center gap-6">
          <Link to={isAuthed ? "/" : "/login"} className="flex items-center gap-2">
            <img src={logo} alt="QE" className="h-7" />
            <span className="font-semibold text-neutral-100">QuantumEdge</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-2">
            <Link to="/pricing" className="text-sm text-neutral-200 hover:text-white px-2 py-1">
              Pricing
            </Link>
          </nav>
        </div>

        {/* RIGHT: socials + auth */}
        <div className="flex items-center gap-5">
          {/* Socials with breathing room */}
          <div className="flex items-center gap-4 pr-2 mr-2 border-r border-white/10">
            <a
              href="http://www.youtube.com/@quantum.edge.fx1"
              target="_blank"
              rel="noreferrer"
              title="YouTube"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-cyan-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M23.5 6.2a4 4 0 0 0-2.8-2.8C18.9 3 12 3 12 3s-6.9 0-8.7.4A4 4 0 0 0 .5 6.2 41.7 41.7 0 0 0 0 12a41.7 41.7 0 0 0 .5 5.8 4 4 0 0 0 2.8 2.8C5.1 21 12 21 12 21s6.9 0 8.7-.4a4 4 0 0 0 2.8-2.8c.4-1.9.5-3.8.5-5.8s-.1-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/quantumedge.fx/"
              target="_blank"
              rel="noreferrer"
              title="Instagram"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-cyan-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zm6.4-.9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
              </svg>
            </a>
            <a
              href="http://tiktok.com/@quantum.edge.fx"
              target="_blank"
              rel="noreferrer"
              title="TikTok"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-cyan-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15 3c1.1 1.6 2.6 2.7 4.5 3V9c-1.8-.1-3.3-.7-4.5-1.7V15a6 6 0 1 1-6-6c.5 0 1 .1 1.5.2V12a3 3 0 1 0 3 3V3h1z" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61579183787818"
              target="_blank"
              rel="noreferrer"
              title="Facebook"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-cyan-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M13 22v-8h3l1-4h-4V8c0-1.1.3-2 2-2h2V2h-3c-3 0-5 1.8-5 5v3H6v4h3v8h4z" />
              </svg>
            </a>
          </div>

          {/* Auth */}
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <Link to="/" className={linkBase}>Dashboard</Link>
              <Link to="/traderlab" className={linkBase}>TraderLab</Link>
              <Link to="/backtesting" className={linkBase}>Backtesting</Link>
              <Link to="/psych-quiz" className={linkBase}>Psych&nbsp;Quiz</Link>
              <Link to="/courses" className={linkBase}>Courses</Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-red-400/40 text-red-300 hover:text-red-200"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-[color:var(--accent)] hover:opacity-90 font-semibold transition-colors"
                style={{ color: "#0b0f17" }}
                title="Register"
              >
                Register
              </Link>
              <Link to="/login" className={linkBase}>Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/request-access" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordRequest />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/pricing" element={<PricingMulti />} />
        <Route path="/thank-you" element={<ThankYou />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/traderlab"
          element={
            <ProtectedRoute>
              <TraderLab />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backtesting"
          element={
            <ProtectedRoute>
              <Backtesting />
            </ProtectedRoute>
          }
        />
        <Route
          path="/psych-quiz"
          element={
            <ProtectedRoute>
              <PsychQuiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <Courses />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
