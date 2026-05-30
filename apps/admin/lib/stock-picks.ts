import type { Prisma } from "@prisma/client";

export type ChartPoint = { label: string; value: number };

export const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strong_sell: "Strong Sell",
};

export const RECOMMENDATION_COLORS: Record<string, { bg: string; color: string }> = {
  strong_buy: { bg: "#dcfce7", color: "#15803d" },
  buy: { bg: "#ecfdf5", color: "#16a34a" },
  hold: { bg: "#fef9c3", color: "#a16207" },
  sell: { bg: "#fee2e2", color: "#dc2626" },
  strong_sell: { bg: "#fecaca", color: "#991b1b" },
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "group";
}

export function uniqueSlug(base: string, existing: string[]): string {
  let slug = slugify(base);
  if (!existing.includes(slug)) return slug;
  let i = 2;
  while (existing.includes(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export function parseChartData(raw: unknown): ChartPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === "object" && "value" in (p as object))
    .map((p, i) => {
      const pt = p as { label?: string; value: number };
      return {
        label: pt.label ?? `D${i + 1}`,
        value: Number(pt.value) || 0,
      };
    });
}

export function defaultChartData(performancePct: number | null): ChartPoint[] {
  const end = performancePct ?? 12;
  const start = Math.max(0, end - 8);
  return Array.from({ length: 12 }, (_, i) => ({
    label: `W${i + 1}`,
    value: start + ((end - start) * i) / 11 + Math.sin(i * 0.8) * 1.2,
  }));
}

export function serializeGroup(g: {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  iconEmoji: string;
  performancePct: Prisma.Decimal | null;
  benchmarkPct: Prisma.Decimal | null;
  chartData: Prisma.JsonValue;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  stocks?: {
    id: number;
    symbol: string;
    stockName: string;
    cmp: Prisma.Decimal | null;
    targetPrice: Prisma.Decimal | null;
    stopLoss: Prisma.Decimal | null;
    recommendation: string;
    analystNote: string | null;
    sortOrder: number;
    isPublished: boolean;
  }[];
  _count?: { stocks: number };
}) {
  const stockCount =
    g._count?.stocks ??
    (g.stocks ? g.stocks.filter((s) => s.isPublished !== false).length : 0);

  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    category: g.category,
    iconEmoji: g.iconEmoji,
    performancePct: g.performancePct != null ? Number(g.performancePct) : null,
    benchmarkPct: g.benchmarkPct != null ? Number(g.benchmarkPct) : null,
    chartData: parseChartData(g.chartData),
    sortOrder: g.sortOrder,
    isPublished: g.isPublished,
    stockCount,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    stocks: g.stocks?.map(serializeStock),
  };
}

export function serializeStock(s: {
  id: number;
  groupId?: number;
  symbol: string;
  stockName: string;
  cmp: Prisma.Decimal | null;
  targetPrice: Prisma.Decimal | null;
  stopLoss: Prisma.Decimal | null;
  recommendation: string;
  analystNote: string | null;
  sortOrder: number;
  isPublished: boolean;
}) {
  return {
    id: s.id,
    groupId: s.groupId,
    symbol: s.symbol,
    stockName: s.stockName,
    cmp: s.cmp != null ? Number(s.cmp) : null,
    targetPrice: s.targetPrice != null ? Number(s.targetPrice) : null,
    stopLoss: s.stopLoss != null ? Number(s.stopLoss) : null,
    recommendation: s.recommendation,
    recommendationLabel: RECOMMENDATION_LABELS[s.recommendation] ?? s.recommendation,
    analystNote: s.analystNote,
    sortOrder: s.sortOrder,
    isPublished: s.isPublished,
  };
}
