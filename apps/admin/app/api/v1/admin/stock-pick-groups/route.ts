import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeGroup, uniqueSlug } from "@/lib/stock-picks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const groups = await prisma.stockPickGroup.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { stocks: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: groups.map((g) => serializeGroup(g)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, category, iconEmoji, performancePct, benchmarkPct, chartData, sortOrder, isPublished } =
    body;

  if (!name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const existing = await prisma.stockPickGroup.findMany({
    where: { deletedAt: null },
    select: { slug: true },
  });
  const slug = uniqueSlug(
    name,
    existing.map((g) => g.slug),
  );

  const group = await prisma.stockPickGroup.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      category: category?.trim() || null,
      iconEmoji: iconEmoji?.trim() || "📈",
      performancePct: performancePct != null ? performancePct : null,
      benchmarkPct: benchmarkPct != null ? benchmarkPct : null,
      chartData: chartData ?? null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isPublished: Boolean(isPublished),
      createdById: auth.userId,
    },
    include: { _count: { select: { stocks: true } } },
  });

  return NextResponse.json({ ok: true, data: serializeGroup(group) });
}
