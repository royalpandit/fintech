import "server-only";

import { prisma } from "@/lib/prisma";

type Mem = { payload: unknown; fetchedAt: Date };
const memory = new Map<string, Mem>();

export async function saveMarketSnapshot(kind: string, payload: unknown): Promise<void> {
  memory.set(kind, { payload, fetchedAt: new Date() });
  try {
    await prisma.marketFeedSnapshot.upsert({
      where: { kind },
      create: { kind, payload: payload as object, fetchedAt: new Date() },
      update: { payload: payload as object, fetchedAt: new Date() },
    });
  } catch (e) {
    console.warn("[market-snapshot] persist skipped for %s:", kind, e instanceof Error ? e.message : e);
  }
}

export async function loadMarketSnapshot<T>(kind: string): Promise<{ data: T; fetchedAt: Date } | null> {
  try {
    const row = await prisma.marketFeedSnapshot.findUnique({ where: { kind } });
    if (row?.payload != null) {
      return { data: row.payload as T, fetchedAt: row.fetchedAt };
    }
  } catch {
    // Table may not exist yet — fall through to process memory.
  }
  const mem = memory.get(kind);
  if (!mem) return null;
  return { data: mem.payload as T, fetchedAt: mem.fetchedAt };
}
