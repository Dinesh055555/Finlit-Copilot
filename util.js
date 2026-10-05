import crypto from "node:crypto";

export const uid = (p = "") => p + crypto.randomBytes(6).toString("hex");

export const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

// India Standard Time helpers (UTC+05:30, no daylight saving)
export function istParts(d = new Date()) {
  const t = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return { day: t.getUTCDay(), hour: t.getUTCHours(), minute: t.getUTCMinutes(), date: t.toISOString().slice(0, 10) };
}

export function istMinutes(d = new Date()) {
  const p = istParts(d);
  return p.hour * 60 + p.minute;
}

// NSE equity session 09:15 to 15:30 IST, Monday to Friday. Exchange holidays are not modelled.
export function isMarketOpen(d = new Date()) {
  const p = istParts(d);
  if (p.day === 0 || p.day === 6) return false;
  const m = p.hour * 60 + p.minute;
  return m >= 9 * 60 + 15 && m <= 15 * 60 + 30;
}

export function isWithin(d, fromHHMM, toHHMM) {
  const m = istMinutes(d);
  const [fh, fm] = fromHHMM.split(":").map(Number);
  const [th, tm] = toHHMM.split(":").map(Number);
  return m >= fh * 60 + fm && m <= th * 60 + tm;
}

export const todayIST = () => istParts().date;

// AES-256-GCM for storing the Zerodha access token at rest
export function encrypt(text, keyMaterial) {
  if (!keyMaterial) return { plain: text };
  const key = crypto.createHash("sha256").update(keyMaterial).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: enc.toString("base64") };
}

export function decrypt(obj, keyMaterial) {
  if (!obj) return null;
  if (obj.plain) return obj.plain;
  const key = crypto.createHash("sha256").update(keyMaterial).digest();
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(obj.iv, "base64"));
  d.setAuthTag(Buffer.from(obj.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(obj.data, "base64")), d.final()]).toString("utf8");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
