import { type NextRequest, NextResponse } from "next/server";
import { storeDhanToken } from "@/lib/dhan-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/dhan/callback
 *
 * Dhan redirects here after the user authorises the app.
 * Handles both response styles:
 *   a) ?access-token=xxx   (Dhan returns token directly in redirect)
 *   b) ?code=xxx           (authorization-code flow — exchange for token)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Style A: Dhan passes the access token straight in the redirect URL
  const directToken =
    searchParams.get("access-token") ??
    searchParams.get("access_token") ??
    searchParams.get("token");

  if (directToken) {
    storeDhanToken(directToken, 86_400); // 24 h
    return NextResponse.redirect(
      new URL("/super-admin?dhan=authorized", req.url),
    );
  }

  // Style B: authorization-code — exchange for access token
  const code = searchParams.get("code");
  if (code) {
    const apiKey     = process.env.DHAN_API_KEY?.trim();
    const apiSecret  = process.env.DHAN_API_SECRET?.trim();
    const redirectUri = process.env.DHAN_REDIRECT_URI?.trim() ?? `${process.env.NEXTAUTH_URL}/api/v1/auth/dhan/callback`;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: "DHAN_API_KEY / DHAN_API_SECRET not set" }, { status: 500 });
    }

    try {
      const tokenRes = await fetch("https://api.dhan.co/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type:    "authorization_code",
          code,
          client_id:     apiKey,
          client_secret: apiSecret,
          redirect_uri:  redirectUri,
        }),
      });
      const data = await tokenRes.json() as { access_token?: string; expires_in?: number; error?: string };
      if (!data.access_token) {
        console.error("[Dhan OAuth] token exchange failed:", data);
        return NextResponse.redirect(new URL("/super-admin?dhan=error", req.url));
      }
      storeDhanToken(data.access_token, data.expires_in ?? 86_400);
      return NextResponse.redirect(new URL("/super-admin?dhan=authorized", req.url));
    } catch (e) {
      console.error("[Dhan OAuth] callback error:", e);
      return NextResponse.redirect(new URL("/super-admin?dhan=error", req.url));
    }
  }

  const err = searchParams.get("error") ?? "unknown";
  return NextResponse.redirect(new URL(`/super-admin?dhan=error&reason=${err}`, req.url));
}
