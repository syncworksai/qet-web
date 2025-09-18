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
import Dashboard from "./pages/Dashboard.jsx";
import TraderLab from "./pages/TraderLab.jsx";
import Backtesting from "./pages/Backtesting.jsx";
import PsychQuiz from "./pages/PsychQuiz.jsx";
import Courses from "./pages/Courses.jsx";
import Pricing from "./pages/Pricing.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import logo from "./assets/QELOGO.png";

// --- Auth guard ---
function ProtectedRoute({ children }) {
  const location = useLocation();
  const access = localStorage.getItem("access");
  if (!access) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// --- Navbar ---
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

  const navBtn =
    "px-3 py-1.5 rounded border border-neutral-700 hover:border-neutral-600 text-neutral-200 hover:text-neutral-100";

  return (
    <div className="w-full border-b border-white/10 bg-[color:var(--card)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link to={isAuthed ? "/" : "/login"} className="flex items-center gap-2">
          <img src={logo} alt="QE" className="h-7" />
          <span className="font-semibold">QuantumEdge</span>
        </Link>

        {isAuthed ? (
          <div className="flex items-center gap-3">
            <Link to="/" className={navBtn}>Dashboard</Link>
            <Link to="/traderlab" className={navBtn}>TraderLab</Link>
            <Link to="/backtesting" className={navBtn}>Backtesting</Link>
            <Link to="/psych-quiz" className={navBtn}>Psych Quiz</Link>
            <Link to="/courses" className={navBtn}>Courses</Link>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded border border-red-400/40 text-red-300 hover:text-red-200"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/pricing" className={navBtn}>Pricing</Link>
            <Link to="/register" className={navBtn}>Register</Link>
            <Link to="/login" className={navBtn}>Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* keep old link working too */}
        <Route path="/request-access" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordRequest />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/thank-you" element={<ThankYou />} />

        {/* Protected routes */}
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
