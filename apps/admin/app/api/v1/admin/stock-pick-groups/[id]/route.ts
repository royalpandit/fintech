import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeGroup, slugify, uniqueSlug } from "@/lib/stock-picks";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const group = await prisma.stockPickGroup.findFirst({
    where: { id: Number(params.id), deletedAt: null },
    include: {
      stocks: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { stocks: { where: { deletedAt: null } } } },
    },
  });

  if (!group) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: serializeGroup(group) });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  const body = await req.json();
  const {
    name,
    description,
    category,
    iconEmoji,
    performancePct,
    benchmarkPct,
    chartData,
    sortOrder,
    isPublished,
    slug: slugInput,
  } = body;

  const existing = await prisma.stockPickGroup.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let slug = existing.slug;
  if (slugInput?.trim()) {
    slug = slugify(slugInput);
  } else if (name?.trim() && name.trim() !== existing.name) {
    const slugs = await prisma.stockPickGroup.findMany({
      where: { deletedAt: null, id: { not: id } },
      select: { slug: true },
    });
    slug = uniqueSlug(name, slugs.map((g) => g.slug));
  }

  const group = await prisma.stockPickGroup.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      slug,
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(category !== undefined && { category: category?.trim() || null }),
      ...(iconEmoji !== undefined && { iconEmoji: iconEmoji?.trim() || "📈" }),
      ...(performancePct !== undefined && {
        performancePct: performancePct != null ? performancePct : null,
      }),
      ...(benchmarkPct !== undefined && {
        benchmarkPct: benchmarkPct != null ? benchmarkPct : null,
      }),
      ...(chartData !== undefined && { chartData }),
      ...(typeof sortOrder === "number" && { sortOrder }),
      ...(typeof isPublished === "boolean" && { isPublished }),
    },
    include: {
      stocks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      _count: { select: { stocks: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json({ ok: true, data: serializeGroup(group) });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  await prisma.stockPickGroup.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });

  return NextResponse.json({ ok: true });
}
