"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

type ToastCtx = { show: (message: string, kind?: ToastKind) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  // No-op fallback so components using the hook never crash outside a provider.
  return ctx ?? { show: () => {} };
}

let nextId = 1;

const TONE: Record<ToastKind, { bg: string; color: string; icon: string }> = {
  success: { bg: "#065f46", color: "#ecfdf5", icon: "✓" },
  error: { bg: "#7f1d1d", color: "#fef2f2", icon: "!" },
  info: { bg: "#1e3a8a", color: "#eff6ff", icon: "i" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {/* Top-right, sliding in from above and to the side. Position lives in
          .toast-stack in globals.css. */}
      <div className="toast-stack">
        {toasts.map((t) => {
          const tone = TONE[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 240,
                maxWidth: "min(420px, calc(100vw - 32px))",
                padding: "11px 14px",
                borderRadius: 12,
                background: tone.bg,
                color: tone.color,
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
                animation: "toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                pointerEvents: "auto",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.2)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {tone.icon}
              </span>
              {t.message}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translate(10px, -10px); } to { opacity: 1; transform: none; } }`}</style>
    </Ctx.Provider>
  );
}
