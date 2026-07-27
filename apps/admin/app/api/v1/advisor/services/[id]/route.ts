import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { isServiceCategory } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

async function owned(advisorUserId: number, id: number) {
  return prisma.subscriptionService.findFirst({ where: { id, advisorUserId } });
}

// PATCH — edit fields / pause. DELETE — remove a service (guarded).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  const id = Number(params.id);
  if (!(await owned(auth.userId, id))) return err("Service not found", 404);

  const body = await parseBody<{
    name?: string;
    category?: string;
    description?: string;
    price?: number;
    yearlyPrice?: number | null;
    hasTrial?: boolean;
    trialDays?: number;
    paused?: boolean;
    isActive?: boolean;
  }>(req);
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim();
  if (isServiceCategory(body.category)) data.category = body.category;
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.price === "number" && body.price >= 0) data.price = body.price;
  if ("yearlyPrice" in body) data.yearlyPrice = typeof body.yearlyPrice === "number" && body.yearlyPrice > 0 ? body.yearlyPrice : null;
  if (typeof body.hasTrial === "boolean") data.hasTrial = body.hasTrial;
  if (typeof body.trialDays === "number" && body.trialDays > 0) data.trialDays = Math.round(body.trialDays);
  if (typeof body.paused === "boolean") data.paused = body.paused;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.subscriptionService.update({ where: { id }, data });
  return ok({ id: updated.id });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  const id = Number(params.id);
  if (!(await owned(auth.userId, id))) return err("Service not found", 404);

  // Guard: block deletion while active subscribers exist unless ?force=true.
  const force = new URL(req.url).searchParams.get("force") === "true";
  const active = await prisma.serviceSubscription.count({ where: { serviceId: id, status: "active" } });
  if (active > 0 && !force) {
    return err(`This service has ${active} active subscriber(s). Confirm to delete anyway.`, 409);
  }

  await prisma.subscriptionService.delete({ where: { id } });
  return ok({ deleted: true, id });
}
