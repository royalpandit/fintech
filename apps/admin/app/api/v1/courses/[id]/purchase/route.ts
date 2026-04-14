import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const courseId = Number(params.id);

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return err("Course not found", 404);

  const existing = await prisma.courseEnrollment.findFirst({
    where: { courseId, userId },
  });
  if (existing) return err("Already enrolled", 409);

  await prisma.courseEnrollment.create({ data: { courseId, userId } });

  await prisma.payment.create({
    data: {
      userId,
      kind: "course",
      amount: course.price,
      status: "success",
      referenceKind: "course_enrollment",
      referenceId: courseId,
    },
  });

  return ok({ course_id: courseId, purchased: true });
}
