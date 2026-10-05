// Live news: Moneycontrol and ET Markets RSS (headline, link, time only) plus optional Marketaux.
import Parser from "rss-parser";
import crypto from "node:crypto";
import { config, isConfigured } from "./config.js";
import { classifyBatch } from "./classifier.js";
import { fetchWithTimeout } from "./util.js";

const parser = new Parser({ timeout: 10000, headers: { "User-Agent": "Mozilla/5.0 (FinLit Co-Pilot news reader)" } });

export const newsState = { items: [], lastFetch: null, sources: {}, error: null };

const idFor = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const GENERIC = new Set(["india", "indian", "national", "bharat", "hindustan", "state", "power", "finance", "capital", "global", "united", "general", "first", "fund", "direct", "growth", "plan"]);

function nameKeys(h) {
  const keys = new Set();
  if (h.kind === "mf") return keys;
  if (h.symbol && h.symbol.length >= 3) keys.add(h.symbol.toLowerCase());
  const core = (h.name || "")
    .replace(/\((.*?)\)/g, "")
    .replace(/\b(ltd|limited|inc|corporation|corp|company|co)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (core.length >= 4) keys.add(core);
  const first = core.split(" ")[0];
  if (first && first.length >= 6 && !GENERIC.has(first)) keys.add(first);
  return keys;
}

export function matchHoldings(item, holdings) {
  const t = " " + normTitle(item.title) + " ";
  const ids = [];
  const names = [];
  for (const h of holdings) {
    for (const k of nameKeys(h)) {
      if (t.includes(" " + k + " ") || (item.tickers || []).includes(h.symbol)) {
        ids.push(h.id);
        names.push(h.name);
        break;
      }
    }
  }
  return { ids, names };
}

async function fetchRss() {
  const out = [];
  await Promise.all(
    config.news.feeds.map(async (f) => {
      try {
        const feed = await parser.parseURL(f.url);
        const items = (feed.items || []).slice(0, 25);
        newsState.sources[f.url] = { ok: true, count: items.length, publisher: f.publisher };
        for (const it of items) {
          if (!it.title) continue;
          out.push({
            id: idFor(it.link || it.title),
            title: it.title.trim(),
            link: it.link || "",
            publisher: f.publisher,
            publishedAt: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : null),
            source: "rss",
          });
        }
      } catch (e) {
        newsState.sources[f.url] = { ok: false, error: e.message, publisher: f.publisher };
      }
    })
  );
  return out;
}

async function fetchMarketaux(symbols = []) {
  if (!isConfigured.marketaux()) return [];
  const qs = new URLSearchParams({ countries: "in", filter_entities: "true", language: "en", limit: "3", api_token: config.news.marketauxToken });
  if (symbols.length) qs.set("symbols", symbols.slice(0, 10).map((s) => `${s}.NS`).join(","));
  try {
    const r = await fetchWithTimeout(`https://api.marketaux.com/v1/news/all?${qs}`);
    const j = await r.json();
    newsState.sources.marketaux = { ok: r.ok, count: (j.data || []).length, publisher: "Marketaux" };
    return (j.data || []).map((a) => ({
      id: idFor(a.url || a.title),
      title: a.title,
      link: a.url,
      publisher: a.source || "Marketaux",
      publishedAt: a.published_at,
      source: "marketaux",
      tickers: (a.entities || []).map((e) => (e.symbol || "").replace(/\.(NS|BO)$/, "")),
      apiSentiment: (a.entities || []).length ? (a.entities || []).reduce((s, e) => s + (e.sentiment_score || 0), 0) / a.entities.length : null,
    }));
  } catch (e) {
    newsState.sources.marketaux = { ok: false, error: e.message, publisher: "Marketaux" };
    return [];
  }
}

/**
 * Fetch, dedupe, match against all engines' holdings, classify new items.
 * Returns the list of newly added items.
 */
export async function refreshNews(allHoldings, liveSymbols = []) {
  const [rss, mx] = await Promise.all([fetchRss(), fetchMarketaux(liveSymbols)]);
  const known = new Set(newsState.items.map((i) => i.id));
  const knownTitles = new Set(newsState.items.map((i) => normTitle(i.title)));
  const fresh = [];
  for (const it of [...mx, ...rss]) {
    const nt = normTitle(it.title);
    if (known.has(it.id) || knownTitles.has(nt)) continue;
    known.add(it.id);
    knownTitles.add(nt);
    const m = matchHoldings(it, allHoldings);
    it.matchedNames = [...new Set(m.names)];
    it.matchedHoldingIds = m.ids;
    fresh.push(it);
  }
  if (fresh.length) {
    const cls = await classifyBatch(fresh);
    for (const it of fresh) {
      it.classification = cls[it.id];
      if (it.apiSentiment != null && it.classification) it.classification.sentiment = Number(it.apiSentiment.toFixed(2));
    }
  }
  newsState.items = [...fresh, ...newsState.items]
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 160);
  newsState.lastFetch = new Date().toISOString();
  newsState.error = Object.values(newsState.sources).some((s) => s.ok) ? null : "No news source reachable right now.";
  return fresh;
}

// News as seen by one engine: global feed re-matched to its holdings, plus injected replay or drill items
export function newsFor(engine) {
  const injected = engine.injectedNews || [];
  const global = newsState.items.map((it) => {
    const m = matchHoldings(it, engine.holdings);
    let classification = it.classification;
    if (classification && classification.scope === "company_specific" && !m.ids.length) {
      classification = { ...classification, scope: "sector", class: classification.class === "structural" ? "material" : classification.class };
    }
    return { ...it, matchedHoldingIds: m.ids, matchedNames: m.names, classification };
  });
  return [...injected, ...global];
}
