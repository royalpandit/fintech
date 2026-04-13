import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);

  const [data, total] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        advisor: { select: { id: true, fullName: true } },
        _count: { select: { lessons: true, enrollments: true } },
      },
    }),
    prisma.course.count({ where: { deletedAt: null, isPublished: true } }),
  ]);

  return ok({ data, total, page, limit });
}
