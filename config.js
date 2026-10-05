import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const bool = (v, d = false) => (v === undefined || v === "" ? d : ["1", "true", "yes", "on"].includes(String(v).toLowerCase()));

export const config = {
  port: Number(env.PORT || 8080),
  baseUrl: (env.APP_BASE_URL || `http://localhost:${env.PORT || 8080}`).replace(/\/$/, ""),
  passcode: env.APP_PASSCODE || "",
  dataDir: env.DATA_DIR || path.join(here, "data"),
  webDist: path.join(here, "dist"),
  rootDir: here,

  kite: {
    apiKey: env.KITE_API_KEY || "",
    apiSecret: env.KITE_API_SECRET || "",
    // true only if you bought the Kite Connect plan with market data (Rs 500/month)
    marketData: bool(env.KITE_MARKET_DATA, false),
  },

  news: {
    marketauxToken: env.MARKETAUX_TOKEN || "",
    feeds: (env.NEWS_FEEDS ||
      [
        "Moneycontrol|https://www.moneycontrol.com/rss/latestnews.xml",
        "Moneycontrol|https://www.moneycontrol.com/rss/marketreports.xml",
        "Moneycontrol|https://www.moneycontrol.com/rss/business.xml",
        "Moneycontrol|https://www.moneycontrol.com/rss/buzzingstocks.xml",
        "Moneycontrol|https://www.moneycontrol.com/rss/economy.xml",
        "ET Markets|https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "ET Markets|https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
      ].join(","))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [publisher, ...rest] = s.split("|");
        return { publisher: publisher.trim(), url: rest.join("|").trim() };
      }),
    pollMinutesMarket: Number(env.NEWS_POLL_MINUTES || 5),
    pollMinutesOff: 20,
  },

  ai: {
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    model: env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  },

  notify: {
    ntfyServer: (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, ""),
    ntfyTopic: env.NTFY_TOPIC || "",
    pushoverAppToken: env.PUSHOVER_APP_TOKEN || "",
    pushoverUserKey: env.PUSHOVER_USER_KEY || "",
  },

  watch: {
    holdingsPollSeconds: Number(env.HOLDINGS_POLL_SECONDS || 60),
  },
};

export const isConfigured = {
  kite: () => !!(config.kite.apiKey && config.kite.apiSecret),
  ai: () => !!config.ai.anthropicKey,
  marketaux: () => !!config.news.marketauxToken,
};
