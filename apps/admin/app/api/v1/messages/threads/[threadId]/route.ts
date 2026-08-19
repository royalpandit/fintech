import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { notifyNewMessage } from "@/lib/notify";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";

export const dynamic = "force-dynamic";

/** Collapse the two avatar sources into a single `sender.avatarUrl` for clients. */
function withSenderAvatar<
  T extends {
    sender: {
      id: number;
      fullName: string;
      avatarUrl?: string | null;
      advisorProfile?: { profileImageUrl?: string | null } | null;
    };
  },
>(m: T) {
  return {
    ...m,
    sender: {
      id: m.sender.id,
      fullName: m.sender.fullName,
      avatarUrl: resolveAvatarUrl(m.sender),
    },
  };
}

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
      sender: { select: { id: true, fullName: true, ...userAvatarSelect } },
    },
  });

  // Thread participants (for header)
  const participants = await prisma.dmThreadParticipant.findMany({
    where: { threadId },
    include: { user: { select: { id: true, fullName: true } } },
  });

  return ok({ data: messages.map(withSenderAvatar), participants });
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
      sender: { select: { id: true, fullName: true, ...userAvatarSelect } },
    },
  });

  // Tell the other participant(s). Best-effort — never blocks the send.
  const others = await prisma.dmThreadParticipant.findMany({
    where: { threadId, userId: { not: auth.userId } },
    select: { userId: true },
  });
  await Promise.all(
    others.map((p) =>
      notifyNewMessage({
        recipientUserId: p.userId,
        senderName: message.sender.fullName,
        threadId,
        preview: content,
        isAttachment: Boolean(attachmentUrl),
      }),
    ),
  );

  return ok({ data: withSenderAvatar(message) });
}
