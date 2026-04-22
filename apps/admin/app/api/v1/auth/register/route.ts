import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { err, parseBody } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[0-9]{10,15}$/;
const SEBI_REGEX = /^INA[0-9]{9}$/i;

type RegisterBody = {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: "user" | "advisor";
  sebiRegistrationNo?: string;
  experienceYears?: number;
  bio?: string;
};

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must contain a letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

export async function POST(req: NextRequest) {
  const body = await parseBody<RegisterBody>(req);

  const fullName = (body.fullName ?? body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";
  const role: "user" | "advisor" = body.role === "advisor" ? "advisor" : "user";

  if (!fullName || fullName.length < 2) {
    return err("Full name is required");
  }
  if (!EMAIL_REGEX.test(email)) {
    return err("Valid email is required");
  }
  if (!PHONE_REGEX.test(phone.replace(/\s|-/g, ""))) {
    return err("Valid phone number is required");
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) return err(passwordError);

  let sebiRegistrationNo: string | null = null;
  if (role === "advisor") {
    sebiRegistrationNo = (body.sebiRegistrationNo ?? "").trim().toUpperCase();
    if (!SEBI_REGEX.test(sebiRegistrationNo)) {
      return err("Valid SEBI registration number is required (format: INA followed by 9 digits)");
    }
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true, email: true, phone: true },
  });
  if (existingUser) {
    if (existingUser.email === email) return err("Email is already registered", 409);
    return err("Phone number is already registered", 409);
  }

  if (sebiRegistrationNo) {
    const sebiTaken = await prisma.advisorProfile.findUnique({
      where: { sebiRegistrationNo },
      select: { id: true },
    });
    if (sebiTaken) return err("This SEBI registration number is already in use", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        phone: phone.replace(/\s|-/g, ""),
        passwordHash,
        role,
        status: "active",
      },
      select: {
        id: true,
        uuid: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
      },
    });

    if (role === "advisor" && sebiRegistrationNo) {
      await tx.advisorProfile.create({
        data: {
          userId: created.id,
          sebiRegistrationNo,
          experienceYears: typeof body.experienceYears === "number" ? body.experienceYears : null,
          bio: body.bio?.trim() || null,
          verificationStatus: "pending",
        },
      });
    }

    return created;
  });

  const session = await createSession(user.id, req);
  const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  const advisorProfile =
    role === "advisor"
      ? await prisma.advisorProfile.findUnique({
          where: { userId: user.id },
          select: { sebiRegistrationNo: true, verificationStatus: true },
        })
      : null;

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
      advisorProfile,
    },
    redirectTo:
      user.role === "advisor" ? "/advisor/pending" : "/user/home",
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
