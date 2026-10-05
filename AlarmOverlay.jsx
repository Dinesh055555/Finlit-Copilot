import React, { useEffect, useRef } from "react";
import { Siren } from "lucide-react";

export default function AlarmOverlay({ alert, onOpen, onAck }) {
  const btn = useRef(null);
  useEffect(() => btn.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-50 bg-strong/50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="alarm-title" aria-describedby="alarm-msg">
      <div className="bg-white rounded-lg shadow-pop max-w-md w-full p-6 sheet-in">
        <div className="w-14 h-14 rounded-full bg-down text-white flex items-center justify-center ring-pulse">
          <Siren size={26} />
        </div>
        <h2 id="alarm-title" className="text-lg font-semibold text-strong mt-4">{alert.title}</h2>
        <p id="alarm-msg" className="text-sm mt-2 leading-relaxed">{alert.message}</p>
        <p className="text-xs text-mute mt-3">This is specific to a stock you own, so it is worth 30 seconds now. Nothing has been sold.</p>
        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button ref={btn} className="btn-primary flex-1" onClick={onOpen}>Open my plan</button>
          <button className="btn-ghost flex-1" onClick={onAck}>Stop the alarm</button>
        </div>
      </div>
    </div>
  );
}
