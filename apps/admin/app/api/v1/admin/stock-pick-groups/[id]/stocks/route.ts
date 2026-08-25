// ─── Stock Basket / AI Stock Picks — RETIRED ──────────────────────────────
// Superseded by Finuer Basket (/user/finuer-basket, /super-admin/finuer-basket).
// The original implementation is preserved verbatim, line-commented, below the
// stub. To bring the feature back: delete the stub, uncomment the body, and
// restore the nav entries in components/user-shell.tsx + lib/super-admin.ts.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stock Basket is retired — use the Finuer Basket API (/api/v1/baskets). */
function gone() {
  return NextResponse.json(
    { ok: false, error: "Stock Basket has been retired. Use Finuer Basket instead." },
    { status: 410 },
  );
}

export async function GET() {
  return gone();
}
export async function POST() {
  return gone();
}
export async function PUT() {
  return gone();
}

// ─── Original implementation (commented out) ───────────────────────────

// import { NextResponse, type NextRequest } from "next/server";
// import { requireRole } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";
// import { serializeStock } from "@/lib/stock-picks";
//
// export const dynamic = "force-dynamic";
//
// type Params = { params: { id: string } };
//
// export async function GET(req: NextRequest, { params }: Params) {
//   const auth = await requireRole(req, ["super_admin"]);
//   if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
//
//   const groupId = Number(params.id);
//   const stocks = await prisma.stockPickStock.findMany({
//     where: { groupId, deletedAt: null },
//     orderBy: { sortOrder: "asc" },
//   });
//
//   return NextResponse.json({
//     ok: true,
//     data: stocks.map((s) => serializeStock({ ...s, groupId })),
//   });
// }
//
// export async function POST(req: NextRequest, { params }: Params) {
//   const auth = await requireRole(req, ["super_admin"]);
//   if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
//
//   const groupId = Number(params.id);
//   const group = await prisma.stockPickGroup.findFirst({
//     where: { id: groupId, deletedAt: null },
//   });
//   if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
//
//   const body = await req.json();
//   const {
//     symbol,
//     stockName,
//     cmp,
//     targetPrice,
//     stopLoss,
//     recommendation,
//     analystNote,
//     sortOrder,
//     isPublished,
//   } = body;
//
//   if (!symbol?.trim() || !stockName?.trim()) {
//     return NextResponse.json(
//       { ok: false, error: "symbol and stockName are required" },
//       { status: 400 },
//     );
//   }
//
//   const maxOrder = await prisma.stockPickStock.aggregate({
//     where: { groupId, deletedAt: null },
//     _max: { sortOrder: true },
//   });
//
//   const stock = await prisma.stockPickStock.create({
//     data: {
//       groupId,
//       symbol: symbol.trim().toUpperCase(),
//       stockName: stockName.trim(),
//       cmp: cmp != null ? cmp : null,
//       targetPrice: targetPrice != null ? targetPrice : null,
//       stopLoss: stopLoss != null ? stopLoss : null,
//       recommendation: recommendation || "buy",
//       analystNote: analystNote?.trim() || null,
//       sortOrder:
//         typeof sortOrder === "number" ? sortOrder : (maxOrder._max.sortOrder ?? -1) + 1,
//       isPublished: Boolean(isPublished),
//     },
//   });
//
//   return NextResponse.json({ ok: true, data: serializeStock(stock) });
// }
//
// /** PUT — reorder stocks: body { order: [{ id, sortOrder }] } */
// export async function PUT(req: NextRequest, { params }: Params) {
//   const auth = await requireRole(req, ["super_admin"]);
//   if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
//
//   const groupId = Number(params.id);
//   const body = await req.json();
//   const order = body.order as { id: number; sortOrder: number }[] | undefined;
//
//   if (!Array.isArray(order)) {
//     return NextResponse.json({ ok: false, error: "order array required" }, { status: 400 });
//   }
//
//   await prisma.$transaction(
//     order.map((item) =>
//       prisma.stockPickStock.updateMany({
//         where: { id: item.id, groupId, deletedAt: null },
//         data: { sortOrder: item.sortOrder },
//       }),
//     ),
//   );
//
//   const stocks = await prisma.stockPickStock.findMany({
//     where: { groupId, deletedAt: null },
//     orderBy: { sortOrder: "asc" },
//   });
//
//   return NextResponse.json({
//     ok: true,
//     data: stocks.map((s) => serializeStock({ ...s, groupId })),
//   });
// }
