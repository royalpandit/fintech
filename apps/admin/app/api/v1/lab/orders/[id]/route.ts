import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { cancelPaperOrder, serializePaperOrder } from "@/lib/paper-order-engine";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return err("Invalid order id");

  try {
    const order = await cancelPaperOrder(auth.userId, id);
    return ok({ order: serializePaperOrder(order) });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Cancel failed", 400);
  }
}
