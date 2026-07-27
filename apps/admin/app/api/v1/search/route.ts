import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const TAKE = 6;

export type SearchGroupKey = "advisors" | "posts" | "courses" | "communities";

// GET /api/v1/search?q=…
// Unified quick-search behind the header search bar. Public — guests can search
// too, matching the existing /user/search page.
export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return ok({ advisors: [], posts: [], courses: [], communities: [] });
  }

  const [advisors, posts, courses, communities] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "advisor",
        deletedAt: null,
        advisorProfile: { verificationStatus: "approved" },
        fullName: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        fullName: true,
        advisorProfile: {
          select: { sebiRegistrationNo: true, professionalType: true },
        },
      },
    }),
    prisma.marketPost.findMany({
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        publishedAt: { not: null },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { marketSymbol: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { id: true, title: true, marketSymbol: true, sentiment: true },
    }),
    prisma.course.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        complianceStatus: "approved",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { id: true, title: true },
    }),
    prisma.group.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { slug: true, name: true, communityType: true },
    }),
  ]);

  return ok({
    advisors: advisors.map((a) => ({
      id: a.id,
      name: a.fullName,
      sub: a.advisorProfile?.sebiRegistrationNo ?? "",
      professionalType: a.advisorProfile?.professionalType ?? null,
    })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      sub: p.marketSymbol ?? "",
      sentiment: p.sentiment,
    })),
    courses: courses.map((c) => ({ id: c.id, title: c.title })),
    communities: communities.map((g) => ({
      slug: g.slug,
      name: g.name,
      type: g.communityType,
    })),
  });
}
