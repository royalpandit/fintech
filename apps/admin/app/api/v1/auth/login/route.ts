import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

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

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET || "fallback-secret",
    { expiresIn: "7d" },
  );

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
