import "server-only";

import { prisma } from "@/lib/prisma";
import { geminiChat } from "@/lib/gemini";

/**
 * Per-holding AI commentary for the portfolio detail page.
 *
 * Three of the existing agents are asked about one position the user actually
 * owns, rather than the user having to open each agent and retype the context.
 * The prompt carries their real numbers — quantity, average cost, live price,
 * unrealised P&L, how long they have held it and what share of the portfolio it
 * is — because that is the difference between "here is a report on RELIANCE"
 * and "here is what your RELIANCE position looks like".
 *
 * Agents are resolved by name so the set stays editable from
 * /super-admin/agents. If an operator renames or deactivates one, that panel
 * reports itself unavailable instead of the page failing.
 */

export type HoldingAgentKey = "research" | "technical" | "architect";

export const HOLDING_AGENTS: {
  key: HoldingAgentKey;
  /** Matched case-insensitively against GeminiAgent.name. */
  agentName: string;
  label: string;
  blurb: string;
  icon: string;
}[] = [
  {
    key: "research",
    agentName: "Stock Research AI",
    label: "Stock Research",
    blurb: "Fundamentals, valuation and what could move it from here",
    icon: "🔬",
  },
  {
    key: "technical",
    agentName: "Technical Analyst AI",
    label: "Technical Analysis",
    blurb: "Trend, momentum and the levels that matter to your entry",
    icon: "📈",
  },
  {
    key: "architect",
    agentName: "Portfolio Architect",
    label: "Portfolio Fit",
    blurb: "How this position sits inside the rest of your portfolio",
    icon: "🧭",
  },
];

export type HoldingContext = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  /** Share of the whole paper portfolio, percent. */
  weightPct: number;
  /** Days since the first buy of this symbol. */
  heldDays: number | null;
  firstBoughtAt: Date | null;
  /** Every other symbol held, so the architect can talk about concentration. */
  otherHoldings: { symbol: string; weightPct: number }[];
};

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** The shared factual preamble every agent gets. */
function positionBrief(ctx: HoldingContext): string {
  const held =
    ctx.heldDays == null
      ? "unknown"
      : ctx.heldDays === 0
        ? "opened today"
        : `${ctx.heldDays} day${ctx.heldDays === 1 ? "" : "s"}`;

  const others = ctx.otherHoldings.length
    ? ctx.otherHoldings
        .map((h) => `${h.symbol} (${h.weightPct.toFixed(1)}%)`)
        .join(", ")
    : "none — this is their only position";

  return [
    `The investor holds ${ctx.symbol} on the NSE.`,
    `Quantity: ${ctx.quantity}`,
    `Average cost: ${inr(ctx.avgPrice)}`,
    `Current price: ${inr(ctx.lastPrice)}`,
    `Position value: ${inr(ctx.marketValue)}`,
    `Unrealised P&L: ${ctx.unrealizedPnL >= 0 ? "+" : ""}${inr(ctx.unrealizedPnL)} (${ctx.unrealizedPnLPct >= 0 ? "+" : ""}${ctx.unrealizedPnLPct.toFixed(2)}%)`,
    `Share of their portfolio: ${ctx.weightPct.toFixed(1)}%`,
    `Held for: ${held}`,
    `Their other holdings: ${others}`,
  ].join("\n");
}

/**
 * Each agent already has its own system prompt and persona; this only says what
 * to do with this particular position, and asks for something short enough to
 * sit in a card next to two others.
 */
function taskFor(key: HoldingAgentKey, ctx: HoldingContext): string {
  switch (key) {
    case "research":
      return [
        `Give a concise research read on ${ctx.symbol} for someone who already owns it.`,
        "",
        "Cover, briefly:",
        "- What the business does and how it currently earns",
        "- Valuation now versus its own history and its peers",
        "- The two or three things most likely to move the stock over the next year",
        "- The main risk to the thesis",
        "",
        "End with a one-line view framed for an existing holder, not a new buyer.",
      ].join("\n");

    case "technical":
      return [
        `Give a technical read on ${ctx.symbol} relative to this investor's entry.`,
        "",
        "Cover, briefly:",
        "- Current trend on the daily and weekly",
        "- Nearest support and resistance, with actual price levels",
        `- Where their average cost of ${inr(ctx.avgPrice)} sits against those levels`,
        "- Momentum (RSI / MACD direction) in plain words",
        "",
        "End with the level that would invalidate the current setup.",
      ].join("\n");

    case "architect":
      return [
        `Assess how ${ctx.symbol} fits this investor's portfolio as a whole.`,
        "",
        "Cover, briefly:",
        `- Whether ${ctx.weightPct.toFixed(1)}% is a sensible weight for a position like this`,
        "- Sector or factor overlap with their other holdings",
        "- What this portfolio is missing that would balance it",
        "- Whether to add, hold, trim, or exit — and why",
        "",
        "Talk about the portfolio, not just the stock.",
      ].join("\n");
  }
}

/*
 * Cache.
 *
 * A visit to this page fires three Gemini calls. Without a cache, every
 * refresh, back-navigation and re-render pays for all three again. The key
 * includes the rounded position value, so the analysis is re-run when the
 * position actually changes but not when the price ticks a few paise.
 *
 * In-process and therefore per-instance: a serverless deployment will miss more
 * often than a single long-running server. That is acceptable for a cache whose
 * only job is to stop obvious waste — correctness never depends on a hit.
 */
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { text: string; at: number }>();

function cacheKey(userId: number, key: HoldingAgentKey, ctx: HoldingContext): string {
  return [
    userId,
    key,
    ctx.symbol,
    ctx.quantity,
    Math.round(ctx.avgPrice),
    Math.round(ctx.lastPrice),
  ].join(":");
}

/*
 * One flat shape rather than a discriminated union.
 *
 * tsconfig has `strict: false`, which turns off the narrowing that would make
 * `if (!result.ok)` reveal an `error` field — callers get "Property 'error'
 * does not exist" instead. A single optional-field type is honest about what
 * this configuration can actually check.
 */
export type InsightResult = {
  ok: boolean;
  text?: string;
  error?: string;
  cached?: boolean;
  agent?: string;
};

export async function getHoldingInsight(
  userId: number,
  key: HoldingAgentKey,
  ctx: HoldingContext,
): Promise<InsightResult> {
  const spec = HOLDING_AGENTS.find((a) => a.key === key);
  if (!spec) return { ok: false, error: "Unknown agent" };

  const ck = cacheKey(userId, key, ctx);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ok: true, text: hit.text, cached: true, agent: spec.label };
  }

  const agent = await prisma.geminiAgent.findFirst({
    where: { name: { equals: spec.agentName, mode: "insensitive" }, isActive: true },
  });
  if (!agent) {
    return {
      ok: false,
      error: `The ${spec.label} agent is not available. An admin can re-enable "${spec.agentName}" under Agents.`,
    };
  }

  try {
    const text = await geminiChat({
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      history: [],
      userMessage: `${positionBrief(ctx)}\n\n---\n\n${taskFor(key, ctx)}`,
    });

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "The agent returned an empty response." };

    cache.set(ck, { text: trimmed, at: Date.now() });
    return { ok: true, text: trimmed, cached: false, agent: spec.label };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "The agent could not be reached.",
    };
  }
}
