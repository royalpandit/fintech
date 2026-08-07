import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { err, parseBody } from "@/lib/api-helpers";
import { createSession, signAccessToken } from "@/lib/auth";
import { isProfessionalType, type ProfessionalType } from "@/lib/professional-types";
import { normalizeIndianMobile } from "@/lib/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Generic registration / licence / ARN / member-code format — covers every
// professional type (SEBI INA/INH/INP, AMFI ARN, broker codes, platform IDs).
const REG_NO_REGEX = /^[A-Z0-9][A-Z0-9-]{4,39}$/;

// Group 1 — regulated professionals/entities: a registration number is required.
// Group 2 (everything else): no individual registration — we generate a unique
// internal id and keep the identifying details the user supplied.
const GROUP1_TYPES = new Set<ProfessionalType>([
  "research_analyst",
  "investment_advisor",
  "portfolio_manager",
  "advisory_firm",
  "mutual_fund_distributor",
]);
const GROUP2_PREFIX: Partial<Record<ProfessionalType, string>> = {
  wealth_manager: "WEALTH",
  stock_broker: "BROKER",
  finance_creator: "CREATOR",
  listed_company: "LISTCO",
  financial_platform: "PLATFORM",
};

type RegisterBody = {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: "user" | "advisor";
  professionalType?: string;
  sebiRegistrationNo?: string;
  registrationNo?: string;
  details?: Record<string, string>;
  experienceYears?: number;
  bio?: string;
};

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must contain a letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

// PII masking — keeps logs useful for debugging without leaking personal data.
// Never log raw email/phone (and never the password, hash, or token).
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 1)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 4 ? "****" : `***${digits.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  // Correlation id so every line for this one request can be grepped together,
  // plus a timer to report how long registration took.
  const reqId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const elapsed = () => `${Date.now() - startedAt}ms`;
  const log = (msg: string, extra?: Record<string, unknown>) =>
    console.log(`[register:${reqId}] ${msg}`, extra ? JSON.stringify(extra) : "");
  const warn = (msg: string, extra?: Record<string, unknown>) =>
    console.warn(`[register:${reqId}] ${msg}`, extra ? JSON.stringify(extra) : "");

  log("incoming registration request", { ip });

  try {
    const body = await parseBody<RegisterBody>(req);

    const fullName = (body.fullName ?? body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    // Canonical 10-digit Indian mobile (null when invalid — validated below).
    const phone = normalizeIndianMobile(body.phone);
    const password = body.password ?? "";
    const role: "user" | "advisor" = body.role === "advisor" ? "advisor" : "user";

    log("parsed request body", {
      role,
      email: email ? maskEmail(email) : "(empty)",
      phone: phone ? maskPhone(phone) : "(empty)",
      hasPassword: Boolean(password),
    });

    // ── Field validation ─────────────────────────────────────────────
    if (!fullName || fullName.length < 2) {
      warn("rejected: full name missing or too short");
      return err("Full name is required");
    }
    if (!EMAIL_REGEX.test(email)) {
      warn("rejected: invalid email format", { email: maskEmail(email) });
      return err("Valid email is required");
    }
    if (!phone) {
      warn("rejected: invalid phone format");
      return err("Enter a valid 10-digit mobile number");
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      warn("rejected: weak password", { reason: passwordError });
      return err(passwordError);
    }

    let sebiRegistrationNo: string | null = null;
    let professionalType: ProfessionalType = "investment_advisor";
    let verificationDetails: Record<string, string> | null = null;
    if (role === "advisor") {
      professionalType = isProfessionalType(body.professionalType)
        ? body.professionalType
        : "investment_advisor";

      if (GROUP1_TYPES.has(professionalType)) {
        sebiRegistrationNo = (body.sebiRegistrationNo ?? body.registrationNo ?? "").trim().toUpperCase();
        if (!REG_NO_REGEX.test(sebiRegistrationNo)) {
          warn("rejected: invalid registration number");
          return err("A valid registration / licence / ARN number is required");
        }
      } else {
        // No individual registration number — generate a unique internal id and
        // keep the identifying details the user provided.
        const prefix = GROUP2_PREFIX[professionalType] ?? "PRO";
        sebiRegistrationNo = `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
        if (body.details && typeof body.details === "object") {
          verificationDetails = Object.fromEntries(
            Object.entries(body.details)
              .filter(([, v]) => v != null && String(v).trim() !== "")
              .map(([k, v]) => [k, String(v).slice(0, 200)]),
          );
        }
      }
    }
    log("field validation passed", { role, professionalType });

    // ── Uniqueness checks ────────────────────────────────────────────
    const existingUser = await prisma.user.findFirst({
      // Match the phone on its last 10 digits so numbers stored either as
      // "+9199..." or bare "99..." still collide.
      where: { OR: [{ email }, { phone: { endsWith: phone } }] },
      select: { id: true, email: true, phone: true },
    });
    if (existingUser) {
      const conflict = existingUser.email === email ? "email" : "phone";
      warn("rejected: account already exists", { conflict });
      return err(
        conflict === "email" ? "Email is already registered" : "Phone number is already registered",
        409,
      );
    }

    if (sebiRegistrationNo) {
      const sebiTaken = await prisma.advisorProfile.findUnique({
        where: { sebiRegistrationNo },
        select: { id: true },
      });
      if (sebiTaken) {
        warn("rejected: SEBI registration number already in use");
        return err("This SEBI registration number is already in use", 409);
      }
    }
    log("uniqueness checks passed");

    // ── Account creation ─────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);
    log("password hashed; creating user + wallet + watchlist in a transaction");

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
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
            professionalType,
            verificationDetails: verificationDetails ?? undefined,
            experienceYears: typeof body.experienceYears === "number" ? body.experienceYears : null,
            bio: body.bio?.trim() || null,
            // Advisor accounts start PENDING — they cannot access the console
            // until an admin approves them. After approval, on first login they
            // are prompted to complete the self-service verification form
            // (verificationFormSubmittedAt stays null until then).
            verificationStatus: "pending",
          },
        });
        log("advisor profile created (pending admin approval)", { userId: created.id });
      }

      await tx.virtualWallet.create({
        data: { userId: created.id, balance: 1_000_000 },
      });

      await tx.watchlist.create({
        data: { userId: created.id, name: "Default" },
      });

      return created;
    });
    log("transaction committed: user, wallet and watchlist created", {
      userId: user.id,
      role: user.role,
    });

    // ── Session + auth cookie ────────────────────────────────────────
    const session = await createSession(user.id, req);
    const token = signAccessToken({ sub: user.id, role: user.role, sid: session.id });
    log("session created and access token signed", { userId: user.id, sessionId: session.id });

    const advisorProfile =
      role === "advisor"
        ? await prisma.advisorProfile.findUnique({
            where: { userId: user.id },
            select: { sebiRegistrationNo: true, verificationStatus: true },
          })
        : null;

    const redirectTo = user.role === "advisor" ? "/advisor/pending" : "/user/feed";

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
      redirectTo,
    });

    response.cookies.set("access_token", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
    });

    log(`registration successful in ${elapsed()}`, { userId: user.id, role: user.role, redirectTo });
    return response;
  } catch (e) {
    // Unexpected failure (DB error, bcrypt, etc.). Log the full error server-side
    // with the request id, but return a generic message to the client.
    console.error(`[register:${reqId}] registration failed after ${elapsed()}`, e);
    return err("Registration failed due to a server error. Please try again.", 500);
  }
}
