// src/pages/LoginPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { apiNoAuth, apiPath } from "../api/axios";
import logo from "../assets/QELOGO.png";

/**
 * Marketing + Login page
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const WEBINARS = useMemo(() => [], []);

  const PTB_URL =
    "https://dashboard.plutustradebase.com/challenges?affiliateId=quantumedge.fx";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Support username OR email
      const looksLikeEmail = /\S+@\S+\.\S+/.test(username);
      const payload = looksLikeEmail
        ? { email: username, password }
        : { username, password };

      // Use helper to guarantee /api/users/token/
      const res = await apiNoAuth.post(apiPath("users/token/"), payload);
      const { access, refresh } = res.data || {};
      if (!access || !refresh) throw new Error("No tokens returned");

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      const dest = location.state?.from?.pathname || "/traderlab";
      navigate(dest);
    } catch (err) {
      console.error("login failed", err);
      if (err.response?.status === 404) {
        setError("API not found. Check API base URL and backend routes.");
      } else if (err.response?.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-4 md:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-7">
        {/* LEFT */}
        <section className="space-y-6">
          <div className="rounded-2xl p-6 md:p-7 border border-white/10 bg-[color:var(--card,#0A0F16)]">
            <div className="flex items-center gap-3 mb-3">
              <img src={logo} alt="QuantumEdge" className="h-9" />
              <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100">
                Trade with a system. <span className="text-cyan-300">Improve with data.</span>
              </h1>
            </div>
            <p className="text-sm md:text-base text-neutral-400 leading-relaxed">
              QuantumEdge brings together <span className="text-neutral-200">TraderLab</span>, journaling,
              analytics, psych profile, charts, and the FX calendar—designed to help you repeat what works.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <ValueCard title="TraderLab">P&amp;L + hour-of-day win%, attachments, notes.</ValueCard>
              <ValueCard title="Psych Profile">Archetype quiz + prompts to reduce impulsive errors.</ValueCard>
              <ValueCard title="Webinars">Weekly topics &amp; Q&amp;A (recordings as available).</ValueCard>
              <ValueCard title="Courses">Strategy and psychology drills for consistency.</ValueCard>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl font-semibold bg-[color:var(--accent)] hover:opacity-90"
                style={{ color: "#0B0F16" }}
              >
                Create your account
              </Link>
              <Link
                to="/pricing"
                className="px-4 py-2 rounded-xl border border-white/10 text-neutral-200 hover:bg-white/5"
              >
                View pricing
              </Link>
            </div>
          </div>

          <WebinarSchedule items={WEBINARS} />

          <a
            href={PTB_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl p-5 border border-cyan-500/30 hover:border-cyan-400/60 bg-[color:var(--card,#0A0F16)] transition-colors"
            title="Funded challenges"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-wide text-cyan-300">
                  Funded challenges
                </div>
                <div className="text-lg md:text-xl font-semibold text-neutral-100">
                  Trade someone else’s capital with PTB
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  Choose a challenge, then use QuantumEdge to track process, consistency, and your % to payout.
                </p>
                <p className="text-xs text-neutral-500 mt-2">
                  Disclosure: Affiliate link. We may earn a commission at no extra cost to you.
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                  Explore PTB →
                </span>
              </div>
            </div>
          </a>

          <SocialRow />

          {/* NEW: Why I Teach / Quantum Edge Story */}
          <WhyTeach />
        </section>

        {/* RIGHT: Sign In */}
        <aside className="lg:pl-2">
          <div className="w-full max-w-md ml-auto rounded-2xl p-6 border border-white/10 bg-[color:var(--card,#0A0F16)]">
            <div className="mb-5">
              <div className="text-sm text-neutral-400">Welcome back</div>
              <h2 className="text-xl font-semibold text-neutral-100">Sign in</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <FormField
                label="Username or Email"
                autoComplete="username"
                value={username}
                onChange={setUsername}
              />
              <FormField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
              />

              {error && (
                <div className="text-red-400 text-sm rounded border border-red-400/30 bg-red-400/10 px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[color:var(--accent)] text-black font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 text-sm text-neutral-400 space-y-2">
              <div>
                <Link to="/reset-password" className="underline">
                  Forgot password?
                </Link>
              </div>
              <div>
                New here?{" "}
                <Link to="/register" className="underline text-cyan-300">
                  Create your account
                </Link>
              </div>
              <div className="text-xs text-neutral-500">
                Tip: Use the <b>same email</b> on checkout and registration for smooth access.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ----------------- Sub-components ----------------- */

function ValueCard({ title, children }) {
  return (
    <div className="rounded-xl p-3 border border-white/10 bg-black/20">
      <div className="text-sm font-medium text-neutral-100">{title}</div>
      <p className="text-xs text-neutral-400 mt-1">{children}</p>
    </div>
  );
}

function WebinarSchedule({ items }) {
  const empty = !items || items.length === 0;
  return (
    <div className="rounded-2xl p-5 border border-white/10 bg-[color:var(--card,#0A0F16)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm uppercase tracking-wide text-neutral-400">
            Webinar Schedule
          </div>
          <div className="text-lg font-semibold text-neutral-100">What’s coming up</div>
        </div>
        <Link
          to="/pricing"
          className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-neutral-200 hover:bg-white/5"
          title="See plans"
        >
          See plans
        </Link>
      </div>

      {empty ? (
        <div className="text-sm text-neutral-400">
          We’ll post dates here. Topics include market prep, consistency playbooks, and strategy drills.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((w, i) => (
            <li
              key={`${w.date}-${i}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 border border-white/10"
            >
              <div className="text-sm">
                <div className="text-neutral-100 font-medium">{w.title}</div>
                <div className="text-neutral-400">
                  {new Date(`${w.date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  • {w.time} {w.level ? `• ${w.level}` : ""}
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded border border-white/10 text-neutral-300">
                Live
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SocialRow() {
  const socials = [
    { href: "http://www.youtube.com/@quantum.edge.fx1", label: "YouTube", icon: YouTubeIcon },
    { href: "https://www.instagram.com/quantumedge.fx/", label: "Instagram", icon: InstagramIcon },
    { href: "http://tiktok.com/@quantum.edge.fx", label: "TikTok", icon: TikTokIcon },
    { href: "https://www.facebook.com/profile.php?id=61579183787818", label: "Facebook", icon: FacebookIcon },
  ];

  return (
    <div className="rounded-2xl p-4 border border-white/10 bg-[color:var(--card,#0A0F16)]">
      <div className="text-sm text-neutral-400 mb-3">Follow along</div>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
        {socials.map(({ href, label, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
            title={label}
          >
            <Icon />
            <span className="text-sm text-neutral-200">{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* -------- NEW: Story section component -------- */
function WhyTeach() {
  return (
    <section className="rounded-2xl p-6 md:p-7 border border-white/10 bg-[color:var(--card,#0A0F16)]">
      <h2 className="text-xl md:text-2xl font-semibold text-neutral-100 mb-3">
        Why I Teach — The Story Behind Quantum Edge FX
      </h2>

      <div className="space-y-4 text-neutral-300 text-sm leading-relaxed">
        <p>
          I’ve always had an eye for patterns. Working in banking, I was surrounded by investments every day—and the more I learned, the deeper my curiosity grew. Trading fascinated me because it combined logic, psychology, and performance under pressure.
        </p>
        <p>
          But my real education came when life hit hard. My baby was born a month early, our finances were tight, and I was trying to make trading work. In the process, I blew accounts. I made every mistake new traders make—but those losses taught me the one thing no chart ever will: you can’t force the market. Success only comes when your emotions are calm and your process is consistent.
        </p>
        <p>
          The first time I passed a funded challenge, I realized there was still more to master—not in my charts, but in myself. A friend convinced me to post my trades publicly, just to hold myself accountable. What I didn’t expect was how many people it would help. Traders started reaching out, saying my breakdowns made things click for them. That’s when Quantum Edge FX was born—not just as an app, but as a movement built on structure, coaching, and accountability.
        </p>

        <h3 className="text-lg font-semibold text-neutral-100 mt-4">Why Quantum Edge Works</h3>
        <p>
          My strategy is simple, proven, and adaptable—it works in up, down, and sideways markets. But strategy alone doesn’t create success. Discipline does.
        </p>
        <p>
          Quantum Edge FX was designed to combine structure and psychology—so traders learn to master themselves as much as their charts. Every indicator, every journal, every coaching session is built to help you become your own signal caller.
        </p>
        <p>
          Our students’ first breakthroughs come fast: reading momentum more clearly, understanding the technical structure, recognizing levels, and executing with discipline. Then comes the real transformation—the emotional balance, the confidence to take trades calmly, and the consistency that only comes with true self-control.
        </p>

        <h3 className="text-lg font-semibold text-neutral-100 mt-4">What We Stand For</h3>
        <p>
          We’re not another signal group. We’re a training ground for independent, funded traders.
          In our first month, we funded seven accounts through our partner prop firms—and every one of those traders earned it through focus and discipline, not luck.
        </p>
        <p>
          At Quantum Edge, we believe anyone can learn this skill with the right guidance. You don’t need a degree or genius-level IQ. You just need the right structure, coaching, and belief in yourself.
        </p>
        <p>
          Our mission is simple:
          To help everyday people understand trading, understand themselves, and grow into disciplined, confident, and self-reliant individuals.
        </p>
        <p>
          Because trading doesn’t just teach you how to make money—it teaches you who you are.
          And when you learn to master your thoughts, you’ll master your actions… and your results will follow.
        </p>

        <h3 className="text-lg font-semibold text-neutral-100 mt-4">The Quantum Edge Community</h3>
        <p>
          We’re building a place where traders grow together—students, coaches, and mentors all pushing toward a common goal: consistent performance and personal evolution.
          When you finish our program, you won’t just understand the market—you’ll trust yourself in it. You’ll trade with confidence, poise, and patience. You’ll know that every setback is just part of your preparation for greater responsibility and success.
        </p>

        <blockquote className="mt-4 border-l-4 border-cyan-400/60 pl-4 italic text-neutral-200">
          “Failure is nature’s plan to prepare you for great responsibilities.
          Your attitude toward problems is the most important factor in overcoming them.”
          <div className="mt-1 text-xs not-italic text-neutral-400">— Napoleon Hill</div>
        </blockquote>
      </div>
    </section>
  );
}

function FormField({ label, value, onChange, type = "text", autoComplete }) {
  return (
    <div>
      <label className="block text-xs text-[color:var(--muted)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-lg px-3 py-2 bg-background border border-white/10 focus:outline-none focus:border-white/20"
        required
      />
    </div>
  );
}

/* --------- Minimal inline icons --------- */
function YouTubeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="#22d3ee" strokeWidth="1.5" />
      <path d="M10 9.5v5l5-2.5-5-2.5z" fill="#22d3ee" />
    </svg>
  );
}
function InstagramIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="#22d3ee" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.5" stroke="#22d3ee" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1" fill="#22d3ee" />
    </svg>
  );
}
function TikTokIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M14 4c.3 2.3 1.6 4 4 4" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 9v6.5a4.5 4.5 0 1 1-3-4.24" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function FacebookIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M13 10h3V7h-3c-1.7 0-3 1.3-3 3v7h3v-4h2.5l.5-3H13v-1c0-.6.4-1 1-1z" fill="#22d3ee" />
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#22d3ee" strokeWidth="1.5" />
    </svg>
  );
}
