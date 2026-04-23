import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatINR(n: number | null | undefined) {
  if (!n) return "Free";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function statusTag(status: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    approved: { bg: "#d1fae5", fg: "#047857" },
    pending: { bg: "#fef3c7", fg: "#92400e" },
    flagged: { bg: "#fee2e2", fg: "#991b1b" },
    rejected: { bg: "#fee2e2", fg: "#991b1b" },
    under_review: { bg: "#fef3c7", fg: "#92400e" },
  };
  const s = colors[status] ?? colors.pending;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {status}
    </span>
  );
}

export default async function AdvisorCoursesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const courses = await prisma.course.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { lessons: true, enrollments: true, reviews: true } },
    },
  });

  const totalRevenue = courses.reduce((sum, c) => {
    return sum + Number(c.price) * c._count.enrollments;
  }, 0);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">
            Create paid courses to monetize your expertise beyond advisory.
          </p>
        </div>
        <Link href="/advisor/courses/new" className="btn-primary" style={{ padding: "12px 20px" }}>
          + New Course
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Total Courses</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {courses.length}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Published</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {courses.filter((c) => c.isPublished).length}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Total Enrollments</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {courses.reduce((s, c) => s + c._count.enrollments, 0).toLocaleString()}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Gross Revenue</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {formatINR(totalRevenue)}
          </p>
        </article>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}
      >
        {courses.length === 0 ? (
          <article className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48 }}>
            <p className="page-subtitle" style={{ margin: 0, marginBottom: 12 }}>
              You haven't created any courses yet.
            </p>
            <Link href="/advisor/courses/new" className="btn-primary" style={{ padding: "10px 20px" }}>
              Create your first course →
            </Link>
          </article>
        ) : (
          courses.map((course) => (
            <Link
              key={course.id}
              href={`/advisor/courses/${course.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article className="card" style={{ cursor: "pointer", height: "100%" }}>
                <div
                  style={{
                    height: 140,
                    borderRadius: 10,
                    background: course.coverImageUrl
                      ? `url(${course.coverImageUrl}) center/cover`
                      : "linear-gradient(135deg, #047857, #10b981)",
                    marginBottom: 12,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>{course.title}</h3>
                  {statusTag(course.complianceStatus)}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#64748b",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {course.description}
                </p>
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#475569",
                  }}
                >
                  <span>
                    <strong style={{ fontSize: 15, color: "#047857" }}>
                      {formatINR(Number(course.price))}
                    </strong>
                  </span>
                  <span>
                    {course._count.lessons} lessons · {course._count.enrollments} enrolled
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                  {course.isPublished ? "🌐 Live" : "📝 Draft"}
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
