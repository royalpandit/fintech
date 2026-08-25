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
// /** Public: published groups with published stock counts only */
// export async function GET() {
//   const groups = await prisma.stockPickGroup.findMany({
//     where: { deletedAt: null, isPublished: true },
//     orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
//     include: {
//       stocks: {
//         where: { deletedAt: null, isPublished: true },
//         select: { id: true },
//       },
//     },
//   });
//
//   const data = groups.map((g) => {
//     const { stocks, ...rest } = g;
//     const serialized = serializeGroup({
//       ...rest,
//       _count: { stocks: stocks.length },
//     });
//     if (!serialized.chartData.length && serialized.performancePct != null) {
//       serialized.chartData = defaultChartData(serialized.performancePct);
//     }
//     return serialized;
//   });
//
//   return NextResponse.json({ ok: true, data });
// }
