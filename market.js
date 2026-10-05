// Index data for the live engine: Zerodha quotes when the paid data plan is on, otherwise a public delayed source.
import { kiteIndexQuotes } from "./kite.js";
import { fetchWithTimeout } from "./util.js";

export const liveMarket = {
  source: "Not loaded yet",
  nifty: null,
  vix: null,
  asOf: null,
  error: null,
};

async function yahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const r = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`index source ${r.status}`);
  const j = await r.json();
  const m = j?.chart?.result?.[0]?.meta;
  if (!m) throw new Error("no index data");
  const prev = m.chartPreviousClose ?? m.previousClose;
  const last = m.regularMarketPrice;
  return {
    last,
    changePct: prev ? ((last - prev) / prev) * 100 : 0,
    fromHighPct: m.fiftyTwoWeekHigh ? ((last - m.fiftyTwoWeekHigh) / m.fiftyTwoWeekHigh) * 100 : null,
  };
}

export async function refreshMarket() {
  try {
    const k = await kiteIndexQuotes().catch(() => null);
    if (k) {
      Object.assign(liveMarket, k, { asOf: new Date().toISOString(), error: null });
      if (liveMarket.nifty && liveMarket.nifty.fromHighPct == null) {
        const y = await yahoo("^NSEI").catch(() => null);
        if (y) liveMarket.nifty.fromHighPct = y.fromHighPct;
      }
      return liveMarket;
    }
    const [n, v] = await Promise.all([yahoo("^NSEI"), yahoo("^INDIAVIX").catch(() => null)]);
    Object.assign(liveMarket, {
      source: "Public index feed (may be delayed)",
      nifty: n,
      vix: v ? { last: v.last, changePct: v.changePct } : null,
      asOf: new Date().toISOString(),
      error: null,
    });
  } catch (e) {
    liveMarket.error = e.message;
  }
  return liveMarket;
}
