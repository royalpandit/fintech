import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

const INITIAL_BALANCE = 1_000_000;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const wallet = await prisma.virtualWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: INITIAL_BALANCE },
  });

  return ok({ virtual_balance: Number(wallet.balance) });
}
