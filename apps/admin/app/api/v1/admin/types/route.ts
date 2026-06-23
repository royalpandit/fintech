import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeType } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/types — list basket types */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const types = await finuerBasketRepository.listTypes();
  return NextResponse.json({ ok: true, data: types.map(serializeType) });
}

/** POST /api/v1/admin/types — create basket type */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const status = body.status === "inactive" ? "inactive" : "active";

  try {
    const type = await finuerBasketRepository.createType(name, status);
    return NextResponse.json({ ok: true, data: serializeType(type) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create type";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
