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

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.SEED_ADMIN_PHONE?.trim().replace(/\s|-/g, "");
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";
  const roleRaw = (process.env.SEED_ADMIN_ROLE?.trim() || "super_admin").toLowerCase();
  const role = roleRaw === "admin" ? "admin" : "super_admin";

  if (!email || !phone || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL, SEED_ADMIN_PHONE, and SEED_ADMIN_PASSWORD must be set in the environment.",
    );
  }
  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true, email: true, phone: true, role: true },
  });

  if (existing) {
    if (existing.role !== role) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { role, status: "active" },
        select: { id: true, email: true, role: true },
      });
      console.log(`Promoted existing user to ${role}:`, updated);
    } else {
      console.log(`${role} already exists: ${existing.email}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      passwordHash,
      role,
      status: "active",
      emailVerifiedAt: new Date(),
    },
    select: { id: true, uuid: true, fullName: true, email: true, role: true },
  });

  console.log(`${role} created:`, created);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
