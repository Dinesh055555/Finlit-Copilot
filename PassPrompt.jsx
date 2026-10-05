import React, { useState } from "react";

export default function PassPrompt({ onSubmit, onDemo }) {
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <form
        className="panel p-6 w-full max-w-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(!(await onSubmit(p).catch(() => false)));
        }}
      >
        <img src="/icon.svg" alt="" className="w-9 h-9" />
        <h1 className="text-lg font-semibold text-strong mt-3">Enter the app passcode</h1>
        <p className="text-sm mt-1">The live portfolio and alert settings are protected because they connect to a real Zerodha account.</p>
        <label htmlFor="pass" className="label block mt-4">Passcode</label>
        <input id="pass" type="password" className="input mt-1" value={p} onChange={(e) => setP(e.target.value)} autoFocus />
        {err && <p className="text-sm text-down mt-2">That passcode did not match.</p>}
        <button className="btn-primary w-full mt-4" type="submit">Unlock</button>
        <button type="button" className="btn-ghost w-full mt-2" onClick={onDemo}>Use a demo portfolio instead</button>
      </form>
    </div>
  );
}
