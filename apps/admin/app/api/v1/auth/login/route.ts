import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { err, parseBody } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    identifier?: string;
    email?: string;
    phone?: string;
    password?: string;
  }>(req);

  const identifier = (body.identifier ?? body.email ?? body.phone ?? "").trim();
  const password = body.password ?? "";

  if (!identifier || !password) {
    return err("Email/phone and password are required");
  }

  const isEmail = identifier.includes("@");
  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier.replace(/\s|-/g, "") },
    include: {
      advisorProfile: {
        select: { sebiRegistrationNo: true, verificationStatus: true, rejectionReason: true },
      },
    },
  });

  if (!user) return err("Invalid credentials", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return err("Invalid credentials", 401);

  if (user.status === "suspended") {
    return err("This account has been suspended. Contact support.", 403);
  }
  if (user.deletedAt) {
    return err("This account is no longer active.", 403);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  const redirectTo =
    user.role === "super_admin"
      ? "/super-admin/dashboard"
      : user.role === "admin"
        ? "/admin/dashboard"
        : user.role === "advisor"
          ? user.advisorProfile?.verificationStatus === "approved"
            ? "/advisor/dashboard"
            : "/advisor/pending"
          : "/user/home";

  const response = NextResponse.json({
    status: true,
    user: {
      id: user.id,
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accountStatus: user.status,
      advisorProfile: user.advisorProfile,
    },
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
