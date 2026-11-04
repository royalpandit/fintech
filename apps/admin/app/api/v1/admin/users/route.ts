import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  isProfessionalType,
  validateProfessionalCredentials,
  type ProfessionalDetails,
  type ProfessionalType,
} from "@/lib/professional-types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[0-9]{10,15}$/;
const PROFESSIONAL_DETAIL_FIELDS = new Set([
  "regulatoryType",
  "entityName",
  "exchange",
  "ticker",
  "instagramUrl",
  "youtubeUrl",
]);

type AccountStatusInput = "active" | "pending" | "suspended";
type RoleInput = "user" | "advisor" | "admin" | "super_admin";

const ALL_ROLES: RoleInput[] = ["user", "advisor", "admin", "super_admin"];

export async function GET(req: NextRequest) {
  // admin can browse users; super_admin sees everything
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q")?.trim() || "";
  const role = searchParams.get("role") as RoleInput | null;
  const status = searchParams.get("status") as AccountStatusInput | null;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(5, Number(searchParams.get("perPage") || 20)));

  const where: Record<string, unknown> = { deletedAt: null };

  // admins can't see super_admins or other admins
  if (auth.role === "admin") {
    (where as any).role = { in: ["user", "advisor"] };
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search.toLowerCase(), mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }
  if (role && ALL_ROLES.includes(role)) {
    // if admin tries to filter by admin/super_admin, it's silently ignored
    if (auth.role === "admin" && (role === "admin" || role === "super_admin")) {
      // keep in: [user, advisor]
    } else {
      where.role = role;
    }
  }
  if (status && ["active", "pending", "suspended"].includes(status)) where.status = status;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        uuid: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        advisorProfile: {
          select: { sebiRegistrationNo: true, verificationStatus: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, pagination: { page, perPage, total, pages: Math.ceil(total / perPage) } });
}

export async function POST(req: NextRequest) {
  // Only super_admin can create users via this endpoint
  // (admin is read-only for user management per PRD + role split)
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden — super admin only", 403);

  const body = await parseBody<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: RoleInput;
    status?: AccountStatusInput;
    sebiRegistrationNo?: string;
    registrationNo?: string;
    professionalType?: string;
    details?: Record<string, unknown>;
    experienceYears?: number;
    bio?: string;
    autoApproveAdvisor?: boolean;
  }>(req);

  const fullName = (body.fullName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim().replace(/\s|-/g, "");
  const password = body.password ?? "";
  const role: RoleInput =
    body.role && ALL_ROLES.includes(body.role) ? body.role : "user";
  const status: AccountStatusInput =
    body.status && ["active", "pending", "suspended"].includes(body.status) ? body.status : "active";

  if (!fullName || fullName.length < 2) return err("Full name is required");
  if (!EMAIL_REGEX.test(email)) return err("Valid email is required");
  if (!PHONE_REGEX.test(phone)) return err("Valid phone number is required");
  if (password.length < 8) return err("Password must be at least 8 characters");

  let sebiRegistrationNo: string | null = null;
  let professionalType: ProfessionalType = "investment_advisor";
  let verificationDetails: ProfessionalDetails = {};
  if (role === "advisor") {
    if (body.autoApproveAdvisor === true) {
      return err("Advisor credentials must go through manual verification.");
    }
    if (!isProfessionalType(body.professionalType)) return err("Select a valid professional type.");
    professionalType = body.professionalType;
    const rawDetails = body.details && typeof body.details === "object" && !Array.isArray(body.details)
      ? body.details
      : {};
    verificationDetails = Object.fromEntries(
      Object.entries(rawDetails)
        .filter(([key, value]) => PROFESSIONAL_DETAIL_FIELDS.has(key) && typeof value === "string")
        .map(([key, value]) => [key, String(value).trim().slice(0, 200)]),
    );
    sebiRegistrationNo = (body.registrationNo ?? body.sebiRegistrationNo ?? "").trim().toUpperCase();
    const credentialError = validateProfessionalCredentials(
      professionalType,
      sebiRegistrationNo,
      verificationDetails,
    );
    if (credentialError) return err(credentialError);
    if (professionalType === "finance_creator") {
      sebiRegistrationNo = `CREATOR-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    }
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true, email: true },
  });
  if (existing) {
    return err(existing.email === email ? "Email already registered" : "Phone already registered", 409);
  }

  // Enforce singleton super_admin — only one allowed in the entire platform.
  if (role === "super_admin") {
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: "super_admin", deletedAt: null },
      select: { id: true },
    });
    if (existingSuperAdmin) {
      return err(
        "A super admin already exists. Only one super admin is allowed. Demote the existing one first.",
        409,
      );
    }
  }

  if (sebiRegistrationNo) {
    const sebiExists = await prisma.advisorProfile.findUnique({
      where: { sebiRegistrationNo },
      select: { id: true },
    });
    if (sebiExists) return err("Registration identifier already in use", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role,
        status,
        // Super-admin–created active accounts are pre-verified for app access.
        ...(status === "active" ? { emailVerifiedAt: new Date() } : {}),
      },
      select: {
        id: true,
        uuid: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (role === "advisor" && sebiRegistrationNo) {
      await tx.advisorProfile.create({
        data: {
          userId: created.id,
          sebiRegistrationNo,
          experienceYears: typeof body.experienceYears === "number" ? body.experienceYears : null,
          bio: body.bio?.trim() || null,
          professionalType,
          verificationDetails,
          verificationStatus: "pending",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: auth.userId,
        action: "user_created",
        module: "users",
        targetKind: "user",
        targetId: created.id,
        payload: { role, status, professionalType } as any,
      },
    });

    return created;
  });

  return ok({ user });
}
