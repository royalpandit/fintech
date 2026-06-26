import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Cash/coupon winners removed — use Declare Winner for reputation-based results */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Winners sync is deprecated. Use Declare Winner on each competition." },
    { status: 410 },
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json(
    { ok: false, error: "Winners sync is deprecated. Use Declare Winner on each competition." },
    { status: 410 },
  );
}
