import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyCourse } from "@/lib/notify";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { advisorCan } from "@/lib/capabilities-server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  if (!(await advisorCan(auth.userId, "course.sell"))) {
    return err("Courses are not available for your professional type", 403);
  }

  const courseId = Number(params.id);
  if (!Number.isFinite(courseId)) return err("Invalid id");

  const owned = await prisma.course.findFirst({
    where: { id: courseId, advisorUserId: auth.userId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) return err("Course not found", 404);

  const body = await parseBody<{
    title?: string;
    videoUrl?: string;
    durationSeconds?: number;
  }>(req);

  const title = (body.title ?? "").trim();
  if (!title || title.length < 3) return err("Lesson title is required");

  const lastPosition = await prisma.courseLesson.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = (lastPosition?.position ?? 0) + 1;

  const lesson = await prisma.courseLesson.create({
    data: {
      courseId,
      title,
      position: nextPosition,
      videoUrl: body.videoUrl?.trim() || null,
      durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
    },
  });

  // Tell everyone enrolled that there's new material.
  const [course, enrolments] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    prisma.courseEnrollment.findMany({ where: { courseId }, select: { userId: true } }),
  ]);
  for (const e of enrolments) {
    await notifyCourse({
      userId: e.userId,
      courseId,
      title: `New lesson in ${course?.title ?? "your course"}`,
      message: title,
    });
  }

  return ok({ lesson });
}
