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
    // Pages fan out many queries via Promise.all (the advisor dashboard fires
    // ~17 at once). max:1 serialized them onto a single remote connection, so
    // queries timed out waiting to acquire it. The hosted endpoint is pooled
    // (pgbouncer-style), so several client connections are fine.
    max: 10,
    // Keep connections warm instead of tearing them down every 5s and
    // reconnecting across the network (the churn caused "Server has closed the
    // connection" / "Can't reach database server" on the re-establish).
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Send TCP keepalives so dead/idle-killed sockets are detected and replaced
    // rather than handed out and failing on first use.
    keepAlive: true,
    allowExitOnIdle: true,
  });
  // Swallow pool-level errors (e.g. a backend idle-disconnect) so a dropped
  // idle connection doesn't crash the dev server; pg will create a new one.
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
