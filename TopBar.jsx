import React from "react";
import { pct, tone } from "./lib.js";

const NAV = [
  ["dashboard", "Dashboard"],
  ["alerts", "Alerts"],
  ["charter", "My plan"],
  ["settings", "Settings"],
];

function IndexChip({ name, data }) {
  if (!data) return <span className="text-xs text-mute">{name} loading</span>;
  return (
    <span className="flex items-baseline gap-2 text-xs whitespace-nowrap">
      <span className="font-medium text-strong">{name}</span>
      <span className="num text-strong">{Number(data.last).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
      <span className={`num ${tone(data.changePct)}`}>{pct(data.changePct)}</span>
    </span>
  );
}

function WatchDot({ snap }) {
  if (!snap) return null;
  if (snap.replay?.running) return <span className="chip bg-amber-soft text-amber">Replay {snap.replay.clock}</span>;
  if (snap.drill) return <span className="chip bg-down-soft text-down">Alarm drill</span>;
  if (snap.demo) return <span className="chip bg-canvas text-mute">Demo portfolio</span>;
  const w = snap.watch;
  if (!w.connected) return <span className="chip bg-canvas text-mute">Not connected today</span>;
  return (
    <span className={`chip ${w.marketOpen ? "bg-brand-soft text-brand" : "bg-canvas text-mute"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${w.marketOpen ? "bg-up" : "bg-mute"}`} />
      {w.marketOpen ? "Watching live" : "Market closed"}
    </span>
  );
}

export default function TopBar({ snap, src, setSrc, page, setPage }) {
  const unacked = (snap?.alerts || []).filter((a) => !a.ackAt && a.tier >= 2).length;
  return (
    <header className="bg-white border-b border-line sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 h-14 flex items-center gap-4">
        <a href="/" className="flex items-center gap-2 shrink-0" aria-label="FinLit Co-Pilot home">
          <img src="/icon.svg" alt="" className="w-7 h-7" />
          <span className="font-semibold text-strong hidden sm:inline">FinLit Co-Pilot</span>
        </a>
        <div className="hidden md:flex items-center gap-5 pl-4 border-l border-line">
          <IndexChip name="NIFTY 50" data={snap?.market?.nifty} />
          <IndexChip name="INDIA VIX" data={snap?.market?.vix} />
        </div>
        <nav className="flex items-center gap-1 ml-auto overflow-x-auto">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => setPage(id)} className={`relative px-3 py-2 text-sm rounded ${page === id ? "text-brand font-medium" : "text-ink hover:text-strong"}`}>
              {label}
              {id === "alerts" && unacked > 0 && <span className="ml-1 num text-[10px] bg-down text-white rounded-full px-1.5 py-0.5">{unacked}</span>}
            </button>
          ))}
        </nav>
        <div className="hidden sm:block">
          <WatchDot snap={snap} />
        </div>
        <label className="sr-only" htmlFor="src">Portfolio</label>
        <select id="src" value={src} onChange={(e) => setSrc(e.target.value)} className="text-sm border border-line rounded px-2 py-1.5 bg-white text-strong focus:outline-none focus:ring-1 focus:ring-brand">
          <option value="rohan">Rohan (demo)</option>
          <option value="meera">Meera (demo)</option>
          <option value="live">My Zerodha</option>
        </select>
      </div>
      <div className="md:hidden px-3 pb-2 flex gap-4 overflow-x-auto">
        <IndexChip name="NIFTY 50" data={snap?.market?.nifty} />
        <IndexChip name="VIX" data={snap?.market?.vix} />
        <WatchDot snap={snap} />
      </div>
    </header>
  );
}
