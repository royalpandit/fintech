import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/v1/agents/[id]/sessions — get user's chat sessions with this agent */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.agentChatSession.findMany({
    where: { agentId: Number(params.id), userId: auth.userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ ok: true, data: sessions });
}

/** GET /api/v1/agents/[id]/sessions?sessionId=X — load messages for a session */
// Handled via query param on the same route
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = Number(searchParams.get("sessionId"));
  if (!sessionId) return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });

  const session = await prisma.agentChatSession.findFirst({
    where: { id: sessionId, userId: auth.userId, agentId: Number(params.id) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: session });
}
