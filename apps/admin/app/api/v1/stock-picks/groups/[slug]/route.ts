import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultChartData, serializeGroup } from "@/lib/stock-picks";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

export async function GET(_req: Request, { params }: Params) {
  const group = await prisma.stockPickGroup.findFirst({
    where: {
      slug: params.slug,
      deletedAt: null,
      isPublished: true,
    },
    include: {
      stocks: {
        where: { deletedAt: null, isPublished: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!group) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const data = serializeGroup({
    ...group,
    _count: { stocks: group.stocks.length },
  });

  if (!data.chartData.length && data.performancePct != null) {
    data.chartData = defaultChartData(data.performancePct);
  }

  return NextResponse.json({ ok: true, data });
}
