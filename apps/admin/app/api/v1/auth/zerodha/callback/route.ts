import { NextResponse } from "next/server";
import { createSession } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/zerodha/callback?request_token=...&status=success
 * Zerodha redirects here after user login.
 * Exchanges request_token for access_token, then redirects to the terminal.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestToken = searchParams.get("request_token");
  const status       = searchParams.get("status");

  if (status !== "success" || !requestToken) {
    return NextResponse.json(
      { ok: false, error: "Login failed or cancelled", status, requestToken },
      { status: 400 }
    );
  }

  try {
    const accessToken = await createSession(requestToken);

    // Store in a cookie so it survives server restarts
    const res = NextResponse.redirect(new URL("/user/markets", req.url));
    res.cookies.set("zerodha_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Zerodha callback]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
