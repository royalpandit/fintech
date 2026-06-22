import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function sslForDb(url: string | undefined) {
  if (!url) return undefined;
  if (url.includes("localhost") || url.includes("127.0.0.1")) return undefined;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslForDb(process.env.DATABASE_URL),
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const now = new Date();

  // Mark every existing advisor as approved + verification form complete,
  // so they don't see the verification popup.
  const result = await prisma.advisorProfile.updateMany({
    where: { verificationFormSubmittedAt: null },
    data: {
      verificationStatus: "approved",
      verificationFormSubmittedAt: now,
    },
  });

  console.log(`✓ Marked ${result.count} existing advisor(s) as verified.`);
}

main()
  .catch((e) => {
    console.error("Failed to mark advisors verified:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
