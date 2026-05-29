import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function ownedList(userId: number, id: number) {
  return prisma.watchlist.findFirst({ where: { id, userId } });
}

/** PATCH — rename. DELETE — remove watchlist (keeps at least one). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return err("Invalid id");

  const list = await ownedList(auth.userId, id);
  if (!list) return err("Watchlist not found", 404);

  const body = await parseBody<{ name?: string }>(req);
  const name = (body.name ?? "").trim();
  if (!name) return err("name is required");

  const updated = await prisma.watchlist.update({
    where: { id },
    data: { name },
  });

  return ok({ watchlist: { id: updated.id, name: updated.name } });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return err("Invalid id");

  const count = await prisma.watchlist.count({ where: { userId: auth.userId } });
  if (count <= 1) return err("You must keep at least one watchlist");

  const list = await ownedList(auth.userId, id);
  if (!list) return err("Watchlist not found", 404);

  await prisma.watchlist.delete({ where: { id } });
  return ok({ deleted: true, id });
}
