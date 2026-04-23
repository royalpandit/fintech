import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import CourseEditor from "./course-editor";
import LessonsManager from "./lessons-manager";

export const dynamic = "force-dynamic";

function formatINR(n: number | null | undefined) {
  if (!n) return "Free";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default async function AdvisorCourseDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const courseId = Number(params.id);
  if (!Number.isFinite(courseId)) notFound();

  const course = await prisma.course.findFirst({
    where: { id: courseId, advisorUserId: auth.userId, deletedAt: null },
    include: {
      lessons: { orderBy: { position: "asc" } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true, email: true } } },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { fullName: true } } },
      },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  if (!course) notFound();

  const avgRating =
    course.reviews.length > 0
      ? course.reviews.reduce((s, r) => s + r.rating, 0) / course.reviews.length
      : 0;

  return (
    <section>
      <Link href="/advisor/courses" className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← My Courses
      </Link>

      <CourseEditor
        courseId={course.id}
        initial={{
          title: course.title,
          description: course.description ?? "",
          price: String(course.price),
          coverImageUrl: course.coverImageUrl ?? "",
          isPublished: course.isPublished,
          complianceStatus: course.complianceStatus,
        }}
      />

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Enrollments</p>
          <p className="metric-value" style={{ fontSize: 32 }}>
            {course._count.enrollments}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Revenue</p>
          <p className="metric-value" style={{ fontSize: 32 }}>
            {formatINR(Number(course.price) * course._count.enrollments)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Lessons</p>
          <p className="metric-value" style={{ fontSize: 32 }}>
            {course.lessons.length}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Avg Rating</p>
          <p className="metric-value" style={{ fontSize: 32 }}>
            {avgRating ? `${avgRating.toFixed(1)} ★` : "—"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#61708b" }}>
            {course._count.reviews} reviews
          </p>
        </article>
      </div>

      <LessonsManager
        courseId={course.id}
        initialLessons={course.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          videoUrl: l.videoUrl,
          durationSeconds: l.durationSeconds,
        }))}
      />

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recent Enrollments</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {course.enrollments.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No enrollments yet.
                  </td>
                </tr>
              ) : (
                course.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.user.fullName}</td>
                    <td>{e.user.email}</td>
                    <td>{e.enrolledAt.toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
