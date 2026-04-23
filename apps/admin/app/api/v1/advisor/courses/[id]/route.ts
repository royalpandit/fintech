import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

async function assertOwn(courseId: number, advisorUserId: number) {
  return prisma.course.findFirst({
    where: { id: courseId, advisorUserId, deletedAt: null },
    select: { id: true, complianceStatus: true },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courseId = Number(params.id);
  if (!Number.isFinite(courseId)) return err("Invalid id");

  const course = await prisma.course.findFirst({
    where: { id: courseId, advisorUserId: auth.userId, deletedAt: null },
    include: {
      lessons: { orderBy: { position: "asc" } },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  if (!course) return err("Course not found", 404);
  return ok({ course });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courseId = Number(params.id);
  if (!Number.isFinite(courseId)) return err("Invalid id");

  const existing = await assertOwn(courseId, auth.userId);
  if (!existing) return err("Course not found", 404);

  const body = await parseBody<{
    title?: string;
    description?: string;
    price?: number;
    coverImageUrl?: string | null;
    isPublished?: boolean;
  }>(req);

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    if (body.title.trim().length < 5) return err("Title too short");
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    if (body.description.trim().length < 20) return err("Description too short");
    data.description = body.description.trim();
  }
  if (typeof body.price === "number") {
    if (body.price < 0) return err("Invalid price");
    data.price = body.price;
  }
  if ("coverImageUrl" in body) {
    data.coverImageUrl = body.coverImageUrl?.trim() || null;
  }
  if (typeof body.isPublished === "boolean") {
    if (body.isPublished && existing.complianceStatus !== "approved") {
      return err("Course must be approved by admin before publishing", 400);
    }
    data.isPublished = body.isPublished;
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data,
  });

  return ok({ course: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courseId = Number(params.id);
  if (!Number.isFinite(courseId)) return err("Invalid id");

  const existing = await assertOwn(courseId, auth.userId);
  if (!existing) return err("Course not found", 404);

  await prisma.course.update({
    where: { id: courseId },
    data: { deletedAt: new Date(), isPublished: false },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "course_deleted",
      module: "courses",
      targetKind: "course",
      targetId: courseId,
    },
  });

  return ok({ id: courseId, deleted: true });
}
