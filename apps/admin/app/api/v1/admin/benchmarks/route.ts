import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeBenchmark } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/benchmarks?market_id= */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const marketId = Number(req.nextUrl.searchParams.get("market_id"));
  const benchmarks = await finuerBasketRepository.listBenchmarks(
    Number.isFinite(marketId) && marketId > 0 ? marketId : null,
  );
  return NextResponse.json({ ok: true, data: benchmarks.map(serializeBenchmark) });
}

/** POST /api/v1/admin/benchmarks */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const marketId = Number(body.marketId ?? body.market_id);
  const name = String(body.name ?? "").trim();
  if (!Number.isFinite(marketId) || marketId <= 0) {
    return NextResponse.json({ ok: false, error: "marketId is required" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const market = await finuerBasketRepository.findMarketById(marketId);
  if (!market) return NextResponse.json({ ok: false, error: "Market not found" }, { status: 404 });

  try {
    const benchmark = await finuerBasketRepository.createBenchmark(marketId, name);
    return NextResponse.json({ ok: true, data: serializeBenchmark(benchmark) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create benchmark";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
