import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{
    provider?: string;
    bankName?: string;
    accountMasked?: string;
  }>(req);

  const account = await prisma.bankAccount.create({
    data: {
      userId,
      bankName: body.bankName || "UPI",
      accountMasked: body.accountMasked,
      provider: body.provider || "upi",
    },
  });

  return ok({ connected: true, provider: account.provider, account_id: account.id });
}
