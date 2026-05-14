import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

// POST — mark a lesson as complete (or uncomplete)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const courseId = Number(params.id);
  const body = await parseBody<{ lessonId?: number; completed?: boolean }>(req);
  const lessonId = Number(body.lessonId);

  if (!lessonId) return err("lessonId is required");

  // Verify enrollment
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_userId: { courseId, userId: auth.userId } },
  });
  if (!enrollment) return err("Not enrolled in this course", 403);

  // Verify lesson belongs to course
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, courseId },
  });
  if (!lesson) return err("Lesson not found", 404);

  if (body.completed === false) {
    await prisma.courseLessonProgress.deleteMany({
      where: { lessonId, userId: auth.userId },
    });
    return ok({ lessonId, completed: false });
  }

  await prisma.courseLessonProgress.upsert({
    where: { lessonId_userId: { lessonId, userId: auth.userId } },
    update: { completedAt: new Date() },
    create: { lessonId, userId: auth.userId },
  });

  return ok({ lessonId, completed: true });
}
