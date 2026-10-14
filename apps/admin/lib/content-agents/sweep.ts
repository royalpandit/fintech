import "server-only";
import { prisma } from "@/lib/prisma";
import { AGENT_DISCLAIMER, generateDraft } from "@/lib/content-agents/generate";

/*
 * The scheduled sweep.
 *
 * Runs on the cron every few minutes, publishes whatever slots have come due,
 * and is safe to run again a minute later. Safety comes from a row rather than
 * a lock: the run is claimed by creating ContentAgentRun(agentId, runDate, slot)
 * — unique on those three — before a single token is spent, so a second sweep
 * racing the first loses the insert and skips. A crash mid-generation leaves a
 * claimed row, which means that slot is not retried today; a duplicate post is
 * worse than a missing one.
 *
 * Nothing is batched across agents: one failure is one empty slot, not a lost
 * tick. Concurrency is small because each generation performs a grounded search,
 * and two hundred of those a day is already the budget.
 */

const GRACE_MINUTES = 25;
const MAX_PER_SWEEP = 6;
const CONCURRENCY = 2;

type DueAgent = {
  id: number;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  target: "market_post" | "community_post";
  category: string;
  botUserId: number;
  slot: string;
};

/** IST wall clock, as minutes since midnight and the calendar date it belongs to. */
function istClock(now = new Date()): { minutes: number; date: Date } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(now)) parts[p.type] = p.value;
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  return {
    minutes: hour * 60 + Number(parts.minute),
    // Midnight UTC of the IST calendar day, matching the @db.Date column.
    date: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`),
  };
}

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Slots that have passed but not by much.
 *
 * The grace window lets a sweep that was late, or a process that restarted,
 * still publish rather than skipping the slot for the day. It deliberately does
 * not wrap past midnight: a 23:50 slot missed entirely is yesterday's post, and
 * publishing it at 00:10 under today's date would be wrong twice over.
 */
function isDue(slot: string, nowMinutes: number): boolean {
  const at = slotMinutes(slot);
  return at <= nowMinutes && nowMinutes - at <= GRACE_MINUTES;
}

async function publishDraft(agent: DueAgent): Promise<{ marketPostId?: number; communityPostId?: number }> {
  const draft = await generateDraft(agent);

  /*
   * A market post must show its working.
   *
   * Grounding is offered to every generation but the model decides whether to
   * use it, and when it declines it still writes with total confidence: a
   * commodities draft skipped the search and quoted gold at $4,160/oz against a
   * real $4,185.80. Near enough to read as correct, wrong enough to publish,
   * and no better than a coin toss after a sharp move.
   *
   * So a post that asserts current facts and cannot show it searched does not
   * go out. The slot stays empty and the run says why, which is the brief's own
   * rule — verify, or leave it out. Community writing is reasoning and stories
   * with no live numbers to get wrong, so it is not held to this.
   */
  if (agent.target === "market_post" && !draft.grounded) {
    throw new Error("Not published: the model wrote without searching, so its figures are unverified");
  }

  if (agent.target === "market_post") {
    const post = await prisma.marketPost.create({
      data: {
        advisorUserId: agent.botUserId,
        title: draft.title,
        content: draft.content,
        assetType: "equity",
        marketSymbol: draft.symbol,
        sentiment: draft.sentiment,
        riskLevel: "medium",
        disclaimer: AGENT_DISCLAIMER,
        // Finuer's own editorial, not a submission awaiting a reviewer — and
        // the scheduled-post sweep only ever publishes approved rows.
        complianceStatus: "approved",
        audience: "public",
        publishedAt: new Date(),
        // Entry, target and stop-loss stay null. That is the line between
        // commentary and a regulated call, and these agents never cross it.
      },
      select: { id: true },
    });
    return { marketPostId: post.id };
  }

  const post = await prisma.communityPost.create({
    data: {
      userId: agent.botUserId,
      title: draft.title,
      content: draft.content,
      postType: "text",
      category: agent.category,
      sentiment: draft.sentiment,
      visibility: "public",
    },
    select: { id: true },
  });
  return { communityPostId: post.id };
}

export async function runContentAgents(): Promise<{
  due: number;
  published: number;
  failed: number;
  skipped: number;
}> {
  const { minutes, date } = istClock();

  const agents = await prisma.contentAgent.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, systemPrompt: true, model: true, temperature: true,
      target: true, category: true, botUserId: true, slots: true,
    },
  });

  const due: DueAgent[] = [];
  for (const a of agents) {
    for (const slot of a.slots) {
      if (isDue(slot, minutes)) due.push({ ...a, slot });
    }
  }
  if (!due.length) return { due: 0, published: 0, failed: 0, skipped: 0 };

  // Oldest slot first, so a backlog drains in the order it was meant to appear.
  due.sort((x, y) => slotMinutes(x.slot) - slotMinutes(y.slot));

  let published = 0;
  let failed = 0;
  let skipped = 0;
  const queue = due.slice(0, MAX_PER_SWEEP);

  const worker = async () => {
    for (;;) {
      const agent = queue.shift();
      if (!agent) return;

      // Claim first. Losing this insert means another sweep already has it.
      let runId: number;
      try {
        const run = await prisma.contentAgentRun.create({
          data: { agentId: agent.id, runDate: date, slot: agent.slot },
          select: { id: true },
        });
        runId = run.id;
      } catch {
        skipped++;
        continue;
      }

      try {
        const ids = await publishDraft(agent);
        await prisma.contentAgentRun.update({
          where: { id: runId },
          data: { status: "published", ...ids },
        });
        published++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.contentAgentRun.update({
          where: { id: runId },
          data: { status: "failed", error: message.slice(0, 500) },
        });
        console.error("[content-agents] %s @ %s failed: %s", agent.name, agent.slot, message);
        failed++;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    "[content-agents] due=%d published=%d failed=%d skipped=%d",
    due.length, published, failed, skipped,
  );
  return { due: due.length, published, failed, skipped };
}
