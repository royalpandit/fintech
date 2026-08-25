import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userAvatarSelect, resolveAvatarUrl } from "@/lib/user-avatar";
import LandingPage, { type LandingAdvisor } from "@/components/landing/landing-page";
import "./landing.css";

export const dynamic = "force-dynamic";

async function loadLandingAdvisors(): Promise<LandingAdvisor[]> {
  try {
    const advisors = await prisma.user.findMany({
      where: {
        role: "advisor",
        deletedAt: null,
        advisorProfile: { verificationStatus: "approved" },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        _count: { select: { followers: true } },
        advisorProfile: {
          select: {
            sebiRegistrationNo: true,
            experienceYears: true,
            expertiseTags: true,
            profileImageUrl: true,
          },
        },
      },
    });

    const thirty = new Date();
    thirty.setDate(thirty.getDate() - 30);
    // roiPct, not accuracyPct — the card labels this "Avg. Returns", and
    // prediction accuracy is a different measurement entirely.
    const metrics = await prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: thirty } },
      _avg: { roiPct: true },
    });
    const roiById = new Map(
      metrics
        .filter(m => m._avg.roiPct != null)
        .map(m => [m.advisorUserId, Number(m._avg.roiPct)]),
    );

    return advisors.map(a => {
      const parts = a.fullName.trim().split(/\s+/);
      const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
      const tags = a.advisorProfile?.expertiseTags;
      const expertise = Array.isArray(tags) && tags.length
        ? String(tags[0])
        : "Equity + Derivatives";
      return {
        id: a.id,
        name: a.fullName,
        sebi: a.advisorProfile?.sebiRegistrationNo ?? "—",
        expertise,
        years: a.advisorProfile?.experienceYears ?? 0,
        // No metrics → null, so the card shows followers instead. This used to
        // fall back to `12 + (a.id % 10)`, i.e. a performance number derived
        // from the row's primary key.
        returnsPct: roiById.get(a.id) ?? null,
        followers: a._count.followers,
        initials: initials.toUpperCase() || "?",
        avatarUrl: resolveAvatarUrl(a),
      };
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  if (!auth) {
    const advisors = await loadLandingAdvisors();
    return <LandingPage advisors={advisors.length ? advisors : undefined} />;
  }

  if (auth.role === "super_admin") redirect("/super-admin/dashboard");
  if (auth.role === "admin") redirect("/admin/dashboard");

  if (auth.role === "advisor") {
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId: auth.userId },
      select: { verificationStatus: true },
    });
    redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
  }

  redirect("/user/feed");
}
