// src/components/SubscriptionGuard.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "../context/SubscriptionContext";
import LockedCard from "./LockedCard";

/** Whole-page guard (auth + subscription) */
export function ProtectedRouteWithSubscription({ children, purchaseUrl, title, feature }) {
  const { isAuthed, loading, isActive, refetch } = useSubscription();
  const location = useLocation();

  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-gray-300">Checking subscription…</div>
      </div>
    );
  }
  if (!isActive) {
    return (
      <LockedCard
        title={title}
        feature={feature}
        purchaseUrl={purchaseUrl}
        onRefetch={refetch}
      />
    );
  }
  return children || null;
}

/** Inline section guard (inside a page) */
export function SubscriptionGuard({ children, purchaseUrl, title, feature }) {
  const { isAuthed, loading, isActive, refetch } = useSubscription();
  const location = useLocation();

  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loading) {
    return (
      <div className="min-h-[20vh] grid place-items-center">
        <div className="text-gray-300">Checking subscription…</div>
      </div>
    );
  }
  if (!isActive) {
    return (
      <LockedCard
        title={title}
        feature={feature}
        purchaseUrl={purchaseUrl}
        onRefetch={refetch}
      />
    );
  }
  return children || null;
}
