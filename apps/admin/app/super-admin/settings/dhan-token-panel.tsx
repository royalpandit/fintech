"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Set the Dhan access token without touching the environment.
 *
 * The token expires every 24 hours. Previously that meant editing .env and
 * restarting (locally) or redeploying the whole app (on Vercel) once a day for
 * a string with a one-day life — and because nothing checked the expiry, the
 * first sign it had lapsed was an empty Markets tab.
 *
 * So: paste, save, done. The server proves the token works before keeping it,
 * and the countdown here says when the next rotation is due.
 */

type Status = {
  present: boolean;
  valid: boolean;
  source: "database" | "session-file" | "env" | "none";
  expiresAt: number | null;
  expiresInMs: number | null;
  masked: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

const SOURCE_LABEL: Record<Status["source"], string> = {
  database: "Set from this panel",
  "session-file": "Local session file",
  env: "Environment variable",
  none: "Not configured",
};

function countdown(ms: number): string {
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours >= 1) return `${hours}h ${mins % 60}m left`;
  return `${mins}m left`;
}

export default function DhanTokenPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [storageReady, setStorageReady] = useState(true);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/dhan/token", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setStatus(json.status);
        setStorageReady(json.storageReady !== false);
      }
    } catch {
      /* the panel is not worth an error of its own if it cannot poll */
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Slow tick purely so the countdown does not go stale while the tab is open.
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function save() {
    setError("");
    setDone("");
    setBusy(true);
    try {
      const res = await fetch("/api/v1/admin/dhan/token", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Could not save the token.");
        return;
      }
      setStatus(json.status);
      setToken("");
      setDone("Token verified against Dhan and saved. Live prices are back.");
    } catch {
      setError("Network error while saving.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setError("");
    setDone("");
    setBusy(true);
    try {
      const res = await fetch("/api/v1/admin/dhan/token", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setStatus(json.status);
        setDone("Stored token removed. Falling back to the environment variable.");
      }
    } finally {
      setBusy(false);
    }
  }

  const expired = status?.present && !status.valid;

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Dhan Market Data Token</h3>
        <span className={`tag ${!status?.present ? "danger" : expired ? "danger" : "success"}`}>
          {!status?.present ? "Not configured" : expired ? "Expired" : "Active"}
        </span>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
        Dhan tokens last 24 hours. Paste a new one here and it takes effect on
        the next request — no redeploy, no restart. While it is expired, Markets
        falls back to delayed Yahoo prices and paper trading is paused.
      </p>

      {!storageReady && (
        <div className="dtp-note dtp-note--warn">
          Set <code>CREDENTIAL_SECRET</code> (or <code>JWT_SECRET</code>) in the
          environment before saving — without one there is no key to encrypt the
          token with, and it cannot be stored safely.
        </div>
      )}

      {status?.present && (
        <div className="dtp-facts">
          <div>
            <span>Token</span>
            <strong style={{ fontFamily: "monospace" }}>{status.masked}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{SOURCE_LABEL[status.source]}</strong>
          </div>
          <div>
            <span>Expires</span>
            <strong className={expired ? "dtp-bad" : undefined}>
              {status.expiresAt
                ? `${new Date(status.expiresAt).toLocaleString("en-IN")} · ${countdown(status.expiresInMs ?? 0)}`
                : "Unknown (not a readable JWT)"}
            </strong>
          </div>
          {status.updatedBy && (
            <div>
              <span>Last set by</span>
              <strong>
                {status.updatedBy}
                {status.updatedAt ? ` · ${new Date(status.updatedAt).toLocaleString("en-IN")}` : ""}
              </strong>
            </div>
          )}
        </div>
      )}

      <label className="dtp-label" htmlFor="dhan-token">
        New access token
      </label>
      <textarea
        id="dhan-token"
        className="input dtp-input"
        rows={3}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste the token from Dhan → Profile → DhanHQ Trading APIs → Generate Access Token"
        spellCheck={false}
        autoComplete="off"
      />

      {error && <p className="dtp-note dtp-note--error">{error}</p>}
      {done && <p className="dtp-note dtp-note--ok">{done}</p>}

      <div className="dtp-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void save()}
          disabled={busy || !token.trim() || !storageReady}
        >
          {busy ? "Verifying…" : "Verify & save"}
        </button>
        {status?.source === "database" && (
          <button type="button" className="btn-secondary" onClick={() => void clear()} disabled={busy}>
            Remove stored token
          </button>
        )}
      </div>
    </article>
  );
}
