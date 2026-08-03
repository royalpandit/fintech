import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prismaBase: PrismaClient; pgPool: Pool };

// The hosted Postgres (pgbouncer-style) closes idle connections, so the pool can
// hand out a socket the server already killed — the query then fails on first use
// with "Server has closed the connection" / "Can't reach database server". These
// mean the query never ran, so retrying on a fresh connection is safe.
function isTransientConnError(e: unknown): boolean {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message?: unknown }).message ?? "").toLowerCase()
      : "";
  return (
    msg.includes("server has closed the connection") ||
    msg.includes("can't reach database server") ||
    msg.includes("connection terminated") ||
    msg.includes("connection reset") ||
    msg.includes("econnreset")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const basePrisma =
  g.prismaBase ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prismaBase = basePrisma;

// Retry transient connection drops once or twice on a fresh pooled connection,
// so a stale idle-killed socket doesn't surface as a 500 to the user.
export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await query(args);
        } catch (e) {
          if (attempt < 2 && isTransientConnError(e)) {
            await sleep(120 * (attempt + 1));
            continue;
          }
          throw e;
        }
      }
    },
  },
});
