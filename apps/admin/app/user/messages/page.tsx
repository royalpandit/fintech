import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import MessagesInbox, {
  type SubscriptionRow,
  type ThreadRow,
} from "./messages-inbox";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const userId = auth.userId;

  const [threads, subscriptions] = await Promise.all([
    prisma.dmThread.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        status: true,
        amount: true,
        startDate: true,
        endDate: true,
        advisor: {
          select: {
            id: true,
            fullName: true,
            advisorProfile: { select: { sebiRegistrationNo: true } },
          },
        },
      },
    }),
  ]);

  const threadRows: ThreadRow[] = threads.map((t) => {
    const partner = t.participants.find((p) => p.userId !== userId)?.user;
    const lastMsg = t.messages[0];
    return {
      id: t.id,
      partnerName: partner?.fullName ?? "Unknown",
      lastPreview: lastMsg?.contentEnc ?? "No messages yet",
      lastAt: lastMsg?.createdAt.toISOString() ?? null,
      isOwnLast: lastMsg?.senderUserId === userId,
    };
  });

  const subscriptionRows: SubscriptionRow[] = subscriptions
    .filter((s) => s.advisor)
    .map((s) => ({
      id: s.id,
      status: s.status,
      amount: Number(s.amount),
      startDate: s.startDate.toISOString(),
      endDate: s.endDate?.toISOString() ?? null,
      advisor: {
        id: s.advisor!.id,
        fullName: s.advisor!.fullName,
        sebiRegistrationNo: s.advisor!.advisorProfile?.sebiRegistrationNo ?? null,
      },
    }));

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Messages
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Chat with analysts from your subscriptions
        </p>
      </div>

      <MessagesInbox threads={threadRows} subscriptions={subscriptionRows} />
    </section>
  );
}
