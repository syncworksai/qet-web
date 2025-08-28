// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("UI Error:", err, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-[color:var(--card)] border border-white/10 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Try refreshing the page. If it keeps happening, please contact support.
          </p>
        </div>
      </div>
    );
  }
}
