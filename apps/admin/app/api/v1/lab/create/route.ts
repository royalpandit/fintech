import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

const INITIAL_BALANCE = 1_000_000;

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const wallet = await prisma.virtualWallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: INITIAL_BALANCE },
  });

  return ok({ virtual_balance: Number(wallet.balance) });
}
