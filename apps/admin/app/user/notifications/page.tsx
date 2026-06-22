import Link from "next/link";
import { cookies } from "next/headers";
import { FiBell } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  if (!isAuthed) {
    return (
      <section>
        <div style={{ marginBottom: 20 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.5,
            }}
          >
            Notifications
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
            Stay updated on advisor sentiment, comments, and your activity
          </p>
        </div>

        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 36,
              marginBottom: 12,
              color: "var(--text-muted)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <FiBell size={36} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
            Sign in to see notifications
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)" }}>
            Get alerts when advisors post sentiment, when your comments get replies, and more.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Get started — free
          </Link>
        </article>
      </section>
    );
  }

  const filter = searchParams.filter ?? "all";
  const where: Record<string, unknown> = { userId: userId! };
  if (filter === "unread") where.readAt = null;
  if (filter === "read") where.readAt = { not: null };

  const [notifications, unreadCount, totalCount, pendingRequests] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: userId!, readAt: null } }),
    prisma.notification.count({ where: { userId: userId! } }),
    (async () => {
      try {
        return await (prisma as any).friendRequest.findMany({
          where: { toUserId: userId, status: "pending" },
          orderBy: { createdAt: "desc" },
          include: { from: { select: { id: true, fullName: true } } },
        }) as { id: number; fromUserId: number; from: { id: number; fullName: string }; createdAt: Date }[];
      } catch {
        return [];
      }
    })(),
  ]);

  return (
    <section>
      <NotificationsClient
        notifications={notifications.map((n) => ({
          ...n,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        }))}
        unreadCount={unreadCount}
        totalCount={totalCount}
        filter={filter}
        pendingRequests={pendingRequests.map((r) => ({
          fromUserId: r.fromUserId,
          fromName: r.from.fullName,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </section>
  );
}
