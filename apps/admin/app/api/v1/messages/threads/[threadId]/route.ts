import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function assertParticipant(threadId: number, userId: number) {
  const p = await prisma.dmThreadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  return Boolean(p);
}

// GET — fetch messages in a thread
export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const threadId = Number(params.threadId);
  if (!await assertParticipant(threadId, auth.userId)) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ? Number(searchParams.get("cursor")) : undefined;

  const messages = await prisma.dmMessage.findMany({
    where: {
      threadId,
      deletedAt: null,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: {
      sender: { select: { id: true, fullName: true } },
    },
  });

  // Thread participants (for header)
  const participants = await prisma.dmThreadParticipant.findMany({
    where: { threadId },
    include: { user: { select: { id: true, fullName: true } } },
  });

  return ok({ data: messages, participants });
}

// POST — send a message to the thread
export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const threadId = Number(params.threadId);
  if (!await assertParticipant(threadId, auth.userId)) return err("Forbidden", 403);

  const body = await parseBody<{
    content?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
  }>(req);

  const content = body.content?.trim() ?? "";
  const attachmentUrl = body.attachmentUrl?.trim() || null;
  // A message must have either text or an attachment.
  if (!content && !attachmentUrl) return err("content or an attachment is required");

  const attachmentType = attachmentUrl
    ? body.attachmentType === "image"
      ? "image"
      : "file"
    : null;

  const message = await prisma.dmMessage.create({
    data: {
      threadId,
      senderUserId: auth.userId,
      contentEnc: content,
      attachmentUrl,
      attachmentType,
      attachmentName: attachmentUrl ? body.attachmentName?.slice(0, 255) ?? null : null,
    },
    include: {
      sender: { select: { id: true, fullName: true } },
    },
  });

  return ok({ data: message });
}
