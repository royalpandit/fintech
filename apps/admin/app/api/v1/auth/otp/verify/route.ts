import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, err } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";
import { normalizeIndianMobile } from "@/lib/phone";
import { verifyOTP } from "@/lib/otp";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true, uuid: true, fullName: true, email: true, phone: true,
  role: true, status: true, deletedAt: true,
  advisorProfile: { select: { verificationStatus: true } },
} as const;

export async function POST(req: NextRequest) {
  const body = await parseBody<{ phone?: string; otp?: string }>(req);
  const raw = (body.phone ?? "").trim();
  const otp = (body.otp ?? "").trim();

  if (!raw || !otp) return err("Phone and OTP are required");

  const mobile = normalizeIndianMobile(raw);
  if (!mobile) return err("Invalid phone number");

  if (!verifyOTP(mobile, otp)) return err("Invalid or expired OTP", 401);

  let user = await prisma.user.findFirst({
    where: { phone: { endsWith: mobile } },
    select: userSelect,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        fullName: `User ${mobile.slice(-4)}`,
        phone: `+91${mobile}`,
        // Placeholder email — phone-only accounts don't have a real email.
        // Prefixed with "otp_" and suffixed with an invalid TLD so it can
        // never be confused with a real address.
        email: `otp_${mobile}@placeholder.invalid`,
        role: "user",
        status: "active",
        passwordHash: "",
      },
      select: userSelect,
    });
  }

  if (user.status === "suspended") return err("Account suspended. Contact support.", 403);
  if (user.deletedAt) return err("Account is no longer active.", 403);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  const redirectTo =
    user.role === "super_admin" ? "/super-admin/dashboard"
    : user.role === "admin" ? "/admin/dashboard"
    : user.role === "advisor"
      ? (user.advisorProfile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending")
    : "/user/feed";

  const response = NextResponse.json({
    status: true,
    user: { id: user.id, uuid: user.uuid, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role },
    redirectTo,
  });

  response.cookies.set("access_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
