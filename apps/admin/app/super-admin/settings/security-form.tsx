"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";

const POLICIES = [
  "Enforce 2FA for all admins",
  "Require IP allowlisting for sensitive actions",
  "Enable immutable audit log retention",
];

const STORAGE_KEY = "finuer.settings.security.v1";

type State = {
  sessionTimeout: string;
  failedLoginThreshold: string;
  policies: Record<string, boolean>;
};

const DEFAULT: State = {
  sessionTimeout: "30",
  failedLoginThreshold: "5",
  policies: Object.fromEntries(POLICIES.map((p) => [p, true])),
};

export default function SecurityForm() {
  const { show } = useToast();
  const [state, setState] = useState<State>(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...DEFAULT, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    setSaving(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      show("Security policies updated");
    } catch {
      show("Couldn't save policies", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
        <label>
          <p className="metric-label" style={{ margin: "0 0 6px" }}>
            Session Timeout (minutes)
          </p>
          <input
            className="input"
            value={state.sessionTimeout}
            onChange={(e) => setState((p) => ({ ...p, sessionTimeout: e.target.value }))}
          />
        </label>
        <label>
          <p className="metric-label" style={{ margin: "0 0 6px" }}>
            Failed Login Threshold
          </p>
          <input
            className="input"
            value={state.failedLoginThreshold}
            onChange={(e) => setState((p) => ({ ...p, failedLoginThreshold: e.target.value }))}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {POLICIES.map((policy) => (
          <label key={policy} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              className="toggle"
              checked={state.policies[policy] ?? false}
              onChange={(e) =>
                setState((p) => ({ ...p, policies: { ...p.policies, [policy]: e.target.checked } }))
              }
            />
            {policy}
          </label>
        ))}
      </div>

      <button className="btn-primary" style={{ marginTop: 14 }} type="button" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Update Security Policies"}
      </button>
    </>
  );
}
