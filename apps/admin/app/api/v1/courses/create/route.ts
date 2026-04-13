import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{
    title?: string;
    description?: string;
    price?: number;
    coverImageUrl?: string;
  }>(req);

  if (!body.title) return err("title is required");

  const course = await prisma.course.create({
    data: {
      advisorUserId: userId,
      title: body.title,
      description: body.description,
      price: body.price || 0,
      coverImageUrl: body.coverImageUrl,
    },
  });

  return ok({ course_id: course.id, course });
}
