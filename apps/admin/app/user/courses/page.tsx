import Link from "next/link";
import { cookies } from "next/headers";
import { FiBookOpen, FiStar, FiUsers, FiClock } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function fmtPrice(price: number, currency: string) {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
}

function fmtDuration(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function CoursesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const userId = auth?.userId ?? null;

  const [courses, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true, deletedAt: null, complianceStatus: "approved" },
      orderBy: { createdAt: "desc" },
      include: {
        advisor: {
          select: {
            id: true,
            fullName: true,
            advisorProfile: { select: { sebiRegistrationNo: true } },
          },
        },
        lessons: { select: { durationSeconds: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    userId
      ? prisma.courseEnrollment.findMany({
          where: { userId },
          select: { courseId: true },
        })
      : Promise.resolve([]),
  ]);

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));

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
          Courses
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Learn from SEBI-verified advisors at your own pace
        </p>
      </div>

      {courses.length === 0 ? (
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
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
              color: "var(--text-muted)",
            }}
          >
            <FiBookOpen size={40} />
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
            No courses published yet — check back soon.
          </p>
        </article>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <style>{`.course-card:hover { box-shadow: 0 8px 32px rgba(14,165,233,0.12) !important; transform: translateY(-2px) !important; }`}</style>
          {courses.map((c) => {
            const isEnrolled = enrolledIds.has(c.id);
            const totalSecs = c.lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
            const price = Number(c.price);

            return (
              <Link
                key={c.id}
                href={`/user/courses/${c.id}`}
                style={{ textDecoration: "none" }}
              >
                <article
                  className="course-card"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "box-shadow 0.2s, transform 0.2s",
                  }}
                >
                  {/* Thumbnail */}
                  {c.coverImageUrl ? (
                    <img
                      src={c.coverImageUrl}
                      alt={c.title}
                      style={{ width: "100%", height: 160, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 160,
                        background: "linear-gradient(135deg, #0c4a6e 0%, #0e7490 60%, #047857 100%)",
                        display: "grid",
                        placeItems: "center",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      <FiBookOpen size={48} />
                    </div>
                  )}

                  <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                    <h3
                      style={{
                        margin: "0 0 8px",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text)",
                        lineHeight: 1.35,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {c.title}
                    </h3>

                    {/* Instructor */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          background:
                            "linear-gradient(135deg, rgba(14,165,233,0.15), rgba(16,185,129,0.15))",
                          color: "#0ea5e9",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 8,
                          fontWeight: 600,
                        }}
                      >
                        {getInitials(c.advisor.fullName)}
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.advisor.fullName}</span>
                    </div>

                    {/* Stats */}
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <FiBookOpen size={11} /> {c.lessons.length} lessons
                      </span>
                      {totalSecs > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <FiClock size={11} /> {fmtDuration(totalSecs)}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <FiUsers size={11} /> {c._count.enrollments}
                      </span>
                    </div>

                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: price === 0 ? "#10b981" : "var(--text)",
                          letterSpacing: -0.3,
                        }}
                      >
                        {fmtPrice(price, c.currency)}
                      </span>

                      {isEnrolled ? (
                        <span
                          style={{
                            padding: "5px 12px",
                            borderRadius: 8,
                            background: "#d1fae5",
                            color: "#047857",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Enrolled
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "5px 12px",
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {price === 0 ? "Enroll free" : "Buy now"}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
