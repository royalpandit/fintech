import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/v1/agents — list active agents (public for all logged-in users) */
export async function GET() {
  const agents = await prisma.geminiAgent.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      model: true,
      _count: { select: { sessions: true } },
    },
  });
  return NextResponse.json({ ok: true, data: agents });
}
