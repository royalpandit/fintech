import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import CourseRowActions from "./course-row-actions";
import TablePager from "@/components/table-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { page?: string; sort?: string };

const SORTS: { key: string; label: string; orderBy: Prisma.CourseOrderByWithRelationInput }[] = [
  { key: "recent", label: "Newest", orderBy: { createdAt: "desc" } },
  { key: "enrolled", label: "Most enrolled", orderBy: { enrollments: { _count: "desc" } } },
];

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

const COMPLIANCE_TONE: Record<string, { bg: string; color: string }> = {
  approved: { bg: "#dcfce7", color: "#15803d" },
  pending: { bg: "#fef9c3", color: "#a16207" },
  under_review: { bg: "#fef9c3", color: "#a16207" },
  flagged: { bg: "#fee2e2", color: "#b91c1c" },
  rejected: { bg: "#fee2e2", color: "#b91c1c" },
};

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const sort = SORTS.find((s) => s.key === searchParams.sort) ?? SORTS[0];

  const [rows, total, published, pending, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: sort.orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        advisor: { select: { fullName: true } },
        _count: { select: { lessons: true, enrollments: true } },
      },
    }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null, isPublished: true } }),
    prisma.course.count({
      where: { deletedAt: null, complianceStatus: { in: ["pending", "under_review"] } },
    }),
    prisma.courseEnrollment.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stats = [
    { label: "Total courses", value: total.toString() },
    { label: "Published", value: published.toString() },
    { label: "Awaiting review", value: pending.toString(), tone: pending > 0 ? "#dc2626" : undefined },
    { label: "Enrollments", value: enrollments.toLocaleString() },
  ];

  return (
    <section>
      <h1 className="page-title">Courses</h1>
      <p className="page-subtitle">
        Review advisor-created courses, approve them for compliance, and control what is published to
        learners.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, margin: "16px 0" }}>
        {stats.map((s) => (
          <article key={s.label} className="stat-card">
            <p className="stat-card-label">{s.label}</p>
            <p className="stat-card-value" style={{ color: s.tone ?? "var(--text)" }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Sort:</span>
        {SORTS.map((s) => {
          const active = s.key === sort.key;
          return (
            <Link
              key={s.key}
              href={`/super-admin/courses?sort=${s.key}`}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--accent-blue-soft, rgba(37,99,235,0.12))" : "var(--surface)",
                color: active ? "var(--accent-blue, #2563eb)" : "var(--text-muted)",
              }}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No courses yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Course", "Advisor", "Price", "Lessons", "Enrolled", "Compliance", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign:
                            h === "Course" || h === "Advisor" || h === "Compliance" || h === "Status"
                              ? "left"
                              : "right",
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
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const tone = COMPLIANCE_TONE[c.complianceStatus] ?? {
                    bg: "var(--surface-2)",
                    color: "var(--text-muted)",
                  };
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", maxWidth: 280, fontWeight: 600 }}>{c.title}</td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {c.advisor?.fullName ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {Number(c.price) > 0 ? formatINR(Number(c.price)) : "Free"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>{c._count.lessons}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>{c._count.enrollments}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: tone.bg,
                            color: tone.color,
                            textTransform: "capitalize",
                          }}
                        >
                          {c.complianceStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: c.isPublished ? "#15803d" : "var(--text-muted)",
                          }}
                        >
                          {c.isPublished ? "LIVE" : "Draft"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <CourseRowActions
                          id={c.id}
                          complianceStatus={c.complianceStatus}
                          isPublished={c.isPublished}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager
              basePath="/super-admin/courses"
              params={{ sort: sort.key }}
              page={page}
              totalPages={totalPages}
              total={total}
            />
          </div>
        )}
      </article>
    </section>
  );
}
