import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated, setAccessToken } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/zerodha/status — also seeds token from cookie if cache is cold */
export async function GET(req: NextRequest) {
  // Re-hydrate memory cache from cookie after a server restart
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }
  return NextResponse.json({ ok: true, authenticated: isAuthenticated() });
}
