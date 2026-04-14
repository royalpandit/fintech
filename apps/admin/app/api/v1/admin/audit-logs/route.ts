import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const module = searchParams.get("module");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  const where: Record<string, unknown> = {};
  if (module) where.module = module;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        actor: { select: { id: true, fullName: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({ data, total, page, limit });
}
