// src/pages/TradeDesk.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProChart from "../components/ProChart";
import { apiPublic } from "../api/axios";
import { useFeedStore } from "../store/feedStore";
import { useTradeStore } from "../store/tradeStore";

/* ---------------------- Watchlist ---------------------- */
function Watchlist({ value, onPick, onChange }) {
  const [input, setInput] = useState("");
  const add = () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    if (!value.includes(s)) onChange([...value, s]);
    setInput("");
  };
  const remove = (s) => onChange(value.filter((v) => v !== s));

  return (
    <aside className="shrink-0 border-r border-white/10" style={{ width: 184 }}>
      <div className="p-3">
        <div className="text-sm font-semibold mb-2 opacity-80">Watchlist</div>
        <div className="flex gap-2 mb-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add (e.g. XAUUSD)"
            className="flex-1 bg-transparent border border-white/15 rounded-lg px-2 py-1 text-neutral-200 text-xs"
          />
          <button
            onClick={add}
            className="px-2 py-1 rounded-lg border border-white/15 hover:bg-white/[0.06] text-xs"
          >
            Add
          </button>
        </div>
        <ul className="space-y-0.5">
          {value.map((s) => (
            <li key={s} className="flex items-center justify-between">
              <button
                onClick={() => onPick(s)}
                className="px-2 py-1 rounded hover:bg-white/5 font-mono text-xs"
                title={`Load ${s}`}
              >
                {s}
              </button>
              <button
                onClick={() => remove(s)}
                className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 hover:bg-white/5"
                title="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ---------------------- Open Trades (paper) ---------------------- */
function OpenTrades() {
  const trades = useTradeStore((s) => s.trades);
  const close = useTradeStore((s) => s.close);
  const last = useFeedStore((s) => s.last);

  return (
    <div className="mt-3 text-xs space-y-2">
      {trades.map((t) => {
        const sym = `${t.symbol.slice(0, 3)}/${t.symbol.slice(3, 6)}`;
        const mkt = last?.[sym]?.price;
        return (
          <div
            key={t.id}
            className="flex items-center justify-between border border-white/10 rounded px-2 py-1"
          >
            <div>
              <span className="font-mono">{t.symbol}</span> · {t.side} · {t.status}
              &nbsp;· entry {t.entry}
              {t.status === "OPEN" && mkt ? <> · mkt {mkt}</> : null}
              {t.status === "CLOSED" ? (
                <>
                  {" "}
                  · P&L <b>{t.pnl}</b>
                </>
              ) : null}
            </div>
            {t.status === "OPEN" ? (
              <button
                className="px-2 py-1 rounded border border-white/15 hover:bg-white/5"
                onClick={() => mkt && close(t.id, mkt)}
                title="Close at market"
              >
                Close @ MKT
              </button>
            ) : null}
          </div>
        );
      })}
      {!trades.length && (
        <div className="text-neutral-500 text-[11px]">No paper trades yet.</div>
      )}
    </div>
  );
}

/* ---------------------- Order Ticket (paper) ---------------------- */
function StickyOrderTicket({ symbol }) {
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState(1000);
  const [type, setType] = useState("MARKET");
  const [price, setPrice] = useState("");
  const [sl, setSL] = useState("");
  const [tp, setTP] = useState("");

  const last = useFeedStore((s) => s.last);
  const trade = useTradeStore();

  const place = () => {
    const symKey = `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`;
    const mkt = last?.[symKey]?.price;
    const px = type === "MARKET" ? (mkt ?? Number(price)) : Number(price);
    if (!Number.isFinite(px)) return;
    trade.place({ symbol, side, qty, price: px, sl, tp, type });
    if (type !== "MARKET") setPrice("");
  };

  const exportCSV = () => trade.exportCSV();

  return (
    <aside
      className="w-[320px] shrink-0"
      style={{ position: "sticky", top: 12, alignSelf: "flex-start" }}
    >
      <div className="rounded-2xl border border-neutral-800 bg-[color:var(--card,#0B0B10)] p-4">
        <div className="text-sm font-semibold text-neutral-200 mb-3">
          Order Ticket
        </div>

        <label className="text-xs block mb-1 text-neutral-400">Symbol</label>
        <input
          value={symbol}
          readOnly
          className="w-full mb-3 bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
        />

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSide("BUY")}
            className={`flex-1 px-3 py-2 rounded-lg border ${
              side === "BUY"
                ? "bg-emerald-600 border-emerald-500"
                : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("SELL")}
            className={`flex-1 px-3 py-2 rounded-lg border ${
              side === "SELL"
                ? "bg-rose-600 border-rose-500"
                : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            Sell
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs block mb-1 text-neutral-400">
              Quantity
            </label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
            />
          </div>
          <div>
            <label className="text-xs block mb-1 text-neutral-400">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
            >
              <option>MARKET</option>
              <option>LIMIT</option>
              <option>STOP</option>
            </select>
          </div>
        </div>

        {(type === "LIMIT" || type === "STOP") && (
          <>
            <label className="text-xs block mb-1 text-neutral-400">Price</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full mb-3 bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
            />
          </>
        )}

        <label className="text-xs block mb-1 text-neutral-400">Stop Loss</label>
        <input
          value={sl}
          onChange={(e) => setSL(e.target.value)}
          className="w-full mb-3 bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
        />
        <label className="text-xs block mb-1 text-neutral-400">Take Profit</label>
        <input
          value={tp}
          onChange={(e) => setTP(e.target.value)}
          className="w-full mb-4 bg-transparent border border-white/15 rounded-lg px-2 py-1.5 text-neutral-200"
        />

        <button
          onClick={place}
          className="w-full px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
        >
          Place Order
        </button>
        <button
          onClick={exportCSV}
          className="w-full mt-2 px-3 py-2 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
        >
          Export CSV
        </button>

        <div className="text-[11px] mt-3 text-neutral-400">
          Paper ticket. We can wire this to your broker API anytime.
        </div>

        <OpenTrades />
      </div>
    </aside>
  );
}

/* ------------------------------ Page ------------------------------ */
export default function TradeDesk() {
  const DEFAULTS = {
    symbol: "XAUUSD",
    watchlist: [
      "XAUUSD",
      "XAGUSD",
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "AUDUSD",
      "USDCAD",
      "NZDUSD",
      "BTCUSDT",
      "ETHUSDT",
    ],
  };

  const [symbol, setSymbol] = useState(
    () => localStorage.getItem("qe_td_symbol") || DEFAULTS.symbol
  );
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("qe_td_watchlist") || "[]");
      return saved.length ? saved : DEFAULTS.watchlist;
    } catch {
      return DEFAULTS.watchlist;
    }
  });
  useEffect(() => localStorage.setItem("qe_td_symbol", symbol), [symbol]);
  useEffect(
    () => localStorage.setItem("qe_td_watchlist", JSON.stringify(watchlist)),
    [watchlist]
  );

  // optional backend probe (safe to keep even if backend is off)
  const [probe, setProbe] = useState("");
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const res = await apiPublic.get(
          `/api/market/ohlc?symbol=${symbol}&interval=60&range=7d`
        );
        if (!ok) return;
        setProbe(res?.data?.t?.length ? "" : "Demo/Fail");
      } catch {
        if (ok) setProbe("Demo/Fail");
      }
    })();
    return () => {
      ok = false;
    };
  }, [symbol]);

  const TOP = { label: "1h", seconds: 60 * 60 };
  const CARDS = [
    { label: "1m", seconds: 60 },
    { label: "5m", seconds: 5 * 60 },
    { label: "10m", seconds: 10 * 60 },
    { label: "15m", seconds: 15 * 60 },
    { label: "30m", seconds: 30 * 60 },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-200">
      {/* Header */}
      <header
        className="h-14 border-b border-white/10 px-4 flex items-center gap-6"
        style={{ background: "#0a0f18" }}
      >
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-6 w-6 rounded-full bg-indigo-600" />
          QuantumEdge
        </div>
        <nav className="text-sm flex items-center gap-4 opacity-80">
          <Link to="/" className="hover:opacity-100">
            Dashboard
          </Link>
          <span className="opacity-100 font-medium">Trade Desk</span>
          <Link to="/traderlab" className="hover:opacity-100">
            TraderLab
          </Link>
          <Link to="/backtesting" className="hover:opacity-100">
            Backtesting
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <span className="opacity-70">Symbol</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-transparent border border-white/15 rounded px-2 py-1 w-[120px]"
            />
          </label>
          <span className="text-xs text-amber-300">{probe}</span>
        </div>
      </header>

      <main className="flex">
        <Watchlist value={watchlist} onChange={setWatchlist} onPick={setSymbol} />

        <section className="flex-1 p-3">
          {/* Top: 1H big card */}
          <div className="rounded-2xl border border-neutral-800 bg-[color:var(--card,#0B0B10)] mb-3">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-sm">
                <span className="font-mono font-semibold">{symbol}</span>
                <span className="opacity-70 ml-2">{TOP.label}</span>
              </div>
              <div className="text-xs text-neutral-500">
                Pro chart • Drawing tools • Indicator panes
              </div>
            </div>
            <div className="px-2 py-2">
              <ProChart symbol={symbol} interval={TOP.seconds} height={420} />
            </div>
          </div>

          {/* Mini grid 1 */}
          <div
            className="grid gap-3 mb-3"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            {CARDS.slice(0, 3).map((tf) => (
              <div
                key={tf.label}
                className="rounded-2xl border border-neutral-800 bg-[color:var(--card,#0B0B10)]"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <div className="text-sm">
                    <span className="font-mono font-semibold">{symbol}</span>
                    <span className="opacity-70 ml-2">{tf.label}</span>
                  </div>
                  <div className="text-xs text-neutral-500">Pro card</div>
                </div>
                <div className="px-2 py-2">
                  <ProChart symbol={symbol} interval={tf.seconds} height={300} tight />
                </div>
              </div>
            ))}
          </div>

          {/* Mini grid 2 */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {CARDS.slice(3).map((tf) => (
              <div
                key={tf.label}
                className="rounded-2xl border border-neutral-800 bg-[color:var(--card,#0B0B10)]"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <div className="text-sm">
                    <span className="font-mono font-semibold">{symbol}</span>
                    <span className="opacity-70 ml-2">{tf.label}</span>
                  </div>
                  <div className="text-xs text-neutral-500">Pro card</div>
                </div>
                <div className="px-2 py-2">
                  <ProChart symbol={symbol} interval={tf.seconds} height={320} tight />
                </div>
              </div>
            ))}
          </div>
        </section>

        <StickyOrderTicket symbol={symbol} />
      </main>
    </div>
  );
}
