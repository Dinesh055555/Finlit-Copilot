import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, stream, getPass, setPass, startAlarmSound, stopAlarmSound, browserNotify } from "./lib.js";
import TopBar from "./TopBar.jsx";
import NewsPanel from "./NewsPanel.jsx";
import Dashboard from "./Dashboard.jsx";
import PlanSheet from "./PlanSheet.jsx";
import AlertsPage from "./AlertsPage.jsx";
import CharterPage from "./CharterPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import AlarmOverlay from "./AlarmOverlay.jsx";
import Toasts from "./Toasts.jsx";
import PassPrompt from "./PassPrompt.jsx";

const params = new URLSearchParams(window.location.search);
const initialSrc = params.get("src") || (() => {
  try {
    return localStorage.getItem("finlit-src") || "rohan";
  } catch {
    return "rohan";
  }
})();

export default function App() {
  const [src, setSrcState] = useState(["rohan", "meera", "live"].includes(initialSrc) ? initialSrc : "rohan");
  const [page, setPage] = useState("dashboard");
  const [cfg, setCfg] = useState(null);
  const [snap, setSnap] = useState(null);
  const [needPass, setNeedPass] = useState(false);
  const [plan, setPlan] = useState(
    window.location.pathname.startsWith("/plan") ? { alertId: params.get("alert"), reason: params.get("alert") ? "alert" : null } : null
  );
  const [alarm, setAlarm] = useState(null);
  const [toasts, setToasts] = useState([]);
  const refreshTimer = useRef(null);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.ms || 6000);
  }, []);

  const setSrc = (s) => {
    setSrcState(s);
    setPlan(null);
    try {
      localStorage.setItem("finlit-src", s);
    } catch {}
  };

  const loadCfg = useCallback(() => api("/api/config").then(setCfg).catch(() => {}), []);

  const load = useCallback(async () => {
    try {
      const s = await api(`/api/state?src=${src}`);
      setSnap(s);
      setNeedPass(false);
    } catch (e) {
      if (e.status === 401) setNeedPass(true);
    }
  }, [src]);

  const softRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(load, 250);
  }, [load]);

  useEffect(() => {
    loadCfg();
    if (params.get("kite") === "connected") toast({ tone: "ok", text: "Zerodha connected. Your watch has started." });
    if (params.get("kite") === "failed") toast({ tone: "bad", text: "Zerodha login did not complete. Try again from Settings." });
    if (params.get("kite")) window.history.replaceState({}, "", "/");
  }, [loadCfg, toast]);

  useEffect(() => {
    setSnap(null);
    load();
    if (needPass) return;
    const close = stream(src, {
      refresh: softRefresh,
      news: softRefresh,
      tick: softRefresh,
      alert: (a) => {
        softRefresh();
        browserNotify(a);
        if (a.tier === 3) {
          setAlarm(a);
          startAlarmSound();
        } else toast({ tone: a.tier === 2 ? "warn" : "info", title: a.title, text: a.message, alert: a, ms: 9000 });
      },
      alert_update: softRefresh,
    });
    return close;
  }, [src, load, softRefresh, toast, needPass]);

  const openPlan = (req = {}) => {
    stopAlarmSound();
    setAlarm(null);
    setPlan(req);
    window.history.replaceState({}, "", `/plan?src=${src}${req.alertId ? `&alert=${req.alertId}` : ""}`);
  };
  const closePlan = () => {
    setPlan(null);
    window.history.replaceState({}, "", "/");
    load();
  };

  const ackAlarm = async () => {
    stopAlarmSound();
    if (alarm) await api(`/api/alerts/${alarm.id}/ack`, { method: "POST" }).catch(() => {});
    setAlarm(null);
    load();
  };

  if (needPass)
    return (
      <PassPrompt
        onSubmit={async (p) => {
          setPass(p);
          const r = await api("/api/auth/check", { method: "POST", body: { pass: p } });
          if (r.ok) {
            setNeedPass(false);
            load();
          }
          return r.ok;
        }}
        onDemo={() => setSrc("rohan")}
      />
    );

  return (
    <div className="min-h-full flex flex-col">
      <TopBar cfg={cfg} snap={snap} src={src} setSrc={setSrc} page={page} setPage={setPage} />
      <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row gap-4 p-3 sm:p-4">
        <aside className="lg:w-[380px] lg:shrink-0 order-2 lg:order-1">
          <NewsPanel snap={snap} onRefresh={async () => { await api("/api/news/refresh", { method: "POST" }).catch(() => {}); load(); }} />
        </aside>
        <section className="flex-1 min-w-0 order-1 lg:order-2">
          {page === "dashboard" && <Dashboard snap={snap} src={src} cfg={cfg} setSrc={setSrc} onPlan={openPlan} toast={toast} reload={load} />}
          {page === "alerts" && <AlertsPage snap={snap} onPlan={openPlan} />}
          {page === "charter" && <CharterPage snap={snap} src={src} reload={load} toast={toast} />}
          {page === "settings" && <SettingsPage cfg={cfg} reloadCfg={loadCfg} snap={snap} src={src} setSrc={setSrc} toast={toast} reload={load} />}
        </section>
      </main>
      <footer className="text-xs text-mute text-center px-4 pb-6 pt-2">
        FinLit Co-Pilot is decision support, not investment advice. You make every final decision in your own broker account.
      </footer>
      {plan && snap && <PlanSheet src={src} snap={snap} req={plan} onClose={closePlan} toast={toast} />}
      {alarm && <AlarmOverlay alert={alarm} onOpen={() => openPlan({ alertId: alarm.id, reason: "alert" })} onAck={ackAlarm} />}
      <Toasts items={toasts} onOpen={(a) => openPlan({ alertId: a.id, reason: "alert" })} />
    </div>
  );
}
