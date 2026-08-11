import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { advisorCan } from "@/lib/capabilities-server";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  if (auth.role !== "advisor") return err("Forbidden", 403);
  if (!(await advisorCan(auth.userId, "course.sell"))) {
    return err("Courses are not available for your professional type", 403);
  }

  const body = await parseBody<{
    title?: string;
    description?: string;
    price?: number;
    coverImageUrl?: string;
  }>(req);

  if (!body.title) return err("title is required");

  const course = await prisma.course.create({
    data: {
      advisorUserId: auth.userId,
      title: body.title,
      description: body.description,
      price: body.price || 0,
      coverImageUrl: body.coverImageUrl,
    },
  });

  return ok({ course_id: course.id, course });
}
