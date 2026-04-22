import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api-helpers";
import { requireAuth, revokeSession } from "@/lib/auth";

function clearCookie(response: NextResponse) {
  response.cookies.set("access_token", "", {
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) {
    await revokeSession(auth.sessionId);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const accept = req.headers.get("accept") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const response = NextResponse.redirect(new URL("/login", req.url), 303);
    clearCookie(response);
    return response;
  }

  if (accept.includes("text/html") && !accept.includes("application/json")) {
    const response = NextResponse.redirect(new URL("/login", req.url), 303);
    clearCookie(response);
    return response;
  }

  const response = NextResponse.json({ status: true, message: "Logged out" });
  clearCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth) {
    await revokeSession(auth.sessionId);
  }
  const response = NextResponse.redirect(new URL("/login", req.url), 303);
  clearCookie(response);
  return response;
}
