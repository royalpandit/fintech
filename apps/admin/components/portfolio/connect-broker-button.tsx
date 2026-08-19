"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheck, FiLink, FiLock, FiX } from "react-icons/fi";
import { useToast } from "@/components/toast";

/**
 * Starts the broker connection flow. The button on the portfolio page used to
 * be a bare <button> with no handler, so clicking "Connect Broker" did nothing
 * even though /api/v1/portfolio/connect existed.
 */

const BROKERS = [
  { id: "Zerodha", label: "Zerodha", note: "Kite Connect", short: "Z" },
  { id: "Angel One", label: "Angel One", note: "SmartAPI", short: "A" },
  { id: "Upstox", label: "Upstox", note: "Upstox API", short: "U" },
  { id: "Groww", label: "Groww", note: "Manual sync", short: "G" },
  { id: "ICICI Direct", label: "ICICI Direct", note: "Breeze API", short: "I" },
  { id: "Other", label: "Other broker", note: "Manual sync", short: "+" },
];

export default function ConnectBrokerButton({
  label = "Connect Broker",
  connectedBrokers = [],
}: {
  label?: string;
  connectedBrokers?: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connected = new Set(connectedBrokers);

  async function connect() {
    if (!picked || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/portfolio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker_name: picked }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === false) {
        toast.show(json.error || "Couldn't connect that broker", "error");
        return;
      }
      setOpen(false);
      setPicked(null);
      toast.show(`${picked} connected — holdings will sync shortly`, "success");
      router.refresh();
    } catch {
      toast.show("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "12px 22px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.95)",
          color: "#064e3b",
          fontWeight: 600,
          fontSize: 14,
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <FiLink size={15} />
        {label}
      </button>

      {open && (
        <div className="cb-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="cb-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cb-title"
          >
            <header className="cb-head">
              <span className="cb-head-icon" aria-hidden>
                <FiLink size={17} />
              </span>
              <div className="cb-head-text">
                <h3 id="cb-title">Connect your broker</h3>
                <p>Sync your holdings automatically. Disconnect any time.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="cb-close"
              >
                <FiX size={17} />
              </button>
            </header>

            <div className="cb-list">
              {BROKERS.map((b) => {
                const already = connected.has(b.id);
                const active = picked === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={already}
                    onClick={() => setPicked(b.id)}
                    className={`cb-option${active ? " cb-option-on" : ""}${already ? " cb-option-done" : ""}`}
                    aria-pressed={active}
                  >
                    <span className="cb-option-mark" aria-hidden>
                      {b.short}
                    </span>
                    <span className="cb-option-body">
                      <span className="cb-option-name">{b.label}</span>
                      <span className="cb-option-note">{b.note}</span>
                    </span>
                    {already ? (
                      <span className="cb-option-tag">
                        <FiCheck size={11} /> Connected
                      </span>
                    ) : (
                      <span className={`cb-radio${active ? " cb-radio-on" : ""}`} aria-hidden>
                        {active && <FiCheck size={11} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="cb-secure">
              <FiLock size={12} /> Read-only access. We never place orders on your behalf.
            </p>

            <footer className="cb-actions">
              <button type="button" className="cb-btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cb-btn-primary"
                disabled={!picked || saving}
                onClick={() => void connect()}
              >
                {saving ? "Connecting…" : picked ? `Connect ${picked}` : "Connect"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
