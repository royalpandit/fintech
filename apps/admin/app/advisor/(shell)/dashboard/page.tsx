import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import Sparkline from "@/components/advisor-ui/sparkline";
import AreaChart from "@/components/advisor-ui/area-chart";
import ProgressRing from "@/components/advisor-ui/progress-ring";
import Delta from "@/components/advisor-ui/delta";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Plus,
  Shield,
  Sparkle,
  Target,
  TrendUp,
  Users,
  Wallet,
  Zap,
} from "@/components/advisor-ui/icons";

export const dynamic = "force-dynamic";

function formatINR(n: number | null | undefined, compact = false) {
  if (!n) return "₹0";
  const num = Number(n);
  if (compact && num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (compact && num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function dayLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default async function AdvisorDashboardPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const now = new Date();
  const thirty = new Date(now);
  thirty.setDate(thirty.getDate() - 30);
  const sixty = new Date(now);
  sixty.setDate(sixty.getDate() - 60);

  const [
    user,
    postCountsByStatus,
    totalPosts,
    activeSubscribers,
    prevActiveSubscribers,
    totalFollowers,
    wallet,
    metrics30,
    metrics30to60,
    allMetrics,
    revenueLast30Sum,
    revenuePrev30Sum,
    newSubsLast30,
    newSubsPrev30,
    recentPosts,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        advisorProfile: {
          select: { sebiRegistrationNo: true, expertiseTags: true, verifiedAt: true },
        },
      },
    }),
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { advisorUserId: userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.marketPost.count({ where: { advisorUserId: userId, deletedAt: null } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "active" } }),
    prisma.subscription.count({
      where: {
        advisorUserId: userId,
        status: "active",
        createdAt: { lt: thirty },
      },
    }),
    prisma.userFollow.count({ where: { followingUserId: userId } }),
    prisma.advisorWallet.findUnique({ where: { advisorUserId: userId } }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId, day: { gte: thirty } },
      orderBy: { day: "asc" },
    }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId, day: { gte: sixty, lt: thirty } },
      orderBy: { day: "asc" },
    }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId },
      orderBy: { day: "desc" },
      take: 30,
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: thirty } },
      _sum: { earningsAmount: true },
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: sixty, lt: thirty } },
      _sum: { earningsAmount: true },
    }),
    prisma.subscription.count({
      where: { advisorUserId: userId, createdAt: { gte: thirty } },
    }),
    prisma.subscription.count({
      where: { advisorUserId: userId, createdAt: { gte: sixty, lt: thirty } },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        sentiment: true,
        complianceStatus: true,
        createdAt: true,
        marketSymbol: true,
        _count: { select: { comments: true, reactions: true } },
      },
    }),
  ]);

  if (!user) redirect("/login");

  // Alerts + sidebar data (second parallel batch — keep them light)
  const [
    unreadNotifications,
    recentNotifications,
    flaggedPostsList,
    rejectedPostsList,
    toxicCommentsCount,
    kycDocs,
    recentAudits,
    recentNewSubscribers,
  ] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, message: true, readAt: true, createdAt: true },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, complianceStatus: "flagged", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, complianceStatus: "rejected", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.marketComment.count({
      where: {
        deletedAt: null,
        post: { advisorUserId: userId, deletedAt: null },
        toxicityScore: { gte: 5 },
      },
    }),
    prisma.kycDocument.findMany({
      where: { userId },
      select: { documentType: true, verificationStatus: true },
    }),
    prisma.auditLog.findMany({
      where: { actorUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, action: true, module: true, targetKind: true, targetId: true, createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { advisorUserId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  // Derive compliance mix
  const statusMap = postCountsByStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.complianceStatus] = row._count._all;
    return acc;
  }, {});
  const approvedPosts = statusMap["approved"] ?? 0;
  const pendingPosts = (statusMap["pending"] ?? 0) + (statusMap["under_review"] ?? 0);
  const flaggedPosts = (statusMap["flagged"] ?? 0) + (statusMap["rejected"] ?? 0);
  const approvedPct = totalPosts > 0 ? (approvedPosts / totalPosts) * 100 : 0;
  const pendingPct = totalPosts > 0 ? (pendingPosts / totalPosts) * 100 : 0;
  const flaggedPct = totalPosts > 0 ? (flaggedPosts / totalPosts) * 100 : 0;

  const latest = allMetrics[0];
  const accuracy = latest?.accuracyPct ? Number(latest.accuracyPct) : 0;
  const roi = latest?.roiPct ? Number(latest.roiPct) : 0;

  // Sparkline series — chronological (oldest first, last 14 days)
  const spark = [...allMetrics].reverse().slice(-14);
  const revenueSpark = spark.map((m) => Number(m.earningsAmount || 0));
  const subsSpark = spark.map((m) => m.subscribersCount);
  const accuracySpark = spark.map((m) => Number(m.accuracyPct || 0));
  const followerSpark = spark.map((m) => m.followersCount);

  // Area chart data — last 30 days
  const revenueAreaData = metrics30.map((m) => ({
    label: dayLabel(m.day),
    value: Number(m.earningsAmount || 0),
  }));

  const currentRevenue30 = Number(revenueLast30Sum._sum.earningsAmount ?? 0);
  const previousRevenue30 = Number(revenuePrev30Sum._sum.earningsAmount ?? 0);

  const walletBalance = wallet?.balance ? Number(wallet.balance) : 0;
  const walletPrev =
    metrics30to60.length > 0
      ? metrics30to60.reduce((s, m) => s + Number(m.earningsAmount || 0), 0)
      : 0;

  // KYC completeness
  const kycApproved = kycDocs.filter((d) => d.verificationStatus === "approved");
  const kycApprovedTypes = new Set(kycApproved.map((d) => d.documentType));
  const kycRequired = ["pan", "aadhaar", "sebi_cert"] as const;
  const kycDone = kycRequired.filter((t) => kycApprovedTypes.has(t)).length;
  const kycPct = Math.round((kycDone / kycRequired.length) * 100);

  const totalAlerts = flaggedPostsList.length + rejectedPostsList.length + toxicCommentsCount;

  // Build merged activity timeline
  type TimelineEntry = {
    id: string;
    kind: "post" | "subscription" | "payout" | "moderation" | "system";
    title: string;
    meta?: string;
    at: Date;
    tone: "success" | "warning" | "danger" | "info" | "neutral";
  };

  const timeline: TimelineEntry[] = [];

  for (const a of recentAudits) {
    const action = a.action.toLowerCase();
    let tone: TimelineEntry["tone"] = "neutral";
    let title = a.action.replace(/_/g, " ");
    if (action.includes("approved") || action.includes("submitted")) tone = "success";
    if (action.includes("flag") || action.includes("reject")) tone = "danger";
    if (action.includes("hidden") || action.includes("deleted")) tone = "warning";
    if (action.includes("payout")) tone = "info";
    if (action.includes("kyc")) tone = "info";
    if (action.startsWith("post")) title = `${title.charAt(0).toUpperCase() + title.slice(1)}`;

    timeline.push({
      id: `audit-${a.id}`,
      kind: "moderation",
      title,
      meta: a.targetKind ? `${a.targetKind}#${a.targetId ?? "—"}` : undefined,
      at: a.createdAt,
      tone,
    });
  }

  for (const s of recentNewSubscribers) {
    timeline.push({
      id: `sub-${s.id}`,
      kind: "subscription",
      title: "New subscriber",
      meta: `${s.user?.fullName ?? "Someone"} · ${formatINR(Number(s.amount), true)}`,
      at: s.createdAt,
      tone: "success",
    });
  }

  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());
  const timelineTop = timeline.slice(0, 8);

  const toneColors: Record<TimelineEntry["tone"], string> = {
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#dc2626",
    info: "#2563eb",
    neutral: "#94a3b8",
  };

  const firstName = user.fullName.split(" ")[0];

  return (
    <section className="advisor-scope">
      {/* ═══ HERO BANNER ═══ */}
      <div className="advisor-hero">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            position: "relative",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span className="pill-emerald" style={{ background: "rgba(255,255,255,0.16)", color: "#a7f3d0" }}>
                <CheckCircle size={12} />
                SEBI Verified · {user.advisorProfile?.sebiRegistrationNo}
              </span>
              <span className="pill-emerald" style={{ background: "rgba(255,255,255,0.16)", color: "#a7f3d0" }}>
                <span className="live-dot" />
                Live
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2, color: "#fff" }}>
              Good to see you, {firstName}
            </h1>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
              Here&apos;s what&apos;s happened with your advisory business in the last 30 days.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/advisor/posts/new" className="hero-cta">
              <Plus size={16} />
              Post Sentiment
            </Link>
            <Link
              href="/advisor/analytics"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
                backdropFilter: "blur(8px)",
              }}
            >
              <TrendUp size={16} />
              Analytics
            </Link>
          </div>
        </div>

        {/* Hero stat strip */}
        <div
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 32,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.15)",
            position: "relative",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
              Accuracy
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 4, letterSpacing: -0.8 }}>
              {accuracy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
              ROI
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: roi >= 0 ? "#a7f3d0" : "#fecaca",
                marginTop: 4,
                letterSpacing: -0.8,
              }}
            >
              {roi >= 0 ? "+" : ""}
              {roi.toFixed(2)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
              Followers
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 4, letterSpacing: -0.8 }}>
              {totalFollowers.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
              Published
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 4, letterSpacing: -0.8 }}>
              {approvedPosts}
              <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginLeft: 6 }}>
                / {totalPosts}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPI CARDS with SPARKLINES ═══ */}
      <div className="grid grid-4" style={{ marginTop: 20 }}>
        {/* Wallet */}
        <article className="kpi-card" style={{ ["--accent-color" as any]: "#10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="kpi-icon-wrap">
              <Wallet size={22} />
            </div>
            <Delta current={walletBalance} previous={walletPrev} />
          </div>
          <div className="kpi-value">{formatINR(walletBalance, true)}</div>
          <div className="kpi-label">Wallet Balance</div>
          <div style={{ marginTop: 12, height: 44 }}>
            <Sparkline values={revenueSpark} color="#10b981" />
          </div>
        </article>

        {/* Subscribers */}
        <article className="kpi-card" style={{ ["--accent-color" as any]: "#2563eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="kpi-icon-wrap" style={{ background: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}>
              <Users size={22} />
            </div>
            <Delta current={activeSubscribers} previous={prevActiveSubscribers} />
          </div>
          <div className="kpi-value">{activeSubscribers.toLocaleString()}</div>
          <div className="kpi-label">Active Subscribers</div>
          <div style={{ marginTop: 12, height: 44 }}>
            <Sparkline values={subsSpark.length ? subsSpark : [0]} color="#2563eb" />
          </div>
        </article>

        {/* Revenue 30d */}
        <article className="kpi-card" style={{ ["--accent-color" as any]: "#f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="kpi-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#b45309" }}>
              <TrendUp size={22} />
            </div>
            <Delta current={currentRevenue30} previous={previousRevenue30} />
          </div>
          <div className="kpi-value">{formatINR(currentRevenue30, true)}</div>
          <div className="kpi-label">Revenue · Last 30 Days</div>
          <div style={{ marginTop: 12, height: 44 }}>
            <Sparkline values={revenueSpark} color="#f59e0b" fill="rgba(245, 158, 11, 0.12)" />
          </div>
        </article>

        {/* Accuracy ring */}
        <article className="kpi-card" style={{ ["--accent-color" as any]: "#10b981" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <ProgressRing
              value={accuracy}
              size={90}
              stroke={8}
              color="#10b981"
              label={`${accuracy.toFixed(0)}%`}
              sublabel="ACCURACY"
            />
            <div style={{ flex: 1 }}>
              <div className="kpi-label">Latest Performance</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>ROI</span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: roi >= 0 ? "#047857" : "#dc2626",
                  }}
                >
                  {roi >= 0 ? "+" : ""}
                  {roi.toFixed(1)}%
                </span>
              </div>
              <div style={{ marginTop: 8, height: 28 }}>
                <Sparkline values={accuracySpark.length ? accuracySpark : [0]} color="#10b981" height={28} width={120} />
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* ═══ REVENUE CHART + COMPLIANCE SHIELD ═══ */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1.8fr 1fr", gap: 20, marginTop: 20 }}
      >
        <article className="premium-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <h3 className="premium-card-title">Revenue · 30-Day Trend</h3>
              <p className="premium-card-caption">
                Daily earnings from subscriptions and course enrollments
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981" }} />
                Earnings
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  fontWeight: 600,
                }}
              >
                {formatINR(currentRevenue30, true)} total
              </span>
            </div>
          </div>
          <AreaChart data={revenueAreaData} color="#10b981" valueFormatter={(n) => formatINR(n, true)} />
        </article>

        <article
          className="premium-card"
          style={{
            background: `linear-gradient(160deg, ${totalAlerts > 0 ? "#fff7ed" : "#f0fdf4"} 0%, #fff 60%)`,
            borderColor: totalAlerts > 0 ? "#fed7aa" : "#bbf7d0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: totalAlerts > 0 ? "#fff7ed" : "#ecfdf5",
                color: totalAlerts > 0 ? "#c2410c" : "#047857",
                display: "grid",
                placeItems: "center",
                border: `1px solid ${totalAlerts > 0 ? "#fed7aa" : "#bbf7d0"}`,
              }}
            >
              <Shield size={22} />
            </div>
            <div>
              <h3 className="premium-card-title" style={{ marginBottom: 0 }}>
                Compliance Shield
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                {totalAlerts === 0 ? "All posts in good standing" : `${totalAlerts} items need attention`}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 16,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>APPROVED</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#047857", marginTop: 4 }}>
                {approvedPosts}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>PENDING</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
                {pendingPosts}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>FLAGGED</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626", marginTop: 4 }}>
                {flaggedPosts}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>TOXIC</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626", marginTop: 4 }}>
                {toxicCommentsCount}
              </div>
            </div>
          </div>

          {totalAlerts > 0 ? (
            <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
              {[...flaggedPostsList.slice(0, 2), ...rejectedPostsList.slice(0, 1)].map((p) => (
                <Link
                  key={p.id}
                  href={`/advisor/posts/${p.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #fed7aa",
                    textDecoration: "none",
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🚩 {p.title}
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #bbf7d0",
                fontSize: 12,
                color: "#047857",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
              }}
            >
              <CheckCircle size={16} />
              All your posts passed compliance. Keep it up.
            </div>
          )}
        </article>
      </div>

      {/* ═══ SECONDARY ROW: Post mix / KYC ring / Notifications ═══ */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1.3fr 1fr 1fr", gap: 20, marginTop: 20 }}
      >
        <article className="premium-card">
          <h3 className="premium-card-title">Post Performance Mix</h3>
          <p className="premium-card-caption">Distribution across compliance states · {totalPosts} total</p>

          {totalPosts === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              Submit your first post to see performance here.
            </div>
          ) : (
            <>
              <div className="segmented-bar" style={{ marginTop: 8 }}>
                <div
                  className="segmented-bar-fill"
                  style={{ width: `${approvedPct}%`, background: "#10b981" }}
                />
                <div
                  className="segmented-bar-fill"
                  style={{ width: `${pendingPct}%`, background: "#f59e0b" }}
                />
                <div
                  className="segmented-bar-fill"
                  style={{ width: `${flaggedPct}%`, background: "#dc2626" }}
                />
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {[
                  {
                    label: "Approved",
                    value: approvedPosts,
                    pct: approvedPct,
                    color: "#10b981",
                  },
                  {
                    label: "Pending review",
                    value: pendingPosts,
                    pct: pendingPct,
                    color: "#f59e0b",
                  },
                  {
                    label: "Flagged / Rejected",
                    value: flaggedPosts,
                    pct: flaggedPct,
                    color: "#dc2626",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{ width: 10, height: 10, borderRadius: 999, background: row.color }}
                      />
                      <span style={{ fontSize: 13, color: "#334155" }}>{row.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                        {row.pct.toFixed(0)}%
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: "#0f172a",
                          minWidth: 28,
                          textAlign: "right",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="premium-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h3 className="premium-card-title">KYC Readiness</h3>
              <p className="premium-card-caption">
                {kycDone === 3 ? "Fully verified" : `${3 - kycDone} pending`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing
              value={kycPct}
              size={92}
              stroke={9}
              color={kycDone === 3 ? "#10b981" : "#f59e0b"}
              label={`${kycDone}/3`}
              sublabel="DOCS"
            />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              {kycRequired.map((doc) => {
                const done = kycApprovedTypes.has(doc);
                return (
                  <div
                    key={doc}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: done ? "#047857" : "#64748b",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        background: done ? "#d1fae5" : "#f1f5f9",
                        color: done ? "#047857" : "#cbd5e1",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {done ? <CheckCircle size={12} /> : <Clock size={12} />}
                    </div>
                    <span style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.3 }}>
                      {doc.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            href="/advisor/profile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 14,
              fontSize: 12,
              color: "#047857",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {kycDone === 3 ? "View documents" : "Complete KYC"}
            <ArrowUpRight size={13} />
          </Link>
        </article>

        <article className="premium-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div>
              <h3 className="premium-card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Bell size={15} />
                Inbox
              </h3>
              <p className="premium-card-caption">
                {unreadNotifications > 0 ? `${unreadNotifications} unread` : "All caught up"}
              </p>
            </div>
            {unreadNotifications > 0 && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {unreadNotifications}
              </span>
            )}
          </div>

          {recentNotifications.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, padding: "20px 0", textAlign: "center" }}>
              No notifications yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {recentNotifications.slice(0, 3).map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: n.readAt ? "#f8fafc" : "rgba(37, 99, 235, 0.05)",
                    border: `1px solid ${n.readAt ? "#e2e8f0" : "#bfdbfe"}`,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: n.readAt ? "#cbd5e1" : "#2563eb",
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {n.title}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "#64748b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {relTime(n.createdAt)} · {n.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/advisor/notifications"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 12,
              fontSize: 12,
              color: "#047857",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View all notifications
            <ArrowUpRight size={13} />
          </Link>
        </article>
      </div>

      {/* ═══ TIMELINE + POSTS ═══ */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1.5fr", gap: 20, marginTop: 20, alignItems: "start" }}
      >
        <article className="premium-card" style={{ position: "sticky", top: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#f0fdf4",
                color: "#047857",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Zap size={16} />
            </div>
            <div>
              <h3 className="premium-card-title" style={{ marginBottom: 0 }}>
                Activity Feed
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                Latest moderation and subscriber events
              </p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {timelineTop.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, padding: "20px 0", textAlign: "center" }}>
                No recent activity.
              </p>
            ) : (
              timelineTop.map((event) => (
                <div key={event.id} className="timeline-item">
                  <div
                    className="timeline-dot"
                    style={{ background: toneColors[event.tone] }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0f172a",
                        textTransform: "capitalize",
                      }}
                    >
                      {event.title}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      {event.meta && <span>{event.meta} · </span>}
                      {relTime(event.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="premium-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "#f0fdf4",
                  color: "#047857",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <FileText size={16} />
              </div>
              <h3 className="premium-card-title" style={{ marginBottom: 0 }}>
                Recent Market Posts
              </h3>
            </div>
            <Link
              href="/advisor/posts"
              style={{
                fontSize: 12,
                color: "#047857",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {recentPosts.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                border: "2px dashed #e2e8f0",
                borderRadius: 14,
              }}
            >
              <Sparkle size={28} style={{ color: "#94a3b8", marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
                No posts yet — create your first one.
              </p>
              <Link
                href="/advisor/posts/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #047857, #10b981)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <Plus size={14} />
                Post Sentiment
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {recentPosts.map((post) => {
                const complianceMap: Record<
                  string,
                  { label: string; bg: string; fg: string }
                > = {
                  approved: { label: "Approved", bg: "#d1fae5", fg: "#047857" },
                  pending: { label: "Pending", bg: "#fef3c7", fg: "#92400e" },
                  under_review: { label: "Reviewing", bg: "#fef3c7", fg: "#92400e" },
                  flagged: { label: "Flagged", bg: "#fee2e2", fg: "#991b1b" },
                  rejected: { label: "Rejected", bg: "#fee2e2", fg: "#991b1b" },
                };
                const sentimentColor: Record<string, string> = {
                  bullish: "#10b981",
                  bearish: "#ef4444",
                  neutral: "#64748b",
                };
                const cmp = complianceMap[post.complianceStatus] ?? complianceMap.pending;

                return (
                  <Link
                    key={post.id}
                    href={`/advisor/posts/${post.id}`}
                    style={{
                      display: "block",
                      padding: 14,
                      borderRadius: 14,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: `${sentimentColor[post.sentiment] ?? "#64748b"}22`,
                              color: sentimentColor[post.sentiment] ?? "#64748b",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.4,
                            }}
                          >
                            {post.sentiment}
                          </span>
                          {post.marketSymbol && (
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "#f1f5f9",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#334155",
                                letterSpacing: 0.4,
                              }}
                            >
                              {post.marketSymbol}
                            </span>
                          )}
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: cmp.bg,
                              color: cmp.fg,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.4,
                            }}
                          >
                            {cmp.label}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {post.title}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            marginTop: 6,
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <TrendUp size={11} />
                            {post._count.reactions} reactions
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <MessageSquare size={11} />
                            {post._count.comments} comments
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Clock size={11} />
                            {relTime(post.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight size={18} style={{ color: "#94a3b8", flexShrink: 0 }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </article>
      </div>

      {/* ═══ QUICK ACTIONS STRIP ═══ */}
      <article
        className="premium-card"
        style={{
          marginTop: 20,
          background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
          borderColor: "#bbf7d0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Target size={18} style={{ color: "#047857" }} />
          <h3 className="premium-card-title" style={{ marginBottom: 0 }}>
            Quick Actions
          </h3>
        </div>
        <p className="premium-card-caption">Jump to the most common tasks</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginTop: 8,
          }}
        >
          {[
            {
              href: "/advisor/posts/new",
              icon: <Plus size={18} />,
              label: "New Post",
              desc: "Publish sentiment",
            },
            {
              href: "/advisor/courses/new",
              icon: <FileText size={18} />,
              label: "New Course",
              desc: "Monetize content",
            },
            {
              href: "/advisor/subscribers",
              icon: <Users size={18} />,
              label: "Subscribers",
              desc: `${activeSubscribers} active`,
            },
            {
              href: "/advisor/earnings",
              icon: <Wallet size={18} />,
              label: "Request Payout",
              desc: formatINR(walletBalance, true),
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={{
                display: "flex",
                gap: 10,
                padding: 14,
                borderRadius: 14,
                background: "#fff",
                border: "1px solid #bbf7d0",
                textDecoration: "none",
                color: "#0f172a",
                transition: "transform 0.15s, border-color 0.15s",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "#ecfdf5",
                  color: "#047857",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {action.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{action.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </article>
    </section>
  );
}
