import React, { useEffect, useState } from "react";
import { api, inr } from "./lib.js";

const PRESETS = {
  Conservative: { equityMin: 30, equityMax: 50, safeMin: 40, singleStockMax: 5 },
  Moderate: { equityMin: 60, equityMax: 80, safeMin: 20, singleStockMax: 10 },
  Aggressive: { equityMin: 75, equityMax: 95, safeMin: 5, singleStockMax: 15 },
};

function Field({ id, label, hint, value, onChange, suffix, type = "number" }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-strong">{label}</label>
      {hint && <p className="text-xs text-mute">{hint}</p>}
      <div className="flex items-center gap-2 mt-1">
        <input id={id} type={type} className="input num" value={value} onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)} />
        {suffix && <span className="text-sm text-mute w-6">{suffix}</span>}
      </div>
    </div>
  );
}

export default function CharterPage({ snap, src, reload, toast }) {
  const [c, setC] = useState(null);
  const [rule, setRule] = useState("");
  useEffect(() => {
    if (snap?.charter) setC({ ...snap.charter, rules: [...(snap.charter.rules || [])] });
  }, [snap?.src]);
  if (!c) return null;
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v }));

  const save = async () => {
    try {
      await api("/api/charter", { method: "PUT", body: { src, charter: c } });
      toast({ tone: "ok", text: "Your plan is saved. Every alert and plan now uses these rules." });
      reload();
    } catch (e) {
      toast({ tone: "bad", text: e.message });
    }
  };

  return (
    <div className="panel p-5 sm:p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-strong">My plan</h1>
        <p className="text-sm mt-1 max-w-2xl">
          Set these rules on a calm day. When markets get noisy, the Co-Pilot does not give you its opinion. It shows you whether a decision keeps or breaks the rules you wrote yourself.
        </p>
      </div>

      <div>
        <p className="text-sm text-strong mb-2">Start from a risk profile</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([name, p]) => (
            <button key={name} className="btn-ghost !py-1.5" onClick={() => setC((x) => ({ ...x, ...p }))}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field id="emin" label="Equity, minimum" value={c.equityMin} onChange={set("equityMin")} suffix="%" />
        <Field id="emax" label="Equity, maximum" value={c.equityMax} onChange={set("equityMax")} suffix="%" />
        <Field id="safe" label="Debt plus cash, at least" value={c.safeMin} onChange={set("safeMin")} suffix="%" />
        <Field id="stock" label="Any single stock, at most" value={c.singleStockMax} onChange={set("singleStockMax")} suffix="%" />
        <Field id="need" label="Money I need within 12 months" hint="This should stay out of equity. Leave 0 if none." value={c.needAmount} onChange={set("needAmount")} suffix="₹" />
        <Field id="needd" label="Needed by" type="date" value={c.needDate || ""} onChange={set("needDate")} />
        <Field id="slab" label="My income tax slab" hint="Used for debt fund gains" value={c.slabRate} onChange={set("slabRate")} suffix="%" />
        <Field id="ltcg" label="Long-term gains already booked this year" hint="Uses up part of the 1.25 lakh tax-free limit" value={c.ltcgAlreadyUsed} onChange={set("ltcgAlreadyUsed")} suffix="₹" />
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-sm font-semibold text-strong">When should my phone ring like an alarm?</h2>
        <p className="text-xs text-mute mt-1 max-w-2xl">
          Serious company-specific news on a large holding always qualifies. You can add your own floors. A market-wide fall alone never rings the alarm, because that is when panic selling does the most damage.
        </p>
        <div className="grid sm:grid-cols-2 gap-5 mt-4">
          <Field id="floor" label="Ring if my portfolio falls below" hint={c.hardFloor ? `Currently ${inr(c.hardFloor)}` : "0 means off"} value={c.hardFloor} onChange={set("hardFloor")} suffix="₹" />
          <Field id="hdrop" label="Ring if any holding is this far below my cost" hint="0 means off" value={c.holdingDropFloorPct} onChange={set("holdingDropFloorPct")} suffix="%" />
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-sm font-semibold text-strong">My rules in my words</h2>
        <ul className="mt-2 space-y-2">
          {c.rules.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-sm bg-canvas rounded px-3 py-2">
              <span>{r}</span>
              <button className="text-xs text-mute hover:text-down" onClick={() => setC((x) => ({ ...x, rules: x.rules.filter((_, j) => j !== i) }))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 mt-2">
          <input className="input" placeholder="For example: I never sell on the day of a big fall" value={rule} onChange={(e) => setRule(e.target.value)} />
          <button
            className="btn-ghost"
            onClick={() => {
              if (!rule.trim()) return;
              setC((x) => ({ ...x, rules: [...x.rules, rule.trim()] }));
              setRule("");
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={save}>Save my plan</button>
        <button className="btn-ghost" onClick={() => setC({ ...snap.charter, rules: [...(snap.charter.rules || [])] })}>Undo changes</button>
      </div>
    </div>
  );
}
