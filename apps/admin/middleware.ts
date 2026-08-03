import { NextResponse, type NextRequest } from "next/server";

// Approved advisors are allowed into /user for SHARED sections they deep-link
// into (stock charts, basket/competition detail, community, public profiles).
// But investor-ONLY pages below have their own advisor equivalents, so send
// advisors there instead of showing them the investor shell.
const INVESTOR_ONLY_REDIRECTS: Record<string, string> = {
  feed: "/advisor/feed",
  home: "/advisor/dashboard",
  dashboard: "/advisor/dashboard",
  settings: "/advisor/profile",
  wallet: "/advisor/earnings",
  subscriptions: "/advisor/services",
  trades: "/advisor/posts",
};

// Decode (not verify) the JWT payload to read the role. This is only a UX
// redirect hint — real authorization is still enforced server-side in the
// layouts and API routes via verifyAccessToken + DB session lookup.
function roleFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const seg = req.nextUrl.pathname.split("/")[2] ?? "";
  const target = INVESTOR_ONLY_REDIRECTS[seg];
  if (!target) return NextResponse.next();

  const role = roleFromToken(req.cookies.get("access_token")?.value);
  if (role === "advisor") {
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*"],
};
