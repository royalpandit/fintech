// One-off backfill: stamps publishedAt = createdAt for any approved market posts
// that were created before the auto-approve change. Run with:
//   npx tsx scripts/backfill-published-at.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const stale = await prisma.marketPost.findMany({
    where: { complianceStatus: "approved", publishedAt: null, deletedAt: null },
    select: { id: true, createdAt: true },
  });

  console.log(`Found ${stale.length} approved posts without publishedAt`);
  for (const p of stale) {
    await prisma.marketPost.update({
      where: { id: p.id },
      data: { publishedAt: p.createdAt },
    });
  }
  console.log("Backfill complete");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
