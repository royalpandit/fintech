import { NextRequest } from "next/server";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  activeSubscriberIds,
  createBroadcast,
  deliverBroadcast,
} from "@/lib/broadcast";
import { subscribersForServiceIds } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

// Analyst-only. GET → recipient count for the current selection.
// ?serviceIds=1,2 targets those services; absent = all active subscribers.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  const raw = new URL(req.url).searchParams.get("serviceIds");
  const serviceIds = raw
    ? raw.split(",").map(Number).filter((n) => Number.isInteger(n))
    : [];
  const ids =
    serviceIds.length > 0
      ? await subscribersForServiceIds(auth.userId, serviceIds)
      : await activeSubscriberIds(auth.userId);
  return ok({ recipientCount: ids.length });
}

// POST → create + (optionally) send a broadcast to all active subscribers.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    content?: string;
    scheduledAt?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    serviceIds?: number[]; // empty/absent = all subscribers
  }>(req);

  const serviceIds = Array.isArray(body.serviceIds)
    ? body.serviceIds.filter((n) => Number.isInteger(n))
    : [];

  const content = (body.content ?? "").trim();
  const hasAttachment = Boolean(body.attachmentUrl?.trim());
  if (!content && !hasAttachment) return err("Message or an attachment is required");

  let scheduledAt: Date | null = null;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (Number.isNaN(d.getTime())) return err("Invalid schedule time");
    if (d.getTime() <= Date.now()) return err("Scheduled time must be in the future");
    scheduledAt = d;
  }

  const recipients =
    serviceIds.length > 0
      ? await subscribersForServiceIds(auth.userId, serviceIds)
      : await activeSubscriberIds(auth.userId);
  if (recipients.length === 0) {
    return err("No subscribers match the selected recipients");
  }

  const { id } = await createBroadcast({
    analystUserId: auth.userId,
    content,
    scheduledAt,
    targetServiceIds: serviceIds,
    attachment: hasAttachment
      ? {
          attachmentUrl: body.attachmentUrl?.trim(),
          attachmentType: body.attachmentType === "image" ? "image" : "file",
          attachmentName: body.attachmentName?.slice(0, 255) ?? null,
        }
      : undefined,
  });

  // Send now unless scheduled for later.
  if (!scheduledAt) {
    const delivered = await deliverBroadcast(id);
    return ok({ id, sent: true, recipientCount: delivered });
  }
  return ok({ id, sent: false, scheduledAt: scheduledAt.toISOString(), recipientCount: recipients.length });
}
