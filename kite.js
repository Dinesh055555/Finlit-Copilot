// Zerodha Kite Connect integration: login, holdings sync, optional market quotes.
import kiteconnect from "kiteconnect";
import { config, isConfigured } from "./config.js";
import { persisted, save, engines } from "./store.js";
import { encrypt, decrypt, todayIST } from "./util.js";

const { KiteConnect } = kiteconnect;

function client() {
  const kc = new KiteConnect({ api_key: config.kite.apiKey });
  const token = currentToken();
  if (token) kc.setAccessToken(token);
  return kc;
}

export function currentToken() {
  const k = persisted.kite;
  if (!k?.token) return null;
  // Zerodha tokens expire every morning. Treat a token from an earlier IST date as expired.
  if (k.date !== todayIST()) return null;
  try {
    return decrypt(k.token, config.kite.apiSecret);
  } catch {
    return null;
  }
}

export const kiteStatus = () => ({
  configured: isConfigured.kite(),
  connected: !!currentToken(),
  userName: persisted.kite?.userName || null,
  connectedAt: persisted.kite?.at || null,
  marketData: config.kite.marketData,
  apiKey: config.kite.apiKey || null,
});

export function loginUrl() {
  return new KiteConnect({ api_key: config.kite.apiKey }).getLoginURL();
}

export async function completeLogin(requestToken) {
  const kc = new KiteConnect({ api_key: config.kite.apiKey });
  const session = await kc.generateSession(requestToken, config.kite.apiSecret);
  persisted.kite = {
    token: encrypt(session.access_token, config.kite.apiSecret),
    userName: session.user_name || session.user_shortname || session.user_id,
    userId: session.user_id,
    date: todayIST(),
    at: new Date().toISOString(),
  };
  save();
  return persisted.kite;
}

export function logout() {
  persisted.kite = null;
  engines.live.holdings = [];
  engines.live.baseHoldings = [];
  save();
}

const DEBT_WORDS = /(liquid|overnight|money market|gilt|debt|bond|duration|banking & psu|banking and psu|corporate|credit risk|floater|treasury|arbitrage)/i;
const CASH_WORDS = /(liquid|overnight|money market)/i;
const ETF_DEBT = /(LIQUID|LIQ|GILT|BOND|BBETF|SDL|GSEC)/;
const ETF_GOLD = /(GOLD|SILVER)/;

function lotsFor(symbol, qty, lastPrice, avgPrice) {
  const tb = persisted.tradebookLots?.[symbol];
  if (tb && tb.length) {
    let left = qty;
    const lots = [];
    // newest lots are the ones still held under FIFO; tb is stored oldest first after sells removed
    for (const l of tb) {
      if (left <= 0) break;
      const q = Math.min(left, l.qty);
      const months = l.date ? (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24 * 30.4375) : l.months;
      lots.push({ cost: q * l.price, value: q * lastPrice, months });
      left -= q;
    }
    if (left > 0) lots.push({ cost: left * avgPrice, value: left * lastPrice, months: 6 });
    return { lots, estimated: left > 0 };
  }
  return { lots: [{ cost: qty * avgPrice, value: qty * lastPrice, months: 6 }], estimated: true };
}

export function normalizeEquity(h) {
  const qty = (h.quantity || 0) + (h.t1_quantity || 0);
  const sym = h.tradingsymbol;
  const isEtf = /BEES$|ETF|IETF/.test(sym);
  let assetClass = "equity";
  let taxClass = "equity";
  if (isEtf && ETF_DEBT.test(sym)) {
    assetClass = /LIQ/.test(sym) ? "cash" : "debt";
    taxClass = "slab";
  } else if (isEtf && ETF_GOLD.test(sym)) {
    assetClass = "debt";
    taxClass = "slab";
  }
  const { lots, estimated } = lotsFor(sym, qty, h.last_price, h.average_price);
  return {
    id: `eq:${h.exchange}:${sym}`,
    symbol: sym,
    tradingsymbol: sym,
    name: sym,
    exchange: h.exchange,
    instrumentToken: h.instrument_token,
    kind: isEtf ? "etf" : "stock",
    assetClass,
    taxClass,
    quantity: qty,
    lastPrice: h.last_price,
    avgPrice: h.average_price,
    value: qty * h.last_price,
    cost: qty * h.average_price,
    dayChangePct: h.day_change_percentage || 0,
    exitLoadPct: 0,
    exitLoadMonths: 12,
    beta: 1,
    lots,
    lotsEstimated: estimated,
  };
}

export function normalizeMF(h) {
  const name = h.fund || h.tradingsymbol;
  const debt = DEBT_WORDS.test(name);
  const assetClass = debt ? (CASH_WORDS.test(name) ? "cash" : "debt") : "equity";
  const value = h.quantity * h.last_price;
  const cost = h.quantity * h.average_price;
  return {
    id: `mf:${h.tradingsymbol}:${h.folio || ""}`,
    symbol: h.tradingsymbol,
    name,
    exchange: "MF",
    kind: "mf",
    assetClass,
    taxClass: debt ? "slab" : "equity",
    quantity: h.quantity,
    lastPrice: h.last_price,
    avgPrice: h.average_price,
    value,
    cost,
    dayChangePct: 0,
    exitLoadPct: debt ? 0 : 1,
    exitLoadMonths: 12,
    beta: debt ? 0 : 1,
    lots: [{ cost, value, months: 6 }],
    lotsEstimated: true,
    folio: h.folio,
  };
}

// Company names for news matching (Kite holdings only carry trading symbols)
let nameMap = null;
export async function loadInstrumentNames() {
  if (nameMap || !currentToken()) return nameMap;
  try {
    const list = await client().getInstruments("NSE");
    nameMap = {};
    for (const i of list) if (i.tradingsymbol && i.name) nameMap[i.tradingsymbol] = i.name;
  } catch (e) {
    console.warn("instrument names unavailable:", e.message);
  }
  return nameMap;
}

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export async function syncHoldings() {
  const e = engines.live;
  if (!currentToken()) {
    e.syncError = "Not connected today. Log in with Zerodha to start the watch.";
    return null;
  }
  const kc = client();
  try {
    const [eq, mf] = await Promise.all([kc.getHoldings(), kc.getMFHoldings().catch(() => [])]);
    const names = await loadInstrumentNames();
    const holdings = [...eq.map(normalizeEquity), ...mf.map(normalizeMF)].filter((h) => h.value > 0);
    for (const h of holdings) if (h.kind !== "mf" && names?.[h.symbol]) h.name = titleCase(names[h.symbol]);
    e.holdings = holdings;
    e.baseHoldings = holdings.map((h) => ({ ...h, lots: h.lots.map((l) => ({ ...l })) }));
    e.lastSync = new Date().toISOString();
    e.syncError = null;
    return holdings;
  } catch (err) {
    e.syncError = err?.message || "Holdings sync failed";
    if (err?.error_type === "TokenException") {
      persisted.kite = { ...(persisted.kite || {}), date: "expired" };
      save();
    }
    return null;
  }
}

export async function kiteIndexQuotes() {
  if (!config.kite.marketData || !currentToken()) return null;
  const q = await client().getQuote(["NSE:NIFTY 50", "NSE:INDIA VIX"]);
  const n = q["NSE:NIFTY 50"];
  const v = q["NSE:INDIA VIX"];
  if (!n) return null;
  const chg = (x) => (x?.ohlc?.close ? ((x.last_price - x.ohlc.close) / x.ohlc.close) * 100 : 0);
  return {
    source: "Zerodha live quotes",
    nifty: { last: n.last_price, changePct: chg(n), fromHighPct: null },
    vix: v ? { last: v.last_price, changePct: chg(v) } : null,
  };
}
