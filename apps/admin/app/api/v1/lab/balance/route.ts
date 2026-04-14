import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const wallet = await prisma.virtualWallet.findUnique({ where: { userId } });
  if (!wallet) return err("No virtual wallet found. Create one first.", 404);

  return ok({ balance: Number(wallet.balance) });
}
