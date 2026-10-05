// In-memory state with a small JSON file for settings, alerts and decisions.
// On Render's free tier the file system resets on each deploy or restart (documented limitation).
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { DEMO_PROFILES, DEMO_MARKET } from "./demo.js";

const file = path.join(config.dataDir, "state.json");

const DEFAULT_LIVE_CHARTER = {
  equityMin: 60,
  equityMax: 80,
  safeMin: 20,
  singleStockMax: 10,
  slabRate: 30,
  ltcgAlreadyUsed: 0,
  needAmount: 0,
  needDate: "",
  rules: ["Rebalance when my equity drifts more than 5 points outside my range."],
  hardFloor: 0,
  holdingDropFloorPct: 0,
};

const DEFAULTS = {
  notify: {
    ntfyTopic: config.notify.ntfyTopic,
    pushoverUserKey: config.notify.pushoverUserKey,
    useNtfy: !!config.notify.ntfyTopic,
    usePushover: !!(config.notify.pushoverUserKey && config.notify.pushoverAppToken),
    alarmOptIn: true,
    alarmAnyTime: false,
    alarmFrom: "09:00",
    alarmTo: "16:00",
  },
  thresholds: {
    infoPortfolioPct: 2,
    priorityPortfolioPct: 4,
    niftyInfoPct: 2,
    vixPriority: 22,
    alarmWeightPct: 10,
    alarmConfidence: 0.75,
    maxAlarmsPerDay: 3,
  },
  charters: {
    rohan: DEMO_PROFILES.rohan.charter,
    meera: DEMO_PROFILES.meera.charter,
    live: DEFAULT_LIVE_CHARTER,
  },
  livePerson: {
    name: "You",
    goal: "Long-term wealth",
    horizonYears: 5,
    risk: "Moderate",
    sip: 0,
    defaultReason: "worried",
  },
  kite: null,
  tradebookLots: null,
  alerts: [],
  decisions: [],
  consentAt: null,
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...structuredClone(DEFAULTS),
      ...raw,
      notify: { ...DEFAULTS.notify, ...(raw.notify || {}) },
      thresholds: { ...DEFAULTS.thresholds, ...(raw.thresholds || {}) },
      charters: { ...DEFAULTS.charters, ...(raw.charters || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const persisted = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(config.dataDir, { recursive: true });
      persisted.alerts = persisted.alerts.slice(-300);
      persisted.decisions = persisted.decisions.slice(-300);
      fs.writeFileSync(file, JSON.stringify(persisted, null, 2));
    } catch (e) {
      console.error("save failed", e.message);
    }
  }, 300);
}

export function resetAll() {
  const keep = { kite: persisted.kite };
  Object.keys(persisted).forEach((k) => delete persisted[k]);
  Object.assign(persisted, structuredClone(DEFAULTS), keep);
  save();
}

// Engines: one per portfolio source
const cloneHoldings = (hs) => hs.map((h) => ({ ...h, lots: h.lots.map((l) => ({ ...l })) }));

export const engines = {
  rohan: {
    id: "rohan",
    label: "Rohan (demo)",
    demo: true,
    person: DEMO_PROFILES.rohan.person,
    baseHoldings: cloneHoldings(DEMO_PROFILES.rohan.holdings),
    holdings: cloneHoldings(DEMO_PROFILES.rohan.holdings),
    market: { ...DEMO_MARKET },
    portfolioFromPeakPct: DEMO_PROFILES.rohan.portfolioFromPeakPct,
    injectedNews: [],
    fired: {},
    replay: null,
    drill: false,
    lastSync: null,
  },
  meera: {
    id: "meera",
    label: "Meera (demo)",
    demo: true,
    person: DEMO_PROFILES.meera.person,
    baseHoldings: cloneHoldings(DEMO_PROFILES.meera.holdings),
    holdings: cloneHoldings(DEMO_PROFILES.meera.holdings),
    market: { ...DEMO_MARKET },
    portfolioFromPeakPct: DEMO_PROFILES.meera.portfolioFromPeakPct,
    injectedNews: [],
    fired: {},
    replay: null,
    drill: false,
    lastSync: null,
  },
  live: {
    id: "live",
    label: "My Zerodha",
    demo: false,
    person: persisted.livePerson,
    baseHoldings: [],
    holdings: [],
    market: null,
    portfolioFromPeakPct: null,
    injectedNews: [],
    fired: {},
    replay: null,
    drill: false,
    lastSync: null,
    syncError: null,
  },
};

export const charterOf = (id) => persisted.charters[id] || DEFAULT_LIVE_CHARTER;

export function resetDemo(id) {
  const e = engines[id];
  if (!e || !e.demo) return;
  const p = DEMO_PROFILES[id];
  e.baseHoldings = cloneHoldings(p.holdings);
  e.holdings = cloneHoldings(p.holdings);
  e.market = { ...DEMO_MARKET };
  e.injectedNews = [];
  e.fired = {};
  e.replay = null;
  e.drill = false;
}

// Server-Sent Events
const clients = new Set();
export function addClient(res, src) {
  const c = { res, src };
  clients.add(c);
  return () => clients.delete(c);
}
export function broadcast(event, data, src = null) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (src && c.src !== src) continue;
    try {
      c.res.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}
export const clientCount = () => clients.size;
