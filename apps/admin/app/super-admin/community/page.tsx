import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CommunityRowActions from "./community-row-actions";
import TablePager from "@/components/table-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { view?: string; page?: string };

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

const VIEWS = [
  { key: "live", label: "Live" },
  { key: "removed", label: "Removed" },
];

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const view = VIEWS.some((v) => v.key === searchParams.view) ? (searchParams.view as string) : "live";
  const removed = view === "removed";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [rows, totalLive, removedCount, todayCount] = await Promise.all([
    prisma.communityPost.findMany({
      where: { deletedAt: removed ? { not: null } : null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    prisma.communityPost.count({ where: { deletedAt: null } }),
    prisma.communityPost.count({ where: { deletedAt: { not: null } } }),
    prisma.communityPost.count({ where: { deletedAt: null, createdAt: { gte: startOfDay } } }),
  ]);

  const totalForView = removed ? removedCount : totalLive;
  const totalPages = Math.max(1, Math.ceil(totalForView / PAGE_SIZE));

  const stats = [
    { label: "Live posts", value: totalLive },
    { label: "Posted today", value: todayCount },
    { label: "Removed", value: removedCount },
  ];

  return (
    <section>
      <h1 className="page-title">Community</h1>
      <p className="page-subtitle">
        Monitor and moderate community feed posts. Remove posts that breach guidelines; removed posts
        can be restored.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, margin: "16px 0" }}>
        {stats.map((s) => (
          <article key={s.label} className="stat-card">
            <p className="stat-card-label">{s.label}</p>
            <p className="stat-card-value">{s.value}</p>
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <Link
              key={v.key}
              href={`/super-admin/community?view=${v.key}`}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--primary-soft)" : "var(--surface)",
                color: active ? "#047857" : "var(--text-muted)",
              }}
            >
              {v.label}
              {v.key === "removed" ? ` (${removedCount})` : ""}
            </Link>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No {removed ? "removed" : "live"} posts.
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Author", "Post", "Engagement", "When", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "" || h === "Engagement" ? "right" : "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 600 }}>{p.user?.fullName ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {p.user?.role ?? ""}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 420 }}>
                      {p.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.title}</div>}
                      <div
                        style={{
                          color: "var(--text-muted)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {p.content}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {p._count.reactions} ♥ · {p._count.comments} 💬
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {relTime(p.createdAt)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <CommunityRowActions id={p.id} removed={removed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager
              basePath="/super-admin/community"
              params={{ view }}
              page={page}
              totalPages={totalPages}
              total={totalForView}
            />
          </div>
        )}
      </article>
    </section>
  );
}
