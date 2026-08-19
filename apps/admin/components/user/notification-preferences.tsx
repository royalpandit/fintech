"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import PushEnable from "@/components/user/push-enable";

export type NotificationPrefs = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  marketAlerts: boolean;
  portfolioAlerts: boolean;
  budgetAlerts: boolean;
  socialAlerts: boolean;
  advisorAlerts: boolean;
};

type Key = keyof NotificationPrefs;

const CHANNELS: { key: Key; label: string; hint: string }[] = [
  { key: "inAppEnabled", label: "In-app", hint: "Bell and notifications page" },
  { key: "pushEnabled", label: "Push", hint: "Browser / device push" },
  { key: "emailEnabled", label: "Email", hint: "Sent to your account email" },
];

const CATEGORIES: { key: Key; label: string; hint: string }[] = [
  { key: "marketAlerts", label: "Market sentiment alerts", hint: "Trade calls and status changes" },
  { key: "portfolioAlerts", label: "Portfolio risk alerts", hint: "Holdings and paper orders" },
  { key: "budgetAlerts", label: "Budget breach alerts", hint: "Wallet and spend limits" },
  { key: "advisorAlerts", label: "Followed advisor activity", hint: "New posts from advisors you follow" },
  { key: "socialAlerts", label: "Comments and replies", hint: "Likes, comments and mentions" },
];

/**
 * Toggles save on change — the previous markup was uncontrolled
 * `defaultChecked` inputs inside a server component with no handler and no
 * endpoint, so nothing persisted and every toggle reverted on refresh.
 */
export default function NotificationPreferences({ initial }: { initial: NotificationPrefs }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [busy, setBusy] = useState<Key | null>(null);

  async function toggle(key: Key, label: string) {
    if (busy) return;
    const next = !prefs[key];
    setBusy(key);
    setPrefs((p) => ({ ...p, [key]: next })); // optimistic

    try {
      const res = await fetch("/api/v1/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === false) throw new Error(json.error || "Save failed");

      // Trust the server's copy so the UI can't drift from what's stored.
      if (json.preferences) setPrefs(json.preferences as NotificationPrefs);
      toast.show(`${label} ${next ? "on" : "off"}`, "success");
    } catch (e) {
      setPrefs((p) => ({ ...p, [key]: !next })); // roll back
      toast.show(e instanceof Error ? e.message : "Couldn't save that setting", "error");
    } finally {
      setBusy(null);
    }
  }

  function renderRow(row: { key: Key; label: string; hint: string }) {
    const on = prefs[row.key];
    // In-app off means the bell goes quiet — worth saying out loud.
    const muted = row.key !== "inAppEnabled" && !prefs.inAppEnabled;
    return (
      <button
        key={row.key}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy === row.key}
        onClick={() => void toggle(row.key, row.label)}
        className={`np-row${on ? " np-row-on" : ""}`}
      >
        <span className="np-row-text">
          <span className="np-row-label">{row.label}</span>
          <span className="np-row-hint">
            {muted && on ? "Enabled, but in-app delivery is off" : row.hint}
          </span>
        </span>
        <span className={`np-switch${on ? " np-switch-on" : ""}`} aria-hidden>
          <span className="np-knob" />
        </span>
      </button>
    );
  }

  return (
    <>
      <p className="np-heading">Channels</p>
      <div className="np-group">{CHANNELS.map(renderRow)}</div>

      {/* The Push switch above stores a preference; a browser still has to be
          granted permission and registered, which this handles. */}
      {prefs.pushEnabled && <PushEnable />}

      <p className="np-heading" style={{ marginTop: 18 }}>
        Categories
      </p>
      <div className="np-group">{CATEGORIES.map(renderRow)}</div>
    </>
  );
}
