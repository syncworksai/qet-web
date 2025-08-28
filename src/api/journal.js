// src/api/journal.js
import { api } from "./axios";

// join paths safely
function j(path) {
  if (!path.startsWith("/")) path = "/" + path;
  return path.replace(/\/{2,}/g, "/");
}

/* ---------------- Backtests: Runs ---------------- */
export async function listBacktestRuns() {
  const { data } = await api.get(j("/api/journal/backtests/runs/"));
  return data;
}

export async function createBacktestRun(payload) {
  // payload: { name, initial_capital, notes }
  const { data } = await api.post(j("/api/journal/backtests/runs/"), payload);
  return data;
}

export async function fetchBacktestRunAnalytics(runId) {
  const { data } = await api.get(j(`/api/journal/backtests/runs/${runId}/analytics/`));
  return data;
}

/* ---------------- Backtests: Trades ---------------- */
export async function getBacktestTrades(runId) {
  const { data } = await api.get(j(`/api/journal/backtests/trades/`), {
    params: { run: runId },
  });
  return data;
}

export async function addBacktestTrade(runId, tradePayload, fileOrNull) {
  // tradePayload: { date, symbol, direction, entry_price, exit_price, size, fee, notes }
  const form = new FormData();
  Object.entries({ ...tradePayload, run: runId }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") form.append(k, v);
  });
  if (fileOrNull) form.append("attachment", fileOrNull);

  const { data } = await api.post(j(`/api/journal/backtests/trades/`), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteBacktestTrade(tradeId) {
  await api.delete(j(`/api/journal/backtests/trades/${tradeId}/`));
  return true;
}

/* ---------------- CSV Upload (server ingests into a run) ---------------- */
export async function uploadBacktestCSV(file, runId = null) {
  const form = new FormData();
  form.append("file", file);
  if (runId != null) form.append("run", String(runId));

  const { data } = await api.post(j(`/api/journal/backtests/upload_csv/`), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* ---------------- High-level analytics alias ---------------- */
export async function fetchBacktestAnalytics(runId) {
  return fetchBacktestRunAnalytics(runId);
}
