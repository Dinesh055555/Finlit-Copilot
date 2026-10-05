// Crash Replay: 4 June 2024 (election results day). Nifty closed 5.93% lower after falling about 8.5% intraday.
// The minute path is reconstructed from the official previous close, open, intraday low and close.
// Headlines are reconstructed descriptions of the day and clearly labelled as replay.
import { broadcast, engines } from "./store.js";
import { evaluateMarket, evaluateNews } from "./rules.js";
import { DRILL_HOLDING, DRILL_NEWS } from "./demo.js";

export const REPLAY_DAY = {
  date: "2024-06-04",
  title: "4 June 2024, election results day",
  prevClose: 23263.9,
  open: 23179.5,
  low: 21281.45,
  close: 21884.5,
  high52: 23338.7,
  vixPrev: 21.0,
  vixClose: 26.7,
};

const ANCHORS = [
  [0, 23179.5],
  [20, 22900],
  [45, 22560],
  [90, 22180],
  [140, 21760],
  [185, 21420],
  [205, 21281.45],
  [240, 21520],
  [290, 21690],
  [340, 21800],
  [375, 21884.5],
];

export function buildPath() {
  const pts = [];
  for (let t = 0; t <= 375; t += 1) {
    let i = 0;
    while (i < ANCHORS.length - 2 && ANCHORS[i + 1][0] < t) i++;
    const [t0, v0] = ANCHORS[i];
    const [t1, v1] = ANCHORS[i + 1];
    const f = (t - t0) / (t1 - t0);
    const base = v0 + (v1 - v0) * f;
    const wiggle = t === 0 || t === 375 || t === 205 ? 0 : Math.sin(t * 0.9) * 18 + Math.sin(t * 0.23) * 25;
    pts.push(Math.max(REPLAY_DAY.low, base + wiggle));
  }
  return pts;
}

const HEADLINES = [
  [6, "Early counting trends show a closer contest than exit polls suggested", -0.5],
  [35, "Sensex and Nifty slide over 3% as investors reassess policy continuity", -0.7],
  [95, "Heavy selling in PSU, power and infrastructure stocks; India VIX jumps", -0.7],
  [175, "Foreign investors turn sellers as coalition arithmetic dominates", -0.6],
  [205, "Nifty extends fall to about 8% intraday, worst session in four years", -0.8],
  [300, "Markets trim losses in late trade as buyers return at lower levels", 0.2],
];

const minuteLabel = (t) => {
  const m = 9 * 60 + 15 + t;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

function scaleHoldings(base, r, rEnd) {
  return base.map((h) => {
    const beta = h.beta ?? (h.assetClass === "equity" ? 1 : 0);
    const f = (1 + beta * r) / (1 + beta * rEnd);
    return {
      ...h,
      value: h.value * f,
      dayChangePct: beta * r * 100,
      lots: h.lots.map((l) => ({ ...l, value: l.value * f })),
    };
  });
}

export function replayStatus(engine) {
  const r = engine.replay;
  if (!r) return null;
  return { running: r.running, done: r.done, step: r.step, total: r.path.length - 1, clock: minuteLabel(r.step), title: REPLAY_DAY.title, nifty: r.path[r.step] };
}

export function stopReplay(engine) {
  if (engine.replay?.timer) clearInterval(engine.replay.timer);
  if (engine.replay) engine.replay.running = false;
}

export function startReplay(engine, { msPerStep = 500, minutesPerStep = 2 } = {}) {
  stopReplay(engine);
  const path = buildPath();
  const rEnd = REPLAY_DAY.close / REPLAY_DAY.prevClose - 1;
  const base = engine.baseHoldings.map((h) => ({ ...h, lots: h.lots.map((l) => ({ ...l })) }));
  engine.fired = {};
  engine.injectedNews = engine.injectedNews.filter((n) => n.drill);
  engine.replay = { running: true, done: false, step: 0, path, timer: null };

  const tick = async () => {
    const rp = engine.replay;
    if (!rp || !rp.running) return;
    const t = rp.step;
    const idx = path[t];
    const r = idx / REPLAY_DAY.prevClose - 1;
    engine.holdings = scaleHoldings(base, r, rEnd);
    const vix = REPLAY_DAY.vixPrev + (REPLAY_DAY.vixClose - REPLAY_DAY.vixPrev) * Math.min(1, (Math.abs(r) / Math.abs(rEnd)) * 0.9 + t / 3750);
    engine.market = {
      source: `Replay of ${REPLAY_DAY.title} (reconstructed path)`,
      nifty: { last: idx, changePct: r * 100, fromHighPct: ((idx - REPLAY_DAY.high52) / REPLAY_DAY.high52) * 100 },
      vix: { last: vix, changePct: ((vix - REPLAY_DAY.vixPrev) / REPLAY_DAY.vixPrev) * 100 },
      asOf: `${REPLAY_DAY.date} ${minuteLabel(t)}`,
      replay: true,
    };
    const fresh = [];
    for (const [ht, title, sent] of HEADLINES) {
      if (ht > t - minutesPerStep && ht <= t) {
        const item = {
          id: `replay-${ht}`,
          title: `REPLAY: ${title}`,
          link: "",
          publisher: "Replay (reconstructed)",
          publishedAt: new Date().toISOString(),
          matchedHoldingIds: [],
          classification: { scope: "market_wide", event_type: "macro", fundamental_impact: "none", class: "noise", confidence: 0.8, sentiment: sent, one_line_reason: "Market-wide political and macro news. Not specific to your holdings.", source: "replay" },
          replay: true,
        };
        engine.injectedNews = [item, ...engine.injectedNews];
        fresh.push(item);
      }
    }
    broadcast("tick", { status: replayStatus(engine) }, engine.id);
    broadcast("refresh", {}, engine.id);
    await evaluateMarket(engine);
    if (fresh.length) await evaluateNews(engine, fresh);
    if (t >= path.length - 1) {
      stopReplay(engine);
      rp.done = true;
      broadcast("refresh", {}, engine.id);
      return;
    }
    rp.step = Math.min(path.length - 1, t + minutesPerStep);
  };
  engine.replay.timer = setInterval(tick, msPerStep);
  tick();
  return replayStatus(engine);
}

export async function runDrill(engine) {
  if (!engine.holdings.find((h) => h.id === DRILL_HOLDING.id)) {
    const d = { ...DRILL_HOLDING, lots: DRILL_HOLDING.lots.map((l) => ({ ...l })) };
    engine.holdings = [...engine.holdings, d];
    engine.baseHoldings = [...engine.baseHoldings, { ...d, lots: d.lots.map((l) => ({ ...l })) }];
  }
  engine.drill = true;
  const news = { ...DRILL_NEWS, publishedAt: new Date().toISOString(), matchedHoldingIds: [DRILL_HOLDING.id], matchedNames: [DRILL_HOLDING.name] };
  engine.injectedNews = [news, ...engine.injectedNews.filter((n) => n.id !== news.id)];
  delete engine.fired[`news:${news.id}`];
  broadcast("refresh", {}, engine.id);
  await evaluateNews(engine, [news]);
  return news;
}

export function endDrill(engine) {
  engine.drill = false;
  engine.holdings = engine.holdings.filter((h) => !h.drill);
  engine.baseHoldings = engine.baseHoldings.filter((h) => !h.drill);
  engine.injectedNews = engine.injectedNews.filter((n) => !n.drill);
}

export const allEngines = () => Object.values(engines);
