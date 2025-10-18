// src/main.jsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Global styles
import "./index.css";
import "./styles/qe-fields.css"; // ← dark-themed inputs/selects/tooltips

// Boot axios globals (API_BASE, interceptors, window.__QE, etc.)
import "./api/axios";

// App
import App from "./App.jsx";

// Providers
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ToastProvider } from "./components/Toast.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ToastProvider>
  </StrictMode>
);
