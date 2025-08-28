// src/config/flags.js
// Flip features on/off without touching component code.
// You can later read these from env (e.g., import.meta.env.VITE_*).

export const FLAGS = {
  // Core dashboard
  WATCHLIST_ENABLED: true,
  NEWS_ENABLED: true,
  CALENDAR_ENABLED: false,     // set true when /api/calendar/ is live
  MARKET_STATUS_ENABLED: true,
  ALERT_CENTER_ENABLED: true,

  // Workflows
  TRADERLAB_ENABLED: true,
  BACKTESTING_ENABLED: true,   // set false if Backtesting page not ready

  // Analytics panels
  ANALYTICS_ENABLED: true,     // requires /api/journal/analytics/
};
