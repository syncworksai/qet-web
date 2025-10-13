// src/api/journal.js
import { api } from "./axios";

// Safe join
function j(path) {
  if (!path.startsWith("/")) path = "/" + path;
  return path.replace(/\/{2,}/g, "/");
}

/* ---------------- Runs ---------------- */
export async function listBacktestRuns() {
  const { data } = await api.get(j("/api/journal/backtests/runs/"));
  return data;
}

export async function createBacktestRun(payload) {
  const { data } = await api.post(j("/api/journal/backtests/runs/"), payload);
  return data;
}

export async function fetchBacktestRunAnalytics(runId) {
  const { data } = await api.get(j(`/api/journal/backtests/runs/${runId}/analytics/`));
  return data;
}

/* ---------------- Trades ---------------- */
export async function getBacktestTrades(runId) {
  const { data } = await api.get(j(`/api/journal/backtests/trades/`), { params: { run: runId } });
  return data;
}

export async function addBacktestTrade(runId, tradePayload, fileOrNull) {
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

/* ---------------- CSV Upload used by TraderLab ---------------- */
export async function uploadBacktestCSV(file, runId = null, tzShiftHours = 0) {
  const form = new FormData();
  form.append("file", file);
  if (runId != null) form.append("run_id", String(runId));
  form.append("tz_shift_hours", String(tzShiftHours || 0));

  const { data } = await api.post(j(`/api/journal/backtests/import_csv/`), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // {imported, rows_parsed, ...}
}

/* ---------------- Journal-only save ---------------- */
export async function saveTradeJournal(tradeId, payload) {
  // POST /api/journal/backtests/trades/<id>/journal/
  const { data } = await api.post(j(`/api/journal/backtests/trades/${tradeId}/journal/`), payload);
  return data;
}
