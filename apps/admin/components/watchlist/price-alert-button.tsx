"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBell, FiTrash2, FiX } from "react-icons/fi";
import { useToast } from "@/components/toast";

type Alert = {
  id: number;
  symbol: string;
  target_price: number;
  direction: string;
  is_triggered: boolean;
};

/**
 * Set a price alert on a symbol. The `PriceAlert` table had no UI at all before
 * this — alerts are evaluated by the cron price-alert job during market hours.
 */
export default function PriceAlertButton({
  symbol,
  lastPrice,
  compact = false,
}: {
  symbol: string;
  lastPrice?: number | null;
  compact?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [price, setPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [saving, setSaving] = useState(false);

  const mine = alerts.filter(
    (a) => !a.is_triggered && a.symbol.toUpperCase() === symbol.toUpperCase(),
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/user/price-alerts", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.data)) setAlerts(json.data);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Seed with the current price so the user only has to nudge it.
    if (open && !price && lastPrice) setPrice(String(lastPrice));
  }, [open, price, lastPrice]);

  async function create() {
    const target = Number(price);
    if (!Number.isFinite(target) || target <= 0) {
      toast.show("Enter a valid target price", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/user/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, targetPrice: target, direction }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === false) {
        toast.show(json.error || "Couldn't create the alert", "error");
        return;
      }
      toast.show(
        `Alert set — ${symbol} ${direction} ₹${target.toLocaleString("en-IN")}`,
        "success",
      );
      setPrice("");
      await load();
    } catch {
      toast.show("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(`/api/v1/user/price-alerts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.show("Alert removed", "info");
    } catch {
      toast.show("Couldn't remove that alert", "error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mkt-add-wl${compact ? " mkt-add-wl-compact" : ""}${mine.length ? " mkt-add-wl-on" : ""}`}
        title={mine.length ? `${mine.length} alert(s) on ${symbol}` : `Set a price alert on ${symbol}`}
      >
        <FiBell size={compact ? 16 : 14} style={mine.length ? { fill: "currentColor" } : undefined} />
        {!compact && <span>{mine.length ? `Alerts (${mine.length})` : "Alert"}</span>}
      </button>

      {open && (
        <div className="cb-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="cb-modal"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="cb-head">
              <span className="cb-head-icon" aria-hidden>
                <FiBell size={17} />
              </span>
              <div className="cb-head-text">
                <h3>Price alert · {symbol}</h3>
                <p>
                  We&apos;ll notify you when the price crosses your target during market
                  hours.
                </p>
              </div>
              <button type="button" className="cb-close" onClick={() => setOpen(false)} aria-label="Close">
                <FiX size={17} />
              </button>
            </header>

            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="pa-input"
                style={{ flex: "0 0 110px" }}
              >
                <option value="above">Rises above</option>
                <option value="below">Falls below</option>
              </select>
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Target ₹"
                className="pa-input"
                style={{ flex: 1 }}
              />
            </div>

            {mine.length > 0 && (
              <div className="pa-list">
                {mine.map((a) => (
                  <div key={a.id} className="pa-row">
                    <span>
                      {a.direction === "above" ? "Above" : "Below"} ₹
                      {a.target_price.toLocaleString("en-IN")}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(a.id)}
                      aria-label="Remove alert"
                      className="pa-del"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <footer className="cb-actions">
              <button type="button" className="cb-btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="cb-btn-primary"
                disabled={saving || !price}
                onClick={() => void create()}
              >
                {saving ? "Saving…" : "Set alert"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
