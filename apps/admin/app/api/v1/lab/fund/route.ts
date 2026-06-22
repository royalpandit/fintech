import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  computeFinuerScore,
  FREE_BALANCE_CAP,
  MAX_BALANCE_CAP,
  UNLOCK_SCORE,
} from "@/lib/finuer-score";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ amount?: number }>(req);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return err("amount must be a positive number");

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId: auth.userId } });
  if (!wallet) return err("No virtual wallet. Create one first.", 404);

  const newBalance = Number(wallet.balance) + amount;

  // Hard ceiling for everyone.
  if (newBalance > MAX_BALANCE_CAP) {
    return err(`Maximum paper balance is ₹${MAX_BALANCE_CAP.toLocaleString("en-IN")}.`);
  }

  // Beyond the free cap, the user must have earned the Finuer score benchmark
  // through posting and interacting on the platform.
  if (newBalance > FREE_BALANCE_CAP) {
    const { score, unlocked } = await computeFinuerScore(auth.userId);
    if (!unlocked) {
      return err(
        `You can hold up to ₹${FREE_BALANCE_CAP.toLocaleString("en-IN")} for now. ` +
          `Reach a Finuer score of ${UNLOCK_SCORE} (you're at ${score}) by posting and ` +
          `interacting on Finuer to unlock a higher balance.`,
        403,
      );
    }
  }

  const updated = await prisma.virtualWallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amount } },
  });

  return ok({
    added: amount,
    balance: Number(updated.balance),
  });
}
