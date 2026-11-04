import "server-only";
import { prisma } from "@/lib/prisma";
import { groqComplete } from "@/lib/groq";
import { HOUSE_RULES, MASTER_RULES } from "@/lib/content-agents/catalogue";
import { buildContext, packForAgent } from "@/lib/content-agents/context";

/**
 * The writer had nothing it could honestly write about.
 *
 * Not a failure — a quiet slot is the correct outcome when the day's data does
 * not cover an agent's beat, and the sweep records it as such so a feed outage
 * stays distinguishable from a day with no IPOs in it.
 */
export class SkipRun extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SkipRun";
  }
}

export type DraftPost = {
  title: string;
  content: string;
  sentiment: "bullish" | "bearish" | "neutral";
  symbol: string | null;
  /**
   * Whether verified figures were handed to the writer. False means the feeds
   * were unreachable, and a factual post is not published without them.
   */
  grounded: boolean;
};

/*
 * The model is told to return bare JSON and mostly does, but "mostly" is not a
 * parser. It fences the object in ```json about a fifth of the time and
 * occasionally writes a sentence before it, so the braces are located rather
 * than assumed, and a failure to find them is an error the run records instead
 * of a post that silently never appears.
 */
function parseDraft(raw: string): Omit<DraftPost, "grounded"> {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1]!.trim();

  /*
   * The brief's own refusal, taken literally.
   *
   * It tells the writer to output `NO POST` when nothing material is verified,
   * and the house rules ask for that as JSON so the sweep can tell a decline
   * from a post. Some runs follow the brief instead and return the bare words —
   * which parsed as a broken response and was recorded as a failure, making a
   * correct refusal look like an outage. Both forms mean the same thing.
   */
  if (/^\W*no\s*post\b/i.test(text) && text.length < 200) {
    throw new SkipRun("no material story today");
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`No JSON object in model output: ${raw.slice(0, 160)}`);
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    throw new Error(`Unparseable JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  /*
   * The writer is allowed to decline.
   *
   * An agent whose beat is not in today's data has two options, and only one of
   * them is acceptable: say nothing, or invent. Asked for upcoming IPOs on a day
   * whose headlines had none, an early draft wrote a full post about a company
   * that is already listed. Giving it a way to refuse is what makes "do not
   * invent" an instruction it can actually follow.
   */
  if (typeof obj.skip === "string" && obj.skip.trim()) {
    throw new SkipRun(obj.skip.trim().slice(0, 120));
  }

  const title = stripDecoration(String(obj.title ?? "").trim());
  const content = stripDecoration(String(obj.content ?? "").trim());
  if (!title || !content) throw new Error("Model returned an empty title or body");

  const s = String(obj.sentiment ?? "neutral").toLowerCase();
  const sentiment: DraftPost["sentiment"] =
    s === "bullish" || s === "bearish" ? s : "neutral";

  // A ticker is optional, and a hallucinated one is worse than none. Only a
  // plain uppercase symbol is kept; anything else is dropped rather than cleaned.
  const rawSym = obj.symbol == null ? "" : String(obj.symbol).trim().toUpperCase();
  const symbol = /^[A-Z][A-Z0-9&-]{1,19}$/.test(rawSym) ? rawSym : null;

  return {
    title: title.slice(0, 190),
    content,
    sentiment,
    symbol,
  };
}

/*
 * Emoji and markdown bold, asked for and still arriving.
 *
 * The brief wants a finance creator's voice, not a decorated one, and the posts
 * render as plain text anyway — so literal asterisks show up as asterisks. The
 * instruction is in the prompt; this is for when the model ignores it, which it
 * does perhaps one time in five.
 */
function stripDecoration(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/gu, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Today in IST, written the way a person would read it. */
function istToday(): string {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function istNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/*
 * What this desk has already published.
 *
 * The brief's second run rule: "Run 2 ka story / stock / asset / hook / format
 * Run 1 se alag ho." The writer has no memory between runs, so the only way it
 * can honour that is to be shown what it said last time. Titles and tickers are
 * enough — they carry the story and the hook, which are the two things that may
 * not repeat.
 *
 * A failure here is not a reason to skip the slot: an unavoidably repetitive
 * post is worse than nothing, but a missing post is worse than a risk of one.
 */
async function recentlyPublished(agent: {
  botUserId: number;
  target: "market_post" | "community_post";
}): Promise<string[]> {
  try {
    if (agent.target === "market_post") {
      const rows = await prisma.marketPost.findMany({
        where: { advisorUserId: agent.botUserId },
        orderBy: { id: "desc" },
        take: 6,
        select: { title: true, marketSymbol: true },
      });
      return rows.map(r => (r.marketSymbol ? `${r.title}  [${r.marketSymbol}]` : r.title));
    }
    const rows = await prisma.communityPost.findMany({
      where: { userId: agent.botUserId },
      orderBy: { id: "desc" },
      take: 6,
      select: { title: true },
    });
    return rows.map(r => r.title ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function generateDraft(agent: {
  agentNo: number;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  category: string;
  botUserId: number;
  target: "market_post" | "community_post";
}): Promise<DraftPost> {
  const pack = packForAgent(agent.agentNo, agent.category);
  const [facts, recent] = await Promise.all([buildContext(pack), recentlyPublished(agent)]);

  // A pack that needs figures and could not get them. Caller decides; for a
  // market post that means no post rather than an invented one.
  if (facts === null) {
    return { title: "", content: "", sentiment: "neutral", symbol: null, grounded: false };
  }

  /*
   * The date is stated because the model has no clock, and the figures are
   * stated because it has no search. Between them it knows when it is writing
   * and what is true, which is everything it needs and nothing it can invent.
   */
  const parts = [`It is ${istToday()}, ${istNow()} IST.`];
  if (facts) {
    parts.push(
      "",
      "VERIFIED DATA — fetched just now. These are the only figures you may quote.",
      "Do not state any other number as fact. If something you want to say is not",
      "in this block, write about it qualitatively or leave it out.",
      "",
      facts,
      "",
    );
  } else {
    /*
     * The desks that need no figures, told so explicitly.
     *
     * Compounding, tax, diversification, psychology: their value is arithmetic
     * and principle, and "none" is the right pack for them. But the house rules
     * say the data block is the only source of fact, and with no block at all a
     * writer reads that as having nothing — Personal Finance Mistake declined a
     * slot with "no verified data available". So the absence is named rather
     * than left to inference, along with the one rule that still binds: an
     * illustration may be invented, a market fact may not.
     */
    parts.push(
      "",
      "NO DATA BLOCK TODAY — your beat does not need one, so this is not a reason",
      "to decline. Write from financial principles and arithmetic you can verify",
      "yourself, and work the numbers correctly.",
      "Any figure you use must be an explicitly labelled illustration — \"maan lo",
      "12% annual return\", \"₹10,000 monthly SIP\" — and never a claim about what",
      "the market, a stock, a fund, a rate or a tax rule currently is. No current",
      "price, index level, flow, yield or event. Those you genuinely do not have.",
      "",
    );
  }
  if (recent.length) {
    parts.push(
      "YOUR RECENT POSTS — do not repeat any of these stories, stocks, hooks or formats:",
      ...recent.map(t => `  • ${t}`),
      "",
    );
  }

  /*
   * The beat is named as a brief, not as a byline.
   *
   * It used to read 'Write today's post as "Pre-Market Master"', and the brief
   * now forbids any desk label reaching the post — a writer told to post AS a
   * name will sign with it. The account's display name is a person's, set in
   * personas.ts, and the post itself is written by a retail investor with no
   * title.
   */
  parts.push(
    `Your beat for this post: ${agent.name}. That is a brief for you, not a name`,
    "to use — it must not appear anywhere in the post. Write one post now.",
  );

  const raw = await groqComplete({
    model: agent.model,
    /*
     * Master rules, then the desk's own block, then the house rules — in the
     * brief's own order of precedence, with the platform's overrides last so
     * they are the final word on the two places the brief cannot be followed
     * literally (live search, and bold in a plain-text feed).
     */
    systemPrompt: `${MASTER_RULES}\n\n---\n\nYOUR OWN BRIEF — the master rules above win on any conflict:\n\n${agent.systemPrompt}\n\n---\n\n${HOUSE_RULES}`,
    userMessage: parts.join("\n"),
    temperature: agent.temperature,
    /*
     * Headroom for the thinking, not for the post.
     *
     * These models reason before answering and the reasoning is billed against
     * max_tokens, so a 120-word post can spend 1,400 tokens getting there. At
     * the 1,600 default the Compounding desk ran out mid-sentence and the run
     * failed on a ceiling rather than on anything wrong with the draft. Billing
     * is by tokens actually used, so a higher ceiling costs nothing on the runs
     * that do not need it.
     */
    maxTokens: 2400,
    signal: AbortSignal.timeout(60_000),
  });

  // "none" packs carry no figures to verify, so they are never gated on data.
  return { ...parseDraft(raw), grounded: pack === "none" ? true : Boolean(facts) };
}

/**
 * Carried on every market post these agents publish.
 *
 * The market feed is shared with SEBI-registered advisors, so a reader needs to
 * know this one is neither a person nor registered advice. The code already
 * keeps the harder boundary — entry, target and stop-loss require a registered
 * professional type, and an agent post never sets them — but a disclosure in
 * the post is what the reader actually sees.
 */
export const AGENT_DISCLAIMER =
  "Generated by a Finuer research agent and published automatically. " +
  "This is market commentary for information only — not investment advice, " +
  "and not a recommendation to buy or sell. Verify independently before acting.";
