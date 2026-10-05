import React, { useState } from "react";
import { Play, Siren, RotateCcw, LogIn, RefreshCw } from "lucide-react";
import { api, inr, inrShort, pct, tone, ago, getPass } from "./lib.js";
import WithdrawSheet from "./WithdrawSheet.jsx";

const CLASS_LABEL = { equity: "Equity", debt: "Debt", cash: "Cash-like" };

function Allocation({ summary, charter }) {
  const t = summary.total || 1;
  const eq = (summary.equity / t) * 100;
  const debt = (summary.debt / t) * 100;
  const cash = (summary.cash / t) * 100;
  const outside = eq > charter.equityMax + 0.05 || eq < charter.equityMin - 0.05;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="text-mute">Allocation vs your plan</span>
        <span className={outside ? "text-amber font-medium" : "text-mute"}>
          Equity {eq.toFixed(0)}%, your range {charter.equityMin} to {charter.equityMax}%
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-canvas overflow-hidden flex" role="img" aria-label={`Equity ${eq.toFixed(0)} percent, debt ${debt.toFixed(0)} percent, cash ${cash.toFixed(0)} percent`}>
        <div className="bg-brand h-full" style={{ width: `${eq}%` }} />
        <div className="bg-[#9DBEE6] h-full" style={{ width: `${debt}%` }} />
        <div className="bg-[#CFDDEE] h-full" style={{ width: `${cash}%` }} />
      </div>
      <div className="relative h-2 mt-0.5">
        <div className="absolute top-0 h-2 border-x-2 border-amber/70 bg-amber-soft" style={{ left: `${charter.equityMin}%`, width: `${charter.equityMax - charter.equityMin}%` }} title="Your equity range" />
      </div>
      <div className="flex gap-4 text-xs text-mute mt-1">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-brand inline-block" />Equity {inrShort(summary.equity)}</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#9DBEE6] inline-block" />Debt {inrShort(summary.debt)}</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#CFDDEE] inline-block" />Cash-like {inrShort(summary.cash)}</span>
      </div>
    </div>
  );
}

function ConnectCard({ cfg, snap, reload, toast }) {
  const configured = cfg?.kite?.configured;
  return (
    <div className="panel p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-strong">Connect your Zerodha account</h1>
      <p className="text-sm mt-2 max-w-xl leading-relaxed">
        Log in with Zerodha and we read your holdings and mutual funds (read-only). During market hours we watch prices and news, and alert your phone only when it matters. We never place orders. Every order is confirmed by you inside Zerodha.
      </p>
      {snap?.watch?.syncError && configured && <p className="text-sm text-amber mt-3">{snap.watch.syncError}</p>}
      {configured ? (
        <a className="btn-primary mt-5" href={`/api/kite/login?pass=${encodeURIComponent(getPass())}`}>
          <LogIn size={16} /> Log in with Zerodha
        </a>
      ) : (
        <div className="mt-5 text-sm bg-canvas rounded p-4 leading-relaxed">
          The server does not have Zerodha keys yet. Add <code className="text-strong">KITE_API_KEY</code> and <code className="text-strong">KITE_API_SECRET</code> in Render's environment settings, and set the redirect URL in your Kite developer app to <code className="text-strong break-all">{cfg?.baseUrl}/api/kite/callback</code>.
        </div>
      )}
      <p className="text-xs text-mute mt-4">Zerodha logins expire every morning. We send a reminder at 8:45 AM on trading days so the watch starts before the market opens.</p>
      <div className="mt-6 pt-5 border-t border-line">
        <p className="text-sm">No account handy? The full experience works on the demo portfolios, including crash replay and phone alarms.</p>
        <button
          className="btn-ghost mt-3"
          onClick={async () => {
            await api("/api/kite/sync", { method: "POST" }).catch(() => {});
            reload();
            toast({ tone: "info", text: "Checked the connection again." });
          }}
        >
          <RefreshCw size={15} /> Check connection
        </button>
      </div>
    </div>
  );
}

function DemoControls({ snap, src, reload, toast }) {
  const [busy, setBusy] = useState(null);
  const run = async (key, path, body = {}) => {
    setBusy(key);
    try {
      await api(path, { method: "POST", body: { src, ...body } });
      await reload();
    } catch (e) {
      toast({ tone: "bad", text: e.message });
    }
    setBusy(null);
  };
  const r = snap.replay;
  const progress = r ? (r.step / r.total) * 100 : 0;
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-md">
          <h3 className="text-sm font-semibold text-strong">See it react to a real crash</h3>
          <p className="text-xs text-mute mt-1 leading-relaxed">
            Replay 4 June 2024, when Nifty closed 5.93% lower, through the live alert engine. Market-wide falls send calm alerts. The alarm drill shows what happens when serious news hits a stock you own.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy || r?.running} onClick={() => run("replay", "/api/replay/start", { speed: "normal" })}>
            <Play size={15} /> {r?.running ? `Replaying ${r.clock}` : "Replay the crash"}
          </button>
          <button className="btn-ghost text-down" disabled={!!busy} onClick={() => run("drill", "/api/drill")}>
            <Siren size={15} /> Alarm drill
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => run("reset", "/api/reset")} aria-label="Reset portfolio">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>
      {r && (
        <div className="mt-3">
          <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
            <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-mute mt-1 num">
            {r.done ? "Replay finished at 15:30. Open your plan to see what the Co-Pilot suggests now." : `Market time ${r.clock}, Nifty ${Math.round(r.nifty).toLocaleString("en-IN")}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ snap, src, cfg, onPlan, toast, reload }) {
  const [withdraw, setWithdraw] = useState(false);
  if (!snap) return <div className="panel p-8 text-sm text-mute">Loading your portfolio</div>;
  if (src === "live" && !snap.holdings.length) return <ConnectCard cfg={cfg} snap={snap} reload={reload} toast={toast} />;

  const s = snap.summary;
  const pnl = s.total - s.invested;
  const recent = snap.alerts.slice(0, 3);
  const person = snap.person || {};

  return (
    <div className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-mute">
              {person.name}
              {person.goal ? `, goal: ${person.goal}` : ""}
            </p>
            <p className="text-3xl font-semibold text-strong num mt-1">{inr(s.total)}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mt-1 num">
              <span className={tone(s.dayChange)}>
                {s.dayChange >= 0 ? "+" : "-"}
                {inr(Math.abs(s.dayChange))} today ({pct(s.dayChangePct)})
              </span>
              <span className="text-mute">
                Invested {inr(s.invested)}, P&L <span className={tone(pnl)}>{pnl >= 0 ? "+" : "-"}{inr(Math.abs(pnl))}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => onPlan({})}>Check my plan</button>
            <button className="btn-sell" onClick={() => setWithdraw(true)}>Withdraw or exit</button>
          </div>
        </div>
        <div className="mt-5">
          <Allocation summary={s} charter={snap.charter} />
        </div>
      </div>

      <DemoControls snap={snap} src={src} reload={reload} toast={toast} />

      {recent.length > 0 && (
        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex justify-between items-center">
            <h3 className="text-sm font-semibold text-strong">Latest alerts</h3>
            <span className="text-xs text-mute">Tap one to open your plan</span>
          </div>
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id}>
                <button className="w-full text-left px-4 py-3 hover:bg-canvas flex gap-3" onClick={() => onPlan({ alertId: a.id, reason: "alert" })}>
                  <TierBadge tier={a.tier} />
                  <span className="min-w-0">
                    <span className="block text-sm text-strong truncate">{a.title}</span>
                    <span className="block text-xs text-mute truncate">{a.message}</span>
                  </span>
                  <span className="ml-auto text-xs text-mute whitespace-nowrap">{ago(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex justify-between items-center">
          <h3 className="text-sm font-semibold text-strong">Holdings ({snap.holdings.length})</h3>
          {src === "live" && <span className="text-xs text-mute">Synced {ago(snap.watch.lastSync)}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm num">
            <thead>
              <tr className="text-xs text-mute text-right border-b border-line">
                <th className="text-left font-medium px-4 py-2">Instrument</th>
                <th className="font-medium px-3 py-2">Value</th>
                <th className="font-medium px-3 py-2 hidden sm:table-cell">Weight</th>
                <th className="font-medium px-3 py-2 hidden sm:table-cell">Day</th>
                <th className="font-medium px-4 py-2">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {snap.holdings.map((h) => {
                const p = h.value - h.cost;
                const months = Math.max(...h.lots.map((l) => l.months));
                const loadOn = h.kind === "mf" && h.exitLoadPct > 0 && months <= (h.exitLoadMonths || 12);
                return (
                  <tr key={h.id} className={h.drill ? "bg-down-soft/50" : ""}>
                    <td className="px-4 py-2.5">
                      <div className="text-strong">{h.name}</div>
                      <div className="text-[11px] text-mute flex flex-wrap gap-x-2">
                        <span>{CLASS_LABEL[h.assetClass]}{h.kind === "mf" ? " fund" : h.kind === "etf" ? " ETF" : " stock"}</span>
                        <span>{h.lotsEstimated ? "holding period estimated" : `held ${Math.round(months)} months`}</span>
                        {loadOn && <span className="text-amber">exit load {h.exitLoadPct}%</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-strong whitespace-nowrap">{inr(h.value)}</td>
                    <td className="px-3 py-2.5 text-right hidden sm:table-cell">{((h.value / s.total) * 100).toFixed(1)}%</td>
                    <td className={`px-3 py-2.5 text-right hidden sm:table-cell ${tone(h.dayChangePct)}`}>{pct(h.dayChangePct)}</td>
                    <td className={`px-4 py-2.5 text-right whitespace-nowrap ${tone(p)}`}>
                      {p >= 0 ? "+" : "-"}
                      {inr(Math.abs(p))}
                      <div className="text-[11px]">{pct(h.cost ? (p / h.cost) * 100 : 0)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {withdraw && (
        <WithdrawSheet
          snap={snap}
          src={src}
          onClose={() => setWithdraw(false)}
          onPlan={(req) => {
            setWithdraw(false);
            onPlan(req);
          }}
        />
      )}
    </div>
  );
}

export function TierBadge({ tier }) {
  const map = {
    1: ["Info", "bg-canvas text-mute"],
    2: ["Priority", "bg-amber-soft text-amber"],
    3: ["Alarm", "bg-down text-white"],
  };
  const [l, c] = map[tier] || map[1];
  return <span className={`chip shrink-0 h-fit ${c}`}>{l}</span>;
}
