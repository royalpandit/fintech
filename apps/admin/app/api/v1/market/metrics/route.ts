import { NextResponse } from "next/server";
import { getAngelMetrics } from "@/lib/angelone-metrics";
import { getAngelStreamHub } from "@/lib/angelone-stream";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/metrics — debug counters for Angel REST / WS usage */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ...getAngelMetrics(),
    stream: getAngelStreamHub().getStatus(),
  });
}
