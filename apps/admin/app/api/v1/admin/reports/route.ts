import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

  const where = { status };

  const [data, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, fullName: true } },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  return ok({ data, total, page, limit });
}
