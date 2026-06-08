import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultChartData, serializeGroup } from "@/lib/stock-picks";

export const dynamic = "force-dynamic";

/** Public: published groups with published stock counts only */
export async function GET() {
  const groups = await prisma.stockPickGroup.findMany({
    where: { deletedAt: null, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      stocks: {
        where: { deletedAt: null, isPublished: true },
        select: { id: true },
      },
    },
  });

  const data = groups.map((g) => {
    const { stocks, ...rest } = g;
    const serialized = serializeGroup({
      ...rest,
      _count: { stocks: stocks.length },
    });
    if (!serialized.chartData.length && serialized.performancePct != null) {
      serialized.chartData = defaultChartData(serialized.performancePct);
    }
    return serialized;
  });

  return NextResponse.json({ ok: true, data });
}
