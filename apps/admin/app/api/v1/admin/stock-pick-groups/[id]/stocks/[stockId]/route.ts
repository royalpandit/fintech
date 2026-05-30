import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeStock } from "@/lib/stock-picks";

export const dynamic = "force-dynamic";

type Params = { params: { id: string; stockId: string } };

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const groupId = Number(params.id);
  const stockId = Number(params.stockId);
  const body = await req.json();

  const existing = await prisma.stockPickStock.findFirst({
    where: { id: stockId, groupId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const {
    symbol,
    stockName,
    cmp,
    targetPrice,
    stopLoss,
    recommendation,
    analystNote,
    sortOrder,
    isPublished,
  } = body;

  const stock = await prisma.stockPickStock.update({
    where: { id: stockId },
    data: {
      ...(symbol && { symbol: symbol.trim().toUpperCase() }),
      ...(stockName && { stockName: stockName.trim() }),
      ...(cmp !== undefined && { cmp: cmp != null ? cmp : null }),
      ...(targetPrice !== undefined && { targetPrice: targetPrice != null ? targetPrice : null }),
      ...(stopLoss !== undefined && { stopLoss: stopLoss != null ? stopLoss : null }),
      ...(recommendation && { recommendation }),
      ...(analystNote !== undefined && { analystNote: analystNote?.trim() || null }),
      ...(typeof sortOrder === "number" && { sortOrder }),
      ...(typeof isPublished === "boolean" && { isPublished }),
    },
  });

  return NextResponse.json({ ok: true, data: serializeStock(stock) });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const stockId = Number(params.stockId);
  await prisma.stockPickStock.update({
    where: { id: stockId },
    data: { deletedAt: new Date(), isPublished: false },
  });

  return NextResponse.json({ ok: true });
}
