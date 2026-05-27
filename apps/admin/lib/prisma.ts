import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma: PrismaClient; pgPool: Pool };

function poolSslOption(connectionString: string | undefined) {
  if (!connectionString) return {};
  const needsSsl =
    /sslmode=(require|verify-full|verify-ca)/i.test(connectionString) ||
    /ssl=true/i.test(connectionString);
  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/i.test(connectionString);
  if (!needsSsl || isLocal) return {};
  // pg v8.20 treats sslmode=require as verify-full — disable cert check for hosted DBs
  return { ssl: { rejectUnauthorized: false } as const };
}

if (!g.pgPool) {
  const connectionString = process.env.DATABASE_URL;
  g.pgPool = new Pool({
    connectionString,
    ...poolSslOption(connectionString),
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
