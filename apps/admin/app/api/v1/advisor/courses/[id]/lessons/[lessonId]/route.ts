import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

async function assertOwned(courseId: number, lessonId: number, userId: number) {
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, courseId },
    include: { course: { select: { advisorUserId: true, deletedAt: true } } },
  });
  if (!lesson) return null;
  if (lesson.course.advisorUserId !== userId) return null;
  if (lesson.course.deletedAt) return null;
  return lesson;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } },
) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courseId = Number(params.id);
  const lessonId = Number(params.lessonId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) return err("Invalid id");

  const lesson = await assertOwned(courseId, lessonId, auth.userId);
  if (!lesson) return err("Lesson not found", 404);

  const body = await parseBody<{
    title?: string;
    videoUrl?: string | null;
    durationSeconds?: number | null;
    position?: number;
  }>(req);

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    if (body.title.trim().length < 3) return err("Lesson title too short");
    data.title = body.title.trim();
  }
  if ("videoUrl" in body) data.videoUrl = body.videoUrl?.trim() || null;
  if ("durationSeconds" in body) {
    data.durationSeconds =
      typeof body.durationSeconds === "number" && body.durationSeconds > 0
        ? body.durationSeconds
        : null;
  }
  if (typeof body.position === "number" && body.position > 0) {
    // Check nothing else uses that position; bump others if needed.
    const conflict = await prisma.courseLesson.findFirst({
      where: { courseId, position: body.position, NOT: { id: lessonId } },
      select: { id: true },
    });
    if (conflict) {
      return err("Another lesson already uses that position. Reorder first.");
    }
    data.position = body.position;
  }

  const updated = await prisma.courseLesson.update({
    where: { id: lessonId },
    data,
  });

  return ok({ lesson: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } },
) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courseId = Number(params.id);
  const lessonId = Number(params.lessonId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) return err("Invalid id");

  const lesson = await assertOwned(courseId, lessonId, auth.userId);
  if (!lesson) return err("Lesson not found", 404);

  await prisma.courseLesson.delete({ where: { id: lessonId } });
  return ok({ deleted: true });
}
