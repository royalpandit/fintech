import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { notifyPayoutStatus } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Review a payout request. Advisors could raise requests, but there was no way
 * to action one — so requests piled up at "requested" forever and no payout
 * notification could ever fire.
 *
 * PATCH { status: "processing" | "paid" | "rejected", note?: string }
 */

const NEXT_STATES: Record<string, string[]> = {
  requested: ["processing", "paid", "rejected"],
  processing: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid payout id");

  const body = await parseBody<{ status?: string; note?: string }>(req);
  const status = String(body.status ?? "");
  if (!["processing", "paid", "rejected"].includes(status)) {
    return err("status must be processing, paid or rejected");
  }

  const existing = await prisma.payoutRequest.findUnique({ where: { id } });
  if (!existing) return err("Payout request not found", 404);

  const allowed = NEXT_STATES[existing.status] ?? [];
  if (!allowed.includes(status)) {
    return err(`Cannot move a ${existing.status} payout to ${status}`, 409);
  }

  const amount = Number(existing.amount);

  // Paying out debits the advisor's wallet. Do the debit and the status change
  // together so a failure can't mark it paid without moving the money.
  const payout = await prisma.$transaction(async (tx) => {
    if (status === "paid") {
      const wallet = await tx.advisorWallet.findUnique({
        where: { advisorUserId: existing.advisorUserId },
      });
      const balance = Number(wallet?.balance ?? 0);
      if (balance < amount) {
        throw new Error(
          `Advisor balance (₹${balance.toLocaleString("en-IN")}) is less than the payout amount`,
        );
      }
      await tx.advisorWallet.update({
        where: { advisorUserId: existing.advisorUserId },
        data: { balance: balance - amount },
      });
    }

    return tx.payoutRequest.update({
      where: { id },
      data: {
        status: status as "processing" | "paid" | "rejected",
        reviewedByAdminId: auth.userId,
        reviewNote: body.note?.trim() || existing.reviewNote,
      },
    });
  }).catch((e: unknown) => {
    throw e instanceof Error ? e : new Error("Payout update failed");
  });

  await notifyPayoutStatus({
    advisorUserId: existing.advisorUserId,
    amount,
    status,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: `payout_${status}`,
      module: "payments",
      targetKind: "payout_request",
      targetId: id,
      payload: { amount } as never,
    },
  });

  return ok({ payout });
}
