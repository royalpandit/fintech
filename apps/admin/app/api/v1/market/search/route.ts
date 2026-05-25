import { NextResponse } from "next/server";
import { searchSymbol } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query    = searchParams.get("q") ?? "";
    const exchange = searchParams.get("exchange") ?? "ALL";
    if (!query || query.length < 1)
      return NextResponse.json({ ok: true, data: [] });

    const results = await searchSymbol(exchange, query);
    return NextResponse.json({ ok: true, data: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/search]", msg);
    return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 200 });
  }
}
