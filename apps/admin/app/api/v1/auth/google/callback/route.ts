import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSession, signAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true, uuid: true, fullName: true, email: true, phone: true,
  role: true, status: true, deletedAt: true,
  advisorProfile: { select: { verificationStatus: true } },
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=google_cancelled`);
  }

  const redirectUri = `${appUrl}/api/v1/auth/google/callback`;

  // Exchange code for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=google_token_failed`);
  }

  const tokens = (await tokenRes.json()) as { access_token: string };

  // Fetch Google user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}/login?error=google_user_failed`);
  }

  const gUser = (await userRes.json()) as { id: string; email?: string; name: string };

  if (!gUser.email) {
    return NextResponse.redirect(`${appUrl}/login?error=no_email`);
  }

  const email = gUser.email.toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email },
    select: userSelect,
  });

  if (!user) {
    // Phone is required by the schema. Google-only accounts get a synthetic
    // placeholder (uuid-derived, guaranteed unique) that fits @db.VarChar(20).
    const placeholderPhone = `G${randomUUID().replace(/-/g, "").slice(0, 19)}`;
    user = await prisma.user.create({
      data: {
        fullName: gUser.name,
        email,
        phone: placeholderPhone,
        role: "user",
        status: "active",
        passwordHash: "",
        emailVerifiedAt: new Date(),
      },
      select: userSelect,
    });
  }

  if (user.status === "suspended") {
    return NextResponse.redirect(`${appUrl}/login?error=suspended`);
  }
  if (user.deletedAt) {
    return NextResponse.redirect(`${appUrl}/login?error=deleted`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  const redirectTo =
    user.role === "super_admin" ? "/super-admin/dashboard"
    : user.role === "admin" ? "/admin/dashboard"
    : user.role === "advisor"
      ? (user.advisorProfile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending")
    : "/user/home";

  const response = NextResponse.redirect(`${appUrl}${redirectTo}`);
  response.cookies.set("access_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
