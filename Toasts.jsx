import React from "react";

const TONE = {
  ok: "border-l-up",
  bad: "border-l-down",
  warn: "border-l-amber",
  info: "border-l-brand",
};

export default function Toasts({ items, onOpen }) {
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-[380px]" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`bg-white shadow-pop rounded border border-line border-l-4 ${TONE[t.tone] || TONE.info} p-3 sheet-in`}>
          {t.title && <p className="text-sm font-medium text-strong">{t.title}</p>}
          <p className="text-sm">{t.text}</p>
          {t.alert && (
            <button className="text-sm text-brand font-medium mt-1" onClick={() => onOpen(t.alert)}>
              Open my plan
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
