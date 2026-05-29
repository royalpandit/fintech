import { NextResponse, type NextRequest } from "next/server";
import { subscriptionKey } from "@/lib/angelone-exchange";
import { getAngelStreamHub } from "@/lib/angelone-stream";
import { isRateLimited } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StreamItem = { exchange: string; token: string };

function parseItems(raw: string | null): StreamItem[] {
  if (!raw) return [];
  return raw.split(",").flatMap(part => {
    const [exch, tok] = part.split(":");
    return exch && tok ? [{ exchange: decodeURIComponent(exch), token: decodeURIComponent(tok) }] : [];
  });
}

/**
 * GET /api/v1/market/stream?symbols=NSE:99926000,NSE:2885
 * One SSE connection per browser tab — server multiplexes on a single Angel WebSocket.
 */
export async function GET(req: NextRequest) {
  if (isRateLimited()) {
    return NextResponse.json({
      ok: false,
      error: "Angel One rate limit — stream paused",
      rateLimited: true,
    }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const items = parseItems(searchParams.get("symbols"));
  if (!items.length) {
    return NextResponse.json({ ok: false, error: "Missing symbols=NSE:token,..." }, { status: 400 });
  }

  const hub = getAngelStreamHub();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* closed */ }
      };

      send({ type: "connected", symbols: items.length });

      const onTick = (tick: { token: string; exchange: string; ltp: number; volume?: number; ts: number }) => {
        send({ type: "tick", ...tick });
      };

      let cleanup: (() => void) | undefined;
      hub.subscribeMany(items, onTick).then(unsub => {
        cleanup = unsub;
      }).catch(err => {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      });

      const heartbeat = setInterval(() => send({ type: "ping", ts: Date.now() }), 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        cleanup?.();
        try { controller.close(); } catch { /* ignore */ }
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

/** POST body: { symbols: ["NSE:99926000", ...] } — returns current subscription keys (debug). */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { symbols?: string[] };
  const items = (body.symbols ?? []).flatMap(s => {
    const [exch, tok] = s.split(":");
    return exch && tok ? [{ exchange: exch, token: tok }] : [];
  });
  return NextResponse.json({
    ok: true,
    keys: items.map(i => subscriptionKey(i.exchange, i.token)),
    hub: getAngelStreamHub().getStatus(),
  });
}
