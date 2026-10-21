// Creates the hundred scheduled writers and the bot account each one posts as.
//
// Idempotent: upserts by agentNo and by bot email, so re-running after editing
// lib/content-agents/catalogue.ts updates prompts, slots and targets without
// touching anything already published.
//
// Run:  npx tsx scripts/seed-content-agents.ts

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AGENTS, agentBotEmail } from "../lib/content-agents/catalogue";
import { groqModelForAgent } from "../lib/content-agents/models";

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

/*
 * Bot accounts get a random password nobody holds.
 *
 * They are never signed into — the sweep writes posts with their userId
 * directly — so a known or shared secret would be a login nobody needs and an
 * attacker might. A fresh 32-byte value per account means there is no password
 * to leak, including to whoever runs this script.
 */
function unusablePassword(): string {
  const bytes = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
  return bcrypt.hashSync(bytes.toString("hex"), 10);
}

/** 9xxxxxxxxx, unique per agent — User.phone is unique and required. */
function botPhone(no: number): string {
  return `9${String(900_000_000 + no).padStart(9, "0")}`;
}

async function main() {
  console.log(`Seeding ${AGENTS.length} content agents…\n`);

  let created = 0;
  let updated = 0;

  for (const a of AGENTS) {
    const email = agentBotEmail(a.slug);

    const bot = await prisma.user.upsert({
      where: { email },
      update: { fullName: `Finuer ${a.name}` },
      create: {
        fullName: `Finuer ${a.name}`,
        email,
        phone: botPhone(a.no),
        passwordHash: unusablePassword(),
        role: "user",
        status: "active",
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });

    const existing = await prisma.contentAgent.findUnique({
      where: { agentNo: a.no },
      select: { id: true },
    });

    await prisma.contentAgent.upsert({
      where: { agentNo: a.no },
      update: {
        slug: a.slug,
        name: a.name,
        department: a.department,
        systemPrompt: a.prompt,
        target: a.target,
        category: a.category,
        slots: a.slots,
        botUserId: bot.id,
        model: groqModelForAgent(a.no),
      },
      create: {
        agentNo: a.no,
        slug: a.slug,
        name: a.name,
        department: a.department,
        systemPrompt: a.prompt,
        target: a.target,
        category: a.category,
        slots: a.slots,
        botUserId: bot.id,
        model: groqModelForAgent(a.no),
      },
    });

    if (existing) updated++;
    else created++;
    process.stdout.write(`  ${String(a.no).padStart(3)} ${a.name.padEnd(32)} ${a.slots.join(" ")}  ${a.target === "market_post" ? "market" : "community"}\n`);
  }

  const market = AGENTS.filter(a => a.target === "market_post").length;
  console.log(
    `\nDone. ${created} created, ${updated} updated.\n` +
    `${market} market-feed agents, ${AGENTS.length - market} community-feed agents, ` +
    `${AGENTS.length * 2} posts/day.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
