import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

const MAX_TOP_UP = 10_000_000;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ amount?: number }>(req);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return err("amount must be a positive number");
  if (amount > MAX_TOP_UP) return err(`Maximum top-up is ₹${MAX_TOP_UP.toLocaleString("en-IN")}`);

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId: auth.userId } });
  if (!wallet) return err("No virtual wallet. Create one first.", 404);

  const updated = await prisma.virtualWallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amount } },
  });

  return ok({
    added: amount,
    balance: Number(updated.balance),
  });
}
