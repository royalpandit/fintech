"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";

/**
 * Registers this browser for web push: service worker → permission →
 * PushManager.subscribe → store the endpoint server-side.
 *
 * The "Push" switch in settings only records a *preference*; a browser also has
 * to be granted permission and registered, which is what this does.
 */

/** VAPID public key must reach PushManager.subscribe as a Uint8Array. */
function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Build on an explicit ArrayBuffer — PushManager wants BufferSource, and a
  // bare Uint8Array can be backed by SharedArrayBuffer as far as TS knows.
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "unconfigured";

export default function PushEnable() {
  const toast = useToast();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    try {
      const res = await fetch("/api/v1/user/push-subscription", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!json.configured) {
        setState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = await reg?.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        toast.show("Push permission was not granted", "error");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        toast.show("Push is not configured on the server", "error");
        setState("unconfigured");
        return;
      }

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true, // required by Chrome
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const json = sub.toJSON();
      const res = await fetch("/api/v1/user/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");

      setState("on");
      toast.show("Push notifications enabled on this device", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't enable push", "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/v1/user/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      toast.show("Push disabled on this device", "info");
    } catch {
      toast.show("Couldn't disable push", "error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;

  const NOTE: Record<State, string> = {
    checking: "",
    unsupported: "This browser doesn't support push notifications.",
    unconfigured: "Push isn't configured on the server yet.",
    denied:
      "Blocked in your browser settings — allow notifications for this site, then reload.",
    off: "Not enabled on this device.",
    on: "Enabled on this device.",
  };

  const actionable = state === "off" || state === "on";

  return (
    <div className="np-push">
      <div className="np-row-text">
        <span className="np-row-label">This device</span>
        <span className="np-row-hint">{NOTE[state]}</span>
      </div>
      {actionable && (
        <button
          type="button"
          className={state === "on" ? "np-push-btn np-push-btn-off" : "np-push-btn"}
          disabled={busy}
          onClick={() => void (state === "on" ? disable() : enable())}
        >
          {busy ? "…" : state === "on" ? "Disable" : "Enable"}
        </button>
      )}
    </div>
  );
}
