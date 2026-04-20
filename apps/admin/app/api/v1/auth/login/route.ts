import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { err, parseBody } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    email?: string;
    phone?: string;
    password?: string;
  }>(req);

  if (!body.password || (!body.email && !body.phone)) {
    return err("email/phone and password are required");
  }

  const user = await prisma.user.findFirst({
    where: body.email
      ? { email: body.email.toLowerCase() }
      : { phone: body.phone },
  });

  if (!user) return err("Invalid credentials", 401);

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) return err("Invalid credentials", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  const response = NextResponse.json({
    status: true,
    user: {
      id: user.id,
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
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
