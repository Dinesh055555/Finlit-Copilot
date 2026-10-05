import React from "react";
import { inr, ago } from "./lib.js";
import { TierBadge } from "./Dashboard.jsx";

const OPTION_TONE = { exit_all: "text-down", stay: "text-up", rebalance: "text-brand", withdraw_need: "text-brand" };

export default function AlertsPage({ snap, onPlan }) {
  if (!snap) return null;
  const alerts = snap.alerts;
  const decisions = snap.decisions;
  const alarms = alerts.filter((a) => a.tier === 3 && a.ackAt);
  const ackSecs = alarms.map((a) => (new Date(a.ackAt) - new Date(a.createdAt)) / 1000).sort((a, b) => a - b);
  const medianAck = ackSecs.length ? ackSecs[Math.floor(ackSecs.length / 2)] : null;
  const informed = decisions.length;
  const heroShare = decisions.length ? Math.round((decisions.filter((d) => d.hero).length / decisions.length) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="panel p-4">
          <p className="text-xs text-mute">Informed decisions made</p>
          <p className="text-2xl font-semibold text-strong num mt-1">{informed}</p>
          <p className="text-[11px] text-mute mt-1">Exits decided after seeing cost, plan and news</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-mute">Median time to acknowledge an alarm</p>
          <p className="text-2xl font-semibold text-strong num mt-1">{medianAck == null ? "No alarms yet" : `${Math.round(medianAck)} s`}</p>
          <p className="text-[11px] text-mute mt-1">From phone alarm to opening the plan</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-mute">Chose the option that fits the plan</p>
          <p className="text-2xl font-semibold text-strong num mt-1">{heroShare == null ? "None yet" : `${heroShare}%`}</p>
          <p className="text-[11px] text-mute mt-1">Exit everything is always one tap away</p>
        </div>
      </div>

      <div className="panel">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-strong">Alert timeline</h2>
          <p className="text-xs text-mute mt-0.5">Info and priority alerts are calm pushes. Alarms ring through silent mode and are reserved for serious news on a stock you own or a floor you set.</p>
        </div>
        {alerts.length === 0 ? (
          <p className="p-4 text-sm text-mute">No alerts yet. Run the crash replay or the alarm drill from the dashboard to see them arrive.</p>
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex gap-3">
                  <TierBadge tier={a.tier} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-strong">{a.title}</p>
                    <p className="text-xs mt-0.5">{a.message}</p>
                    <p className="text-[11px] text-mute mt-1">
                      {ago(a.createdAt)}
                      {a.ackAt ? `, opened after ${Math.max(1, Math.round((new Date(a.ackAt) - new Date(a.createdAt)) / 1000))} s` : ", not opened yet"}
                      {a.downgraded ? `. Sent as priority, not alarm: ${a.downgraded}` : ""}
                    </p>
                    <p className="text-[11px] text-mute">
                      Phone: {Object.entries(a.deliveries || {}).filter(([k]) => k !== "inApp").map(([k, v]) => `${k} ${v}`).join(", ") || "in app only"}
                    </p>
                  </div>
                  <button className="btn-ghost !px-3 !py-1.5 h-fit text-xs" onClick={() => onPlan({ alertId: a.id, reason: "alert" })}>
                    Open plan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-strong">Decision log</h2>
          <p className="text-xs text-mute mt-0.5">Thirty days after each decision we show you how it played out.</p>
        </div>
        {decisions.length === 0 ? (
          <p className="p-4 text-sm text-mute">Your saved decisions will appear here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {decisions.map((d) => (
              <li key={d.id} className="px-4 py-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span className={`font-medium ${OPTION_TONE[d.optionId] || "text-strong"}`}>{d.optionLabel}</span>
                <span className="text-mute num">{d.cost != null ? `cost ${inr(d.cost)}` : ""}</span>
                <span className="text-mute num">{d.secondsToDecide != null ? `decided in ${d.secondsToDecide} s` : ""}</span>
                <span className="text-mute">{ago(d.at)}, review on {new Date(d.followUpOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                {d.note && <span className="w-full text-xs">Your note: {d.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
