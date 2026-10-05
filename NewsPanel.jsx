import React, { useMemo, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { ago } from "./lib.js";

const CLASS_STYLE = {
  structural: "bg-down-soft text-down",
  material: "bg-amber-soft text-amber",
  noise: "bg-canvas text-mute",
};
const CLASS_LABEL = { structural: "Structural", material: "Material", noise: "Noise" };

function sentimentDot(s) {
  if (s == null) return "bg-line";
  if (s <= -0.3) return "bg-down";
  if (s >= 0.3) return "bg-up";
  return "bg-mute";
}

export default function NewsPanel({ snap, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => {
    const all = snap?.news || [];
    if (filter === "mine") return all.filter((n) => n.matchedHoldingIds?.length);
    if (filter === "market") return all.filter((n) => n.classification?.scope === "market_wide");
    return all;
  }, [snap, filter]);

  const sources = Object.values(snap?.newsSources || {});
  const okSources = [...new Set(sources.filter((s) => s.ok).map((s) => s.publisher))];

  return (
    <div className="panel flex flex-col lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-88px)]">
      <div className="px-4 pt-3 pb-2 border-b border-line">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-strong">Market news</h2>
          <button
            className="text-mute hover:text-brand p-1 rounded focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Refresh news"
            onClick={async () => {
              setBusy(true);
              await onRefresh();
              setBusy(false);
            }}
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="text-xs text-mute mt-0.5">
          {okSources.length ? `Live from ${okSources.join(", ")}` : "Connecting to Moneycontrol and ET Markets feeds"}
          {snap?.watch?.newsLastFetch ? `, updated ${ago(snap.watch.newsLastFetch)}` : ""}
        </p>
        <div className="flex gap-1 mt-2" role="tablist">
          {[
            ["all", "All"],
            ["mine", "My holdings"],
            ["market", "Market-wide"],
          ].map(([id, l]) => (
            <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`chip ${filter === id ? "bg-brand-soft text-brand" : "text-mute hover:text-strong"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <ul className="overflow-y-auto divide-y divide-line">
        {items.length === 0 && <li className="p-4 text-sm text-mute">{filter === "mine" ? "No news about your holdings right now. Quiet is good." : "Waiting for the first headlines."}</li>}
        {items.slice(0, 70).map((n) => {
          const c = n.classification;
          const Wrapper = n.link ? "a" : "div";
          return (
            <li key={n.id}>
              <Wrapper {...(n.link ? { href: n.link, target: "_blank", rel: "noreferrer" } : {})} className={`block px-4 py-3 hover:bg-canvas ${n.replay || n.drill ? "bg-amber-soft/40" : ""}`}>
                <div className="flex gap-2">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sentimentDot(c?.sentiment)}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-strong">
                      {n.title}
                      {n.link && <ExternalLink size={11} className="inline ml-1 text-mute" aria-hidden />}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-mute">
                      <span>{n.publisher}</span>
                      <span>{ago(n.publishedAt)}</span>
                      {c && <span className={`chip !text-[10px] ${CLASS_STYLE[c.class] || CLASS_STYLE.noise}`}>{CLASS_LABEL[c.class] || "Noise"}</span>}
                      {n.matchedNames?.length > 0 && <span className="chip !text-[10px] bg-brand-soft text-brand">{n.matchedNames[0]}</span>}
                    </div>
                  </div>
                </div>
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
