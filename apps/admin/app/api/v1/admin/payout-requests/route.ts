import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — payout queue for the admin review UI. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const status = req.nextUrl.searchParams.get("status");
  const valid = ["requested", "processing", "paid", "rejected"];

  const [rows, pendingCount] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: status && valid.includes(status) ? { status: status as "requested" } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        advisor: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.payoutRequest.count({ where: { status: { in: ["requested", "processing"] } } }),
  ]);

  // Balances let the reviewer see whether a payout can actually be covered.
  const wallets = await prisma.advisorWallet.findMany({
    where: { advisorUserId: { in: rows.map((r) => r.advisorUserId) } },
    select: { advisorUserId: true, balance: true },
  });
  const balanceBy = new Map(wallets.map((w) => [w.advisorUserId, Number(w.balance)]));

  return ok({
    data: rows.map((r) => ({
      id: r.id,
      advisor_user_id: r.advisorUserId,
      advisor_name: r.advisor?.fullName ?? "Unknown",
      advisor_email: r.advisor?.email ?? null,
      amount: Number(r.amount),
      advisor_balance: balanceBy.get(r.advisorUserId) ?? 0,
      status: r.status,
      review_note: r.reviewNote,
      created_at: r.createdAt.toISOString(),
    })),
    pendingCount,
  });
}
