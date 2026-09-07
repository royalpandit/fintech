"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiCheck, FiLink, FiLock, FiX } from "react-icons/fi";
import { useToast } from "@/components/toast";

/**
 * Starts the broker connection flow. The button on the portfolio page used to
 * be a bare <button> with no handler, so clicking "Connect Broker" did nothing
 * even though /api/v1/portfolio/connect existed.
 */

/*
 * `domain` drives the logo: each broker's own favicon, served from their own
 * site. Not a third-party favicon service — that would hand every user's
 * broker choice to an unrelated company — and not bundled image files, which
 * would mean shipping other people's trademarks.
 *
 * `color` is the fallback tile behind it: if the favicon 404s, is blocked, or
 * the user is offline, a brand-coloured initial is still recognisable, where
 * the old uniform teal tile made all six look identical.
 */
const BROKERS = [
  { id: "Zerodha", label: "Zerodha", note: "Kite Connect", short: "Z", domain: "zerodha.com", color: "#387ED1" },
  { id: "Angel One", label: "Angel One", note: "SmartAPI", short: "A", domain: "angelone.in", color: "#E8544F" },
  { id: "Upstox", label: "Upstox", note: "Upstox API", short: "U", domain: "upstox.com", color: "#5A4FCF" },
  { id: "Groww", label: "Groww", note: "Manual sync", short: "G", domain: "groww.in", color: "#00B386" },
  { id: "ICICI Direct", label: "ICICI Direct", note: "Breeze API", short: "I", domain: "icicidirect.com", color: "#F37E20" },
  { id: "Other", label: "Other broker", note: "Manual sync", short: "+", domain: null, color: "#64748b" },
];

export default function ConnectBrokerButton({
  label = "Connect Broker",
  connectedBrokers = [],
  variant = "hero",
}: {
  label?: string;
  connectedBrokers?: string[];
  /**
   * "hero" is white-on-dark for the gradient banner at the top of the
   * portfolio page. "solid" is the same button on an ordinary card, where
   * white-on-white would be invisible.
   */
  variant?: "hero" | "solid";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connected = new Set(connectedBrokers);

  async function disconnect(broker: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/portfolio/connect?broker=${encodeURIComponent(broker)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === false) {
        toast.show(json.error || "Couldn't disconnect that broker", "error");
        return;
      }
      // The picker stays open: unlinking is usually the first half of
      // "unlink this one, link that one".
      if (picked === broker) setPicked(null);
      toast.show(`${broker} disconnected — its holdings are hidden`, "success");
      router.refresh();
    } catch {
      toast.show("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

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
        className={`cb-trigger cb-trigger--${variant}`}
      >
        <FiLink size={15} />
        {label}
      </button>

      {open &&
        /*
         * Portalled for the same reason the composer is: this button now also
         * renders inside the Broker Holdings card, deep in the page, and a
         * fixed backdrop resolves against any ancestor carrying a transform or
         * filter. On <body> it always means the viewport.
         */
        createPortal(
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
                  /* A connected broker is a row with its own Disconnect action,
                     so it can no longer be one big <button> - a button inside a
                     button is invalid and the inner one never fires. */
                  <div
                    key={b.id}
                    className={`cb-option${active ? " cb-option-on" : ""}${already ? " cb-option-done" : ""}`}
                  >
                    <button
                      type="button"
                      disabled={already || saving}
                      onClick={() => setPicked(b.id)}
                      className="cb-option-pick"
                      aria-pressed={active}
                    >
                      <span className="cb-option-mark" style={{ background: `${b.color}1f`, color: b.color }}>
                        {b.domain ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://${b.domain}/favicon.ico`}
                            alt=""
                            className="cb-option-logo"
                            loading="lazy"
                            // Hide rather than show a broken-image glyph; the
                            // brand-coloured initial underneath takes over.
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="cb-option-initial" aria-hidden>
                          {b.short}
                        </span>
                      </span>
                      <span className="cb-option-body">
                        <span className="cb-option-name">{b.label}</span>
                        <span className="cb-option-note">
                          {already ? "Connected" : b.note}
                        </span>
                      </span>
                      {!already && (
                        <span className={`cb-radio${active ? " cb-radio-on" : ""}`} aria-hidden>
                          {active && <FiCheck size={11} />}
                        </span>
                      )}
                    </button>

                    {already && (
                      <button
                        type="button"
                        className="cb-disconnect"
                        onClick={() => void disconnect(b.id)}
                        disabled={saving}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
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
          </div>,
          document.body,
        )}
    </>
  );
}
