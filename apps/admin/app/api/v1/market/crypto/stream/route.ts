import { type NextRequest } from "next/server";
import { CRYPTO_STREAM_SYMBOLS, getCryptoStreamHub } from "@/lib/crypto-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/v1/market/crypto/stream?ids=bitcoin,ethereum
 * SSE of live ticks. Binance is primary; Coinbase is the failover.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const allowed = new Set(CRYPTO_STREAM_SYMBOLS.map((s) => s.id));
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => allowed.has(s));
  const watch = ids.length ? ids : CRYPTO_STREAM_SYMBOLS.slice(0, 8).map((s) => s.id);

  const hub = getCryptoStreamHub();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send({ type: "connected", ids: watch });
      const unsub = hub.subscribe(watch, (tick) => send({ type: "tick", ...tick }));
      const heartbeat = setInterval(() => send({ type: "ping", ts: Date.now() }), 25_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
