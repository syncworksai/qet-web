// src/pages/PsychQuiz.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer,
} from "recharts";
import { api } from "../api/axios";

/**
 * QuantumEdge — Trader Psychology Quiz
 * v1.0.0
 *
 * Features:
 * - 20 Likert questions (1-5), categories:
 *   risk_tolerance, discipline, patience, impulsivity (reversed), plan_adherence,
 *   emotional_control, review_habits, speed_preference
 * - Progress + validation
 * - Results: category scores (0-5), archetype, recommended risk & guardrails
 * - Radar chart visualization (Recharts)
 * - Save draft, load last, reset
 * - Export JSON (profile + settings)
 * - Apply to TraderLab (stores "qe_traderlab_settings" in localStorage)
 * - Optional POST to /api/users/psych-profile/ (silently ignored if missing)
 *
 * Routing:
 *   Add a route like: <Route path="/psych-quiz" element={<PsychQuiz />} />
 */

const QUIZ_STORAGE_KEY = "qe_psych_quiz_v1";
const QUIZ_VERSION = "1.0.0";

const LIKERT = [
  { v: 1, label: "Strongly Disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly Agree" },
];

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
  { id: "pa2", cat: "plan_adherence", text: "I pre-write my trade idea and thesis (even briefly) before I click buy/sell." },

  // emotional_control
  { id: "e1", cat: "emotional_control", text: "I stay calm under pressure and execute without panic." },
  { id: "e2", cat: "emotional_control", reverse: true, text: "My mood outside trading strongly dictates my decisions while trading." },

  // review_habits
  { id: "r1", cat: "review_habits", text: "I tag trades and review my stats weekly." },
  { id: "r2", cat: "review_habits", text: "I regularly refine rules based on data from my journal." },

  // speed_preference (higher = prefers faster pace)
  { id: "s1", cat: "speed_preference", text: "I enjoy making quick decisions on lower timeframes." },
  { id: "s2", cat: "speed_preference", text: "Holding overnight makes me anxious compared with flat at end of day." },
];

const CATEGORY_META = {
  risk_tolerance: { label: "Risk Tolerance" },
  discipline: { label: "Discipline" },
  patience: { label: "Patience" },
  impulsivity: { label: "Impulsivity (lower is better)" },
  plan_adherence: { label: "Plan Adherence" },
  emotional_control: { label: "Emotional Control" },
  review_habits: { label: "Review Habits" },
  speed_preference: { label: "Pace Preference" },
};

const initialAnswers = Object.fromEntries(QUESTIONS.map(q => [q.id, 0]));

function invertLikert(v) {
  // Reverse-code: 1->5, 2->4, 3->3, 4->2, 5->1
  if (!v) return 0;
  return 6 - v;
}

function computeCategoryScores(answers) {
  const buckets = {};
  for (const q of QUESTIONS) {
    const raw = answers[q.id] || 0;
    const val = q.reverse ? invertLikert(raw) : raw;
    if (!buckets[q.cat]) buckets[q.cat] = [];
    buckets[q.cat].push(val);
  }
  const result = {};
  for (const [cat, arr] of Object.entries(buckets)) {
    const n = arr.length || 1;
    const avg = arr.reduce((a, b) => a + b, 0) / n;
    result[cat] = Number(avg.toFixed(2));
  }
  return result;
}

function deriveArchetype(scores) {
  const risk = scores.risk_tolerance ?? 0;
  const disc = scores.discipline ?? 0;
  const pat = scores.patience ?? 0;
  const imp = scores.impulsivity ?? 0; // already reversed if any reverse items; here higher means *less* impulsive due to reverse-coding above
  const plan = scores.plan_adherence ?? 0;
  const emo = scores.emotional_control ?? 0;
  const rev = scores.review_habits ?? 0;
  const spd = scores.speed_preference ?? 0;

  // System index: rule-following & control
  const systemIndex = (disc + plan + emo + rev + imp) / 5; // higher = more systematic/controlled
  // Heuristic thresholds
  let archetype = {
    name: "Swing Trend-Follower",
    desc: "Steadier tempo, patient with rules-based execution, letting winners work over longer horizons.",
    tips: [
      "Focus on clear higher-timeframe structure (4H/D).",
      "Fewer, higher-quality trades; add on trend continuation.",
      "Automate alerts; avoid screen fatigue.",
    ],
  };

  if (rev >= 4 && plan >= 4 && disc >= 4 && systemIndex >= 4) {
    archetype = {
      name: "Algorithmic/Systematic",
      desc: "Data-first, rule-bound trader. Your edge compounds through measurement and iteration.",
      tips: [
        "Codify rules; A/B test entries/exits.",
        "Batch review weekly with dashboards.",
        "Explore partial automation and alerts.",
      ],
    };
  } else if (spd >= 4 && risk >= 3.5 && systemIndex >= 3.2) {
    archetype = {
      name: "Scalper (Rule-Based)",
      desc: "Thrives on fast decisions with tight risk and strict process.",
      tips: [
        "Define one or two A+ patterns on 1–5m.",
        "Hard stops, auto partials; respect daily stop.",
        "Trade session windows (e.g., London/NY overlap).",
      ],
    };
  } else if (spd >= 3.6 && risk >= 3.4 && systemIndex >= 3) {
    archetype = {
      name: "Day Trader Momentum",
      desc: "Comfortable with intraday volatility, looking for clean continuation or breakouts.",
      tips: [
        "Focus on liquidity events and trend days.",
        "Use pre-defined news filters; avoid chop.",
        "Cap max trades; avoid revenge trading.",
      ],
    };
  } else if (pat >= 4 && systemIndex >= 3.6 && risk <= 3.2) {
    archetype = {
      name: "Position / Macro Swing",
      desc: "Slow tempo, thesis-driven with high discipline and low risk.",
      tips: [
        "Weekly/Monthly levels; scale over days/weeks.",
        "Diversify themes; mind correlations and carry.",
        "Journal narrative plus risk metrics.",
      ],
    };
  } else if (pat >= 3.5 && systemIndex >= 3 && risk <= 3) {
    archetype = {
      name: "Mean-Reversion Swing",
      desc: "Comfortable fading extremes with clear risk lines and patience.",
      tips: [
        "Wait for exhaustion & confirmation.",
        "Size small; avoid adding to losers.",
        "Use time stops to avoid drifts.",
      ],
    };
  }
  return { archetype, systemIndex };
}

function deriveSettings(scores, archetypeName) {
  const risk = scores.risk_tolerance ?? 0;
  const spd = scores.speed_preference ?? 0;
  const pat = scores.patience ?? 0;

  // Risk per trade suggestion
  let riskPct = 0.5;
  if (risk >= 4.2) riskPct = 0.8;
  else if (risk >= 3.5) riskPct = 0.6;
  else if (risk <= 2.5) riskPct = 0.3;

  // Daily loss stop suggestion
  let maxDailyLossPct = Math.min(3, Math.max(1, Math.round((riskPct * 4) * 10) / 10)); // ~1.2%–3.2%

  // Max trades/day suggestion (pace-driven)
  let maxTrades = 5;
  if (spd >= 4.2) maxTrades = 8;
  else if (spd >= 3.5) maxTrades = 6;
  else if (spd <= 2.4 || pat >= 3.8) maxTrades = 3;

  // Holding period
  let holding = "hours to days";
  if (spd >= 4) holding = "minutes to hours";
  if (pat >= 4 && spd <= 3) holding = "days to weeks";

  // Instruments
  let instruments = ["Major FX pairs", "Gold", "US Indices"];
  if (archetypeName.includes("Scalper")) instruments = ["Major FX pairs", "DAX/NAS100", "Gold (tight stops)"];
  if (archetypeName.includes("Position") || holding === "days to weeks")
    instruments = ["Major FX pairs", "Gold", "Index CFDs/ETFs", "Selected large-cap equities"];

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

function ProgressBar({ value }) {
  return (
    <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden">
      <div
        className="h-2 bg-indigo-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function LikertRow({ q, value, onChange }) {
  return (
    <div className="py-3 border-b border-neutral-800">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm md:text-base text-neutral-200">{q.text}</legend>
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {LIKERT.map((opt) => (
            <label
              key={opt.v}
              className={`flex items-center justify-center rounded-lg border px-2 py-2 cursor-pointer text-xs md:text-sm
                ${value === opt.v ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-700 hover:border-neutral-500"}`}
            >
              <input
                type="radio"
                name={q.id}
                value={opt.v}
                checked={value === opt.v}
                onChange={() => onChange(q.id, opt.v)}
                className="sr-only"
              />
              {opt.v}
            </label>
          ))}
        </div>
        <div className="flex justify-between text-[10px] md:text-xs text-neutral-400">
          <span>Strongly Disagree</span>
          <span>Strongly Agree</span>
        </div>
      </fieldset>
    </div>
  );
}

export default function PsychQuiz() {
  const [answers, setAnswers] = useState(initialAnswers);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState(null);
  const [archetype, setArchetype] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savingState, setSavingState] = useState("idle"); // idle | saving | saved | local_only | error

  const total = QUESTIONS.length;
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v > 0).length,
    [answers]
  );
  const progress = Math.round((answeredCount / total) * 100);

  useEffect(() => {
    // try load from localStorage
    try {
      const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === QUIZ_VERSION && parsed?.answers) {
          setAnswers((prev) => ({ ...prev, ...parsed.answers }));
          if (parsed.scores && parsed.archetype && parsed.settings) {
            setScores(parsed.scores);
            setArchetype(parsed.archetype);
            setSettings(parsed.settings);
            setSubmitted(true);
          }
        }
      }
    } catch {}
  }, []);

  function updateAnswer(id, v) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        QUIZ_STORAGE_KEY,
        JSON.stringify({ version: QUIZ_VERSION, answers })
      );
    } catch {}
  }

  function resetAll() {
    setAnswers(initialAnswers);
    setSubmitted(false);
    setScores(null);
    setArchetype(null);
    setSettings(null);
    setSavingState("idle");
    try { localStorage.removeItem(QUIZ_STORAGE_KEY); } catch {}
  }

  async function persistProfile(payload) {
    setSavingState("saving");
    try {
      // Optional server persist (ignore if endpoint not present)
      await api.post("/api/users/psych-profile/", payload);
      setSavingState("saved");
    } catch (e) {
      // Silently downgrade to local-only
      setSavingState("local_only");
    }
  }

  function exportJSON() {
    const payload = {
      version: QUIZ_VERSION,
      completed_at: new Date().toISOString(),
      scores,
      archetype,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QE-psych-profile-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyToTraderLab() {
    if (!settings) return;
    try {
      localStorage.setItem("qe_traderlab_settings", JSON.stringify({
        ...settings,
        source: "psych_quiz",
        version: QUIZ_VERSION,
        saved_at: new Date().toISOString(),
      }));
      alert("Settings saved for TraderLab defaults.");
    } catch {}
  }

  function onSubmit(e) {
    e.preventDefault();
    if (answeredCount < total) return;

    const sc = computeCategoryScores(answers);
    const { archetype: arch, systemIndex } = deriveArchetype(sc);
    const recs = deriveSettings(sc, arch.name);

    const payload = {
      version: QUIZ_VERSION,
      timestamp: new Date().toISOString(),
      scores: sc,
      archetype: arch,
      systemIndex,
      settings: recs,
    };

    setScores(sc);
    setArchetype(arch);
    setSettings(recs);
    setSubmitted(true);

    try {
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({
        version: QUIZ_VERSION,
        answers,
        scores: sc,
        archetype: arch,
        settings: recs,
      }));
    } catch {}

    // fire-and-forget attempt to persist
    persistProfile(payload);
  }

  const radarData = useMemo(() => {
    if (!scores) return [];
    // For radar readability, we’ll map impulsivity as "Impulse Control"
    const impulseControl = scores.impulsivity; // higher = better control (due to reverse coding)
    return [
      { metric: "Risk", value: scores.risk_tolerance },
      { metric: "Discipline", value: scores.discipline },
      { metric: "Patience", value: scores.patience },
      { metric: "Impulse Control", value: impulseControl },
      { metric: "Plan", value: scores.plan_adherence },
      { metric: "Emotion", value: scores.emotional_control },
      { metric: "Review", value: scores.review_habits },
      { metric: "Pace", value: scores.speed_preference },
    ];
  }, [scores]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">Trader Psychology Quiz</h1>
          <p className="text-neutral-400 mt-1">
            Answer honestly on a 1–5 scale. Your profile will map to an archetype and recommended guardrails.
          </p>
        </header>

        <section className="mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-300">Progress: {progress}%</span>
            <div className="flex-1"><ProgressBar value={progress} /></div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700"
            >
              Reset
            </button>
          </div>
        </section>

        {!submitted && (
          <form onSubmit={onSubmit} className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="grid grid-cols-1">
              {QUESTIONS.map((q) => (
                <LikertRow
                  key={q.id}
                  q={q}
                  value={answers[q.id]}
                  onChange={updateAnswer}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <button
                type="submit"
                disabled={answeredCount < total}
                className={`px-4 py-2 rounded-xl text-sm font-medium border
                  ${answeredCount < total
                    ? "bg-neutral-800 text-neutral-500 border-neutral-800 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"}`}
              >
                Generate Profile
              </button>
              <span className="text-xs text-neutral-400">
                {answeredCount < total
                  ? `Please answer ${total - answeredCount} more question${total-answeredCount === 1 ? "" : "s"}`
                  : "Ready to score!"}
              </span>
            </div>
          </form>
        )}

        {submitted && scores && archetype && settings && (
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-neutral-100">Your Profile</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Archetype: <span className="text-indigo-400 font-medium">{archetype.name}</span>
              </p>
              <p className="text-sm text-neutral-300 mt-2">{archetype.desc}</p>
              <ul className="list-disc list-inside text-sm text-neutral-300 mt-3 space-y-1">
                {archetype.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>

              <div className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 5]} />
                    <Radar name="Score" dataKey="value" fillOpacity={0.4} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(CATEGORY_META).map(([k, meta]) => (
                  <div key={k} className="flex justify-between border border-neutral-800 rounded-lg px-3 py-2">
                    <span className="text-neutral-400">{meta.label}</span>
                    <span className="text-neutral-200 font-medium">{scores[k]?.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                {savingState === "saving" && "Saving profile…"}
                {savingState === "saved" && "Saved to server."}
                {savingState === "local_only" && "Saved locally. (Server endpoint not available.)"}
                {savingState === "error" && "Save error (kept locally)."}
              </div>
            </div>

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
                  <div className="text-neutral-200 font-medium mt-1">
                    {settings.suggested_instruments.join(" • ")}
                  </div>
                </div>
                <div className="border border-neutral-800 rounded-lg px-3 py-2">
                  <div className="text-neutral-400 mb-1">Journaling Prompts</div>
                  <ul className="list-disc list-inside text-neutral-200">
                    {settings.journaling_prompts.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={exportJSON}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700"
                >
                  Export JSON
                </button>
                <button
                  onClick={applyToTraderLab}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white border border-indigo-500"
                >
                  Apply to TraderLab
                </button>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 border border-neutral-700"
                >
                  Edit Answers
                </button>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                Tip: TraderLab can read <code>qe_traderlab_settings</code> from localStorage to prefill defaults.
              </p>
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-500">
          v{QUIZ_VERSION} · This tool is educational and not financial advice.
        </footer>
      </div>
    </div>
  );
}
