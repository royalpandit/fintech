import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";

const HARDCODED_ADMIN_EMAIL = "admin@example.com";
const HARDCODED_ADMIN_PASSWORD = "Admin123!";
const HARDCODED_ADMIN_FULL_NAME = "Administrator";
const HARDCODED_ADMIN_PHONE = "0000000000";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    email?: string;
    phone?: string;
    password?: string;
  }>(req);

  if (!body.password || (!body.email && !body.phone)) {
    return err("email/phone and password are required");
  }

  const isHardcodedAdmin =
    body.email?.toLowerCase() === HARDCODED_ADMIN_EMAIL &&
    body.password === HARDCODED_ADMIN_PASSWORD;

  let user = null;

  if (isHardcodedAdmin) {
    const hashedPassword = await bcrypt.hash(HARDCODED_ADMIN_PASSWORD, 12);
    user = await prisma.user.upsert({
      where: { email: HARDCODED_ADMIN_EMAIL },
      update: {
        fullName: HARDCODED_ADMIN_FULL_NAME,
        phone: HARDCODED_ADMIN_PHONE,
        passwordHash: hashedPassword,
        role: "admin",
      },
      create: {
        fullName: HARDCODED_ADMIN_FULL_NAME,
        email: HARDCODED_ADMIN_EMAIL,
        phone: HARDCODED_ADMIN_PHONE,
        passwordHash: hashedPassword,
        role: "admin",
      },
      select: {
        id: true,
        uuid: true,
        fullName: true,
        email: true,
        role: true,
      },
    });
  } else {
    user = await prisma.user.findFirst({
      where: body.email
        ? { email: body.email.toLowerCase() }
        : { phone: body.phone },
    });

    if (!user) return err("Invalid credentials", 401);

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return err("Invalid credentials", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  return ok({
    token,
    user: {
      id: user.id,
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
}
