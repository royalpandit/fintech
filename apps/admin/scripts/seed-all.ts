import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Hardcoded seed credentials ──────────────────────────
// Super admin is ALWAYS exactly this one identity — cannot be duplicated.
// Admin / advisor / user are idempotent seeds (created if missing, kept otherwise).

const SUPER_ADMIN = {
  fullName: "Corescent Super Admin",
  email: "superadmin@corescent.local",
  phone: "+919999990001",
  password: "SuperAdmin@2025",
};

const ADMIN = {
  fullName: "Corescent Admin",
  email: "admin@corescent.local",
  phone: "+919999990002",
  password: "Admin@2025",
};

const ADVISOR = {
  fullName: "Ananya Mehta",
  email: "advisor@corescent.local",
  phone: "+919999990003",
  password: "Advisor@2025",
  sebiRegistrationNo: "INA000000001",
  experienceYears: 8,
  bio: "Seed advisor — approved for testing. Equity and derivatives specialist.",
};

const USER = {
  fullName: "Rohan Retail",
  email: "user@corescent.local",
  phone: "+919999990004",
  password: "User@2025",
};

type SeedResult = {
  role: string;
  status: "created" | "existing";
  email: string;
  phone: string;
  password: string;
  extra?: Record<string, unknown>;
};

async function upsertUser(
  data: { fullName: string; email: string; phone: string; password: string },
  role: "super_admin" | "admin" | "advisor" | "user",
): Promise<{ userId: number; created: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { phone: data.phone }] },
    select: { id: true, email: true, role: true },
  });

  if (existing) {
    // Keep password unchanged on reruns (so operators can rotate manually).
    // Only ensure the role + status are correct.
    if (existing.role !== role) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role, status: "active" },
      });
    }
    return { userId: existing.id, created: false };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role,
      status: "active",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });

  return { userId: user.id, created: true };
}

async function seedSuperAdmin(): Promise<SeedResult> {
  // Enforce exactly ONE super_admin in the entire system.
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "super_admin" },
    select: { id: true, email: true, phone: true },
  });

  if (existingSuperAdmin) {
    const matchesHardcoded =
      existingSuperAdmin.email === SUPER_ADMIN.email &&
      existingSuperAdmin.phone === SUPER_ADMIN.phone;

    if (!matchesHardcoded) {
      throw new Error(
        `A different super_admin already exists (id=${existingSuperAdmin.id}, email=${existingSuperAdmin.email}). ` +
          `Only one super_admin is allowed. Remove or demote the existing one first.`,
      );
    }
    return {
      role: "super_admin",
      status: "existing",
      email: SUPER_ADMIN.email,
      phone: SUPER_ADMIN.phone,
      password: SUPER_ADMIN.password + " (unchanged — reset manually if needed)",
    };
  }

  const { created } = await upsertUser(SUPER_ADMIN, "super_admin");
  return {
    role: "super_admin",
    status: created ? "created" : "existing",
    email: SUPER_ADMIN.email,
    phone: SUPER_ADMIN.phone,
    password: SUPER_ADMIN.password,
  };
}

async function seedAdmin(): Promise<SeedResult> {
  const { created } = await upsertUser(ADMIN, "admin");
  return {
    role: "admin",
    status: created ? "created" : "existing",
    email: ADMIN.email,
    phone: ADMIN.phone,
    password: created ? ADMIN.password : `${ADMIN.password} (unchanged on rerun)`,
  };
}

async function seedAdvisor(): Promise<SeedResult> {
  const { userId, created } = await upsertUser(ADVISOR, "advisor");

  // Ensure the AdvisorProfile exists and is approved.
  const existingProfile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true, sebiRegistrationNo: true, verificationStatus: true },
  });

  // Find super_admin to attribute the approval to, fall back to any admin.
  const verifier = await prisma.user.findFirst({
    where: { role: { in: ["super_admin", "admin"] } },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (!existingProfile) {
    await prisma.advisorProfile.create({
      data: {
        userId,
        sebiRegistrationNo: ADVISOR.sebiRegistrationNo,
        experienceYears: ADVISOR.experienceYears,
        bio: ADVISOR.bio,
        verificationStatus: "approved",
        verifiedAt: new Date(),
        verifiedByAdminId: verifier?.id ?? null,
      },
    });
  } else if (existingProfile.verificationStatus !== "approved") {
    await prisma.advisorProfile.update({
      where: { userId },
      data: {
        verificationStatus: "approved",
        verifiedAt: new Date(),
        verifiedByAdminId: verifier?.id ?? null,
      },
    });
  }

  return {
    role: "advisor",
    status: created ? "created" : "existing",
    email: ADVISOR.email,
    phone: ADVISOR.phone,
    password: created ? ADVISOR.password : `${ADVISOR.password} (unchanged on rerun)`,
    extra: {
      sebiRegistrationNo: ADVISOR.sebiRegistrationNo,
      verificationStatus: "approved",
    },
  };
}

async function seedUser(): Promise<SeedResult> {
  const { created } = await upsertUser(USER, "user");
  return {
    role: "user",
    status: created ? "created" : "existing",
    email: USER.email,
    phone: USER.phone,
    password: created ? USER.password : `${USER.password} (unchanged on rerun)`,
  };
}

function printResult(results: SeedResult[]) {
  const divider = "═".repeat(76);
  console.log("\n" + divider);
  console.log("  SEED CREDENTIALS  —  copy these for testing");
  console.log(divider);

  for (const r of results) {
    const statusIcon = r.status === "created" ? "✓ created" : "• existed";
    console.log(`\n  [${r.role.toUpperCase()}]   ${statusIcon}`);
    console.log(`    email    : ${r.email}`);
    console.log(`    phone    : ${r.phone}`);
    console.log(`    password : ${r.password}`);
    if (r.extra) {
      for (const [k, v] of Object.entries(r.extra)) {
        console.log(`    ${k.padEnd(9)}: ${v}`);
      }
    }
  }

  console.log("\n" + divider);
  console.log("  Login at:  http://localhost:3000/login");
  console.log(divider + "\n");
}

async function main() {
  console.log("Seeding all four roles...\n");

  const superAdmin = await seedSuperAdmin();
  const admin = await seedAdmin();
  const advisor = await seedAdvisor();
  const user = await seedUser();

  printResult([superAdmin, admin, advisor, user]);
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:", error?.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
