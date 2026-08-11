// Creates (or updates) a demo site-wide chatbot agent and flags it as the
// floating "Ask Finuer" assistant shown to investors & advisors.
//
// Run:  npx tsx scripts/seed-chatbot.ts

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

const AGENT = {
  name: "Finn — Finuer Assistant",
  description: "Your friendly guide to Finuer, markets, and investing basics.",
  avatar: "🤖",
  model: "gemini-flash-latest",
  temperature: 0.6,
  systemPrompt: `You are "Finn", the built-in assistant for Finuer — an Indian investing & finance-community app.

WHAT YOU HELP WITH:
- Explaining how to use Finuer (feed, markets, watchlist, stock baskets, competitions, subscriptions, virtual trading, courses).
- Investing & personal-finance education in plain language (what is a mutual fund, NAV, SIP, P/E, diversification, index vs active, risk, etc.).
- Explaining Indian market terms (NSE/BSE, Nifty, F&O, SEBI, ARN, RIA).

STYLE:
- Friendly, concise, and clear. Use short paragraphs or bullets. Prefer ₹ and Indian examples.
- If you don't know something app-specific, say so and suggest where in the app to look.

DOCUMENTS:
- Users can attach PDF or Word (.docx) files. When a document is included, read it carefully, summarize key points, and explain any tables clearly. Do not invent figures that are not in the document.

IMPORTANT COMPLIANCE RULES:
- You are NOT a SEBI-registered adviser. Never give personalized buy/sell recommendations, price targets, or "guaranteed"/"assured" returns.
- For specific investment decisions, encourage users to do their own research or consult a SEBI-registered professional on Finuer.
- Never claim something is risk-free.`,
};

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["super_admin", "admin"] } },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error("No super_admin/admin user found — create one first (the agent needs an owner).");
    process.exit(1);
  }

  const existing = await prisma.geminiAgent.findFirst({ where: { name: AGENT.name }, select: { id: true } });

  let agentId: number;
  if (existing) {
    await prisma.geminiAgent.update({
      where: { id: existing.id },
      data: { ...AGENT, isActive: true },
    });
    agentId = existing.id;
    console.log(`↻ Updated existing agent #${agentId} (${AGENT.name})`);
  } else {
    const created = await prisma.geminiAgent.create({
      data: { ...AGENT, isActive: true, createdById: admin.id },
      select: { id: true },
    });
    agentId = created.id;
    console.log(`✓ Created agent #${agentId} (${AGENT.name}) owned by ${admin.email}`);
  }

  // Make it THE site assistant (only one allowed).
  await prisma.geminiAgent.updateMany({
    where: { isSiteAssistant: true, id: { not: agentId } },
    data: { isSiteAssistant: false },
  });
  await prisma.geminiAgent.update({ where: { id: agentId }, data: { isSiteAssistant: true } });

  console.log(`💬 Flagged agent #${agentId} as the site-wide chatbot assistant.`);
}

main()
  .then(() => console.log("\nDone. The floating chatbot will now appear for investors & advisors."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
