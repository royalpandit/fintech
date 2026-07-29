import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Basket-level watchlist. GET → { saved }, POST → save, DELETE → unsave.
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: true, saved: false });
  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: true, saved: false });
  const row = await prisma.finuerBasketSave.findUnique({
    where: { userId_basketId: { userId: auth.userId, basketId } },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, saved: Boolean(row) });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  await prisma.finuerBasketSave.upsert({
    where: { userId_basketId: { userId: auth.userId, basketId } },
    create: { userId: auth.userId, basketId },
    update: {},
  });
  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  await prisma.finuerBasketSave.deleteMany({ where: { userId: auth.userId, basketId } });
  return NextResponse.json({ ok: true, saved: false });
}
