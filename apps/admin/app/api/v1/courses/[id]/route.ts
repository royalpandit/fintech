import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const courseId = Number(params.id);
  if (!courseId) return err("Invalid course id");

  const auth = await requireAuth(req);
  const userId = auth?.userId ?? null;

  const course = await prisma.course.findFirst({
    where: { id: courseId, isPublished: true, deletedAt: null },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true } },
        },
      },
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          durationSeconds: true,
          videoUrl: true,
        },
      },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  if (!course) return err("Course not found", 404);

  // Check if current user is enrolled
  const enrollment = userId
    ? await prisma.courseEnrollment.findUnique({
        where: { courseId_userId: { courseId, userId } },
      })
    : null;

  // Get completed lesson IDs for enrolled user
  let completedLessonIds: number[] = [];
  if (userId && enrollment) {
    const progress = await prisma.courseLessonProgress.findMany({
      where: { userId, lesson: { courseId } },
      select: { lessonId: true },
    });
    completedLessonIds = progress.map((p) => p.lessonId);
  }

  // Average rating
  const ratingAgg = await prisma.courseReview.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: true,
  });

  return ok({
    data: course,
    enrolled: Boolean(enrollment),
    enrolledAt: enrollment?.enrolledAt ?? null,
    completedLessonIds,
    avgRating: ratingAgg._avg.rating,
    reviewCount: ratingAgg._count,
  });
}
