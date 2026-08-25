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

// ─── Original implementation (commented out) ───────────────────────────

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { defaultChartData, serializeGroup } from "@/lib/stock-picks";
//
// export const dynamic = "force-dynamic";
//
// type Params = { params: { slug: string } };
//
// export async function GET(_req: Request, { params }: Params) {
//   const group = await prisma.stockPickGroup.findFirst({
//     where: {
//       slug: params.slug,
//       deletedAt: null,
//       isPublished: true,
//     },
//     include: {
//       stocks: {
//         where: { deletedAt: null, isPublished: true },
//         orderBy: { sortOrder: "asc" },
//       },
//     },
//   });
//
//   if (!group) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
//
//   const data = serializeGroup({
//     ...group,
//     _count: { stocks: group.stocks.length },
//   });
//
//   if (!data.chartData.length && data.performancePct != null) {
//     data.chartData = defaultChartData(data.performancePct);
//   }
//
//   return NextResponse.json({ ok: true, data });
// }
