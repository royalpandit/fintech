// Demo accounts for the professional types added in the roles/permissions work.
// Creates one advisor login per NEW professional type, and assigns explicit
// professional types to the existing demo advisors (they defaulted to RIA, which
// under the new gate cannot post buy/sell calls — so we make two of them SEBI).
//
// Run:  npx tsx scripts/seed-professionals.ts

import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ProfessionalType } from "@prisma/client";

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

type Demo = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  professionalType: ProfessionalType;
  sebi: string; // sebiRegistrationNo is required + unique; use a reg/ARN/placeholder
  bio: string;
  tags: string[];
};

const NEW_PROFESSIONALS: Demo[] = [
  {
    fullName: "Kavya Nair",
    email: "mfd@finuer.local",
    phone: "+919999990010",
    password: "Mfd@2025",
    professionalType: "mutual_fund_distributor",
    sebi: "ARN-198234",
    bio: "AMFI-registered mutual fund distributor. SIP & goal-based portfolios.",
    tags: ["Mutual Funds", "SIP", "Goal Planning"],
  },
  {
    fullName: "Rahul Desai",
    email: "broker@finuer.local",
    phone: "+919999990011",
    password: "Broker@2025",
    professionalType: "stock_broker",
    sebi: "NSE-BR-004567",
    bio: "Full-service stock broker. Execution, margins and market access.",
    tags: ["Broking", "Equity", "Derivatives"],
  },
  {
    fullName: "Neha Kapoor",
    email: "creator@finuer.local",
    phone: "+919999990012",
    password: "Creator@2025",
    professionalType: "finance_creator",
    sebi: "CREATOR-000001",
    bio: "Finance educator & content creator. Markets made simple.",
    tags: ["Education", "Personal Finance", "Content"],
  },
  {
    fullName: "Zenith Industries Ltd",
    email: "listedco@finuer.local",
    phone: "+919999990013",
    password: "Listed@2025",
    professionalType: "listed_company",
    sebi: "LISTCO-000001",
    bio: "Investor relations for Zenith Industries (NSE: ZENITH).",
    tags: ["Investor Relations", "Announcements"],
  },
  {
    fullName: "FinBridge Platform",
    email: "platform@finuer.local",
    phone: "+919999990014",
    password: "Platform@2025",
    professionalType: "financial_platform",
    sebi: "PLATFORM-000001",
    bio: "Financial platform — insurance, bonds and fintech products.",
    tags: ["Fintech", "Bonds", "Insurance"],
  },
];

type PostSeed = {
  title: string;
  content: string;
  assetType: string;
  sentiment: string;
  risk: string;
  symbol?: string;
};

// A couple of normal (non-trade) posts per professional so each has content.
const POSTS_BY_TYPE: Partial<Record<ProfessionalType, PostSeed[]>> = {
  mutual_fund_distributor: [
    {
      title: "Three flexi-cap funds for a 10-year SIP",
      content:
        "For long-horizon investors, flexi-cap funds let the manager move across market caps. Here's how I'd structure a ₹15k monthly SIP across three funds, and why staggering start dates smooths out entry risk.",
      assetType: "mf",
      sentiment: "bullish",
      risk: "medium",
    },
    {
      title: "STP vs lump-sum in a choppy market",
      content:
        "Sitting on idle cash? A Systematic Transfer Plan moves money from a liquid fund into equity in tranches, cutting timing risk. Worked example inside.",
      assetType: "mf",
      sentiment: "neutral",
      risk: "low",
    },
  ],
  stock_broker: [
    {
      title: "Margin & MTF: how leverage actually works",
      content:
        "A plain-English breakdown of margin trading facility, interest costs, and the pledge/unpledge cycle — plus the mistakes that trigger square-offs.",
      assetType: "equity",
      sentiment: "neutral",
      risk: "high",
    },
    {
      title: "A 5-point pre-market checklist",
      content:
        "Before you place your first order of the day: global cues, SGX Nifty, sector news, your open positions, and your risk per trade.",
      assetType: "equity",
      sentiment: "neutral",
      risk: "medium",
    },
  ],
  finance_creator: [
    {
      title: "Emergency fund 101",
      content:
        "How many months of expenses do you really need, where to park it, and why it's the foundation before any investing. No jargon.",
      assetType: "other",
      sentiment: "neutral",
      risk: "low",
    },
    {
      title: "The P/E ratio in 3 minutes",
      content:
        "What price-to-earnings really tells you, when a 'high' P/E is justified, and how to compare it across peers.",
      assetType: "equity",
      sentiment: "neutral",
      risk: "low",
    },
  ],
  listed_company: [
    {
      title: "Zenith Industries — Q1 FY26 results",
      content:
        "Revenue up 18% YoY, EBITDA margin at 21%. Management commentary on demand, capex, and the outlook for H2.",
      assetType: "equity",
      sentiment: "bullish",
      risk: "medium",
      symbol: "ZENITH",
    },
    {
      title: "Capacity expansion at our Pune facility",
      content:
        "The board has approved a ₹450 cr capex to add 30% capacity, with commissioning expected by Q4 FY26.",
      assetType: "equity",
      sentiment: "bullish",
      risk: "medium",
      symbol: "ZENITH",
    },
  ],
  financial_platform: [
    {
      title: "Government bonds now live on FinBridge",
      content:
        "Retail investors can now buy SGBs and G-Secs directly — how it works, settlement, and the taxation basics.",
      assetType: "other",
      sentiment: "neutral",
      risk: "low",
    },
    {
      title: "How our P2P lending product works",
      content:
        "Diversification across borrowers, expected returns, the risks involved, and how we underwrite. Read before you invest.",
      assetType: "other",
      sentiment: "neutral",
      risk: "high",
    },
  ],
};

async function createPost(advisorUserId: number, p: PostSeed, daysAgo: number) {
  const existing = await prisma.marketPost.findFirst({
    where: { advisorUserId, title: p.title },
    select: { id: true },
  });
  if (existing) return;
  const publishedAt = new Date(Date.now() - daysAgo * 86_400_000);
  await prisma.marketPost.create({
    data: {
      advisorUserId,
      title: p.title,
      content: p.content,
      assetType: p.assetType as never,
      sentiment: p.sentiment as never,
      riskLevel: p.risk as never,
      marketSymbol: p.symbol ?? null,
      disclaimer:
        "This is for educational purposes only. Not investment advice. Consult a SEBI-registered advisor before investing.",
      complianceStatus: "approved",
      audience: "public",
      publishedAt,
      createdAt: publishedAt,
    },
  });
}

// Existing demo advisors → explicit professional types so the platform still has
// SEBI members who can publish buy/sell (Entry/Target/SL) calls.
const EXISTING_TYPES: { email: string; professionalType: ProfessionalType }[] = [
  { email: "advisor@finuer.local", professionalType: "research_analyst" }, // Ananya Mehta
  { email: "advisor2@finuer.local", professionalType: "research_analyst" }, // Vikram Rajan
  { email: "advisor3@finuer.local", professionalType: "investment_advisor" }, // Priya Sharma (RIA)
];

async function verifierId(): Promise<number | null> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["super_admin", "admin"] } },
    select: { id: true },
  });
  return admin?.id ?? null;
}

async function main() {
  const adminId = await verifierId();

  for (const d of NEW_PROFESSIONALS) {
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: d.email }, { phone: d.phone }] },
      select: { id: true },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash(d.password, 12);
      user = await prisma.user.create({
        data: {
          fullName: d.fullName,
          email: d.email,
          phone: d.phone,
          passwordHash,
          role: "advisor",
          status: "active",
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
    }

    const existingProfile = await prisma.advisorProfile.findUnique({ where: { userId: user.id } });
    if (!existingProfile) {
      await prisma.advisorProfile.create({
        data: {
          userId: user.id,
          sebiRegistrationNo: d.sebi,
          professionalType: d.professionalType,
          experienceYears: 5,
          bio: d.bio,
          expertiseTags: d.tags,
          verificationStatus: "approved",
          verifiedAt: new Date(),
          verifiedByAdminId: adminId,
        },
      });
    } else {
      await prisma.advisorProfile.update({
        where: { userId: user.id },
        data: { professionalType: d.professionalType },
      });
    }

    const posts = POSTS_BY_TYPE[d.professionalType] ?? [];
    for (let i = 0; i < posts.length; i++) await createPost(user.id, posts[i], i + 1);

    console.log(`✓ ${d.professionalType.padEnd(24)} ${d.email}  /  ${d.password}  (+${posts.length} posts)`);
  }

  for (const e of EXISTING_TYPES) {
    const u = await prisma.user.findUnique({ where: { email: e.email }, select: { id: true } });
    if (!u) continue;
    await prisma.advisorProfile.updateMany({
      where: { userId: u.id },
      data: { professionalType: e.professionalType },
    });
    console.log(`↻ ${e.professionalType.padEnd(24)} ${e.email} (existing)`);
  }
}

main()
  .then(() => console.log("\nDone."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
