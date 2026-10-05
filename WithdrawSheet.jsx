import React, { useState } from "react";
import { X } from "lucide-react";
import { inr } from "./lib.js";

export default function WithdrawSheet({ snap, src, onClose, onPlan }) {
  const total = snap.summary.total;
  const [amount, setAmount] = useState(Math.round(total));
  const share = total ? (amount / total) * 100 : 0;
  const big = share >= 50;

  return (
    <div className="fixed inset-0 z-40 bg-strong/30 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="wd-title">
      <div className="bg-white w-full sm:max-w-md rounded-t-lg sm:rounded-lg shadow-pop p-5 sheet-in">
        <div className="flex items-center justify-between">
          <h2 id="wd-title" className="text-base font-semibold text-strong">Withdraw or exit</h2>
          <button onClick={onClose} className="p-1 text-mute hover:text-strong" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="label block mt-4" htmlFor="wd-amount">Amount to withdraw</label>
        <input id="wd-amount" className="input num mt-1 text-lg" type="number" min={0} max={Math.round(total)} value={amount} onChange={(e) => setAmount(Math.min(total, Math.max(0, Number(e.target.value))))} />
        <div className="flex gap-2 mt-2">
          {[25, 50, 100].map((p) => (
            <button key={p} className={`chip border ${Math.round(share) === p ? "border-brand text-brand bg-brand-soft" : "border-line text-ink"}`} onClick={() => setAmount(Math.round((total * p) / 100))}>
              {p === 100 ? "Withdraw all" : `${p}%`}
            </button>
          ))}
        </div>
        <p className="text-xs text-mute mt-2 num">
          {inr(amount)} is {share.toFixed(0)}% of your portfolio of {inr(total)}.
        </p>
        {big ? (
          <>
            <p className="text-sm mt-4 leading-relaxed">This is a large exit. Take 30 seconds to see the cost, your plan and the news before you decide. You can still exit everything in one tap.</p>
            <button className="btn-primary w-full mt-4" onClick={() => onPlan({ amount, fromWithdraw: true })}>
              Continue
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mt-4 leading-relaxed">Withdrawals under half your portfolio go straight to your broker. No pause needed.</p>
            {src === "live" ? (
              <a className="btn-primary w-full mt-4" href="https://kite.zerodha.com/holdings" target="_blank" rel="noreferrer">
                Open holdings in Zerodha
              </a>
            ) : (
              <button className="btn-primary w-full mt-4" onClick={onClose}>
                Done (demo portfolio)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
