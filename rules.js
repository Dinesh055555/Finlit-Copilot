// Alert engine: three tiers. A market-wide fall alone is never an alarm.
import { persisted, save, broadcast, charterOf } from "./store.js";
import { summarize } from "./planner.js";
import { deliver } from "./notify.js";
import { uid, inr, todayIST, isWithin } from "./util.js";

export const TIER_NAMES = { 1: "Info", 2: "Priority", 3: "Alarm" };

function firedToday(engine, key) {
  return engine.fired[key] === todayIST();
}
function markFired(engine, key) {
  engine.fired[key] = todayIST();
}
function alarmsToday(engine) {
  const d = todayIST();
  return persisted.alerts.filter((a) => a.src === engine.id && a.tier === 3 && a.createdAt.slice(0, 10) === d).length;
}

export async function createAlert(engine, { tier, key, title, message, newsId = null, holdingId = null }) {
  if (key && firedToday(engine, key)) return null;
  const n = persisted.notify;
  const th = persisted.thresholds;
  const mode = engine.drill ? "DRILL" : engine.replay?.running ? "REPLAY" : null;
  let downgraded = null;
  if (tier === 3) {
    if (!n.alarmOptIn) downgraded = "Alarm tier is switched off in Settings";
    else if (!mode && !n.alarmAnyTime && !isWithin(new Date(), n.alarmFrom, n.alarmTo)) downgraded = "Outside alarm hours";
    else if (alarmsToday(engine) >= th.maxAlarmsPerDay) downgraded = "Daily alarm limit reached";
    if (downgraded) tier = 2;
  }
  if (key) markFired(engine, key);
  const alert = {
    id: uid("al_"),
    src: engine.id,
    tier,
    tierName: TIER_NAMES[tier],
    title: mode ? `${mode}: ${title}` : title,
    message,
    newsId,
    holdingId,
    createdAt: new Date().toISOString(),
    downgraded,
    mode,
    ackAt: null,
    deliveries: {},
  };
  persisted.alerts.push(alert);
  save();
  broadcast("alert", alert, engine.id);
  alert.deliveries = await deliver(alert);
  save();
  broadcast("alert_update", alert, engine.id);
  return alert;
}

export async function evaluateMarket(engine) {
  if (!engine.holdings.length) return;
  const s = summarize(engine.holdings);
  const th = persisted.thresholds;
  const ch = charterOf(engine.id);
  const m = engine.market || {};
  const niftyPct = m.nifty?.changePct;
  const marketWide = niftyPct != null && niftyPct <= -1.5;
  const tail = marketWide
    ? `The fall is market-wide: Nifty is down ${Math.abs(niftyPct).toFixed(1)}% today and your holdings are moving with it. Tap for your 30-second plan.`
    : "Tap for your 30-second plan before you act.";

  if (s.dayChangePct <= -th.priorityPortfolioPct) {
    await createAlert(engine, {
      tier: 2,
      key: "pf-prio",
      title: `Portfolio down ${Math.abs(s.dayChangePct).toFixed(1)}% today`,
      message: `Your portfolio is down ${inr(Math.abs(s.dayChangePct * s.total) / 100)} today. ${tail}`,
    });
  } else if (s.dayChangePct <= -th.infoPortfolioPct) {
    await createAlert(engine, {
      tier: 1,
      key: "pf-info",
      title: `Portfolio down ${Math.abs(s.dayChangePct).toFixed(1)}% today`,
      message: `FYI: down ${inr(Math.abs(s.dayChangePct * s.total) / 100)} so far today. No action needed. ${marketWide ? "This is a market-wide move." : ""}`.trim(),
    });
  }
  if (niftyPct != null && niftyPct <= -th.niftyInfoPct) {
    await createAlert(engine, {
      tier: 1,
      key: "nifty-info",
      title: `Nifty down ${Math.abs(niftyPct).toFixed(1)}% today`,
      message: "Broad market fall. We are watching your holdings and will only ring if something specific to a stock you own happens.",
    });
  }
  if (m.vix?.last >= th.vixPriority) {
    await createAlert(engine, {
      tier: 2,
      key: "vix",
      title: `India VIX at ${m.vix.last.toFixed(1)}`,
      message: "Volatility is high. Big swings are likely both ways today. Avoid deciding on the worst minute of the day.",
    });
  }
  if (ch.hardFloor > 0 && s.total < ch.hardFloor) {
    await createAlert(engine, {
      tier: 3,
      key: "hard-floor",
      title: `Your floor of ${inr(ch.hardFloor)} is breached`,
      message: `You asked us to ring if your portfolio fell below ${inr(ch.hardFloor)}. It is now ${inr(s.total)}. Open your plan before you act.`,
    });
  }
  if (ch.holdingDropFloorPct > 0) {
    for (const h of engine.holdings) {
      const dd = h.cost > 0 ? ((h.value - h.cost) / h.cost) * 100 : 0;
      if (dd <= -ch.holdingDropFloorPct) {
        await createAlert(engine, {
          tier: 3,
          key: `hdrop:${h.id}`,
          holdingId: h.id,
          title: `${h.name} is ${Math.abs(dd).toFixed(0)}% below your cost`,
          message: `You set a ring if any holding falls ${ch.holdingDropFloorPct}% below cost. Open your plan before you act.`,
        });
      }
    }
  }
}

export async function evaluateNews(engine, items) {
  const th = persisted.thresholds;
  const s = summarize(engine.holdings);
  let mediumCount = 0;
  for (const it of items) {
    const c = it.classification;
    if (!c || !it.matchedHoldingIds?.length) continue;
    const h = engine.holdings.find((x) => x.id === it.matchedHoldingIds[0]);
    if (!h) continue;
    const weight = s.total ? (h.value / s.total) * 100 : 0;
    if (c.class === "structural") {
      const big = weight >= th.alarmWeightPct && (c.confidence ?? 0) >= th.alarmConfidence;
      await createAlert(engine, {
        tier: big ? 3 : 2,
        key: `news:${it.id}`,
        newsId: it.id,
        holdingId: h.id,
        title: `${h.name}: serious company-specific news`,
        message: `${it.title}. You hold ${inr(h.value)} (${weight.toFixed(1)}% of your portfolio). Classified structural, ${Math.round((c.confidence ?? 0) * 100)}% confidence. Tap to review before you act.`,
      });
    } else if ((c.sentiment ?? 0) < -0.3 && mediumCount < 3) {
      mediumCount++;
      await createAlert(engine, {
        tier: 2,
        key: `news:${it.id}`,
        newsId: it.id,
        holdingId: h.id,
        title: `News on ${h.name}`,
        message: `${it.title}. Classified ${c.class} (${c.one_line_reason}) Tap for context.`,
      });
    }
  }
}
