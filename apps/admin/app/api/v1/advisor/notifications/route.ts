import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);
  const filter = searchParams.get("filter");

  const where: Record<string, unknown> = { userId: auth.userId };
  if (filter === "unread") where.readAt = null;
  if (filter === "read") where.readAt = { not: null };

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
  ]);

  return ok({ data, total, unreadCount, page, limit });
}

export async function PATCH(req: NextRequest) {
  // Bulk mark-all-read
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{ action?: "mark_all_read" }>(req);
  if (body.action !== "mark_all_read") {
    return err("Only action=mark_all_read is supported on the collection endpoint");
  }

  const result = await prisma.notification.updateMany({
    where: { userId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ updated: result.count });
}
