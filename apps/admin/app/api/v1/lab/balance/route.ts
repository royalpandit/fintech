import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId } });
  if (!wallet) return err("No virtual wallet found. Create one first.", 404);

  return ok({ balance: Number(wallet.balance) });
}
