import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { serializePortfolio } from "@/lib/competition-trading";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseSellBody(body: Record<string, unknown>) {
  return {
    stockSymbol: String(body.stockSymbol ?? body.stock_symbol ?? "").trim(),
    companyName: String(body.companyName ?? body.company_name ?? "").trim(),
    quantity: Number(body.quantity),
    price: Number(body.price ?? 0),
    exchange: body.exchange ? String(body.exchange) : undefined,
    symbolToken: body.symbolToken
      ? String(body.symbolToken)
      : body.symbol_token
        ? String(body.symbol_token)
        : undefined,
  };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  try {
    const portfolio = await competitionTradingRepository.sellStock(
      Number(id),
      auth.userId,
      parseSellBody(body),
    );
    return NextResponse.json({ ok: true, data: serializePortfolio(portfolio!) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sell failed" },
      { status: 400 },
    );
  }
}
