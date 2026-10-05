import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { config, isConfigured } from "./config.js";
import { engines, persisted, save, addClient, broadcast, charterOf, resetDemo, resetAll } from "./store.js";
import { summarize, buildPlan } from "./planner.js";
import { kiteStatus, loginUrl, completeLogin, logout, syncHoldings, currentToken } from "./kite.js";
import { refreshMarket, liveMarket } from "./market.js";
import { refreshNews, newsFor, newsState } from "./news.js";
import { evaluateMarket, evaluateNews } from "./rules.js";
import { startReplay, stopReplay, replayStatus, runDrill, endDrill, REPLAY_DAY } from "./replay.js";
import { channelStatus, sendSimple } from "./notify.js";
import { tradebookToLots } from "./tradebook.js";
import { isMarketOpen, istParts, todayIST, uid } from "./util.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const SRC = new Set(["rohan", "meera", "live"]);
const engineFor = (req) => engines[SRC.has(req.query.src || req.body?.src) ? req.query.src || req.body?.src : "rohan"];

// Passcode protects anything that touches the real Zerodha account or the team's phone settings.
function requirePass(req, res, next) {
  if (!config.passcode) return next();
  const p = req.get("x-app-pass") || req.query.pass || req.body?.pass;
  if (p === config.passcode) return next();
  res.status(401).json({ error: "Passcode required" });
}
const needsPassFor = (e) => (e.id === "live" ? requirePass : (req, res, next) => next());

const watchStatus = () => {
  const k = kiteStatus();
  const now = new Date();
  return {
    marketOpen: isMarketOpen(now),
    istTime: `${String(istParts(now).hour).padStart(2, "0")}:${String(istParts(now).minute).padStart(2, "0")}`,
    connected: k.connected,
    lastSync: engines.live.lastSync,
    syncError: engines.live.syncError,
    newsLastFetch: newsState.lastFetch,
  };
};

function snapshot(e) {
  const holdings = e.holdings;
  const news = newsFor(e).slice(0, 80);
  return {
    src: e.id,
    label: e.label,
    demo: e.demo,
    person: e.id === "live" ? persisted.livePerson : e.person,
    charter: charterOf(e.id),
    holdings,
    summary: summarize(holdings),
    portfolioFromPeakPct: e.portfolioFromPeakPct,
    market: e.id === "live" && !e.replay?.running && !e.replay?.done ? liveMarket : e.market,
    news,
    newsSources: newsState.sources,
    alerts: persisted.alerts.filter((a) => a.src === e.id).slice(-60).reverse(),
    decisions: persisted.decisions.filter((d) => d.src === e.id).slice(-60).reverse(),
    replay: replayStatus(e),
    drill: e.drill,
    watch: watchStatus(),
  };
}

// ---------- API ----------
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get("/api/config", (req, res) =>
  res.json({
    passcodeRequired: !!config.passcode,
    kite: kiteStatus(),
    ai: isConfigured.ai(),
    marketaux: isConfigured.marketaux(),
    channels: channelStatus(),
    notify: { ...persisted.notify, pushoverUserKey: persisted.notify.pushoverUserKey ? "set" : "" },
    thresholds: persisted.thresholds,
    replayDay: REPLAY_DAY,
    baseUrl: config.baseUrl,
    consentAt: persisted.consentAt,
  })
);

app.post("/api/auth/check", (req, res) => res.json({ ok: !config.passcode || req.body?.pass === config.passcode }));

// Zerodha login
app.get("/api/kite/login", requirePass, (req, res) => {
  if (!isConfigured.kite()) return res.status(400).send("Set KITE_API_KEY and KITE_API_SECRET on the server first.");
  res.redirect(loginUrl());
});
app.get("/api/kite/callback", async (req, res) => {
  if (req.query.status !== "success" || !req.query.request_token) return res.redirect("/?src=live&kite=failed");
  try {
    await completeLogin(req.query.request_token);
    persisted.consentAt ||= new Date().toISOString();
    save();
    await syncHoldings();
    await evaluateMarket(engines.live).catch(() => {});
    broadcast("refresh", {}, "live");
    res.redirect("/?src=live&kite=connected");
  } catch (e) {
    console.error("kite login failed", e.message);
    res.redirect("/?src=live&kite=failed");
  }
});
app.post("/api/kite/logout", requirePass, (req, res) => {
  logout();
  broadcast("refresh", {}, "live");
  res.json({ ok: true });
});
app.post("/api/kite/sync", requirePass, async (req, res) => {
  await syncHoldings();
  broadcast("refresh", {}, "live");
  res.json({ ok: !engines.live.syncError, error: engines.live.syncError });
});

app.get("/api/state", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => res.json(snapshot(engineFor(req))));

app.get("/api/stream", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ src: e.id })}\n\n`);
  const remove = addClient(res, e.id);
  const ping = setInterval(() => res.write(`event: ping\ndata: {}\n\n`), 25000);
  req.on("close", () => {
    clearInterval(ping);
    remove();
  });
});

app.post("/api/plan", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  if (!e.holdings.length) return res.status(400).json({ error: "No holdings loaded yet." });
  const alert = req.body.alertId ? persisted.alerts.find((a) => a.id === req.body.alertId) : null;
  const plan = buildPlan({
    holdings: e.holdings,
    charter: charterOf(e.id),
    person: e.id === "live" ? persisted.livePerson : e.person,
    reason: req.body.reason,
    needAmount: Number(req.body.needAmount) || 0,
    alert,
    market: snapshot(e).market,
    news: newsFor(e),
    profileFromPeak: e.portfolioFromPeakPct,
    assumptions: req.body.assumptions,
  });
  res.json({ plan, alert, kiteApiKey: config.kite.apiKey || null });
});

app.put("/api/charter", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  const c = { ...charterOf(e.id), ...req.body.charter };
  for (const k of ["equityMin", "equityMax", "safeMin", "singleStockMax", "slabRate", "ltcgAlreadyUsed", "needAmount", "hardFloor", "holdingDropFloorPct"]) c[k] = Number(c[k]) || 0;
  persisted.charters[e.id] = c;
  save();
  broadcast("refresh", {}, e.id);
  res.json({ ok: true, charter: c });
});

app.put("/api/person", requirePass, (req, res) => {
  persisted.livePerson = { ...persisted.livePerson, ...req.body.person };
  engines.live.person = persisted.livePerson;
  save();
  res.json({ ok: true });
});

app.put("/api/settings", requirePass, (req, res) => {
  const { notify, thresholds } = req.body;
  if (notify) {
    const next = { ...persisted.notify, ...notify };
    if (notify.pushoverUserKey === "set") next.pushoverUserKey = persisted.notify.pushoverUserKey;
    persisted.notify = next;
  }
  if (thresholds) persisted.thresholds = { ...persisted.thresholds, ...Object.fromEntries(Object.entries(thresholds).map(([k, v]) => [k, Number(v)])) };
  save();
  res.json({ ok: true, channels: channelStatus() });
});

app.post("/api/notify/test", requirePass, async (req, res) => {
  const tier = Number(req.body.tier) || 3;
  const titles = { 1: "Test: info alert", 2: "Test: priority alert", 3: "Test: ALARM alert" };
  const out = await sendSimple(tier, titles[tier], "This is a test from FinLit Co-Pilot. If this rang through silent mode, your alarm channel is ready.", "/");
  res.json({ ok: true, result: out, channels: channelStatus() });
});

// Pushover emergency acknowledgement callback
app.post("/api/pushover/ack", express.urlencoded({ extended: false }), (req, res) => {
  const a = persisted.alerts.find((x) => x.id === req.query.alert);
  if (a && !a.ackAt) {
    a.ackAt = new Date().toISOString();
    a.ackVia = "pushover";
    save();
    broadcast("alert_update", a, a.src);
  }
  res.json({ ok: true });
});

app.post("/api/alerts/:id/ack", (req, res) => {
  const a = persisted.alerts.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "not found" });
  if (!a.ackAt) {
    a.ackAt = new Date().toISOString();
    a.ackVia = "app";
    save();
    broadcast("alert_update", a, a.src);
  }
  res.json({ ok: true, alert: a });
});

app.post("/api/decisions", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  const d = {
    id: uid("dc_"),
    src: e.id,
    at: new Date().toISOString(),
    alertId: req.body.alertId || null,
    reason: req.body.reason || null,
    optionId: req.body.optionId,
    optionLabel: req.body.optionLabel,
    cost: req.body.cost ?? null,
    hero: !!req.body.hero,
    secondsToDecide: req.body.secondsToDecide ?? null,
    note: (req.body.note || "").slice(0, 500),
    portfolioValue: summarize(e.holdings).total,
    followUpOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };
  persisted.decisions.push(d);
  save();
  broadcast("refresh", {}, e.id);
  res.json({ ok: true, decision: d });
});

app.post("/api/replay/start", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  if (!e.baseHoldings.length) return res.status(400).json({ error: "Load holdings first." });
  const fast = req.body.speed === "fast";
  res.json({ ok: true, status: startReplay(e, { msPerStep: fast ? 250 : 500, minutesPerStep: 2 }) });
});
app.post("/api/replay/stop", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), (req, res) => {
  const e = engineFor(req);
  stopReplay(e);
  res.json({ ok: true });
});
app.post("/api/drill", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), async (req, res) => {
  const e = engineFor(req);
  if (!e.baseHoldings.length) return res.status(400).json({ error: "Load holdings first." });
  const news = await runDrill(e);
  broadcast("refresh", {}, e.id);
  res.json({ ok: true, news });
});
app.post("/api/reset", (req, res, next) => needsPassFor(engineFor(req))(req, res, next), async (req, res) => {
  const e = engineFor(req);
  stopReplay(e);
  if (e.demo) resetDemo(e.id);
  else {
    endDrill(e);
    e.replay = null;
    e.injectedNews = [];
    e.fired = {};
    await syncHoldings();
  }
  broadcast("refresh", {}, e.id);
  res.json({ ok: true });
});

app.post("/api/tradebook", requirePass, upload.single("file"), async (req, res) => {
  try {
    const lots = tradebookToLots(req.file.buffer.toString("utf8"));
    persisted.tradebookLots = lots;
    save();
    await syncHoldings();
    broadcast("refresh", {}, "live");
    res.json({ ok: true, symbols: Object.keys(lots).length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/news/refresh", async (req, res) => {
  await newsCycle();
  res.json({ ok: true, count: newsState.items.length, sources: newsState.sources });
});

app.delete("/api/data", requirePass, (req, res) => {
  logout();
  resetAll();
  for (const id of ["rohan", "meera"]) resetDemo(id);
  broadcast("refresh", {});
  res.json({ ok: true });
});

// ---------- Static frontend ----------
app.get("/icon.svg", (req, res) => res.sendFile(path.join(config.rootDir, "icon.svg")));
app.get("/manifest.webmanifest", (req, res) => res.type("application/manifest+json").sendFile(path.join(config.rootDir, "manifest.webmanifest")));
if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(config.webDist, "index.html")));
} else {
  app.get("/", (req, res) => res.send("Frontend not built. Run npm run build at the repo root."));
}

// ---------- Background watch ----------
async function newsCycle() {
  const all = Object.values(engines).flatMap((e) => e.holdings);
  const liveSymbols = engines.live.holdings.filter((h) => h.kind !== "mf").map((h) => h.symbol);
  try {
    const fresh = await refreshNews(all, liveSymbols);
    if (fresh.length) {
      const live = engines.live;
      if (live.holdings.length && !live.replay?.running) {
        const liveView = newsFor(live).filter((n) => fresh.some((f) => f.id === n.id));
        await evaluateNews(live, liveView);
      }
      broadcast("news", { count: fresh.length });
    }
  } catch (e) {
    console.warn("news cycle failed", e.message);
  }
}

async function watchCycle() {
  const live = engines.live;
  const open = isMarketOpen();
  try {
    await refreshMarket();
    if (currentToken() && !live.replay?.running && !live.drill) {
      await syncHoldings();
      live.market = liveMarket;
      if (open) await evaluateMarket(live);
    }
    broadcast("refresh", {}, "live");
  } catch (e) {
    console.warn("watch cycle failed", e.message);
  }
}

let lastMorning = null;
async function morningReminder() {
  const p = istParts();
  if (p.day === 0 || p.day === 6) return;
  if (p.hour === 8 && p.minute >= 45 && lastMorning !== todayIST() && kiteStatus().configured && !currentToken()) {
    lastMorning = todayIST();
    await sendSimple(1, "Start today's watch", "Markets open at 9:15. Tap to log in with Zerodha so we can watch your portfolio today.", "/?src=live");
  }
}

function loop(fn, msFn) {
  const run = async () => {
    await fn();
    setTimeout(run, msFn());
  };
  setTimeout(run, 1500);
}

loop(watchCycle, () => (isMarketOpen() ? config.watch.holdingsPollSeconds * 1000 : 10 * 60 * 1000));
loop(newsCycle, () => (isMarketOpen() ? config.news.pollMinutesMarket : config.news.pollMinutesOff) * 60 * 1000);
setInterval(morningReminder, 60 * 1000);

app.listen(config.port, () => console.log(`FinLit Co-Pilot running on ${config.baseUrl} (port ${config.port})`));
