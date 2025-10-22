// src/pages/PsychQuiz.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
} from "recharts";
import { api } from "../api/axios";

/**
 * QuantumEdge — Trader Style Profiler (Psych Quiz + DISC-aware)
 * v1.2.0
 *
 * Adds:
 * - Optional DISC import (D/I/S/C -8..+8 or presets) → modifies archetype & horizon.
 * - Time-Horizon vs Pace scatter placement (Scalper/Day/Swing/Position).
 * - Coach Flags (FOMO / Revenge / Over-analysis / Tilt risk).
 * - Consistency Guard seed saved for TraderLab (supports 15%/20% single-day rule checks).
 *
 * Safe to run without DISC (falls back to quiz-only logic).
 */

const QUIZ_STORAGE_KEY = "qe_psych_quiz_v1_2";
const QUIZ_VERSION = "1.2.0";

/* ---------------- Likert + Questions ---------------- */
const LIKERT = [
  { v: 1, label: "Strongly Disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly Agree" },
];

// Original 20, plus 4 add-ons for horizon/news/automation/tilt
const QUESTIONS = [
  // risk_tolerance
  { id: "rt1", cat: "risk_tolerance", text: "I’m comfortable risking a small % of my account when I see an edge." },
  { id: "rt2", cat: "risk_tolerance", text: "Temporary drawdowns don’t push me to change my plan." },
  { id: "rt3", cat: "risk_tolerance", text: "I can accept several losses in a row without increasing size to ‘make it back’." },

  // discipline
  { id: "d1", cat: "discipline", text: "After a string of losses, I still follow my rules next trade." },
  { id: "d2", cat: "discipline", text: "I rarely modify my plan mid-trade without a predefined rule." },
  { id: "d3", cat: "discipline", text: "I close platforms when I hit a daily stop rather than continue trading." },

  // patience
  { id: "p1", cat: "patience", text: "I can wait for A+ setups even if that means no trades for a while." },
  { id: "p2", cat: "patience", text: "I’m comfortable letting a winner play out per plan without micro-managing." },
  { id: "p3", cat: "patience", text: "I’m okay holding positions for several hours or days if the plan calls for it." },

  // impulsivity (reverse-coded)
  { id: "i1", cat: "impulsivity", reverse: true, text: "I take trades on gut feel with no written plan." },
  { id: "i2", cat: "impulsivity", reverse: true, text: "I often chase a move after missing my planned entry." },
  { id: "i3", cat: "impulsivity", reverse: true, text: "When bored, I open trades just to be in the market." },

  // plan_adherence
  { id: "pa1", cat: "plan_adherence", text: "Before entering, I define entry, stop, and target." },
  { id: "pa2", cat: "plan_adherence", text: "I pre-write my trade idea and thesis before I click buy/sell." },

  // emotional_control
  { id: "e1", cat: "emotional_control", text: "I stay calm under pressure and execute without panic." },
  { id: "e2", cat: "emotional_control", reverse: true, text: "My mood outside trading strongly dictates my decisions while trading." },

  // review_habits
  { id: "r1", cat: "review_habits", text: "I tag trades and review my stats weekly." },
  { id: "r2", cat: "review_habits", text: "I regularly refine rules based on data from my journal." },

  // speed_preference
  { id: "s1", cat: "speed_preference", text: "I enjoy making quick decisions on lower timeframes." },
  { id: "s2", cat: "speed_preference", text: "Holding overnight makes me more anxious than being flat EOD." },

  // --- Add-ons to better infer horizon & automation readiness ---
  { id: "h1", cat: "horizon_bias", text: "I’m comfortable holding through session changes if the thesis remains valid." },
  { id: "n1", cat: "news_sensitivity", reverse: true, text: "I frequently trade right into high-impact news releases without rules." },
  { id: "a1", cat: "automation_fit", text: "I like checklists and could follow templated playbooks precisely." },
  { id: "t1", cat: "tilt_resilience", text: "I can stop trading immediately after a large loss without ‘one more try’." },
];

const CATEGORY_META = {
  risk_tolerance: { label: "Risk Tolerance" },
  discipline: { label: "Discipline" },
  patience: { label: "Patience" },
  impulsivity: { label: "Impulse Control" }, // reversed
  plan_adherence: { label: "Plan Adherence" },
  emotional_control: { label: "Emotional Control" },
  review_habits: { label: "Review Habits" },
  speed_preference: { label: "Pace Preference" },
  horizon_bias: { label: "Horizon Bias" },
  news_sensitivity: { label: "News Discipline" }, // reversed
  automation_fit: { label: "Automation Fit" },
  tilt_resilience: { label: "Tilt Resilience" },
};

const initialAnswers = Object.fromEntries(QUESTIONS.map(q => [q.id, 0]));

/* ---------------- Helpers ---------------- */
function clamp(n,min,max){ return Math.min(max, Math.max(min, n)); }
function invertLikert(v){ if(!v) return 0; return 6 - v; } // 1->5 etc.

function computeCategoryScores(answers) {
  const buckets = {};
  for (const q of QUESTIONS) {
    const raw = answers[q.id] || 0;
    const val = q.reverse ? invertLikert(raw) : raw;
    (buckets[q.cat] ||= []).push(val);
  }
  const out = {};
  for (const [cat, arr] of Object.entries(buckets)) {
    const avg = arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
    out[cat] = Number(avg.toFixed(2));
  }
  // rename impulsivity -> impulse control for display parity
  if (out.impulsivity != null) out.impulsivity = out.impulsivity;
  return out;
}

/* ---------------- DISC layer ---------------- */
const DISC_PRESETS = {
  "None": { D: 0, I: 0, S: 0, C: 0, label: "No DISC (quiz only)" },
  "Precisionist CS": { D: -2, I: -1, S: +3, C: +4, label: "Precisionist CS (C+S above midline)" },
  "Driver D": { D: +4, I: +1, S: -2, C: -1, label: "Dominant / Driver" },
  "Influencer I": { D: -1, I: +4, S: -1, C: -2, label: "Influencing / Inspiring" },
  "Steady S": { D: -2, I: -1, S: +4, C: +1, label: "Steady / Stable" },
  "Compliant C": { D: -2, I: -2, S: +1, C: +5, label: "Compliant / Correct" },
};

function normalizeDisc(di) {
  // Input domain ~[-8..+8] from Maxwell graphs. Map to [0..1] intensity for each axis.
  const f = (v)=> (clamp(v, -8, 8) + 8) / 16; // -8 -> 0, +8 -> 1
  const D = f(di.D||0), I = f(di.I||0), S = f(di.S||0), C = f(di.C||0);
  // structureIndex: (S+C) - (D+I) mapped to [0..1] (higher = structured, methodical)
  const raw = (S + C) - (D + I); // [-2..+2]
  const structureIndex = (raw + 2) / 4; // -> [0..1]
  // paceBias: D+I vs S (higher D/I -> faster tempo), map to [0..1]
  const paceBias = clamp((D + I) / 2, 0, 1);
  return { D, I, S, C, structureIndex, paceBias };
}

/* ---------------- Archetype & Settings ---------------- */
function deriveArchetype(scores, discNorm) {
  const r = scores.risk_tolerance ?? 0;
  const d = scores.discipline ?? 0;
  const p = scores.patience ?? 0;
  const ic = scores.impulsivity ?? 0; // already impulse control
  const plan = scores.plan_adherence ?? 0;
  const emo = scores.emotional_control ?? 0;
  const rev = scores.review_habits ?? 0;
  const spd = scores.speed_preference ?? 0;
  const hor = scores.horizon_bias ?? 0;

  const systemIndex = (d + plan + emo + rev + ic) / 5; // 0..5
  const paceIndex = (spd + (5 - p) * 0.5) / 1.5;        // rougher speed metric
  const horizonIndex = (p + hor) / 2;                   // higher → longer horizon

  // Nudge by DISC if provided
  if (discNorm) {
    const sN = discNorm.structureIndex; // 0..1
    const paceN = discNorm.paceBias;    // 0..1
    // structure nudges the systemIndex; pace nudges paceIndex; S+C nudges horizon
    const structBoost = 0.6 * (sN - 0.5); // [-0.3..+0.3]
    const paceBoost   = 0.8 * (paceN - 0.5);
    const horizonBoost= 0.6 * (discNorm.S + discNorm.C - 1); // [-0.6..+0.6] center around ~S+C=1
    // apply, keeping 0..5 domain
    const to05 = (x)=> clamp(x, 0, 5);
    return _derive(to05(systemIndex + structBoost), to05(paceIndex + paceBoost), to05(horizonIndex + horizonBoost), r);
  }
  return _derive(systemIndex, paceIndex, horizonIndex, r);

  function _derive(sysIdx, paceIdx, horizIdx, riskScore) {
    // classify time horizon
    let horizon = "Swing";
    if (horizIdx >= 4) horizon = "Position";
    else if (horizIdx >= 3.2) horizon = "Swing";
    else if (horizIdx >= 2.4) horizon = "Day";
    else horizon = "Scalp/Day";

    // tempo -> refine
    let name = "Swing Trend-Follower";
    let desc = "Rules-based, patient execution with steady tempo.";
    let tips = [
      "Focus on higher-timeframe structure (4H/D).",
      "Fewer, higher-quality trades; systematic journaling.",
      "Automate alerts to avoid screen fatigue.",
    ];

    if (sysIdx >= 4 && riskScore >= 3.4 && paceIdx >= 3) {
      name = "Scalper (Rule-Based)";
      desc = "Fast execution with tight risk; thrives in structured playbooks.";
      tips = ["Define one or two A+ patterns on 1–5m.",
              "Hard stops, auto partials, daily stop respected.",
              "Trade session windows (London/NY overlap)."];
      horizon = horizon === "Position" ? "Day" : horizon;
    } else if (paceIdx >= 3 && riskScore >= 3.2 && sysIdx >= 3) {
      name = "Day Trader Momentum";
      desc = "Comfortable with intraday volatility; seeks continuation/breakouts.";
      tips = ["Use pre-defined news filters to avoid chop.",
              "Cap max trades; avoid revenge trading.",
              "Tag catalysts and liquidity events."];
      horizon = horizon === "Position" ? "Day/Swing" : horizon;
    } else if (horizIdx >= 4 && sysIdx >= 3.2 && riskScore <= 3.2) {
      name = "Position / Macro Swing";
      desc = "Thesis-driven over days/weeks; disciplined and diversified.";
      tips = ["Weekly/Monthly levels; staged scaling.",
              "Mind correlations and carry; diversify themes.",
              "Narrative journaling + risk metrics."];
    } else if (horizIdx >= 3.2 && sysIdx >= 3 && riskScore <= 3) {
      name = "Mean-Reversion Swing";
      desc = "Fades extremes with clear invalidation and patience.";
      tips = ["Wait for exhaustion + confirmation.",
              "Size small; never add to losers.",
              "Use time stops to avoid drifts."];
    }

    return { archetype: { name, desc, tips, horizon }, systemIndex: sysIdx, paceIndex: paceIdx, horizonIndex: horizIdx };
  }
}

function deriveSettings(scores, archetypeName) {
  const risk = scores.risk_tolerance ?? 0;
  const spd  = scores.speed_preference ?? 0;
  const pat  = scores.patience ?? 0;

  let riskPct = 0.5;
  if (risk >= 4.2) riskPct = 0.8;
  else if (risk >= 3.5) riskPct = 0.6;
  else if (risk <= 2.5) riskPct = 0.3;

  let maxDailyLossPct = clamp(Math.round((riskPct * 4) * 10) / 10, 1, 3);

  let maxTrades = 5;
  if (spd >= 4.2) maxTrades = 8;
  else if (spd >= 3.5) maxTrades = 6;
  else if (spd <= 2.4 || pat >= 3.8) maxTrades = 3;

  let holding = "hours to days";
  if (spd >= 4) holding = "minutes to hours";
  if (pat >= 4 && spd <= 3) holding = "days to weeks";

  let instruments = ["Major FX pairs", "Gold", "US Indices"];
  if (archetypeName.includes("Scalper")) instruments = ["Majors", "DAX/NAS100", "Gold (tight stops)"];
  if (archetypeName.includes("Position") || holding === "days to weeks")
    instruments = ["Majors", "Gold", "Index CFDs/ETFs", "Select large-cap equities"];

  return {
    risk_per_trade_percent: Number(riskPct.toFixed(2)),
    max_daily_loss_percent: Number(maxDailyLossPct.toFixed(1)),
    max_trades_per_day: maxTrades,
    typical_holding_period: holding,
    suggested_instruments: instruments,
    journaling_prompts: [
      "What rule did this trade express?",
      "What emotion was strongest pre/post-entry?",
      "Was risk sized per plan? Why/why not?",
      "If repeated 100 times, is this +EV?",
    ],
  };
}

/* ---------------- Small UI bits ---------------- */
function ProgressBar({ value }) {
  return (
    <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden">
      <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${clamp(value,0,100)}%` }}/>
    </div>
  );
}

function LikertRow({ q, value, onChange }) {
  return (
    <div className="py-3 border-b border-neutral-800">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm md:text-base text-neutral-200">{q.text}</legend>
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {LIKERT.map(opt => (
            <label key={opt.v}
              className={`flex items-center justify-center rounded-lg border px-2 py-2 cursor-pointer text-xs md:text-sm
              ${value === opt.v ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-700 hover:border-neutral-500"}`}>
              <input type="radio" name={q.id} className="sr-only"
                     checked={value === opt.v} onChange={()=>onChange(q.id,opt.v)} />
              {opt.v}
            </label>
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-neutral-400"><span>Strongly Disagree</span><span>Strongly Agree</span></div>
      </fieldset>
    </div>
  );
}

function DiscPanel({ disc, setDisc }) {
  const [preset, setPreset] = useState("None");
  useEffect(()=>{ if (preset !== "None") setDisc(DISC_PRESETS[preset]); }, [preset]); // eslint-disable-line
  const setField = (k,v)=> setDisc(d=>({...d,[k]:Number(v)}));
  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">Optional: Import DISC</h3>
        <select value={preset} onChange={e=>setPreset(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200">
          {Object.keys(DISC_PRESETS).map(k=><option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <p className="text-xs text-neutral-400 mt-2">Enter Maxwell graph intensities (−8..+8). Leave 0 if unknown. Preset “Precisionist CS” matches your report.</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {["D","I","S","C"].map(k=>(
          <div key={k} className="flex flex-col gap-1">
            <label className="text-[11px] text-neutral-400">{k}</label>
            <input type="number" min={-8} max={8} value={disc[k]??0}
                   onChange={e=>setField(k, e.target.value)}
                   className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function PsychQuiz(){
  const [answers, setAnswers] = useState(initialAnswers);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState(null);
  const [archetype, setArchetype] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savingState, setSavingState] = useState("idle");
  const [disc, setDisc] = useState({ D:0, I:0, S:0, C:0 });

  const total = QUESTIONS.length;
  const answeredCount = useMemo(()=> Object.values(answers).filter(v=>v>0).length, [answers]);
  const progress = Math.round((answeredCount/total)*100);

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed?.version === QUIZ_VERSION){
          if (parsed.answers) setAnswers(a=>({ ...a, ...parsed.answers }));
          if (parsed.scores && parsed.archetype && parsed.settings){
            setScores(parsed.scores); setArchetype(parsed.archetype); setSettings(parsed.settings);
            setSubmitted(true);
          }
          if (parsed.disc) setDisc(parsed.disc);
        }
      }
    }catch{}
  },[]);

  function updateAnswer(id,v){ setAnswers(prev=>({ ...prev, [id]: v })); }
  function saveDraft(){
    try{ localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ version: QUIZ_VERSION, answers, disc })); }catch{}
  }
  function resetAll(){
    setAnswers(initialAnswers); setSubmitted(false); setScores(null); setArchetype(null); setSettings(null);
    setSavingState("idle"); setDisc({D:0,I:0,S:0,C:0});
    try{ localStorage.removeItem(QUIZ_STORAGE_KEY); }catch{}
  }

  async function persistProfile(payload){
    setSavingState("saving");
    try{
      await api.post("/api/users/psych-profile/", payload);
      setSavingState("saved");
    }catch{ setSavingState("local_only"); }
  }

  function exportJSON(){
    const payload = {
      version: QUIZ_VERSION,
      completed_at: new Date().toISOString(),
      scores, archetype, settings, disc,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)],{type:"application/json"}));
    const a = document.createElement("a");
    a.href = url; a.download = `QE-psych-profile-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function applyToTraderLab(){
    if(!settings) return;
    const consistency = { // seed for 15%/20% rule checks in TraderLab
      single_day_profit_share_limit_percent: 20, // can change to 15 depending on prop firm
      min_profitable_days_required: 7,
      min_profitable_day_threshold_percent: 0.5, // of account size (example)
    };
    try{
      localStorage.setItem("qe_traderlab_settings", JSON.stringify({
        ...settings,
        consistency_guard: consistency,
        source: "psych_quiz",
        version: QUIZ_VERSION,
        saved_at: new Date().toISOString(),
      }));
      alert("Settings saved for TraderLab defaults.");
    }catch{}
  }

  function onSubmit(e){
    e.preventDefault();
    if (answeredCount < total) return;

    const sc = computeCategoryScores(answers);
    const discNorm = (disc.D||disc.I||disc.S||disc.C) ? normalizeDisc(disc) : null;
    const { archetype: arch, systemIndex, paceIndex, horizonIndex } = deriveArchetype(sc, discNorm);
    const recs = deriveSettings(sc, arch.name);

    setScores(sc); setArchetype({ ...arch, systemIndex, paceIndex, horizonIndex }); setSettings(recs); setSubmitted(true);
    try{
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({
        version: QUIZ_VERSION, answers, scores: sc, archetype: { ...arch, systemIndex, paceIndex, horizonIndex }, settings: recs, disc
      }));
    }catch{}
    persistProfile({
      version: QUIZ_VERSION, timestamp: new Date().toISOString(),
      scores: sc, archetype: arch, systemIndex, paceIndex, horizonIndex, settings: recs, disc
    });
  }

  const radarData = useMemo(()=>{
    if(!scores) return [];
    return [
      { metric: "Risk", value: scores.risk_tolerance },
      { metric: "Discipline", value: scores.discipline },
      { metric: "Patience", value: scores.patience },
      { metric: "Impulse Control", value: scores.impulsivity },
      { metric: "Plan", value: scores.plan_adherence },
      { metric: "Emotion", value: scores.emotional_control },
      { metric: "Review", value: scores.review_habits },
      { metric: "Pace", value: scores.speed_preference },
      { metric: "Horizon", value: scores.horizon_bias },
      { metric: "News", value: scores.news_sensitivity },
      { metric: "Automation", value: scores.automation_fit },
      { metric: "Tilt", value: scores.tilt_resilience },
    ];
  },[scores]);

  const placementPoint = useMemo(()=>{
    if(!archetype) return null;
    // map to 0..5 plane for display
    return [{ x: clamp(archetype.paceIndex||0, 0, 5), y: clamp(archetype.horizonIndex||0, 0, 5), name: "You" }];
  },[archetype]);

  const coachFlags = useMemo(()=>{
    if(!scores) return [];
    const flags = [];
    if (scores.impulsivity <= 3 && scores.speed_preference >= 3.8) flags.push("FOMO risk: fast pace + low impulse control");
    if (scores.emotional_control <= 3 && scores.risk_tolerance >= 3.6) flags.push("Tilt risk: risk-seeking with low emotional control");
    if (scores.plan_adherence <= 3 && scores.discipline <= 3) flags.push("Plan drift: rules not consistently followed");
    if (scores.review_habits <= 3 && scores.automation_fit >= 3.8) flags.push("Automate reviews: high automation fit but weak review habit");
    if (scores.automation_fit <= 2.6 && (scores.discipline < 3.2 || scores.review_habits < 3.2)) flags.push("Process weakness: consider simpler playbooks");
    // DISC nudge
    const dn = (disc.D||disc.I||disc.S||disc.C) ? normalizeDisc(disc) : null;
    if (dn && dn.structureIndex >= 0.7 && scores.speed_preference >= 3.8) flags.push("Context switch strain: highly structured style trading very fast pace—guard with checklists");
    return flags;
  },[scores, disc]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">Trader Style Profiler</h1>
          <p className="text-neutral-400 mt-1">Answer honestly on a 1–5 scale. Optional: add your DISC to refine long/short-term bias.</p>
        </header>

        <section className="mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-300">Progress: {progress}%</span>
            <div className="flex-1"><ProgressBar value={progress}/></div>
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={saveDraft}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700">Save draft</button>
            <button type="button" onClick={resetAll}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700">Reset</button>
          </div>
        </section>

        {!submitted && (
          <>
            <DiscPanel disc={disc} setDisc={setDisc}/>
            <form onSubmit={onSubmit} className="mt-4 bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 md:p-6 shadow-xl">
              <div className="grid grid-cols-1">
                {QUESTIONS.map(q=>(
                  <LikertRow key={q.id} q={q} value={answers[q.id]} onChange={updateAnswer}/>
                ))}
              </div>
              <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <button type="submit" disabled={answeredCount < total}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border
                        ${answeredCount<total ? "bg-neutral-800 text-neutral-500 border-neutral-800 cursor-not-allowed"
                                              : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"}`}>
                  Generate Profile
                </button>
                <span className="text-xs text-neutral-400">
                  {answeredCount < total ? `Please answer ${total-answeredCount} more question${total-answeredCount===1?"":"s"}` : "Ready to score!"}
                </span>
              </div>
            </form>
          </>
        )}

        {submitted && scores && archetype && settings && (
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile + Radar */}
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Your Profile</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Archetype: <span className="text-indigo-400 font-medium">{archetype.name}</span> · Horizon: <span className="text-indigo-400 font-medium">{archetype.horizon}</span>
              </p>
              <p className="text-sm text-neutral-300 mt-2">{archetype.desc}</p>
              <ul className="list-disc list-inside text-sm text-neutral-300 mt-3 space-y-1">
                {archetype.tips.map((t,i)=><li key={i}>{t}</li>)}
              </ul>

              <div className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0,5]} />
                    <Radar name="Score" dataKey="value" fillOpacity={0.4}/>
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(CATEGORY_META).map(([k, meta])=>(
                  <div key={k} className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                    <span className="text-neutral-400">{meta.label}</span>
                    <span className="text-neutral-200 font-medium">{scores[k]?.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {!!coachFlags.length && (
                <div className="mt-4 border border-amber-500/30 bg-amber-500/10 rounded-lg p-3">
                  <div className="text-sm font-semibold text-amber-300">Coach Flags</div>
                  <ul className="mt-1 text-sm text-amber-200 list-disc list-inside space-y-1">
                    {coachFlags.map((f,i)=><li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              <div className="mt-3 text-xs text-neutral-500">
                {savingState === "saving" && "Saving profile…"}
                {savingState === "saved" && "Saved to server."}
                {savingState === "local_only" && "Saved locally. (Server endpoint not available.)"}
              </div>
            </div>

            {/* Guardrails + Placement */}
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Recommended Guardrails</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-neutral-400">Risk / Trade</span>
                  <span className="text-neutral-200 font-medium">{settings.risk_per_trade_percent}%</span>
                </div>
                <div className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-neutral-400">Max Daily Loss</span>
                  <span className="text-neutral-200 font-medium">{settings.max_daily_loss_percent}%</span>
                </div>
                <div className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-neutral-400">Max Trades / Day</span>
                  <span className="text-neutral-200 font-medium">{settings.max_trades_per_day}</span>
                </div>
                <div className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-neutral-400">Typical Holding</span>
                  <span className="text-neutral-200 font-medium">{settings.typical_holding_period}</span>
                </div>
                <div className="border border-neutral-800 rounded-lg px-3 py-2">
                  <div className="text-neutral-400">Suggested Instruments</div>
                  <div className="text-neutral-200 font-medium mt-1">{settings.suggested_instruments.join(" • ")}</div>
                </div>
                <div className="border border-neutral-800 rounded-lg px-3 py-2">
                  <div className="text-neutral-400 mb-1">Journaling Prompts</div>
                  <ul className="list-disc list-inside text-neutral-200">
                    {settings.journaling_prompts.map((p,i)=><li key={i}>{p}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold text-neutral-200 mb-2">Time-Horizon Placement</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid />
                      <XAxis type="number" dataKey="x" name="Pace" domain={[0,5]} ticks={[0,1,2,3,4,5]} />
                      <YAxis type="number" dataKey="y" name="Horizon" domain={[0,5]} ticks={[0,1,2,3,4,5]} />
                      <ReTooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter name="You" data={placementPoint} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-400">
                  <div>Bottom-left: Scalper</div><div className="text-right">Top-right: Position</div>
                  <div>Center-left/right: Day</div><div className="text-right">Upper-center: Swing</div>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button onClick={exportJSON}
                        className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700">Export JSON</button>
                <button onClick={applyToTraderLab}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white border-indigo-500">Apply to TraderLab</button>
                <button onClick={()=>setSubmitted(false)}
                        className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700">Edit Answers</button>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                Tip: TraderLab can read <code>qe_traderlab_settings</code> for defaults + consistency guard (15%/20% single-day rule).
              </p>
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-500">
          v{QUIZ_VERSION} · Educational only, not financial advice.
        </footer>
      </div>
    </div>
  );
}
