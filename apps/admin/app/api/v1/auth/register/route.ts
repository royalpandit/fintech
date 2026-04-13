import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: "user" | "advisor";
  }>(req);

  if (!body.name || !body.email || !body.phone || !body.password) {
    return err("name, email, phone, and password are required");
  }

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: body.email }, { phone: body.phone }] },
  });
  if (exists) return err("User with this email or phone already exists", 409);

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      fullName: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone,
      passwordHash,
      role: body.role === "advisor" ? "advisor" : "user",
    },
    select: { id: true, uuid: true, fullName: true, email: true, role: true },
  });

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET || "fallback-secret",
    { expiresIn: "7d" },
  );

  return ok({ token, user });
}
