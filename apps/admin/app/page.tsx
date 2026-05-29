import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
        advisorProfile: {
          select: {
            sebiRegistrationNo: true,
            experienceYears: true,
            expertiseTags: true,
          },
        },
      },
    });

    const thirty = new Date();
    thirty.setDate(thirty.getDate() - 30);
    const metrics = await prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: thirty } },
      _avg: { accuracyPct: true },
    });
    const avgById = new Map(
      metrics.map(m => [m.advisorUserId, Number(m._avg.accuracyPct ?? 0)]),
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
        returnsPct: Math.max(8, avgById.get(a.id) ?? 12 + (a.id % 10)),
        initials: initials.toUpperCase() || "?",
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
