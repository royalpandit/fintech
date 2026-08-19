import { prisma } from "@/lib/prisma";
import { deriveEffectiveStatus, getParticipationStart } from "@/lib/competition";

/**
 * Competition status lifecycle.
 *
 * `status` was only ever set at creation and never moved again, so competitions
 * sat at "upcoming" long after their window had opened and closed. The app
 * already knows the right answer — `deriveEffectiveStatus()` computes it from
 * the dates for display — but nothing ever wrote it back, so the stored status
 * (which admin lists, badges and the completed-tab check read) stayed wrong.
 *
 * This persists the derived status. Runs opportunistically on list loads, the
 * same way `publishDueScheduledPosts` and `sendDueBroadcasts` do.
 */

const SWEEPABLE = ["upcoming", "live", "completed"] as const;

export async function sweepCompetitionStatuses(): Promise<void> {
  try {
    const rows = await prisma.competition.findMany({
      // Draft and cancelled are deliberate states — never auto-move them.
      where: { status: { notIn: ["draft", "cancelled"] } },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        participationStartDate: true,
        participationEndDate: true,
        resultDeclaredAt: true,
      },
    });

    const moves = new Map<string, number[]>();
    for (const row of rows) {
      const next = deriveEffectiveStatus(row);
      if (next === row.status) continue;
      if (!(SWEEPABLE as readonly string[]).includes(next)) continue;
      const list = moves.get(next) ?? [];
      list.push(row.id);
      moves.set(next, list);
    }

    for (const [status, ids] of moves) {
      await prisma.competition.updateMany({
        where: { id: { in: ids } },
        data: { status: status as (typeof SWEEPABLE)[number] },
      });
    }
  } catch {
    // Never block a page render on the sweep.
  }
}

type VisibilityRow = {
  status: string;
  visibility: string;
  startDate: Date;
  endDate: Date;
  participationStartDate: Date | null;
  resultDeclaredAt: Date | null;
};

/**
 * Why a competition isn't showing on the public Live tab, in plain words — so
 * an admin who creates one and can't find it is told why instead of guessing.
 */
export function userVisibilityIssue(row: VisibilityRow, now = new Date()): string | null {
  if (row.status === "draft") return "Draft — publish it to make it visible";
  if (row.status === "cancelled") return "Cancelled";
  if (row.visibility === "hidden") return "Visibility is Hidden — users can't see this";
  if (row.resultDeclaredAt) return "Result declared — shows under Completed";
  if (row.endDate < now) return "End date has passed — shows under Completed";
  if (getParticipationStart(row) > now) return "Starts later — shows under Upcoming";
  return null;
}
