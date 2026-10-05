import React, { useEffect, useState } from "react";
import { BellRing, Smartphone, Link2, Upload, Trash2 } from "lucide-react";
import { api, getPass, setPass, ago } from "./lib.js";

function Toggle({ id, label, hint, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
      <input id={id} type="checkbox" className="mt-1 w-4 h-4 accent-[#387ED1]" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm text-strong">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </span>
    </label>
  );
}

const Section = ({ icon: Icon, title, children, sub }) => (
  <section className="panel p-5 sm:p-6">
    <div className="flex items-center gap-2">
      <Icon size={18} className="text-brand" />
      <h2 className="font-semibold text-strong">{title}</h2>
    </div>
    {sub && <p className="text-sm mt-1 max-w-2xl">{sub}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

export default function SettingsPage({ cfg, reloadCfg, snap, setSrc, toast, reload }) {
  const [n, setN] = useState(null);
  const [th, setTh] = useState(null);
  const [pushKey, setPushKey] = useState("");
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (cfg) {
      setN({ ...cfg.notify });
      setTh({ ...cfg.thresholds });
    }
  }, [cfg]);
  if (!cfg || !n) return <div className="panel p-6 text-sm text-mute">Loading settings</div>;

  const call = async (key, fn, ok) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast({ tone: "ok", text: typeof ok === "function" ? ok(r) : ok });
      reloadCfg();
      return r;
    } catch (e) {
      toast({ tone: "bad", text: e.status === 401 ? "Enter the app passcode to change settings (reload and use the live portfolio)." : e.message });
    } finally {
      setBusy(null);
    }
  };

  const saveNotify = () =>
    call("save", () => api("/api/settings", { method: "PUT", body: { notify: { ...n, pushoverUserKey: pushKey || (cfg.notify.pushoverUserKey ? "set" : "") }, thresholds: th } }), "Alert settings saved.");

  const testResult = (r) => {
    const parts = Object.entries(r.result || {}).map(([k, v]) => `${k}: ${v}`);
    return parts.length ? `Test sent. ${parts.join(", ")}` : "No phone channel is on yet. Add an ntfy topic or a Pushover key first, then save.";
  };

  const k = cfg.kite;

  return (
    <div className="space-y-4">
      {cfg.passcodeRequired && <Unlock toast={toast} />}
      <Section icon={Link2} title="Zerodha account" sub="Read-only connection for holdings and mutual funds. Orders are only ever confirmed by you inside Zerodha.">
        <div className="text-sm">
          {!k.configured ? (
            <p>Zerodha keys are not set on the server yet. See the README for the two environment variables and the redirect URL.</p>
          ) : k.connected ? (
            <p>
              Connected as <span className="text-strong font-medium">{k.userName}</span> {k.connectedAt ? `(${ago(k.connectedAt)})` : ""}. The login is valid until tomorrow morning.
            </p>
          ) : (
            <p>Not connected today. Zerodha logins expire every morning.</p>
          )}
          <p className="text-xs text-mute mt-1">
            Live prices: {k.marketData ? "Zerodha market data plan" : "holdings prices refresh every minute; index levels from a public feed (may be delayed)"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {k.configured && (
            <a className="btn-primary" href={`/api/kite/login?pass=${encodeURIComponent(getPass())}`}>
              {k.connected ? "Log in again" : "Log in with Zerodha"}
            </a>
          )}
          {k.connected && (
            <>
              <button className="btn-ghost" disabled={!!busy} onClick={() => call("sync", () => api("/api/kite/sync", { method: "POST" }), "Holdings synced.").then(() => { setSrc("live"); reload(); })}>
                Sync holdings now
              </button>
              <button className="btn-ghost" disabled={!!busy} onClick={() => call("out", () => api("/api/kite/logout", { method: "POST" }), "Disconnected from Zerodha.")}>
                Disconnect
              </button>
            </>
          )}
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-sm text-strong">Exact tax: upload your tradebook</p>
          <p className="text-xs text-mute">Zerodha shares average price but not purchase dates. Download the tradebook CSV from Console (Reports, Tradebook) so we can tell short-term from long-term gains.</p>
          <label className="btn-ghost mt-2 cursor-pointer">
            <Upload size={15} /> Choose tradebook CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.append("file", f);
                call("tb", () => api("/api/tradebook", { method: "POST", form }), (r) => `Tradebook loaded for ${r.symbols} symbols.`);
              }}
            />
          </label>
        </div>
      </Section>

      <Section icon={Smartphone} title="Phone alerts" sub="Info and priority alerts arrive as normal notifications. Alarms ring through silent mode and keep ringing until you open them.">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Toggle id="ntfy" label="ntfy (free, best on Android)" checked={n.useNtfy} onChange={(v) => setN({ ...n, useNtfy: v })} />
            <label className="label block" htmlFor="topic">Your private topic name</label>
            <div className="flex gap-2">
              <input id="topic" className="input" value={n.ntfyTopic} onChange={(e) => setN({ ...n, ntfyTopic: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} placeholder="finlit-yourname-8k2p" />
              <button className="btn-ghost !px-3" onClick={() => setN({ ...n, ntfyTopic: `finlit-${Math.random().toString(36).slice(2, 10)}`, useNtfy: true })}>
                Make one
              </button>
            </div>
            <ol className="text-xs text-mute list-decimal pl-4 space-y-0.5">
              <li>Install the ntfy app and subscribe to this exact topic name.</li>
              <li>In the topic's notification settings, allow it to override Do Not Disturb and pick an alarm sound for max priority.</li>
              <li>Treat the topic name like a password. Anyone who knows it can read your alerts.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <Toggle id="po" label="Pushover (best on iPhone, rings through mute)" checked={n.usePushover} onChange={(v) => setN({ ...n, usePushover: v })} />
            <label className="label block" htmlFor="pokey">Your Pushover user key</label>
            <input id="pokey" className="input" value={pushKey} onChange={(e) => setPushKey(e.target.value.trim())} placeholder={cfg.notify.pushoverUserKey ? "Saved. Type to replace." : "Your 30-character user key"} />
            <p className="text-xs text-mute">
              {cfg.channels.pushover.appTokenSet ? "Server app token is set." : "The server also needs PUSHOVER_APP_TOKEN (see README)."} In the Pushover app, enable Critical Alerts so alarms sound through the mute switch.
            </p>
          </div>
        </div>
        <div className="border-t border-line pt-4 grid md:grid-cols-2 gap-4">
          <Toggle id="alarm" label="Allow alarm-level alerts" hint="Off means alarms are sent as priority alerts instead." checked={n.alarmOptIn} onChange={(v) => setN({ ...n, alarmOptIn: v })} />
          <Toggle id="any" label="Allow alarms outside market hours" hint={`Otherwise alarms only ring between ${n.alarmFrom} and ${n.alarmTo}.`} checked={n.alarmAnyTime} onChange={(v) => setN({ ...n, alarmAnyTime: v })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!!busy} onClick={saveNotify}>Save alert settings</button>
          <button className="btn-ghost text-down" disabled={!!busy} onClick={() => call("t3", () => api("/api/notify/test", { method: "POST", body: { tier: 3 } }), testResult)}>
            <BellRing size={15} /> Send test alarm
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => call("t2", () => api("/api/notify/test", { method: "POST", body: { tier: 2 } }), testResult)}>
            Send test notification
          </button>
          {"Notification" in window && Notification.permission !== "granted" && (
            <button className="btn-ghost" onClick={() => Notification.requestPermission().then(() => reloadCfg())}>
              Allow browser notifications
            </button>
          )}
        </div>
        <p className="text-xs text-mute">Save first, then send a test. Keep this tab open too: alarms also sound here while the app is open.</p>
      </Section>

      <Section icon={BellRing} title="When to alert" sub="Tune the thresholds. Defaults are chosen to stay quiet on normal days.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ["infoPortfolioPct", "Info alert when portfolio falls", "%"],
            ["priorityPortfolioPct", "Priority alert when portfolio falls", "%"],
            ["niftyInfoPct", "Info alert when Nifty falls", "%"],
            ["vixPriority", "Priority alert when India VIX reaches", ""],
            ["alarmWeightPct", "Alarm only for holdings at least", "% of portfolio"],
            ["maxAlarmsPerDay", "Most alarms in a day", ""],
          ].map(([key, label, suf]) => (
            <div key={key}>
              <label className="text-sm text-strong" htmlFor={key}>{label}</label>
              <div className="flex items-center gap-2 mt-1">
                <input id={key} type="number" className="input num" value={th[key]} onChange={(e) => setTh({ ...th, [key]: Number(e.target.value) })} />
                <span className="text-xs text-mute whitespace-nowrap">{suf}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" disabled={!!busy} onClick={saveNotify}>Save thresholds</button>
      </Section>

      <Section icon={Trash2} title="Your data" sub="We keep your Zerodha login token encrypted on the server, plus your plan, alerts and decisions. Nothing is shared or sold.">
        <button
          className="btn-ghost text-down"
          onClick={() => {
            if (window.confirm("Delete your Zerodha connection, plan, alerts and decisions from this server?")) call("del", () => api("/api/data", { method: "DELETE" }), "All your data is deleted.").then(reload);
          }}
        >
          Delete my data
        </button>
      </Section>
    </div>
  );
}

function Unlock({ toast }) {
  const [p, setP] = useState(getPass());
  return (
    <form
      className="panel p-4 flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPass(p);
        const r = await api("/api/auth/check", { method: "POST", body: { pass: p } }).catch(() => ({ ok: false }));
        toast({ tone: r.ok ? "ok" : "bad", text: r.ok ? "Settings unlocked." : "That passcode did not match." });
      }}
    >
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="unlock" className="text-sm text-strong">App passcode</label>
        <p className="text-xs text-mute">Needed to change alerts or touch the Zerodha connection.</p>
        <input id="unlock" type="password" className="input mt-1" value={p} onChange={(e) => setP(e.target.value)} />
      </div>
      <button className="btn-ghost" type="submit">Unlock</button>
    </form>
  );
}
