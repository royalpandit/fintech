/**
 * The hundred writers.
 *
 * The prompts themselves live in prompts.ts, generated from the brief files so
 * that no rule is reworded by being retyped. This file is the part that is a
 * product decision rather than a transcript: which feed each desk posts to,
 * which category it files under, and the two times a day it publishes.
 *
 * Slots are IST and chosen by what the piece is for: pre-market desks land
 * before the open, intraday during the session, closing analysis after it, and
 * research, macro and personal finance in the evening when people read rather
 * than trade. Two per agent — the brief's "2 posts" — two hundred a day, and no
 * two agents share a minute, or the sweep would bunch dozens of generations
 * into one tick.
 */

// Relative, not "@/": the seed script imports this file from plain Node via
// tsx, which does not read the Next.js path alias.
import { AGENT_PROMPTS } from "./prompts";

export { MASTER_RULES } from "./prompts";

export type AgentTarget = "market_post" | "community_post";

export type AgentDef = {
  no: number;
  slug: string;
  name: string;
  department: string;
  target: AgentTarget;
  category: string;
  slots: [string, string];
  prompt: string;
};

/*
 * Appended to every prompt, and the last word on every conflict.
 *
 * The brief tells each writer to search for the latest information. It cannot:
 * the model behind these posts has no browser and a training cut-off months
 * old, so "search" has to be answered for it. The figures are fetched by
 * lib/content-agents/context.ts and pasted into the prompt, and that block is
 * what "verified" means here. The rest of this is the brief's own output rule
 * written in the form the publisher can actually parse, plus the two places the
 * platform overrides it: bold, which renders as literal asterisks in a feed
 * that prints post bodies as plain text, and `NO POST`, which has to arrive as
 * JSON the sweep can tell apart from a post.
 */
export const HOUSE_RULES = `
HOW "VERIFY" WORKS HERE — this overrides the brief's instruction to search.
You have no browser and no live search. Everything you remember about markets is
months out of date and must not be stated. The VERIFIED DATA block in the user
message was fetched seconds ago and is your ONLY source of fact. It replaces the
brief's research step: do not look for figures, use the ones you were given.

This applies to every factual claim, not only numbers:
- Do not state what any market, index, sector or stock did unless it is in the block.
  "US markets closed higher", "FIIs have been selling", "crude has been rising for
  weeks" are all forbidden unless the block says so.
- Do not name a company, event, IPO, deal, policy or earnings result that is not
  in the block.
- Do not date anything that is not dated in the block.
- No invented price, level, percentage, flow, holding, order size, subscription
  figure, tax rate, quote or estimate. Inventing one is the worst thing you can
  do here — worse than posting nothing.

If your usual beat is not in today's block, write from your angle about what IS
there. If the block genuinely has nothing you can honestly write about, that is
the brief's NO POST, and it must be returned as JSON:
{"skip": "reason in a few words"}

VOICE AND FORM
Write as a normal Indian retail investor sharing what they found. Hinglish in
Roman script is not optional: the hook and at least two more lines must be
Hinglish, with the finance terms in English (stock, earnings, margins,
valuation, FII, ETF). A post written entirely in English is a failed run.
This is the register — "Nifty ka move sabne dekha, par asli story yeh number
hai", "Order book strong hai, lekin margin wahi puri kahani badal deta hai".
No Devanagari, no forced Hindi translation of finance words, no heavy slang.
Never refer to yourself as an agent, an AI, a desk, a bot or Finuer's writer,
and never name your beat, your number or any system label. No "as your analyst".
5-6 short lines, 7 at the most, under about 180 words. One central idea only.
Hook that stops the scroll, then the verified fact, then why it matters, then the
catch or second-order effect or the real risk.
Analyse — do not restate the block, the reader can see the numbers.
Last line is exactly: Research: <specific stock/sector/asset + exact metric or catalyst>
No generic close ("monitor closely", "keep watching the market").
The flow labels in your brief — STOP / READ / UNDERSTAND / INSIGHT / FOMO, or
Hook / Fact / Risk — are instructions about structure. Never print them as line
prefixes; a person sharing a find does not label their own sentences.
PLAIN TEXT ONLY — this overrides the brief's "bold" rule. The feed prints post
bodies verbatim, so **stars** show up as stars. No bold, no markdown, no
headings, no emojis, no bullet characters. Emphasis comes from the sentence.
No guaranteed returns, no price target stated as certainty, no "multibagger",
no fake urgency, no "everyone is missing this" without evidence in the block.
Mention Finuer only if a real Finuer feature genuinely helps the reader's next
step. Never force it.

If recent posts of yours are listed, pick a different story, stock, hook and
format. Repeating yourself is a failed run.

Write ONE post for this run, not a batch.

Return ONLY a JSON object, no markdown fence, with exactly these keys:
{
  "title": "under 90 characters, the hook itself",
  "content": "the post body, plain text with real line breaks, ending with the Research: line",
  "sentiment": "bullish" | "bearish" | "neutral",
  "symbol": "a single NSE ticker in caps if the post is about one, else null"
}
`.trim();

const D1 = "Daily Indian Market";
const D2 = "Stock Movers & Catalysts";
const D3 = "Smart Money & Big Transactions";
const D4 = "IPO";
const D5 = "Indian Stock Opportunities";
const D6 = "US & Global";
const D7 = "Sectors, Commodities & Future";
const D8 = "Macro, Government & Economy";
const D9 = "Wealth & Personal Finance";
const D10 = "Psychology, Stories & Debate";

/**
 * Everything about a desk except its prompt.
 *
 * `category` does double duty: it is the community feed's filter value and, via
 * packForCategory, it decides which figures the writer is handed. Change one
 * and check the other — a desk filed under a category whose pack carries no
 * data for it will correctly refuse to post rather than guess.
 */
type AgentMeta = Omit<AgentDef, "prompt">;

const META: AgentMeta[] = [
  // ── Department 1 — Daily Indian Market (A001–A010) ────────────────────────
  { no: 1,  slug: "pre-market-master",   name: "Pre-Market Master",      department: D1, target: "market_post", category: "market",  slots: ["07:15", "08:20"] },
  { no: 2,  slug: "nifty-radar",         name: "Nifty Radar",            department: D1, target: "market_post", category: "market",  slots: ["07:40", "08:45"] },
  { no: 3,  slug: "bank-nifty-radar",    name: "Bank Nifty Radar",       department: D1, target: "market_post", category: "market",  slots: ["07:55", "08:35"] },
  { no: 4,  slug: "fii-dii-morning",     name: "FII / DII Morning",      department: D1, target: "market_post", category: "flows",   slots: ["08:05", "09:00"] },
  { no: 5,  slug: "global-cues-india",   name: "Global Cues to India",   department: D1, target: "market_post", category: "global",  slots: ["06:45", "07:30"] },
  { no: 6,  slug: "market-mood",         name: "Market Mood",            department: D1, target: "market_post", category: "market",  slots: ["10:30", "13:30"] },
  { no: 7,  slug: "sector-rotation",     name: "Sector Rotation Today",  department: D1, target: "market_post", category: "sectors", slots: ["11:15", "14:15"] },
  { no: 8,  slug: "market-movers",       name: "Market Movers Explained", department: D1, target: "market_post", category: "stocks", slots: ["15:45", "16:35"] },
  { no: 9,  slug: "market-question",     name: "Today's Market Question", department: D1, target: "market_post", category: "market", slots: ["16:05", "17:05"] },
  { no: 10, slug: "india-market-signal", name: "India Market Signal",    department: D1, target: "market_post", category: "market",  slots: ["17:35", "19:05"] },

  // ── Department 2 — Stock Movers & Catalysts (A011–A020) ───────────────────
  { no: 11, slug: "stocks-to-watch",     name: "Stocks to Watch Today",  department: D2, target: "market_post", category: "stocks",   slots: ["09:20", "18:10"] },
  { no: 12, slug: "biggest-gainer",      name: "Biggest Gainer Story",   department: D2, target: "market_post", category: "stocks",   slots: ["12:15", "15:55"] },
  { no: 13, slug: "biggest-loser",       name: "Biggest Loser Story",    department: D2, target: "market_post", category: "stocks",   slots: ["12:30", "16:15"] },
  { no: 14, slug: "earnings-surprise",   name: "Earnings Surprise",      department: D2, target: "market_post", category: "earnings", slots: ["09:35", "18:25"] },
  { no: 15, slug: "order-book-watch",    name: "Order Book Watch",       department: D2, target: "market_post", category: "stocks",   slots: ["10:20", "19:20"] },
  { no: 16, slug: "guidance-change",     name: "Guidance Change",        department: D2, target: "market_post", category: "earnings", slots: ["10:45", "19:35"] },
  { no: 17, slug: "margin-watch",        name: "Margin Watch",           department: D2, target: "market_post", category: "earnings", slots: ["11:45", "15:00"] },
  { no: 18, slug: "valuation-trigger",   name: "Valuation Trigger",      department: D2, target: "market_post", category: "ideas",    slots: ["12:00", "15:15"] },
  { no: 19, slug: "corporate-action",    name: "Corporate Action Watch", department: D2, target: "market_post", category: "stocks",   slots: ["10:05", "18:55"] },
  { no: 20, slug: "regulatory-catalyst", name: "Regulatory Catalyst",    department: D2, target: "market_post", category: "policy",   slots: ["09:50", "18:40"] },

  // ── Department 3 — Smart Money & Big Transactions (A021–A030) ─────────────
  { no: 21, slug: "unusual-volume",      name: "Unusual Volume / Price", department: D3, target: "market_post", category: "stocks",       slots: ["11:30", "14:30"] },
  { no: 22, slug: "stock-story",         name: "Stock Story Behind the Move", department: D3, target: "market_post", category: "stocks",  slots: ["12:45", "16:45"] },
  { no: 23, slug: "smart-money",         name: "Smart Money",            department: D3, target: "market_post", category: "flows",        slots: ["18:05", "20:05"] },
  { no: 24, slug: "promoter-buy-sell",   name: "Promoter Buy / Sell",    department: D3, target: "market_post", category: "flows",        slots: ["18:20", "20:20"] },
  { no: 25, slug: "block-deals",         name: "Block Deals",            department: D3, target: "market_post", category: "flows",        slots: ["18:35", "20:35"] },
  { no: 26, slug: "institutional-buying", name: "Institutional Buying",  department: D3, target: "market_post", category: "flows",        slots: ["18:50", "20:50"] },
  { no: 27, slug: "mutual-fund-moves",   name: "Mutual Fund Moves",      department: D3, target: "market_post", category: "mutual-funds", slots: ["19:50", "21:05"] },
  { no: 28, slug: "insider-activity",    name: "Insider Activity",       department: D3, target: "market_post", category: "flows",        slots: ["17:20", "21:20"] },
  { no: 29, slug: "big-transactions",    name: "Big Transactions",       department: D3, target: "market_post", category: "flows",        slots: ["17:50", "21:35"] },
  { no: 30, slug: "smart-money-contradiction", name: "Smart Money Contradiction", department: D3, target: "market_post", category: "flows", slots: ["19:38", "21:50"] },

  // ── Department 4 — IPO (A031–A040) ────────────────────────────────────────
  { no: 31, slug: "ipo-radar",           name: "IPO Radar",              department: D4, target: "market_post", category: "ipo", slots: ["09:10", "17:15"] },
  { no: 32, slug: "ipo-valuation",       name: "IPO Valuation",          department: D4, target: "market_post", category: "ipo", slots: ["09:25", "17:40"] },
  { no: 33, slug: "ipo-business-model",  name: "IPO Business Model",     department: D4, target: "market_post", category: "ipo", slots: ["09:40", "17:55"] },
  { no: 34, slug: "ipo-grey-market",     name: "IPO Grey Market / Sentiment", department: D4, target: "market_post", category: "ipo", slots: ["11:00", "16:25"] },
  { no: 35, slug: "ipo-risks",           name: "IPO Risks",              department: D4, target: "market_post", category: "ipo", slots: ["08:50", "16:55"] },
  { no: 36, slug: "ipo-growth",          name: "IPO Growth",             department: D4, target: "market_post", category: "ipo", slots: ["10:50", "19:10"] },
  { no: 37, slug: "ipo-use-of-funds",    name: "IPO Use of Funds",       department: D4, target: "market_post", category: "ipo", slots: ["10:10", "13:45"] },
  { no: 38, slug: "ipo-peer-comparison", name: "IPO Peer Comparison",    department: D4, target: "market_post", category: "ipo", slots: ["13:00", "20:10"] },
  { no: 39, slug: "ipo-listing-story",   name: "IPO Listing Story",      department: D4, target: "market_post", category: "ipo", slots: ["13:15", "20:25"] },
  { no: 40, slug: "ipo-market-misses",   name: "IPO What Market Misses", department: D4, target: "market_post", category: "ipo", slots: ["08:10", "19:45"] },

  // ── Department 5 — Indian Stock Opportunities (A041–A052) ─────────────────
  { no: 41, slug: "hidden-opportunity",  name: "Hidden Stock Opportunity", department: D5, target: "market_post", category: "ideas",   slots: ["19:15", "22:05"] },
  { no: 42, slug: "small-cap-hunter",    name: "Small Cap Hunter",       department: D5, target: "market_post", category: "ideas",     slots: ["19:30", "22:20"] },
  { no: 43, slug: "mid-cap-hunter",      name: "Mid Cap Hunter",         department: D5, target: "market_post", category: "ideas",     slots: ["20:00", "22:35"] },
  { no: 44, slug: "large-cap-hunter",    name: "Large Cap Hunter",       department: D5, target: "market_post", category: "ideas",     slots: ["20:15", "22:50"] },
  { no: 45, slug: "fcf-opportunity",     name: "FCF Opportunity",        department: D5, target: "market_post", category: "ideas",     slots: ["20:30", "23:05"] },
  { no: 46, slug: "earnings-growth",     name: "Earnings Growth",        department: D5, target: "market_post", category: "ideas",     slots: ["20:45", "23:20"] },
  { no: 47, slug: "turnaround-stock",    name: "Turnaround Stock",       department: D5, target: "market_post", category: "ideas",     slots: ["21:00", "23:35"] },
  { no: 48, slug: "market-share-winner", name: "Market Share Winner",    department: D5, target: "market_post", category: "ideas",     slots: ["21:15", "23:50"] },
  { no: 49, slug: "underfollowed-theme", name: "Underfollowed Theme",    department: D5, target: "market_post", category: "sectors",   slots: ["21:30", "06:05"] },
  { no: 50, slug: "next-big-theme",      name: "Next Big Theme",         department: D5, target: "market_post", category: "sectors",   slots: ["21:45", "06:20"] },
  { no: 51, slug: "value-vs-growth",     name: "Value vs Growth",        department: D5, target: "market_post", category: "ideas",     slots: ["22:00", "06:35"] },
  { no: 52, slug: "catalyst-watch",      name: "Catalyst Watch",         department: D5, target: "market_post", category: "stocks",    slots: ["22:15", "06:50"] },

  // ── Department 6 — US & Global (A053–A062) ────────────────────────────────
  { no: 53, slug: "us-market-radar",     name: "US Market Radar",        department: D6, target: "market_post", category: "global",      slots: ["06:15", "19:55"] },
  { no: 54, slug: "nasdaq-tech",         name: "Nasdaq / Tech",          department: D6, target: "market_post", category: "global",      slots: ["06:30", "20:40"] },
  { no: 55, slug: "fed-rates",           name: "Fed / Rates",            department: D6, target: "market_post", category: "macro",       slots: ["07:00", "21:10"] },
  { no: 56, slug: "us-earnings",         name: "US Earnings",            department: D6, target: "market_post", category: "global",      slots: ["07:20", "21:25"] },
  { no: 57, slug: "global-ai",           name: "Global AI",              department: D6, target: "market_post", category: "sectors",     slots: ["07:50", "21:40"] },
  { no: 58, slug: "global-commodities",  name: "Global Commodities",     department: D6, target: "market_post", category: "commodities", slots: ["08:15", "21:55"] },
  { no: 59, slug: "dollar-rupee",        name: "Dollar / Rupee",         department: D6, target: "market_post", category: "macro",       slots: ["08:40", "22:10"] },
  { no: 60, slug: "china-asia",          name: "China / Asia",           department: D6, target: "market_post", category: "global",      slots: ["09:05", "22:25"] },
  { no: 61, slug: "global-etf-asset",    name: "Global ETF / Asset",     department: D6, target: "market_post", category: "global",      slots: ["06:00", "22:40"] },
  { no: 62, slug: "global-contrarian",   name: "Global Contrarian",      department: D6, target: "market_post", category: "global",      slots: ["10:40", "22:55"] },

  // ── Department 7 — Sectors, Commodities & Future (A063–A072) ──────────────
  { no: 63, slug: "ai-infrastructure",   name: "AI Infrastructure",      department: D7, target: "market_post", category: "sectors",     slots: ["10:15", "23:10"] },
  { no: 64, slug: "semiconductors",      name: "Semiconductors",         department: D7, target: "market_post", category: "sectors",     slots: ["11:10", "23:25"] },
  { no: 65, slug: "power-grid",          name: "Power & Grid",           department: D7, target: "market_post", category: "sectors",     slots: ["11:25", "23:40"] },
  { no: 66, slug: "data-centers",        name: "Data Centers & Cooling", department: D7, target: "market_post", category: "sectors",     slots: ["11:40", "23:55"] },
  { no: 67, slug: "cybersecurity",       name: "Cybersecurity",          department: D7, target: "market_post", category: "sectors",     slots: ["11:55", "06:10"] },
  { no: 68, slug: "renewables-solar",    name: "Renewables / Solar",     department: D7, target: "market_post", category: "sectors",     slots: ["12:10", "06:25"] },
  { no: 69, slug: "nuclear-energy",      name: "Nuclear Energy",         department: D7, target: "market_post", category: "sectors",     slots: ["09:15", "17:10"] },
  { no: 70, slug: "critical-minerals",   name: "Critical Minerals",      department: D7, target: "market_post", category: "commodities", slots: ["12:25", "06:40"] },
  { no: 71, slug: "future-mobility",     name: "Future Mobility",        department: D7, target: "market_post", category: "sectors",     slots: ["12:40", "06:55"] },
  { no: 72, slug: "next-decade-themes",  name: "Next Decade Themes",     department: D7, target: "market_post", category: "sectors",     slots: ["12:55", "07:05"] },

  // ── Department 8 — Macro, Government & Economy (A073–A081) ────────────────
  { no: 73, slug: "rbi-watch",           name: "RBI Watch",              department: D8, target: "market_post", category: "macro",  slots: ["09:30", "17:25"] },
  { no: 74, slug: "inflation",           name: "Inflation",              department: D8, target: "market_post", category: "macro",  slots: ["06:58", "20:55"] },
  { no: 75, slug: "gdp-growth",          name: "GDP / Growth",           department: D8, target: "market_post", category: "macro",  slots: ["13:10", "17:45"] },
  { no: 76, slug: "government-policy",   name: "Government Policy",      department: D8, target: "market_post", category: "policy", slots: ["13:25", "18:00"] },
  { no: 77, slug: "capex-cycle",         name: "Capex Cycle",            department: D8, target: "market_post", category: "policy", slots: ["13:40", "18:15"] },
  { no: 78, slug: "consumption",         name: "Consumption",            department: D8, target: "market_post", category: "macro",  slots: ["13:55", "18:30"] },
  { no: 79, slug: "employment-wages",    name: "Employment / Wages",     department: D8, target: "market_post", category: "macro",  slots: ["09:45", "16:08"] },
  { no: 80, slug: "trade-exports",       name: "Trade / Exports",        department: D8, target: "market_post", category: "macro",  slots: ["14:10", "18:45"] },
  { no: 81, slug: "macro-contradiction", name: "Macro Contradiction",    department: D8, target: "market_post", category: "macro",  slots: ["14:25", "19:00"] },

  // ── Department 9 — Wealth & Personal Finance (A082–A091) ──────────────────
  { no: 82, slug: "personal-finance-mistake", name: "Personal Finance Mistake", department: D9, target: "community_post", category: "personal-finance", slots: ["14:40", "19:25"] },
  { no: 83, slug: "compounding",         name: "Compounding",            department: D9, target: "community_post", category: "personal-finance", slots: ["14:55", "19:40"] },
  { no: 84, slug: "tax-investing",       name: "Tax / Investing",        department: D9, target: "community_post", category: "personal-finance", slots: ["15:10", "20:22"] },
  { no: 85, slug: "etf-education",       name: "ETF Education",          department: D9, target: "community_post", category: "personal-finance", slots: ["15:25", "20:37"] },
  { no: 86, slug: "diversification",     name: "Diversification",        department: D9, target: "community_post", category: "personal-finance", slots: ["15:40", "20:52"] },
  { no: 87, slug: "risk-management",     name: "Risk Management",        department: D9, target: "community_post", category: "personal-finance", slots: ["16:00", "21:07"] },
  { no: 88, slug: "valuation-education", name: "Valuation Education",    department: D9, target: "community_post", category: "personal-finance", slots: ["16:20", "21:22"] },
  { no: 89, slug: "crypto-wealth",       name: "Crypto Wealth",          department: D9, target: "community_post", category: "crypto",           slots: ["16:40", "21:37"] },
  { no: 90, slug: "portfolio-check",     name: "Portfolio Check",        department: D9, target: "community_post", category: "personal-finance", slots: ["17:00", "21:52"] },
  { no: 91, slug: "money-decision",      name: "Money Decision",         department: D9, target: "community_post", category: "personal-finance", slots: ["17:30", "22:07"] },

  // ── Department 10 — Psychology, Stories & Debate (A092–A100) ──────────────
  { no: 92,  slug: "investor-psychology",     name: "Investor Psychology",       department: D10, target: "community_post", category: "psychology", slots: ["15:05", "22:22"] },
  { no: 93,  slug: "retail-investor-mistake", name: "Retail Investor Mistake",   department: D10, target: "community_post", category: "psychology", slots: ["15:20", "22:30"] },
  { no: 94,  slug: "contrarian-market",       name: "Contrarian Market",         department: D10, target: "community_post", category: "debate",     slots: ["15:35", "22:45"] },
  { no: 95,  slug: "market-story",            name: "Market Story",              department: D10, target: "community_post", category: "stories",    slots: ["15:50", "23:00"] },
  { no: 96,  slug: "what-everyone-is-missing", name: "What Everyone Is Missing", department: D10, target: "community_post", category: "debate",     slots: ["16:10", "23:15"] },
  { no: 97,  slug: "myth-buster",             name: "Myth Buster",               department: D10, target: "community_post", category: "psychology", slots: ["16:30", "23:30"] },
  { no: 98,  slug: "bull-vs-bear",            name: "Bull vs Bear",              department: D10, target: "community_post", category: "debate",     slots: ["16:50", "23:45"] },
  { no: 99,  slug: "future-prediction",       name: "Future Prediction Question", department: D10, target: "community_post", category: "debate",    slots: ["14:20", "06:33"] },
  { no: 100, slug: "finuer-big-idea",         name: "Finuer Big Idea",           department: D10, target: "community_post", category: "debate",     slots: ["14:50", "06:48"] },
];

/*
 * The table is checked at import rather than trusted.
 *
 * Two agents on the same minute is the one mistake here that does not announce
 * itself: the sweep publishes both, the daily token budget drains early, and
 * nothing in the feed says why. A missing prompt is the same kind of silence,
 * since a desk seeded with an empty system prompt still produces something.
 */
function buildAgents(): AgentDef[] {
  if (META.length !== 100) throw new Error(`catalogue has ${META.length} agents, expected 100`);

  const seenSlot = new Map<string, number>();
  const seenSlug = new Set<string>();

  return META.map((m) => {
    if (m.no < 1 || m.no > 100) throw new Error(`agent ${m.no}: number out of range`);
    if (seenSlug.has(m.slug)) throw new Error(`duplicate slug ${m.slug}`);
    seenSlug.add(m.slug);

    for (const slot of m.slots) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)) throw new Error(`agent ${m.no}: bad slot ${slot}`);
      const clash = seenSlot.get(slot);
      if (clash) throw new Error(`slot ${slot} used by agents ${clash} and ${m.no}`);
      seenSlot.set(slot, m.no);
    }

    const prompt = AGENT_PROMPTS[m.no];
    if (!prompt) throw new Error(`agent ${m.no}: no prompt in prompts.ts`);

    return { ...m, prompt };
  });
}

export const AGENTS: AgentDef[] = buildAgents();

/**
 * The bot account's address, keyed by agent number rather than slug.
 *
 * It used to be the slug, which broke the day the briefs were replaced: the new
 * taxonomy reuses several old slugs on different desks (old 27 Block Deals is
 * new 25), so a slug-keyed account would be claimed by one agent while another
 * row still held it — a unique-constraint failure halfway through a reseed. The
 * number is the one thing about a desk that does not move.
 *
 * No feed endpoint selects a user's email, so this is operator-facing only.
 */
export function agentBotEmail(agentNo: number): string {
  return `agent.${agentNo}@bots.finuer.com`;
}
