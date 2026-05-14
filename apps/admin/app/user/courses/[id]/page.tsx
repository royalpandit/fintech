import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FiBookOpen, FiClock, FiUsers, FiStar, FiCheckCircle } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import CourseDetailClient from "./CourseDetailClient";

export const dynamic = "force-dynamic";

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const userId = auth?.userId ?? null;
  const courseId = Number(params.id);

  const course = await prisma.course.findFirst({
    where: { id: courseId, isPublished: true, deletedAt: null },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true } },
        },
      },
      lessons: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, position: true, durationSeconds: true, videoUrl: true },
      },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  if (!course) notFound();

  const [enrollment, ratingAgg] = await Promise.all([
    userId
      ? prisma.courseEnrollment.findUnique({
          where: { courseId_userId: { courseId, userId } },
        })
      : Promise.resolve(null),
    prisma.courseReview.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const isEnrolled = Boolean(enrollment);

  // completed lesson IDs for enrolled user
  let completedLessonIds: number[] = [];
  if (isEnrolled && userId) {
    const progress = await prisma.courseLessonProgress.findMany({
      where: { userId, lesson: { courseId } },
      select: { lessonId: true },
    });
    completedLessonIds = progress.map((p) => p.lessonId);
  }

  const totalSecs = course.lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);
  const price = Number(course.price);
  const avgRating = ratingAgg._avg.rating ? Number(ratingAgg._avg.rating).toFixed(1) : null;

  return (
    <section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left: course info + lessons */}
        <div>
          {/* Header */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            {course.coverImageUrl ? (
              <img
                src={course.coverImageUrl}
                alt={course.title}
                style={{ width: "100%", height: 220, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  height: 220,
                  background:
                    "linear-gradient(135deg, #0c4a6e 0%, #0e7490 60%, #047857 100%)",
                  display: "grid",
                  placeItems: "center",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                <FiBookOpen size={60} />
              </div>
            )}
            <div style={{ padding: 20 }}>
              <h1
                style={{
                  margin: "0 0 10px",
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.3,
                }}
              >
                {course.title}
              </h1>

              {/* Instructor row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background:
                      "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                    color: "#0ea5e9",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(course.advisor.fullName)}
                </div>
                <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
                  {course.advisor.fullName}
                </span>
                {course.advisor.advisorProfile?.sebiRegistrationNo && (
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>
                    · {course.advisor.advisorProfile.sebiRegistrationNo}
                  </span>
                )}
              </div>

              {/* Meta chips */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <FiBookOpen size={13} /> {course.lessons.length} lessons
                </span>
                {totalSecs > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <FiClock size={13} /> {fmtDuration(totalSecs)}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <FiUsers size={13} /> {course._count.enrollments} enrolled
                </span>
                {avgRating && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <FiStar size={13} style={{ color: "#f59e0b" }} /> {avgRating} ({ratingAgg._count} reviews)
                  </span>
                )}
              </div>

              {course.description && (
                <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
                  {course.description}
                </p>
              )}
            </div>
          </article>

          {/* Lessons list */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Course content
              </h2>
            </div>

            {course.lessons.length === 0 ? (
              <p style={{ margin: 0, padding: 24, color: "#94a3b8", fontSize: 13 }}>
                Lessons coming soon.
              </p>
            ) : (
              <CourseDetailClient
                courseId={courseId}
                lessons={course.lessons}
                isEnrolled={isEnrolled}
                completedLessonIds={completedLessonIds}
                isAuthed={Boolean(auth)}
              />
            )}
          </article>
        </div>

        {/* Right: purchase card */}
        <aside style={{ position: "sticky", top: 20 }}>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: price === 0 ? "#10b981" : "#0f172a",
                letterSpacing: -0.5,
                marginBottom: 16,
              }}
            >
              {price === 0
                ? "Free"
                : new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: course.currency,
                    maximumFractionDigits: 0,
                  }).format(price)}
            </div>

            {isEnrolled ? (
              <div
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  background: "#d1fae5",
                  color: "#047857",
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <FiCheckCircle size={16} /> You are enrolled
              </div>
            ) : (
              <CourseEnrollButton courseId={courseId} price={price} isAuthed={Boolean(auth)} />
            )}

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gap: 8,
                fontSize: 13,
                color: "#475569",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <FiBookOpen size={14} style={{ marginTop: 1, color: "#94a3b8" }} />
                {course.lessons.length} on-demand lessons
              </div>
              {totalSecs > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <FiClock size={14} style={{ marginTop: 1, color: "#94a3b8" }} />
                  {fmtDuration(totalSecs)} of content
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <FiCheckCircle size={14} style={{ marginTop: 1, color: "#94a3b8" }} />
                Certificate on completion
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

// ── Enroll Button ─────────────────────────────────────────
// This is a small client component just for the button
function CourseEnrollButton({
  courseId,
  price,
  isAuthed,
}: {
  courseId: number;
  price: number;
  isAuthed: boolean;
}) {
  // Server-rendered placeholder — the actual interactive button is below
  return (
    <form action={`/api/v1/courses/${courseId}/purchase`} method="POST">
      <button
        type="submit"
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: 10,
          border: "none",
          background: isAuthed
            ? "linear-gradient(135deg, #0ea5e9, #0284c7)"
            : "#e2e8f0",
          color: isAuthed ? "#fff" : "#94a3b8",
          fontWeight: 700,
          fontSize: 15,
          cursor: isAuthed ? "pointer" : "default",
          marginBottom: 10,
        }}
      >
        {isAuthed
          ? price === 0
            ? "Enroll for free"
            : "Purchase & enroll"
          : "Sign in to enroll"}
      </button>
    </form>
  );
}
