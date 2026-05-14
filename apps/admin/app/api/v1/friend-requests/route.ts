import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list pending incoming friend requests
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  try {
    const requests = await (prisma as any).friendRequest.findMany({
      where: { toUserId: auth.userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        from: { select: { id: true, fullName: true } },
      },
    });
    return ok({ data: requests });
  } catch {
    return ok({ data: [] }); // table not yet migrated
  }
}
