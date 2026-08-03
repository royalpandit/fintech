import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TAKE = 6;

// GET /api/v1/admin/search?q=…
// Super-admin global search — spans users, advisors, posts (any status),
// courses, and communities. Broader than the public /api/v1/search.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return ok({ users: [], advisors: [], posts: [], courses: [], communities: [] });
  }

  const [users, advisors, posts, courses, communities] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { id: true, fullName: true, email: true, role: true },
    }),
    prisma.user.findMany({
      where: {
        role: "advisor",
        deletedAt: null,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { advisorProfile: { sebiRegistrationNo: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        fullName: true,
        advisorProfile: { select: { sebiRegistrationNo: true, verificationStatus: true } },
      },
    }),
    prisma.marketPost.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { marketSymbol: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: { id: true, title: true, marketSymbol: true, complianceStatus: true },
    }),
    prisma.course.findMany({
      where: {
        deletedAt: null,
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
      select: { slug: true, name: true },
    }),
  ]);

  return ok({
    users: users.map((u) => ({ id: u.id, name: u.fullName, sub: u.email, role: u.role })),
    advisors: advisors.map((a) => ({
      id: a.id,
      name: a.fullName,
      sub: a.advisorProfile?.sebiRegistrationNo ?? "",
      status: a.advisorProfile?.verificationStatus ?? null,
    })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      sub: p.marketSymbol ?? "",
      status: p.complianceStatus,
    })),
    courses: courses.map((c) => ({ id: c.id, title: c.title })),
    communities: communities.map((g) => ({ slug: g.slug, name: g.name })),
  });
}
