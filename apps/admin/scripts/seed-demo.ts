/**
 * seed-demo.ts — rich demo data for testing all social features
 *
 * Creates:
 *  - 2 extra advisors  (advisor2, advisor3)
 *  - 3 extra users     (user2, user3, user4)
 *  - Accepted friend connections between users (enables chat)
 *  - Follow relationships (users → advisors)
 *  - Market posts by each advisor (approved so they appear in feed)
 *  - Comments + reactions on posts
 *  - DM threads with seeded messages
 *  - In-app notifications for every role
 *
 * Run:
 *   npx tsx scripts/seed-demo.ts
 */

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

// ─── Extra seed accounts ──────────────────────────────────

const EXTRA_ADVISORS = [
  {
    fullName: "Vikram Rajan",
    email: "advisor2@corescent.local",
    phone: "+919999990005",
    password: "Advisor2@2025",
    sebi: "INA000000002",
    exp: 12,
    bio: "Macro strategist with 12 years in derivatives and index futures. Specialises in options flow analysis.",
    tags: ["Derivatives", "Nifty", "Options"],
  },
  {
    fullName: "Priya Sharma",
    email: "advisor3@corescent.local",
    phone: "+919999990006",
    password: "Advisor3@2025",
    sebi: "INA000000003",
    exp: 6,
    bio: "Small & mid-cap growth investor. 6 years tracking India's emerging sectors — EV, green energy, defence.",
    tags: ["SMID Cap", "EV", "Defence"],
  },
];

const EXTRA_USERS = [
  {
    fullName: "Arjun Kumar",
    email: "user2@corescent.local",
    phone: "+919999990007",
    password: "User2@2025",
  },
  {
    fullName: "Meera Singh",
    email: "user3@corescent.local",
    phone: "+919999990008",
    password: "User3@2025",
  },
  {
    fullName: "Siddharth Rao",
    email: "user4@corescent.local",
    phone: "+919999990009",
    password: "User4@2025",
  },
];

// ─── Helpers ──────────────────────────────────────────────

async function upsertUser(
  data: { fullName: string; email: string; phone: string; password: string },
  role: "advisor" | "user",
): Promise<number> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { phone: data.phone }] },
    select: { id: true },
  });
  if (existing) return existing.id;

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role,
      status: "active",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return user.id;
}

async function upsertAdvisorProfile(
  userId: number,
  sebi: string,
  exp: number,
  bio: string,
  tags: string[],
  verifierId: number,
) {
  const existing = await prisma.advisorProfile.findUnique({ where: { userId } });
  if (existing) return;
  await prisma.advisorProfile.create({
    data: {
      userId,
      sebiRegistrationNo: sebi,
      experienceYears: exp,
      bio,
      expertiseTags: tags,
      verificationStatus: "approved",
      verifiedAt: new Date(),
      verifiedByAdminId: verifierId,
    },
  });
}

async function upsertFollow(followerUserId: number, followingUserId: number) {
  await prisma.userFollow.upsert({
    where: { followerUserId_followingUserId: { followerUserId, followingUserId } },
    create: { followerUserId, followingUserId },
    update: {},
  });
}

async function upsertFriendRequest(
  fromUserId: number,
  toUserId: number,
  status = "accepted",
) {
  // Check pair in both directions
  const existing = await (prisma as any).friendRequest.findFirst({
    where: {
      OR: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    },
  });
  if (existing) return existing.id;

  const req = await (prisma as any).friendRequest.create({
    data: { fromUserId, toUserId, status },
  });
  return req.id;
}

async function upsertDmThread(userAId: number, userBId: number): Promise<number> {
  const existing = await prisma.dmThread.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userAId } } },
        { participants: { some: { userId: userBId } } },
      ],
    },
  });
  if (existing) return existing.id;

  const thread = await prisma.dmThread.create({
    data: {
      participants: { create: [{ userId: userAId }, { userId: userBId }] },
    },
  });
  return thread.id;
}

async function seedMessages(
  threadId: number,
  pairs: { senderId: number; content: string; minsAgo: number }[],
) {
  for (const p of pairs) {
    const existingCheck = await prisma.dmMessage.findFirst({
      where: { threadId, senderUserId: p.senderId, contentEnc: p.content },
    });
    if (existingCheck) continue;

    await prisma.dmMessage.create({
      data: {
        threadId,
        senderUserId: p.senderId,
        contentEnc: p.content,
        createdAt: new Date(Date.now() - p.minsAgo * 60_000),
      },
    });
  }
}

async function seedNotification(
  userId: number,
  title: string,
  message: string,
  channel = "in_app",
  minsAgo = 0,
) {
  const existing = await prisma.notification.findFirst({
    where: { userId, title, message },
  });
  if (existing) return;
  await prisma.notification.create({
    data: {
      userId,
      channel: channel as any,
      title,
      message,
      createdAt: new Date(Date.now() - minsAgo * 60_000),
    },
  });
}

async function seedMarketPost(
  advisorUserId: number,
  adminId: number,
  data: {
    title: string;
    content: string;
    sentiment: "bullish" | "bearish" | "neutral";
    assetType: "equity" | "crypto" | "mf" | "commodity" | "other";
    symbol?: string;
    risk: "low" | "medium" | "high";
    timeframe?: string;
    targetPrice?: number;
    daysAgo?: number;
  },
): Promise<number> {
  const existing = await prisma.marketPost.findFirst({
    where: { advisorUserId, title: data.title },
    select: { id: true },
  });
  if (existing) return existing.id;

  const publishedAt = new Date(Date.now() - (data.daysAgo ?? 0) * 86400_000);

  const post = await prisma.marketPost.create({
    data: {
      advisorUserId,
      title: data.title,
      content: data.content,
      sentiment: data.sentiment as any,
      assetType: data.assetType as any,
      marketSymbol: data.symbol ?? null,
      riskLevel: data.risk as any,
      timeframe: data.timeframe ?? null,
      targetPrice: data.targetPrice ?? null,
      disclaimer:
        "This is for educational purposes only. Not financial advice. Consult your SEBI-registered advisor before investing.",
      complianceStatus: "approved",
      publishedAt,
      createdAt: publishedAt,
    },
    select: { id: true },
  });

  // Log in compliance log
  try {
    await (prisma as any).complianceLog.create({
      data: {
        contentKind: "market_post",
        contentId: post.id,
        action: "approve",
        adminId,
        notes: "Seeded — auto-approved",
      },
    });
  } catch {
    // Table may not exist yet
  }

  return post.id;
}

async function seedReaction(postId: number, userId: number) {
  try {
    await prisma.marketReaction.create({
      data: { postId, userId, type: "like" },
    });
  } catch {
    // Unique constraint — already reacted
  }
}

async function seedComment(
  postId: number,
  userId: number,
  content: string,
  minsAgo = 0,
): Promise<number> {
  const existing = await prisma.marketComment.findFirst({
    where: { postId, userId, content },
    select: { id: true },
  });
  if (existing) return existing.id;

  const c = await prisma.marketComment.create({
    data: {
      postId,
      userId,
      content,
      createdAt: new Date(Date.now() - minsAgo * 60_000),
    },
    select: { id: true },
  });
  return c.id;
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  Seeding demo data...\n");

  // ── Find existing base accounts ──────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ["admin", "super_admin"] } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!adminUser) throw new Error("Run seed-all.ts first to create the base admin.");

  const advisor1User = await prisma.user.findFirst({
    where: { email: "advisor@corescent.local" },
    select: { id: true },
  });
  if (!advisor1User) throw new Error("Run seed-all.ts first to create the base advisor.");

  const user1 = await prisma.user.findFirst({
    where: { email: "user@corescent.local" },
    select: { id: true },
  });
  if (!user1) throw new Error("Run seed-all.ts first to create the base user.");

  const a1Id = advisor1User.id; // Ananya Mehta
  const u1Id = user1.id;       // Rohan Retail

  // ── Create extra advisors ────────────────────────────────
  console.log("  Creating advisors...");
  const a2Id = await upsertUser(EXTRA_ADVISORS[0], "advisor");
  await upsertAdvisorProfile(a2Id, EXTRA_ADVISORS[0].sebi, EXTRA_ADVISORS[0].exp, EXTRA_ADVISORS[0].bio, EXTRA_ADVISORS[0].tags, adminUser.id);

  const a3Id = await upsertUser(EXTRA_ADVISORS[1], "advisor");
  await upsertAdvisorProfile(a3Id, EXTRA_ADVISORS[1].sebi, EXTRA_ADVISORS[1].exp, EXTRA_ADVISORS[1].bio, EXTRA_ADVISORS[1].tags, adminUser.id);

  // ── Create extra users ───────────────────────────────────
  console.log("  Creating users...");
  const u2Id = await upsertUser(EXTRA_USERS[0], "user"); // Arjun Kumar
  const u3Id = await upsertUser(EXTRA_USERS[1], "user"); // Meera Singh
  const u4Id = await upsertUser(EXTRA_USERS[2], "user"); // Siddharth Rao

  // ── Follow relationships (users → advisors) ───────────────
  console.log("  Creating follows...");
  await upsertFollow(u1Id, a1Id); // Rohan follows Ananya
  await upsertFollow(u1Id, a2Id); // Rohan follows Vikram
  await upsertFollow(u2Id, a1Id); // Arjun follows Ananya
  await upsertFollow(u2Id, a3Id); // Arjun follows Priya
  await upsertFollow(u3Id, a2Id); // Meera follows Vikram
  await upsertFollow(u3Id, a3Id); // Meera follows Priya
  await upsertFollow(u4Id, a1Id); // Siddharth follows Ananya
  await upsertFollow(u4Id, a2Id); // Siddharth follows Vikram

  // ── Friend connections (accepted) ────────────────────────
  // Accepted friend requests unlock user↔user chat
  console.log("  Creating friend connections...");
  await upsertFriendRequest(u1Id, u2Id); // Rohan ↔ Arjun
  await upsertFriendRequest(u1Id, u3Id); // Rohan ↔ Meera
  await upsertFriendRequest(u2Id, u4Id); // Arjun ↔ Siddharth
  await upsertFriendRequest(u3Id, u4Id); // Meera ↔ Siddharth
  await upsertFriendRequest(u2Id, u3Id); // Arjun ↔ Meera

  // ── Market posts (advisors) ──────────────────────────────
  console.log("  Creating market posts...");

  // Ananya Mehta — 3 approved posts
  const p1 = await seedMarketPost(a1Id, adminUser.id, {
    title: "Nifty 50 — Breakout Confirmed, Target 24,800",
    content:
      "Price action over the last week confirms the ascending triangle breakout above 23,500 on strong volume. RSI at 62 leaves room to run. I see the next meaningful resistance at 24,800. Maintain trailing stop at 23,200. This is my highest-conviction trade of Q2.",
    sentiment: "bullish",
    assetType: "equity",
    symbol: "NIFTY50",
    risk: "medium",
    timeframe: "4–6 weeks",
    targetPrice: 24800,
    daysAgo: 5,
  });

  const p2 = await seedMarketPost(a1Id, adminUser.id, {
    title: "HDFC Bank — Accumulate on Dips Below ₹1,620",
    content:
      "HDFC Bank delivered strong NII growth of 11% YoY. Credit-deposit ratio is normalising which was the main bear case. At CMP of ₹1,610 the stock trades at 2.1x FY26 book — reasonable for a franchise of this quality. I would add in tranches: 40% now, 60% if it touches ₹1,560.",
    sentiment: "bullish",
    assetType: "equity",
    symbol: "HDFCBANK",
    risk: "low",
    timeframe: "12–18 months",
    targetPrice: 1980,
    daysAgo: 12,
  });

  const p3 = await seedMarketPost(a1Id, adminUser.id, {
    title: "Crude Oil — Cautious Below $85, Hedge Positions",
    content:
      "WTI crude struggling at $84–85 resistance. OPEC+ production cut compliance has softened. Global demand forecasts revised lower by IEA. I'm recommending clients to hedge their oil-linked holdings (OMCs, aviation) for the next 30 days. Not a screaming short — but no fresh longs either.",
    sentiment: "neutral",
    assetType: "commodity",
    symbol: "CRUDEOIL",
    risk: "high",
    timeframe: "1 month",
    daysAgo: 2,
  });

  // Vikram Rajan — 2 approved posts
  const p4 = await seedMarketPost(a2Id, adminUser.id, {
    title: "Bank Nifty Weekly Puts — Play the Consolidation",
    content:
      "Bank Nifty has been oscillating in a 800-point range for 3 weeks (49,200–50,000). IV is compressed at 12.5% — cheap premium. I'm buying 49,200 weekly puts at ₹48 and selling 48,500 puts at ₹22 for a net debit of ₹26. Max profit ₹674 if expiry at or below 48,500. Pure range-break play.",
    sentiment: "bearish",
    assetType: "equity",
    symbol: "BANKNIFTY",
    risk: "high",
    timeframe: "1 week",
    daysAgo: 1,
  });

  const p5 = await seedMarketPost(a2Id, adminUser.id, {
    title: "Nifty IT — Risk-Reward Favours Longs After 8% Correction",
    content:
      "Nifty IT index has shed 8% from its January peak on Fed-rate concerns. But the macro is turning: rate cuts expected H2 2025, deal wins accelerating at TCS and Infosys. The index is now trading at the 200-DMA — a historically reliable support. I'm initiating a 3% position in Nifty IT ETF.",
    sentiment: "bullish",
    assetType: "equity",
    symbol: "CNXIT",
    risk: "medium",
    timeframe: "3–6 months",
    targetPrice: 38000,
    daysAgo: 7,
  });

  // Priya Sharma — 1 approved + 1 pending
  const p6 = await seedMarketPost(a3Id, adminUser.id, {
    title: "Waaree Energies — Solar Play with 40% Upside",
    content:
      "India's solar capacity addition target of 100 GW by 2030 makes Waaree an obvious beneficiary. Order book at ₹28,000 Cr — 3.2x trailing revenue. Debt-free with 22% ROCE. At CMP ₹2,180 the stock is still 28% below its 52-week high despite no change in fundamentals. My 18-month target: ₹3,050.",
    sentiment: "bullish",
    assetType: "equity",
    symbol: "WAAREEENER",
    risk: "medium",
    timeframe: "18 months",
    targetPrice: 3050,
    daysAgo: 3,
  });

  // One pending post (not approved — for admin testing)
  const pendingExists = await prisma.marketPost.findFirst({
    where: { advisorUserId: a3Id, title: "IRFC — Railway Financing Giant Undervalued" },
  });
  if (!pendingExists) {
    await prisma.marketPost.create({
      data: {
        advisorUserId: a3Id,
        title: "IRFC — Railway Financing Giant Undervalued",
        content:
          "IRFC funds Indian Railways capex at a government-backed spread. It's essentially a quasi-sovereign bond with equity upside. At 1.4x book and 4.2% dividend yield, I see limited downside. Budget 2025 allocated ₹2.65 lakh Cr to Railways — IRFC will deploy a large chunk. My target: ₹260 in 12 months.",
        sentiment: "bullish",
        assetType: "equity",
        marketSymbol: "IRFC",
        riskLevel: "low" as any,
        timeframe: "12 months",
        targetPrice: 260,
        disclaimer:
          "For educational purposes only. Not financial advice.",
        complianceStatus: "pending",
      },
    });
  }

  // ── Comments + reactions ─────────────────────────────────
  console.log("  Creating comments & reactions...");

  // Post 1 — Nifty breakout
  await seedReaction(p1, u1Id);
  await seedReaction(p1, u2Id);
  await seedReaction(p1, u4Id);
  const c1 = await seedComment(p1, u1Id, "Finally! Been watching this level for weeks. Adding 50% position today.", 180);
  await seedComment(p1, u2Id, "Agreed — the volume confirmation is the key signal here.", 150);
  await seedComment(p1, u4Id, "What's the stop loss if it closes below 23,200 intraday?", 120);
  await seedComment(p1, a1Id, "Daily close below 23,200 triggers the stop. Intraday wicks don't count.", 100);

  // Post 2 — HDFC Bank
  await seedReaction(p2, u1Id);
  await seedReaction(p2, u3Id);
  await seedComment(p2, u3Id, "HDFC Bank has been my favourite private bank for years. Good call.", 300);
  await seedComment(p2, u1Id, "What about ICICI vs HDFC at these levels?", 200);
  await seedComment(p2, a1Id, "ICICI is slightly cheaper but HDFC has better asset quality. I'd prefer HDFC for long-term portfolios.", 180);

  // Post 4 — Bank Nifty options
  await seedReaction(p4, u2Id);
  await seedReaction(p4, u4Id);
  await seedComment(p4, u2Id, "What broker do you use for this strategy? SEBI compliance on options can be tricky.", 60);
  await seedComment(p4, a2Id, "Use any NSE-approved broker. This is a defined-risk spread so no margin issues.", 45);

  // Post 6 — Waaree Solar
  await seedReaction(p6, u1Id);
  await seedReaction(p6, u2Id);
  await seedReaction(p6, u3Id);
  await seedComment(p6, u3Id, "Impressed by the order book. Any concerns about execution risk?", 90);
  await seedComment(p6, a3Id, "Main risk is project delays from grid infrastructure. I've sized it at 3% of portfolio for that reason.", 70);

  // ── DM threads with messages ──────────────────────────────
  console.log("  Creating DM threads & messages...");

  // Thread: Rohan (u1) ↔ Ananya advisor (a1)
  const t1 = await upsertDmThread(u1Id, a1Id);
  await seedMessages(t1, [
    { senderId: u1Id, content: "Hi Ananya! Really impressed by your Nifty analysis. Quick question — should I wait for a retest of 23,500 before entering or is it safe to buy now?", minsAgo: 130 },
    { senderId: a1Id, content: "Hi Rohan! Great question. If you're investing (not trading), CMP is fine — just keep position size moderate. If you want a better risk-reward, set a limit order at 23,550. The range holds on any pullback.", minsAgo: 120 },
    { senderId: u1Id, content: "That makes sense. I'll split — 50% now and 50% at 23,550. Thanks!", minsAgo: 115 },
    { senderId: a1Id, content: "Smart approach. Remember: stop on daily close below 23,200. Good luck!", minsAgo: 110 },
    { senderId: u1Id, content: "Will do. Also saw your HDFC Bank note. Are you already in that position?", minsAgo: 50 },
    { senderId: a1Id, content: "Yes, took the first tranche at ₹1,612 yesterday. Watching ₹1,560 for the second.", minsAgo: 40 },
  ]);

  // Thread: Rohan (u1) ↔ Arjun (u2) — friends
  const t2 = await upsertDmThread(u1Id, u2Id);
  await seedMessages(t2, [
    { senderId: u1Id, content: "Arjun bhai, did you see Ananya's Nifty breakout call? She's been spot on all month!", minsAgo: 250 },
    { senderId: u2Id, content: "Yeah saw it! I've been following her for 3 months now. Consistent analyst. Did you enter?", minsAgo: 240 },
    { senderId: u1Id, content: "Half position. Bit nervous about the global cues — Fed meeting next week.", minsAgo: 235 },
    { senderId: u2Id, content: "Me too. I'm more into Vikram's options plays lately. Low capital, defined risk. Worth a look.", minsAgo: 230 },
    { senderId: u1Id, content: "Ha, options are a bit complex for me still. Maybe you can walk me through it sometime?", minsAgo: 20 },
    { senderId: u2Id, content: "Sure! Catch up on the weekend? I'll show you the Bank Nifty spread strategy.", minsAgo: 10 },
    { senderId: u1Id, content: "Done! Saturday 11 AM 👍", minsAgo: 5 },
  ]);

  // Thread: Arjun (u2) ↔ Vikram advisor (a2)
  const t3 = await upsertDmThread(u2Id, a2Id);
  await seedMessages(t3, [
    { senderId: u2Id, content: "Hi Vikram, really appreciate your Bank Nifty options breakdown. How often do you post these weekly plays?", minsAgo: 480 },
    { senderId: a2Id, content: "Hey Arjun! Every Monday before market open usually. Sometimes a mid-week update if something significant happens.", minsAgo: 460 },
    { senderId: u2Id, content: "Perfect. I executed the 49,200/48,500 put spread you outlined. Net debit ₹27.", minsAgo: 420 },
    { senderId: a2Id, content: "Nice execution. Set a 50% stop on the spread (exit if it goes to ₹14 net debit). Discipline is everything with options.", minsAgo: 400 },
    { senderId: u2Id, content: "Got it. Will set an alert. Thanks Vikram!", minsAgo: 390 },
  ]);

  // Thread: Meera (u3) ↔ Ananya advisor (a1)
  const t4 = await upsertDmThread(u3Id, a1Id);
  await seedMessages(t4, [
    { senderId: u3Id, content: "Hi Ananya, first time messaging you. Love the quality of your research. Do you cover mid-caps too or mainly large-caps?", minsAgo: 700 },
    { senderId: a1Id, content: "Hi Meera! Primarily large-cap and index — that's my strength. For mid-caps, Priya Sharma on this platform is excellent. Check her out!", minsAgo: 680 },
    { senderId: u3Id, content: "Oh I follow Priya too! Great recommendation. Will look forward to more of your large-cap work.", minsAgo: 660 },
    { senderId: a1Id, content: "Glad to have you here! Feel free to ask questions on any post.", minsAgo: 640 },
  ]);

  // Thread: Meera (u3) ↔ Siddharth (u4) — friends
  const t5 = await upsertDmThread(u3Id, u4Id);
  await seedMessages(t5, [
    { senderId: u3Id, content: "Siddharth, you following Priya's Waaree Energies call?", minsAgo: 320 },
    { senderId: u4Id, content: "Yes! Solar theme is solid for the next 5 years. Already have some Adani Solar, thinking of adding Waaree.", minsAgo: 300 },
    { senderId: u3Id, content: "Same thoughts. I'm putting 2% of my portfolio in it. Small but meaningful.", minsAgo: 280 },
    { senderId: u4Id, content: "Makes sense. Ananya's crude oil caution is also worth noting if you're holding OMCs.", minsAgo: 260 },
    { senderId: u3Id, content: "Good point, I have some BPCL. Will check the hedging advice again.", minsAgo: 240 },
  ]);

  // ── Notifications ─────────────────────────────────────────
  console.log("  Creating notifications...");

  // ── For users ────────────────────────────────────────────

  // Rohan (u1)
  await seedNotification(u1Id, "New post from Ananya Mehta", "Ananya posted: \"Nifty 50 — Breakout Confirmed, Target 24,800\"", "in_app", 5 * 60);
  await seedNotification(u1Id, "New post from Vikram Rajan", "Vikram posted: \"Bank Nifty Weekly Puts — Play the Consolidation\"", "in_app", 24 * 60);
  await seedNotification(u1Id, "Arjun Kumar accepted your connection", "You and Arjun Kumar are now connected. Start chatting!", "in_app", 48 * 60);
  await seedNotification(u1Id, "Ananya Mehta replied to your comment", "Ananya replied: \"Daily close below 23,200 triggers the stop.\"", "in_app", 100);

  // Arjun (u2)
  await seedNotification(u2Id, "New post from Ananya Mehta", "Ananya posted: \"HDFC Bank — Accumulate on Dips Below ₹1,620\"", "in_app", 12 * 60);
  await seedNotification(u2Id, "New post from Priya Sharma", "Priya posted: \"Waaree Energies — Solar Play with 40% Upside\"", "in_app", 3 * 60);
  await seedNotification(u2Id, "Vikram Rajan replied to your comment", "Vikram replied: \"Use any NSE-approved broker...\"", "in_app", 45);
  await seedNotification(u2Id, "Connection request accepted", "Meera Singh accepted your connection request.", "in_app", 60 * 24);

  // Meera (u3)
  await seedNotification(u3Id, "New post from Vikram Rajan", "Vikram posted: \"Nifty IT — Risk-Reward Favours Longs\"", "in_app", 7 * 60);
  await seedNotification(u3Id, "New post from Priya Sharma", "Priya posted: \"Waaree Energies — Solar Play with 40% Upside\"", "in_app", 3 * 60);
  await seedNotification(u3Id, "Priya Sharma replied to your comment", "Priya replied: \"Main risk is project delays from grid infrastructure.\"", "in_app", 70);
  await seedNotification(u3Id, "Siddharth Rao sent you a connection request", "Siddharth Rao wants to connect with you.", "in_app", 2 * 60);

  // Siddharth (u4)
  await seedNotification(u4Id, "New post from Ananya Mehta", "Ananya posted: \"Crude Oil — Cautious Below $85, Hedge Positions\"", "in_app", 2 * 60);
  await seedNotification(u4Id, "New post from Vikram Rajan", "Vikram posted: \"Bank Nifty Weekly Puts — Play the Consolidation\"", "in_app", 24 * 60);
  await seedNotification(u4Id, "Meera Singh accepted your connection", "You and Meera Singh are now connected!", "in_app", 4 * 60);
  await seedNotification(u4Id, "Ananya Mehta replied to your comment", "Ananya replied on \"Nifty 50 — Breakout Confirmed\"", "in_app", 100);

  // ── For advisors ──────────────────────────────────────────

  // Ananya (a1)
  await seedNotification(a1Id, "Your post was approved", "\"Nifty 50 — Breakout Confirmed, Target 24,800\" has been approved and is now live.", "in_app", 5 * 60 + 10);
  await seedNotification(a1Id, "Your post was approved", "\"HDFC Bank — Accumulate on Dips Below ₹1,620\" has been approved and is now live.", "in_app", 12 * 60 + 10);
  await seedNotification(a1Id, "New follower", "Rohan Retail started following you.", "in_app", 48 * 60);
  await seedNotification(a1Id, "New follower", "Siddharth Rao started following you.", "in_app", 36 * 60);
  await seedNotification(a1Id, "New follower", "Arjun Kumar started following you.", "in_app", 72 * 60);
  await seedNotification(a1Id, "New comment on your post", "Rohan Retail commented on \"Nifty 50 — Breakout Confirmed\"", "in_app", 180);

  // Vikram (a2)
  await seedNotification(a2Id, "Your post was approved", "\"Bank Nifty Weekly Puts — Play the Consolidation\" is now live.", "in_app", 25 * 60);
  await seedNotification(a2Id, "Your post was approved", "\"Nifty IT — Risk-Reward Favours Longs\" is now live.", "in_app", 7 * 60 + 15);
  await seedNotification(a2Id, "New follower", "Rohan Retail started following you.", "in_app", 50 * 60);
  await seedNotification(a2Id, "New follower", "Meera Singh started following you.", "in_app", 40 * 60);
  await seedNotification(a2Id, "New comment on your post", "Arjun Kumar commented on \"Bank Nifty Weekly Puts\"", "in_app", 60);

  // Priya (a3)
  await seedNotification(a3Id, "Your post was approved", "\"Waaree Energies — Solar Play with 40% Upside\" is now live.", "in_app", 3 * 60 + 20);
  await seedNotification(a3Id, "Post pending review", "\"IRFC — Railway Financing Giant Undervalued\" is under compliance review.", "in_app", 60);
  await seedNotification(a3Id, "New follower", "Arjun Kumar started following you.", "in_app", 5 * 60);
  await seedNotification(a3Id, "New follower", "Meera Singh started following you.", "in_app", 10 * 60);
  await seedNotification(a3Id, "New comment on your post", "Meera Singh commented on \"Waaree Energies\"", "in_app", 90);

  // ── For admin ─────────────────────────────────────────────
  await seedNotification(adminUser.id, "New post pending review", "Priya Sharma submitted \"IRFC — Railway Financing Giant Undervalued\" for compliance review.", "in_app", 50);
  await seedNotification(adminUser.id, "New advisor registration", "A new advisor has submitted their profile for verification.", "in_app", 72 * 60);
  await seedNotification(adminUser.id, "Content flagged", "A user reported content in the market post section.", "in_app", 24 * 60);

  // ── Done ──────────────────────────────────────────────────

  const DIV = "═".repeat(80);
  console.log(`\n${DIV}`);
  console.log("  DEMO SEED COMPLETE — All credentials");
  console.log(DIV);

  const accounts = [
    { role: "SUPER_ADMIN", email: "superadmin@corescent.local", phone: "+919999990001", password: "SuperAdmin@2025", note: "Full platform access" },
    { role: "ADMIN",       email: "admin@corescent.local",      phone: "+919999990002", password: "Admin@2025",      note: "Content moderation, advisor verification" },
    { role: "ADVISOR",     email: "advisor@corescent.local",    phone: "+919999990003", password: "Advisor@2025",    note: "Ananya Mehta · SEBI INA000000001 · 8yr" },
    { role: "ADVISOR",     email: "advisor2@corescent.local",   phone: "+919999990005", password: "Advisor2@2025",   note: "Vikram Rajan · SEBI INA000000002 · 12yr" },
    { role: "ADVISOR",     email: "advisor3@corescent.local",   phone: "+919999990006", password: "Advisor3@2025",   note: "Priya Sharma · SEBI INA000000003 · 6yr" },
    { role: "USER",        email: "user@corescent.local",       phone: "+919999990004", password: "User@2025",       note: "Rohan Retail · connected to Arjun, Meera" },
    { role: "USER",        email: "user2@corescent.local",      phone: "+919999990007", password: "User2@2025",      note: "Arjun Kumar · connected to Rohan, Meera, Siddharth" },
    { role: "USER",        email: "user3@corescent.local",      phone: "+919999990008", password: "User3@2025",      note: "Meera Singh · connected to Rohan, Arjun, Siddharth" },
    { role: "USER",        email: "user4@corescent.local",      phone: "+919999990009", password: "User4@2025",      note: "Siddharth Rao · connected to Arjun, Meera" },
  ];

  for (const a of accounts) {
    console.log(`\n  [${a.role.padEnd(11)}]  ${a.note}`);
    console.log(`    email    : ${a.email}`);
    console.log(`    phone    : ${a.phone}`);
    console.log(`    password : ${a.password}`);
  }

  console.log(`\n${DIV}`);
  console.log("  Connections seeded (can chat immediately):");
  console.log("    Rohan ↔ Arjun   |  Rohan ↔ Meera   |  Arjun ↔ Meera");
  console.log("    Arjun ↔ Siddharth  |  Meera ↔ Siddharth");
  console.log("\n  Advisor follows:");
  console.log("    Rohan    → Ananya, Vikram");
  console.log("    Arjun    → Ananya, Priya");
  console.log("    Meera    → Vikram, Priya");
  console.log("    Siddharth → Ananya, Vikram");
  console.log("\n  DM threads pre-seeded with messages:");
  console.log("    Rohan ↔ Ananya  |  Rohan ↔ Arjun  |  Arjun ↔ Vikram  |  Meera ↔ Ananya  |  Meera ↔ Siddharth");
  console.log(`${DIV}\n`);
}

main()
  .catch((e) => {
    console.error("\n❌  Demo seed failed:", e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
