import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

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

  return ok({ lesson });
}
