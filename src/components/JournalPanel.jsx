// src/components/JournalPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/axios";
import { getBacktestTrades, saveTradeJournal } from "../api/journal";

/**
 * Weighted Likert (1–5) journal + mistake tags, attached to a selected trade.
 * Writes a structured JRNL_V2 block into trade.notes via a dedicated endpoint.
 */

const tokens = {
  muted: "#9aa8bd",
  grid: "#263245",
  primary: "#4f46e5",
};

const DEFAULT_QUESTIONS = [
  { key: "Focus",     label: "Focus on process (not P&L)",  weight: 1.0 },
  { key: "Plan",      label: "Followed the plan/criteria",   weight: 1.2 },
  { key: "Emotions",  label: "Emotional control",            weight: 1.1 },
  { key: "Rules",     label: "Risk & rules adhered",         weight: 1.3 },
  { key: "Patience",  label: "Patience / No forcing",        weight: 1.0 },
  { key: "Setup",     label: "Took only A-setup quality",    weight: 1.1 },
  { key: "Risk",      label: "Position sizing / R:R aligned",weight: 1.2 },
  { key: "NewsDisc",  label: "Respected news/vol events",    weight: 0.8 },
];

const MISTAKE_TAGS = [
  "fomo","revenge","overtrade","chase","hesitation",
  "early_exit","late_exit","rule_break","move_stop",
  "impulsive_entry","impulsive_exit"
];

export default function JournalPanel({ runId, compact }) {
  const [trades, setTrades] = useState([]);
  const [tradeId, setTradeId] = useState("");
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(DEFAULT_QUESTIONS.map(q => [q.key, 3]))
  );
  const [mistakes, setMistakes] = useState(new Set());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (!runId) { setTrades([]); setTradeId(""); return; }
    (async () => {
      try {
        const list = await getBacktestTrades(runId);
        const sorted = (list || []).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
        setTrades(sorted);
        if (sorted[0]?.id) setTradeId(String(sorted[0].id));
      } catch (e) {
        console.error("load trades for journal", e);
        setTrades([]);
      }
    })();
  }, [runId]);

  const scoreInfo = useMemo(() => {
    const maxPerQ = 5;
    const sumW = DEFAULT_QUESTIONS.reduce((a, q) => a + q.weight, 0);
    const raw = DEFAULT_QUESTIONS.reduce((a, q) => {
      const v = Number(answers[q.key] ?? 0);
      return a + (v / maxPerQ) * q.weight;
    }, 0);
    const pct = Math.round((raw / sumW) * 100);

    const flags = DEFAULT_QUESTIONS
      .filter(q => Number(answers[q.key] ?? 0) <= 2)
      .map(q => q.key.toLowerCase());

    return { score: pct, flags };
  }, [answers]);

  function setLikert(key, val) {
    setAnswers(prev => ({ ...prev, [key]: Number(val) }));
  }
  function toggleMistake(tag) {
    setMistakes(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function save() {
    if (!runId || !tradeId) return;
    setBusy(true);
    try {
      const payload = {
        score: scoreInfo.score,
        mistakes: [...mistakes],           // array or CSV is fine on the server
        flags: scoreInfo.flags.length ? scoreInfo.flags : "none",
        extra_notes: notes || "",
      };
      await saveTradeJournal(tradeId, payload);
      setFlash({ type: "ok", text: "Journal saved to trade." });
      // optional: refresh the single trade if you want to reflect notes immediately
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      console.error(e);
      setFlash({ type: "err", text: "Save failed." });
      setTimeout(() => setFlash(null), 2400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-xl border ${compact ? "p-3" : "p-4"}`} style={{ borderColor: tokens.grid }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium">Post-Trade Review (Weighted)</div>
        {flash && (
          <div
            className="text-xs px-2 py-1 rounded-md"
            style={flash.type === "ok"
              ? { color: "#10b981", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)" }
              : { color: "#ef4444", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)" }
            }
          >
            {flash.text}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="grid gap-3">
            {DEFAULT_QUESTIONS.map(q => (
              <LikertRow
                key={q.key}
                label={`${q.label} (w=${q.weight})`}
                name={`q_${q.key}`}             // unique name to keep radios independent
                value={answers[q.key]}
                onChange={v => setLikert(q.key, v)}
              />
            ))}

            {/* Mistake tags */}
            <div className="rounded-lg border p-3" style={{ borderColor: tokens.grid }}>
              <div className="text-sm mb-2">Mistakes (tag what happened)</div>
              <div className="flex flex-wrap gap-2">
                {MISTAKE_TAGS.map(tag => {
                  const active = mistakes.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMistake(tag)}
                      className="px-2 py-1 rounded-md text-xs border"
                      style={{
                        borderColor: active ? "#4f46e5" : tokens.grid,
                        background: active ? "rgba(79,70,229,.14)" : "transparent"
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs" style={{ color: tokens.muted }}>Notes (optional)</label>
              <textarea
                rows={2}
                className="qe-field mt-1 w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, mistake anatomy, corrective action…"
              />
            </div>
          </div>
        </div>

        <aside className="md:col-span-1">
          <div className="rounded-lg border p-3" style={{ borderColor: tokens.grid }}>
            <div className="text-xs" style={{ color: tokens.muted }}>Attach to trade</div>
            <select
              className="qe-select mt-1 w-full"
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
            >
              {(trades || []).map(t => (
                <option key={t.id} value={t.id}>
                  #{t.id} • {t.symbol || "—"} • {t.date || "—"} {t.trade_time?.slice(0,5) || ""}
                </option>
              ))}
              {(!trades || trades.length === 0) && <option value="">No trades yet</option>}
            </select>

            <div className="mt-3">
              <div className="text-xs" style={{ color: tokens.muted }}>Discipline Score</div>
              <div className="text-2xl font-semibold mt-1">{scoreInfo.score}</div>
              {scoreInfo.flags.length > 0 && (
                <div className="mt-2 text-xs" style={{ color: tokens.muted }}>
                  Flags: {scoreInfo.flags.join(", ")}
                </div>
              )}
            </div>

            <button
              className="mt-3 px-3 py-2 rounded-lg text-white w-full text-sm disabled:opacity-60"
              style={{ background: tokens.primary }}
              onClick={save}
              disabled={busy || !tradeId}
            >
              {busy ? "Saving…" : "Save to Trade"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LikertRow({ label, name, value = 3, onChange }) {
  const opts = [1, 2, 3, 4, 5];
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#263245" }}>
      <div className="text-sm mb-2">{label}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {opts.map(v => (
          <label
            key={v}
            className="inline-flex items-center gap-2 px-2 py-1 rounded-md border cursor-pointer"
            style={{
              borderColor: value === v ? "#4f46e5" : "#263245",
              background: value === v ? "rgba(79,70,229,.12)" : "transparent"
            }}
          >
            <input
              type="radio"
              name={name}
              className="accent-indigo-600"
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span className="text-xs" style={{ color: "#9aa8bd" }}>{v}</span>
          </label>
        ))}
        <span className="ml-2 text-xs" style={{ color: "#9aa8bd" }}>
          1 = poor, 5 = excellent
        </span>
      </div>
    </div>
  );
}
