// Phone delivery: ntfy (free, Android alarm-style) and Pushover (emergency alarms on iPhone and Android).
import { config } from "./config.js";
import { persisted } from "./store.js";
import { fetchWithTimeout } from "./util.js";

const NTFY_PRIORITY = { 1: 3, 2: 4, 3: 5 };
const NTFY_TAGS = { 1: ["information_source"], 2: ["warning"], 3: ["rotating_light"] };
const PUSHOVER_PRIORITY = { 1: 0, 2: 1, 3: 2 };

export function channelStatus() {
  const n = persisted.notify;
  return {
    ntfy: { enabled: !!(n.useNtfy && n.ntfyTopic), topic: n.ntfyTopic || "", server: config.notify.ntfyServer },
    pushover: { enabled: !!(n.usePushover && n.pushoverUserKey && config.notify.pushoverAppToken), appTokenSet: !!config.notify.pushoverAppToken, userKeySet: !!n.pushoverUserKey },
    alarmOptIn: n.alarmOptIn,
  };
}

async function sendNtfy(alert, link) {
  const n = persisted.notify;
  const body = {
    topic: n.ntfyTopic,
    title: alert.title,
    message: alert.message,
    priority: NTFY_PRIORITY[alert.tier],
    tags: NTFY_TAGS[alert.tier],
    click: link,
    actions: [{ action: "view", label: "Open my plan", url: link, clear: true }],
  };
  const r = await fetchWithTimeout(config.notify.ntfyServer + "/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`ntfy ${r.status}`);
  return "sent";
}

async function sendPushover(alert, link) {
  const n = persisted.notify;
  const p = new URLSearchParams({
    token: config.notify.pushoverAppToken,
    user: n.pushoverUserKey,
    title: alert.title.slice(0, 250),
    message: alert.message.slice(0, 1024),
    priority: String(PUSHOVER_PRIORITY[alert.tier]),
    url: link,
    url_title: "Open my plan",
  });
  if (alert.tier === 3) {
    p.set("retry", "60");
    p.set("expire", "900");
    p.set("sound", "siren");
    p.set("callback", `${config.baseUrl}/api/pushover/ack?alert=${alert.id}`);
  }
  const r = await fetchWithTimeout("https://api.pushover.net/1/messages.json", { method: "POST", body: p });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.status !== 1) throw new Error(`pushover ${r.status} ${(j.errors || []).join(" ")}`);
  return "sent";
}

export async function deliver(alert) {
  const link = `${config.baseUrl}/plan?src=${alert.src}&alert=${alert.id}`;
  const st = channelStatus();
  const out = { inApp: "sent" };
  const jobs = [];
  if (st.ntfy.enabled) jobs.push(sendNtfy(alert, link).then((v) => (out.ntfy = v)).catch((e) => (out.ntfy = `failed: ${e.message}`)));
  if (st.pushover.enabled) jobs.push(sendPushover(alert, link).then((v) => (out.pushover = v)).catch((e) => (out.pushover = `failed: ${e.message}`)));
  await Promise.all(jobs);
  if (!st.ntfy.enabled && !st.pushover.enabled) out.phone = "No phone channel set up yet (Settings)";
  return out;
}

export async function sendSimple(tier, title, message, linkPath = "/") {
  const fake = { id: "test", src: "live", tier, title, message };
  const link = config.baseUrl + linkPath;
  const st = channelStatus();
  const out = {};
  if (st.ntfy.enabled) out.ntfy = await sendNtfy(fake, link).catch((e) => `failed: ${e.message}`);
  if (st.pushover.enabled) out.pushover = await sendPushover({ ...fake, tier: Math.min(tier, 3) }, link).catch((e) => `failed: ${e.message}`);
  return out;
}
