import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { sendDueBroadcasts } from "@/lib/broadcast";
import { advisorServices, subscriberServiceNames } from "@/lib/subscription-services";
import AdvisorMessagesClient, { type AdvisorThread } from "./advisor-messages-client";

export const dynamic = "force-dynamic";

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdvisorMessagesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  // Deliver any scheduled broadcasts that are now due.
  await sendDueBroadcasts();

  const [threads, services, serviceNames] = await Promise.all([
    prisma.dmThread.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true } } } },
        messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    advisorServices(userId, { activeOnly: true }),
    subscriberServiceNames(userId),
  ]);

  const items: AdvisorThread[] = threads.map((t) => {
    const partner = t.participants.find((p) => p.userId !== userId)?.user;
    const lastMsg = t.messages[0];
    const attachmentLabel =
      lastMsg?.attachmentType === "image"
        ? "📷 Photo"
        : lastMsg?.attachmentType === "file"
          ? `📎 ${lastMsg.attachmentName ?? "Document"}`
          : null;
    const body = lastMsg ? lastMsg.contentEnc || attachmentLabel || "" : "";
    const prefix = lastMsg?.broadcastId ? "📢 " : lastMsg && lastMsg.senderUserId === userId ? "You: " : "";
    return {
      id: t.id,
      partnerName: partner?.fullName ?? "Unknown",
      preview: lastMsg ? `${prefix}${body}` : "No messages yet",
      timeLabel: lastMsg ? relTime(lastMsg.createdAt) : "",
      serviceNames: partner ? serviceNames.get(partner.id) ?? [] : [],
    };
  });

  return (
    <AdvisorMessagesClient
      threads={items}
      services={services.map((s) => ({ id: s.id, name: s.name, count: s.subscriberCount }))}
    />
  );
}
