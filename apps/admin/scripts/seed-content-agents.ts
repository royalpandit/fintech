// Creates the hundred scheduled writers and the bot account each one posts as.
//
// Idempotent: everything is keyed by agentNo, so re-running after editing
// lib/content-agents/catalogue.ts updates prompts, slots, names and targets
// without touching anything already published. Posts keep the account that
// wrote them, which keeps the feed's history honest.
//
// Run:  npx tsx scripts/seed-content-agents.ts

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AGENTS, agentBotEmail } from "../lib/content-agents/catalogue";
import { personaForAgent } from "../lib/content-agents/personas";
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

  /*
   * What is already there, read before anything is written.
   *
   * A desk keeps its row and its account across a change of brief: agent 25 is
   * still agent 25 even though its beat went from Bulk Deals to Block Deals, and
   * the posts it has already published should keep their author. So the account
   * is found through the existing row, not through a name or an address that the
   * new catalogue may have moved somewhere else.
   */
  const before = await prisma.contentAgent.findMany({
    select: { agentNo: true, slug: true, botUserId: true },
  });
  const existingByNo = new Map(before.map(r => [r.agentNo, r]));

  /*
   * Slugs are parked before they are reassigned.
   *
   * ContentAgent.slug is unique and the new taxonomy reuses several old slugs on
   * different numbers — "block-deals" was 27 and is now 25. Updating row by row
   * would hit the constraint the moment a slug moves to a lower number than the
   * row still holding it, and would do so halfway through, leaving the catalogue
   * split between two briefs. Parking every slug first makes the order of the
   * loop irrelevant. If this script dies after this point, slugs read "tmp-<n>"
   * until it is run again.
   */
  if (before.length) {
    await prisma.$executeRawUnsafe(`UPDATE content_agents SET slug = 'tmp-' || agent_no`);
  }

  let created = 0;
  let updated = 0;

  for (const a of AGENTS) {
    const existing = existingByNo.get(a.no);
    const email = agentBotEmail(a.no);
    // The feed shows a person, not a desk — the brief's rule. Re-running this
    // renames the existing bot accounts from "Finuer <desk>" to their persona.
    const persona = personaForAgent(a.no);

    /*
     * The account: this desk's own if it has one, otherwise whoever already
     * holds the numbered address, otherwise a new one. The email is only
     * rewritten when nobody else holds it, because an account that exists is
     * worth more than a tidy address.
     */
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    let botId = existing?.botUserId ?? byEmail?.id;

    if (botId) {
      await prisma.user.update({
        where: { id: botId },
        data: {
          fullName: persona,
          ...(byEmail && byEmail.id !== botId ? {} : { email }),
        },
      });
    } else {
      const bot = await prisma.user.create({
        data: {
          fullName: persona,
          email,
          phone: botPhone(a.no),
          passwordHash: unusablePassword(),
          role: "user",
          status: "active",
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      botId = bot.id;
    }

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
        botUserId: botId,
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
        botUserId: botId,
        model: groqModelForAgent(a.no),
      },
    });

    if (existing) updated++;
    else created++;
    process.stdout.write(
      `  ${String(a.no).padStart(3)} ${a.name.padEnd(30)} ${persona.padEnd(21)} ` +
      `${a.slots.join(" ")}  ${a.target === "market_post" ? "market" : "community"}\n`,
    );
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
