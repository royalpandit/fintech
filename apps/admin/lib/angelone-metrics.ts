/** Angel One API / WebSocket usage metrics (server-side, in-process). */

import "server-only";

type Counter = { count: number; windowStart: number };

const WINDOW_MS = 60_000;
const LOG_INTERVAL_MS = 60_000;

let restCounter: Counter = { count: 0, windowStart: Date.now() };
let wsTickCounter: Counter = { count: 0, windowStart: Date.now() };
let lastLogAt = 0;

const activeSubscriptions = new Set<string>();
let wsConnectionCount = 0;

function bump(counter: Counter) {
  const now = Date.now();
  if (now - counter.windowStart >= WINDOW_MS) {
    counter.count = 0;
    counter.windowStart = now;
  }
  counter.count += 1;
}

function maybeLog() {
  const now = Date.now();
  if (now - lastLogAt < LOG_INTERVAL_MS) return;
  lastLogAt = now;
  console.info(
    "[AngelOne metrics]",
    JSON.stringify({
      restRequestsPerMinute: restCounter.count,
      wsTicksPerMinute: wsTickCounter.count,
      activeSubscriptions: activeSubscriptions.size,
      wsConnectionCount,
      subscriptionSample: [...activeSubscriptions].slice(0, 12),
    }),
  );
}

export function recordRestRequest(label: string) {
  bump(restCounter);
  maybeLog();
  if (process.env.ANGELONE_DEBUG === "1") {
    console.debug("[AngelOne REST]", label);
  }
}

export function recordWsTick() {
  bump(wsTickCounter);
}

export function setWsConnectionCount(n: number) {
  wsConnectionCount = n;
  maybeLog();
}

export function trackSubscription(key: string, active: boolean) {
  if (active) activeSubscriptions.add(key);
  else activeSubscriptions.delete(key);
  maybeLog();
}

export function getAngelMetrics() {
  return {
    restRequestsPerMinute: restCounter.count,
    wsTicksPerMinute: wsTickCounter.count,
    activeSubscriptions: activeSubscriptions.size,
    wsConnectionCount,
    subscriptions: [...activeSubscriptions],
  };
}
