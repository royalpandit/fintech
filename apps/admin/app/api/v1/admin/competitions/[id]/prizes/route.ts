import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Prize distribution removed — prediction competitions use reputation points only */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Prize distribution is deprecated. Use reputation points instead." },
    { status: 410 },
  );
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json(
    { ok: false, error: "Prize distribution is deprecated. Use reputation points instead." },
    { status: 410 },
  );
}
