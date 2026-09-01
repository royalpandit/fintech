import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/dhan/authorize
 * Super-admin only — redirects to Dhan's OAuth login so the user can
 * re-authorize the platform account and get a fresh access token.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyToken(req);
  if (!auth || auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey     = process.env.DHAN_API_KEY?.trim();
  const redirectUri = process.env.DHAN_REDIRECT_URI?.trim() ?? `${process.env.NEXTAUTH_URL}/api/v1/auth/dhan/callback`;

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "DHAN_API_KEY not configured in .env" }, { status: 500 });
  }

  // Dhan OAuth authorization URL
  const url = new URL("https://api.dhan.co/oauth2/login");
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", "finuer-dhan-auth");

  return NextResponse.redirect(url.toString());
}
