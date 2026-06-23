import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeType } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/v1/admin/types/:id */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const data: { name?: string; status?: "active" | "inactive" } = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.status === "active" || body.status === "inactive") data.status = body.status;

  try {
    const type = await finuerBasketRepository.updateType(id, data);
    return NextResponse.json({ ok: true, data: serializeType(type) });
  } catch {
    return NextResponse.json({ ok: false, error: "Type not found" }, { status: 404 });
  }
}

/** DELETE /api/v1/admin/types/:id */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  try {
    await finuerBasketRepository.deleteType(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete type";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
