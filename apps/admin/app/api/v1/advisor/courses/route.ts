import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const courses = await prisma.course.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { lessons: true, enrollments: true, reviews: true } },
    },
  });

  return ok({ data: courses });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    title?: string;
    description?: string;
    price?: number;
    coverImageUrl?: string;
  }>(req);

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const price = Number(body.price);

  if (!title || title.length < 5) return err("Title must be at least 5 characters");
  if (!description || description.length < 20) return err("Description must be at least 20 characters");
  if (!Number.isFinite(price) || price < 0) return err("Valid price is required");

  const course = await prisma.course.create({
    data: {
      advisorUserId: auth.userId,
      title,
      description,
      price,
      coverImageUrl: body.coverImageUrl?.trim() || null,
      isPublished: false,
      complianceStatus: "pending",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "course_created",
      module: "courses",
      targetKind: "course",
      targetId: course.id,
    },
  });

  return ok({ course });
}
