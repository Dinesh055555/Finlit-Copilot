// API helpers and number formatting

const passKey = "finlit-pass";
export const getPass = () => {
  try {
    return localStorage.getItem(passKey) || "";
  } catch {
    return "";
  }
};
export const setPass = (p) => {
  try {
    localStorage.setItem(passKey, p);
  } catch {}
};

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = { "x-app-pass": getPass() };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const r = await fetch(path, { method, headers, body: payload });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return j;
}

export function stream(src, handlers) {
  const es = new EventSource(`/api/stream?src=${src}&pass=${encodeURIComponent(getPass())}`);
  for (const [ev, fn] of Object.entries(handlers)) es.addEventListener(ev, (e) => fn(JSON.parse(e.data || "{}")));
  return () => es.close();
}

export const inr = (n, d = 0) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export function inrShort(n) {
  const a = Math.abs(n || 0);
  const s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  return `${s}₹${Math.round(a).toLocaleString("en-IN")}`;
}

export const pct = (n, d = 2) => `${n > 0 ? "+" : ""}${Number(n || 0).toFixed(d)}%`;
export const tone = (n) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-mute");

export function ago(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const REASONS = [
  { id: "worried", label: "I'm worried about the market" },
  { id: "need", label: "I need the money for something" },
  { id: "goal", label: "I've reached my goal" },
  { id: "moving", label: "I'm moving it somewhere else" },
  { id: "alert", label: "I'm reacting to an alert" },
];

// Alarm sound for tier 3 alerts while the app is open
let ctx = null;
let alarmTimer = null;
export function startAlarmSound() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    };
    stopAlarmSound();
    beep();
    alarmTimer = setInterval(beep, 700);
  } catch {}
}
export function stopAlarmSound() {
  clearInterval(alarmTimer);
  alarmTimer = null;
}

export function browserNotify(alert) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const n = new Notification(alert.title, { body: alert.message, icon: "/icon.svg", requireInteraction: alert.tier === 3 });
    n.onclick = () => {
      window.focus();
      window.location.href = `/plan?src=${alert.src}&alert=${alert.id}`;
    };
  } catch {}
}
