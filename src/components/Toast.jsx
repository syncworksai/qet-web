// src/components/Toast.jsx
import React, { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext(null);
export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-3 py-2 rounded-xl border text-sm shadow"
            style={{
              background: "rgba(12,14,18,0.92)",
              borderColor:
                t.type === "error"
                  ? "rgba(248,113,113,0.4)"
                  : t.type === "success"
                  ? "rgba(16,185,129,0.4)"
                  : "rgba(59,130,246,0.3)",
              color:
                t.type === "error"
                  ? "#fecaca"
                  : t.type === "success"
                  ? "#bbf7d0"
                  : "#dbeafe",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
