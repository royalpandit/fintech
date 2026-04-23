import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_PAYOUT = 500; // INR

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    amount?: number;
    destinationType?: string;
    destinationDetails?: Record<string, unknown>;
  }>(req);

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return err("Valid amount is required");
  }
  if (amount < MIN_PAYOUT) {
    return err(`Minimum payout is ₹${MIN_PAYOUT}`);
  }

  const wallet = await prisma.advisorWallet.findUnique({
    where: { advisorUserId: auth.userId },
  });
  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  if (amount > balance) {
    return err(`Amount exceeds wallet balance (₹${balance.toLocaleString("en-IN")})`);
  }

  // Reject if another request is already in flight.
  const pending = await prisma.payoutRequest.findFirst({
    where: { advisorUserId: auth.userId, status: { in: ["requested", "processing"] } },
    select: { id: true },
  });
  if (pending) {
    return err("You already have a pending payout request", 409);
  }

  const payout = await prisma.payoutRequest.create({
    data: {
      advisorUserId: auth.userId,
      amount,
      destination: {
        type: body.destinationType ?? "bank",
        details: body.destinationDetails ?? {},
      } as any,
      status: "requested",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "payout_requested",
      module: "payments",
      targetKind: "payout_request",
      targetId: payout.id,
      payload: { amount } as any,
    },
  });

  return ok({ payout });
}
