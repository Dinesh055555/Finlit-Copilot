import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Check, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { api, inr, inrShort, pct, REASONS } from "./lib.js";
import { TierBadge } from "./Dashboard.jsx";

const LOADER_LINES = ["Reading the latest headlines", "Checking your own plan", "Working out tax and exit load"];

function Loader() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => Math.min(3, x + 1)), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <ul className="py-10 space-y-3" aria-live="polite">
      {LOADER_LINES.map((l, i) => (
        <li key={l} className={`flex items-center gap-3 text-sm ${i < n ? "text-strong" : "text-mute"}`}>
          {i < n ? <Check size={16} className="text-up" /> : <Loader2 size={16} className="animate-spin" />}
          {l}
        </li>
      ))}
    </ul>
  );
}

function ReasonStep({ snap, initial, onPick, alert, defaultNeed }) {
  const [reason, setReason] = useState(initial || snap.person?.defaultReason || "worried");
  const [need, setNeed] = useState(snap.charter?.needAmount || Math.round(defaultNeed || 0));
  const list = REASONS.filter((r) => r.id !== "alert" || alert);
  return (
    <div>
      <h3 className="text-lg font-semibold text-strong">What is this money for?</h3>
      <p className="text-sm text-mute mt-1">One tap. Your answer changes what we show you.</p>
      <div className="mt-4 space-y-2" role="radiogroup">
        {list.map((r) => (
          <button key={r.id} role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)} className={`w-full text-left px-4 py-3 rounded border text-sm ${reason === r.id ? "border-brand bg-brand-soft text-strong" : "border-line hover:border-mute"}`}>
            {r.label}
          </button>
        ))}
      </div>
      {reason === "need" && (
        <div className="mt-4">
          <label className="label" htmlFor="need">How much do you need?</label>
          <input id="need" type="number" className="input num mt-1" value={need} onChange={(e) => setNeed(Number(e.target.value))} />
        </div>
      )}
      <button className="btn-primary w-full mt-5" onClick={() => onPick(reason, need)}>
        Show my plan
      </button>
    </div>
  );
}

function OkLabel({ ok, value }) {
  return (
    <span className={`inline-flex items-start gap-1 ${ok ? "text-up" : "text-amber"}`}>
      {ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
      <span className="text-strong">{value}</span>
    </span>
  );
}

function WhyTab({ plan, snap }) {
  const c = plan.context;
  const heads = (snap.news || []).filter((n) => (n.classification?.sentiment ?? 0) < 0 && (n.classification?.scope === "market_wide" || n.matchedHoldingIds?.length)).slice(0, 3);
  const pv = c.portfolioVsNifty;
  return (
    <div className="space-y-5">
      <div className={`rounded p-4 ${c.companySpecific ? "bg-down-soft" : "bg-brand-soft"}`}>
        <div className="flex justify-between items-baseline gap-3">
          <p className="font-semibold text-strong">{c.label}</p>
          <p className="text-sm num text-strong">{Math.round(c.confidence * 100)}% confidence</p>
        </div>
        {c.event && <p className="text-sm mt-2 text-strong">{c.event.title}</p>}
        {c.event?.classification?.one_line_reason && <p className="text-xs mt-1">{c.event.classification.one_line_reason}</p>}
      </div>
      <div>
        <p className="label mb-2">What drove this</p>
        <ul className="space-y-2.5">
          {c.signals.map((s) => (
            <li key={s.name} className="text-sm">
              <div className="flex justify-between gap-3">
                <span>{s.name}</span>
                <span className="text-strong text-right">{s.value}</span>
              </div>
              <div className="h-1.5 bg-canvas rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-brand" style={{ width: `${Math.round(s.score * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm num">
        <div className="bg-canvas rounded p-3">
          <p className="label">Your portfolio today</p>
          <p className={`text-lg font-semibold ${pv.portfolioDayPct < 0 ? "text-down" : "text-up"}`}>{pct(pv.portfolioDayPct)}</p>
        </div>
        <div className="bg-canvas rounded p-3">
          <p className="label">Nifty 50 today</p>
          <p className={`text-lg font-semibold ${pv.niftyDayPct < 0 ? "text-down" : "text-up"}`}>{pct(pv.niftyDayPct)}</p>
        </div>
        {pv.portfolioFromPeakPct != null && pv.niftyFromHighPct != null && (
          <p className="col-span-2 text-xs text-mute">
            From peak: your portfolio {pct(pv.portfolioFromPeakPct, 1)}, Nifty {pct(pv.niftyFromHighPct, 1)}. Similar numbers mean your funds are falling with the market, not because of a problem of their own.
          </p>
        )}
      </div>
      {heads.length > 0 && (
        <div>
          <p className="label mb-2">Headlines behind this</p>
          <ul className="space-y-2">
            {heads.map((h) => (
              <li key={h.id} className="text-sm">
                {h.link ? (
                  <a href={h.link} target="_blank" rel="noreferrer" className="text-strong hover:text-brand">
                    {h.title} <ExternalLink size={11} className="inline" />
                  </a>
                ) : (
                  <span className="text-strong">{h.title}</span>
                )}
                <span className="block text-xs text-mute">{h.publisher}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-sm">
        <p className="label">What would change this view</p>
        <p className="mt-1">{c.wouldChange}</p>
      </div>
      <p className="text-xs text-mute">How confidence is worked out: {c.confidenceFormula}</p>
    </div>
  );
}

function PlanTab({ plan }) {
  const hero = plan.options.find((o) => o.hero);
  const cols = [hero, plan.options.find((o) => o.id === "exit_all")].filter((o, i, a) => o && a.findIndex((x) => x?.id === o.id) === i);
  return (
    <div>
      <p className="text-sm mb-3">These are the rules you set when markets were calm. Here is how each choice keeps or breaks them.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-mute border-b border-line">
              <th className="text-left font-medium py-2 pr-3">Your rule</th>
              <th className="text-left font-medium py-2 pr-3">Now</th>
              {cols.map((o) => (
                <th key={o.id} className="text-left font-medium py-2 pr-3">
                  After: {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line num">
            {plan.charter.map((r) => (
              <tr key={r.rule}>
                <td className="py-2.5 pr-3">{r.rule}</td>
                <td className="py-2.5 pr-3"><OkLabel {...r.now} /></td>
                {cols.map((o) => (
                  <td key={o.id} className="py-2.5 pr-3">{r.after[o.id] ? <OkLabel {...r.after[o.id]} /> : <span className="text-mute">n/a</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostTab({ plan }) {
  const priced = plan.options.filter((o) => o.tax);
  const [id, setId] = useState(priced.find((o) => o.hero)?.id || "exit_all");
  const o = priced.find((x) => x.id === id) || priced[0];
  if (!o) return null;
  const t = o.tax;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {priced.map((p) => (
          <button key={p.id} onClick={() => setId(p.id)} className={`chip border ${p.id === o.id ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm num">
          <thead>
            <tr className="text-xs text-mute border-b border-line text-right">
              <th className="text-left font-medium py-2">Holding sold</th>
              <th className="font-medium py-2">Amount</th>
              <th className="font-medium py-2">Exit load</th>
              <th className="font-medium py-2">Gain or loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {t.lines.map((l) => (
              <tr key={l.id} className="text-right">
                <td className="text-left py-2 pr-2">
                  {l.name}
                  <span className="block text-[11px] text-mute">{l.buckets.map((b) => ({ slab: "taxed at slab", stcg: "short-term", ltcg: "long-term" }[b])).join(", ")}</span>
                </td>
                <td className="py-2">{inr(l.amount)}</td>
                <td className="py-2">{inr(l.exitLoad)}</td>
                <td className={`py-2 ${l.gain < 0 ? "text-down" : "text-up"}`}>{l.gain < 0 ? "-" : "+"}{inr(Math.abs(l.gain))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.setoffSteps.length > 0 && (
        <div className="bg-canvas rounded p-3 text-sm">
          <p className="label mb-1">Losses that cancel gains</p>
          <ul className="space-y-1 num">
            {t.setoffSteps.map((s, i) => (
              <li key={i}>{s.text.replace(/(\d+)/, (m) => inr(Number(m)))}</li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-y-1.5 text-sm num">
        <dt>Exit load</dt>
        <dd className="text-right text-strong">{inr(t.exitLoad)}</dd>
        <dt>Tax on slab-rate gains</dt>
        <dd className="text-right text-strong">{inr(t.tax.slab)}</dd>
        <dt>Short-term equity tax (20%)</dt>
        <dd className="text-right text-strong">{inr(t.tax.stcg)}</dd>
        <dt>Long-term equity tax (12.5%)</dt>
        <dd className="text-right text-strong">{inr(t.tax.ltcg)}</dd>
        <dt className="text-mute">Tax-free LTCG limit used</dt>
        <dd className="text-right text-mute">{inr(t.ltcgExemptionUsed)} of {inr(t.ltcgExemptionUsed + t.ltcgExemptionLeftAfter)}</dd>
        {t.carryForwardLoss > 0.5 && (
          <>
            <dt className="text-mute">Loss carried forward</dt>
            <dd className="text-right text-mute">{inr(t.carryForwardLoss)}</dd>
          </>
        )}
        <dt className="font-semibold text-strong border-t border-line pt-2">Total cost</dt>
        <dd className="text-right font-semibold text-strong border-t border-line pt-2">{inr(t.friction)}</dd>
        <dt>You receive</dt>
        <dd className="text-right text-strong">{inr(t.netProceeds)}</dd>
      </dl>
      <p className="text-xs text-mute">{plan.taxNote} Equity: 20% if held 12 months or less, 12.5% above the 1.25 lakh yearly exemption after that. Debt funds bought after April 2023: your slab rate.</p>
    </div>
  );
}

function WhatIfTab({ plan }) {
  const a = plan.assumptions;
  const [move, setMove] = useState(15);
  const rows = plan.options.filter((o) => o.id !== "remind");
  const val = (o, m) => {
    const eq = (o.after.total * o.after.equityPct) / 100;
    const safe = (o.after.total * o.after.safePct) / 100;
    return eq * (1 + m) + safe * (1 + a.debtReturn) + o.after.parked * (1 + a.parkedReturn);
  };
  const data = rows.map((o) => ({ name: o.label.replace(/,.*$/, ""), value: Math.round(val(o, move / 100)), hero: o.hero, id: o.id }));
  const stay = rows.find((o) => o.id === "stay");
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm num">
          <thead>
            <tr className="text-xs text-mute border-b border-line text-right">
              <th className="text-left font-medium py-2">In 12 months, if you choose</th>
              <th className="font-medium py-2">Markets recover 15%</th>
              <th className="font-medium py-2">Markets fall another 10%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-right">
            {rows.map((o) => (
              <tr key={o.id} className={o.hero ? "bg-brand-soft/60" : ""}>
                <td className="text-left py-2 pr-2">{o.label}</td>
                <td className="py-2 text-strong">{inr(o.whatIf.up)}</td>
                <td className="py-2 text-strong">{inr(o.whatIf.down)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label htmlFor="mv" className="text-sm flex justify-between">
          <span>Try your own scenario: equity moves</span>
          <span className="num font-semibold text-strong">{move > 0 ? "+" : ""}{move}%</span>
        </label>
        <input id="mv" type="range" min={-20} max={30} value={move} onChange={(e) => setMove(Number(e.target.value))} className="w-full accent-[#387ED1] mt-2" />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tickFormatter={(v) => inrShort(v)} tick={{ fontSize: 11, fill: "#8A93A2" }} domain={["auto", "auto"]} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#424A57" }} />
            <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "#F7F8FA" }} />
            {stay && <ReferenceLine x={Math.round(val(stay, move / 100))} stroke="#8A93A2" strokeDasharray="3 3" />}
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {data.map((d) => (
                <Cell key={d.id} fill={d.hero ? "#387ED1" : d.id === "exit_all" ? "#D9534F" : "#B8CDE8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-mute">
        Assumptions: debt and existing cash-like holdings earn {Math.round(a.debtReturn * 100)}% a year, money taken out of the market is parked at {a.parkedReturn * 100}%. Illustrative, not a forecast.
      </p>
    </div>
  );
}

function KiteBasket({ apiKey, orders }) {
  const ref = useRef(null);
  return (
    <form ref={ref} method="post" action="https://kite.zerodha.com/connect/basket" target="_blank">
      <input type="hidden" name="api_key" value={apiKey} />
      <input type="hidden" name="data" value={JSON.stringify(orders)} />
      <button type="submit" className="btn-primary w-full">
        Open these orders in Zerodha to confirm <ExternalLink size={14} />
      </button>
    </form>
  );
}

function Decide({ option, plan, snap, src, apiKey, onDone, alert, reason, startedAt }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const stockOrders = option.sales
    .filter((s) => (s.kind === "stock" || s.kind === "etf") && s.tradingsymbol && s.quantityHeld)
    .map((s) => ({
      variety: "regular",
      tradingsymbol: s.tradingsymbol,
      exchange: s.exchange || "NSE",
      transaction_type: "SELL",
      order_type: "MARKET",
      product: "CNC",
      quantity: Math.max(1, Math.min(s.quantityHeld, Math.ceil(s.amount / (s.value / s.quantityHeld)))),
    }));
  const funds = option.sales.filter((s) => s.kind === "mf");
  const breaks = plan.charter.some((r) => r.after[option.id] && !r.after[option.id].ok);

  const confirm = async () => {
    setSaving(true);
    await api("/api/decisions", {
      method: "POST",
      body: { src, alertId: alert?.id, reason, optionId: option.id, optionLabel: option.label, cost: option.cost, hero: option.hero, note, secondsToDecide: Math.round((Date.now() - startedAt) / 1000) },
    }).catch(() => {});
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="label">You chose</p>
        <p className="text-lg font-semibold text-strong">{option.label}</p>
        <p className="text-sm mt-1">{option.detail}</p>
        {option.cost > 0 && <p className="text-sm mt-1 num">Cost: {inr(option.cost)}</p>}
      </div>
      {option.sales.length > 0 && (
        <div className="bg-canvas rounded p-3 text-sm">
          <p className="label mb-1">What will be sold</p>
          <ul className="space-y-1 num">
            {option.sales.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span>{s.name}</span>
                <span className="text-strong">{inr(s.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {src === "live" && option.sales.length > 0 && (
        <div className="space-y-2">
          {stockOrders.length > 0 && apiKey && <KiteBasket apiKey={apiKey} orders={stockOrders} />}
          {funds.length > 0 && (
            <a className="btn-ghost w-full" href="https://coin.zerodha.com/" target="_blank" rel="noreferrer">
              Redeem the {funds.length} fund{funds.length > 1 ? "s" : ""} in Coin <ExternalLink size={14} />
            </a>
          )}
          <p className="text-xs text-mute">Orders open in Zerodha, where you log in and confirm. FinLit never places orders itself.</p>
        </div>
      )}
      {src !== "live" && option.sales.length > 0 && (
        <p className="text-xs text-mute">Demo portfolio: with a linked account, this opens Zerodha with these sell orders filled in for you to confirm.</p>
      )}
      {breaks && (
        <div>
          <label className="label" htmlFor="why">This goes against a rule you set. Want to note why? (optional)</label>
          <textarea id="why" className="input mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: I need cash for a family emergency" />
        </div>
      )}
      <button className="btn-primary w-full" onClick={confirm} disabled={saving}>
        {saving ? "Saving" : "Save my decision"}
      </button>
    </div>
  );
}

export default function PlanSheet({ src, snap, req, onClose, toast }) {
  const alert = useMemo(() => (req.alertId ? snap.alerts.find((a) => a.id === req.alertId) : null), [req.alertId, snap.alerts]);
  const [reason, setReason] = useState(req.reason && req.reason !== "alert" ? req.reason : alert ? "alert" : null);
  const [needAmount, setNeedAmount] = useState(0);
  const [askReason, setAskReason] = useState(!req.reason || req.fromWithdraw);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const tabRef = useRef(null);
  useEffect(() => {
    if (tab) setTimeout(() => tabRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [tab]);

  useEffect(() => {
    if (askReason) return;
    setData(null);
    setError(null);
    const t0 = Date.now();
    api("/api/plan", { method: "POST", body: { src, reason, needAmount, alertId: req.alertId } })
      .then((d) => setTimeout(() => { setData(d); started.current = Date.now(); }, Math.max(0, 1400 - (Date.now() - t0))))
      .catch((e) => setError(e.message));
    if (req.alertId) api(`/api/alerts/${req.alertId}/ack`, { method: "POST" }).catch(() => {});
  }, [askReason, reason, needAmount, src, req.alertId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const plan = data?.plan;
  const option = plan && chosen ? plan.options.find((o) => o.id === chosen) : null;

  return (
    <div className="fixed inset-0 z-40 bg-strong/30 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div className="bg-white w-full max-w-[760px] h-full overflow-y-auto shadow-sheet sheet-in">
        <div className="sticky top-0 bg-white border-b border-line px-5 h-14 flex items-center justify-between z-10">
          <div>
            <h2 id="pp-title" className="font-semibold text-strong">Pause & Plan</h2>
          </div>
          <button onClick={onClose} className="p-1 text-mute hover:text-strong" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 sm:px-8 py-6">
          {alert && (
            <div className={`rounded p-3 mb-5 flex gap-3 ${alert.tier === 3 ? "bg-down-soft" : "bg-canvas"}`}>
              <TierBadge tier={alert.tier} />
              <div className="text-sm">
                <p className="font-medium text-strong">{alert.title}</p>
                <p className="mt-0.5">{alert.message}</p>
              </div>
            </div>
          )}

          {askReason ? (
            <ReasonStep
              snap={snap}
              alert={alert}
              initial={reason}
              defaultNeed={req.amount}
              onPick={(r, need) => {
                setReason(r);
                setNeedAmount(need);
                setAskReason(false);
              }}
            />
          ) : error ? (
            <p className="text-sm text-down">{error}</p>
          ) : !plan ? (
            <Loader />
          ) : done ? (
            <div className="py-6">
              <p className="text-xl font-semibold text-strong">Decision saved</p>
              <p className="text-sm mt-2">
                You chose: {option?.label}. On {new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} we will show you how this decision played out.
              </p>
              <p className="text-sm mt-5">Did this help you decide?</p>
              <div className="flex gap-2 mt-2">
                <button className="btn-ghost" onClick={() => { toast({ tone: "ok", text: "Thanks. Noted." }); onClose(); }}>Yes</button>
                <button className="btn-ghost" onClick={() => { toast({ tone: "info", text: "Thanks. We will use this to improve." }); onClose(); }}>Not really</button>
              </div>
            </div>
          ) : option ? (
            <>
              <button className="text-sm text-brand mb-4" onClick={() => setChosen(null)}>Back to options</button>
              <Decide option={option} plan={plan} snap={snap} src={src} apiKey={data.kiteApiKey} alert={alert} reason={reason} startedAt={started.current} onDone={() => setDone(true)} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-mute mb-3">
                <span>{REASONS.find((r) => r.id === reason)?.label || "Your plan"}</span>
                <button className="text-brand" onClick={() => setAskReason(true)}>Change</button>
              </div>
              <p className={`text-[22px] leading-snug font-semibold ${plan.tone === "alert" ? "text-down" : "text-strong"}`}>{plan.verdict[0]}</p>
              <div className="mt-3 space-y-2 text-[15px] leading-relaxed max-w-[62ch]">
                {plan.verdict.slice(1).map((v, i) => (
                  <p key={i}>{v}</p>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                {plan.keyNumbers.map((k) => (
                  <div key={k.label} className={`rounded p-3 ${k.warn ? "bg-amber-soft" : "bg-canvas"}`}>
                    <p className="text-xs text-mute">{k.label}</p>
                    <p className={`text-xl font-semibold num mt-0.5 ${k.warn ? "text-amber" : "text-strong"}`}>{k.value}</p>
                    <p className="text-[11px] text-mute mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-strong mt-7 mb-2">Your options</h3>
              <ul className="space-y-2">
                {plan.options.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => setChosen(o.id)} className={`w-full text-left rounded border px-4 py-3 flex items-start gap-3 hover:border-brand ${o.hero ? "border-brand bg-brand-soft/50" : o.id === "exit_all" ? "border-line" : "border-line"}`}>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${o.id === "exit_all" ? "text-down" : "text-strong"}`}>{o.label}</span>
                          {o.hero && <span className="chip bg-brand text-white">Fits your plan best</span>}
                        </span>
                        <span className="block text-xs text-mute mt-1">{o.detail}</span>
                      </span>
                      <span className="text-sm num text-strong whitespace-nowrap">{o.cost > 0.5 ? inr(o.cost) : o.sales.length ? "₹0" : "No cost"}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div ref={tabRef} className="mt-7 border-t border-line pt-4 scroll-mt-16">
                <div className="flex gap-1 overflow-x-auto" role="tablist">
                  {[
                    ["why", "Why is this happening?"],
                    ["plan", "Does this fit my plan?"],
                    ["cost", "What will it cost?"],
                    ["whatif", "What if I'm wrong?"],
                  ].map(([id, l]) => (
                    <button key={id} role="tab" aria-selected={tab === id} className={`tab whitespace-nowrap ${tab === id ? "tab-on" : ""}`} onClick={() => setTab(tab === id ? null : id)}>
                      {l}
                    </button>
                  ))}
                </div>
                {tab && (
                  <div className="pt-5">
                    {tab === "why" && <WhyTab plan={plan} snap={snap} />}
                    {tab === "plan" && <PlanTab plan={plan} />}
                    {tab === "cost" && <CostTab plan={plan} />}
                    {tab === "whatif" && <WhatIfTab plan={plan} />}
                  </div>
                )}
              </div>
              <p className="text-xs text-mute mt-8 leading-relaxed">{plan.disclaimer}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
