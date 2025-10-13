// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
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
import TradeDesk from "./pages/TradeDesk.jsx";

import TopNav from "./components/TopNav.jsx";
import {
  SubscriptionProvider,
} from "./context/SubscriptionContext.jsx";
import { ProtectedRouteWithSubscription } from "./components/SubscriptionGuard.jsx";

/* ------------ auth-only wrapper (no sub check) ------------ */
function ProtectedRoute({ children }) {
  const location = useLocation();
  const access = localStorage.getItem("access");
  if (!access) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/* ------------ app ------------ */
export default function App() {
  const TRADE_DESK_URL =
    import.meta?.env?.VITE_TRADE_DESK_STRIPE_URL ||
    "https://buy.stripe.com/eVq6oHbCGgPt5yNeBd2Nq06";
  const COURSES_URL = import.meta?.env?.VITE_COURSES_STRIPE_URL || "";

  return (
    <Router>
      <SubscriptionProvider>
        <TopNav />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/request-access" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordRequest />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
          <Route path="/pricing" element={<PricingMulti />} />
          <Route path="/thank-you" element={<ThankYou />} />

          {/* Protected (auth-only) */}
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

          {/* Protected (auth + subscription) */}
          <Route
            path="/trade"
            element={
              <ProtectedRouteWithSubscription
                purchaseUrl={TRADE_DESK_URL}
                title="Trade Desk (Pro)"
                feature="The real-time trading toolkit is available to subscribers."
              >
                <TradeDesk />
              </ProtectedRouteWithSubscription>
            }
          />
          {/* Alias */}
          <Route
            path="/trade-desk"
            element={
              <ProtectedRouteWithSubscription
                purchaseUrl={TRADE_DESK_URL}
                title="Trade Desk (Pro)"
                feature="The real-time trading toolkit is available to subscribers."
              >
                <TradeDesk />
              </ProtectedRouteWithSubscription>
            }
          />

          <Route
            path="/courses"
            element={
              <ProtectedRouteWithSubscription
                purchaseUrl={COURSES_URL}
                title="Courses (Pro)"
                feature="Premium courses are available to active subscribers."
              >
                <Courses />
              </ProtectedRouteWithSubscription>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SubscriptionProvider>
    </Router>
  );
}
