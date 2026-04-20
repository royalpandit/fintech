import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api-helpers";
import { requireAuth, revokeSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  await revokeSession(auth.sessionId);

  const response = NextResponse.json({ status: true, message: "Logged out" });
  response.cookies.set("access_token", "", {
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
