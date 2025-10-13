// src/components/ContextMenu.jsx
import React, { useEffect, useRef } from "react";

export default function ContextMenu({ open, x, y, onClose, items=[] }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [onClose]);

  if (!open) return null;
  return (
    <div ref={ref} className="fixed z-[80] rounded-lg border border-white/15 bg-[#0b0f17] text-sm shadow-xl"
         style={{ left: x, top: y, minWidth: 180 }}>
      {items.map((it, idx) => (
        <button key={idx}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.06]"
          onClick={() => { it.onClick?.(); onClose?.(); }}>
          {it.icon && <span className="mr-2">{it.icon}</span>}
          {it.label}
        </button>
      ))}
    </div>
  );
}
