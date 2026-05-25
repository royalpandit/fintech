import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma: PrismaClient; pgPool: Pool };

if (!g.pgPool) {
  g.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // pg v8.20 treats sslmode=require as verify-full — disable cert check for Prisma Accelerate
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
  g.pgPool.on("error", () => {});
}

const adapter = new PrismaPg(g.pgPool);

export const prisma =
  g.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
