// src/components/JournalPanel.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/axios";

/**
 * JournalPanel — MVP Reflection + Photos
 * Works with or without a tradeId. Dark theme, no white hovers.
 */
const STORAGE_KEY = "qe_journal_reflections_v1";

const DEFAULT_PROMPTS = [
  { id: "rule", label: "What rule did this trade express (or break)?" },
  { id: "emotion", label: "Strongest emotion pre/post entry?" },
  { id: "setup", label: "Setup grade (A/B/C) and why?" },
  { id: "improve", label: "One improvement for next time?" },
  { id: "ev", label: "If repeated 100 times, is this +EV? Why?" },
];

export default function JournalPanel({ tradeId = null, initialNotes = "", onSaved, compact = false }) {
  const [mood, setMood] = useState(3); // 1..5
  const [tags, setTags] = useState("");
  const [answers, setAnswers] = useState(Object.fromEntries(DEFAULT_PROMPTS.map(p => [p.id, ""])));
  const [notes, setNotes] = useState(initialNotes || "");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const all = JSON.parse(raw) || {};
      const key = tradeId ? String(tradeId) : "__standalone__";
      const r = all[key];
      if (!r) return;
      if (typeof r.mood === "number") setMood(r.mood);
      if (typeof r.tags === "string") setTags(r.tags);
      if (r.answers) setAnswers(prev => ({ ...prev, ...r.answers }));
      if (!initialNotes && typeof r.notes === "string") setNotes(r.notes);
      if (Array.isArray(r.photos)) setPreviews(r.photos.map((url, i) => ({ name: `photo-${i+1}`, url })));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  function saveLocal(payload) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = tradeId ? String(tradeId) : "__standalone__";
      all[key] = payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }

  function onPickFiles(e) {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setPreviews(list.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/api/journal/uploads/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return r?.data?.url || null;
    } catch {
      return URL.createObjectURL(file);
    }
  }

  async function persistServer(payload) {
    try {
      await api.post("/api/journal/reflections/", payload);
      return { ok: true, mode: "reflections" };
    } catch (e1) {
      if (tradeId) {
        try {
          const append = `\n\n---\n[Reflection]\n${payload.notes || ""}`;
          await api.patch(`/api/journal/trades/${tradeId}/`, { notes: append }, { headers: { "Content-Type": "application/json" } });
          return { ok: true, mode: "trade-notes" };
        } catch (e2) {
          return { ok: false, error: e2?.message || "save_failed" };
        }
      }
      return { ok: false, error: e1?.message || "save_failed" };
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatus("Saving…");

    let photoUrls = [];
    if (files.length) {
      const uploaded = await Promise.all(files.map(uploadFile));
      photoUrls = uploaded.filter(Boolean);
    } else if (previews.length) {
      photoUrls = previews.map(p => p.url);
    }

    const payload = {
      trade: tradeId,
      mood,
      tags,
      answers,
      notes,
      photos: photoUrls,
      source: "journal_panel_v1",
      timestamp: new Date().toISOString(),
    };

    saveLocal(payload);
    const res = await persistServer(payload);

    setSaving(false);
    if (res.ok) {
      setStatus(res.mode === "reflections" ? "Saved to server." : "Saved to trade notes.");
    } else {
      setStatus("Saved locally (server unavailable).");
    }
    if (onSaved) onSaved(payload);
  }

  const inputCls =
    "mt-1 w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-0 focus:border-neutral-600";
  const btnPrimary =
    "px-4 py-2 rounded-xl border bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500";
  const btnGhost =
    "px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700";

  return (
    <div className="rounded-2xl border border-neutral-800 p-4 bg-[color:var(--card,#0B0B10)]">
      <div className={`flex items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
        <div>
          <h3 className="text-base font-semibold text-neutral-100">
            {tradeId ? `Journal · Trade #${tradeId}` : "Journal"}
          </h3>
          {!compact && (
            <p className="text-xs text-neutral-400">
              Capture quick reflections. Photos are optional.
            </p>
          )}
        </div>
        <div className="text-[11px] text-neutral-500">{status}</div>
      </div>

      {/* Mood + Tags */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-300 w-16">Mood</label>
          <input
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <span className="text-xs text-neutral-400 w-6 text-right">{mood}</span>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm text-neutral-300">Tags (comma separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. trend, nfp, gold"
            className={inputCls}
          />
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-3">
        {DEFAULT_PROMPTS.map((p) => (
          <div key={p.id}>
            <label className="text-sm text-neutral-300">{p.label}</label>
            <textarea
              rows={2}
              value={answers[p.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [p.id]: e.target.value }))}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* Free notes */}
      <div className="mt-3">
        <label className="text-sm text-neutral-300">Notes</label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else worth noting…"
          className={inputCls}
        />
      </div>

      {/* Photos */}
      <div className="mt-3">
        <label className="text-sm text-neutral-300">Add Photo(s)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPickFiles}
          className="mt-1 block w-full text-sm text-neutral-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-neutral-700 file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700"
        />
        {!!previews.length && (
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative border border-neutral-800 rounded-lg overflow-hidden">
                <img src={p.url} alt={p.name} className="w-full h-24 object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button onClick={handleSave} disabled={saving}
          className={saving ? "px-4 py-2 rounded-xl bg-neutral-800 text-neutral-500 border border-neutral-800" : btnPrimary}>
          {saving ? "Saving…" : "Save Journal"}
        </button>
        <button
          onClick={() => {
            setMood(3); setTags(""); setAnswers(Object.fromEntries(DEFAULT_PROMPTS.map(p => [p.id, ""])));
            setNotes(""); setFiles([]); setPreviews([]); setStatus("");
          }}
          className={btnGhost}
        >
          Reset
        </button>
      </div>

      <p className="mt-2 text-[11px] text-neutral-500">
        Tip: If the server endpoints aren’t ready, entries are kept locally and sync later.
      </p>
    </div>
  );
}
