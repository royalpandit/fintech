import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamGeminiChat } from "@/lib/gemini";
import { PRO_AI_MONTHLY_QUERY_LIMIT, reserveUserAiQuery } from "@/lib/user-ai-quota";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/agents/[id]/chat
 * Body: { message: string; sessionId?: number }
 * Returns SSE stream: data: { text } | data: { done, full } | data: { error }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.geminiAgent.findUnique({ where: { id: Number(params.id), isActive: true } });
  if (!agent) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });

  const body = await req.json();
  const userMessage: string = (body.message ?? "").trim();
  if (!userMessage) return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });

  let sessionId = Number(body.sessionId) || 0;
  if (sessionId) {
    const session = await prisma.agentChatSession.findFirst({
      where: { id: sessionId, userId: auth.userId, agentId: agent.id },
      select: { id: true },
    });
    if (!session) return NextResponse.json({ ok: false, error: "Chat session not found" }, { status: 404 });
  }

  const quota = await reserveUserAiQuery(auth.userId, auth.role, "agent_chat");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "AI_QUERY_LIMIT",
        error: quota.isPro
          ? `You've used all ${PRO_AI_MONTHLY_QUERY_LIMIT} Finuer Pro AI queries for this month. Your limit resets next month.`
          : `You've used your ${quota.limit} free AI queries. Upgrade to Finuer Pro for ${PRO_AI_MONTHLY_QUERY_LIMIT} queries per month.`,
        used: quota.used,
        limit: quota.limit,
        isPro: quota.isPro,
        upgradeUrl: "/user/subscriptions#finuer-pro",
      },
      { status: 402 },
    );
  }

  if (!sessionId) {
    const title = userMessage.length > 60 ? userMessage.slice(0, 57) + "…" : userMessage;
    const session = await prisma.agentChatSession.create({
      data: { agentId: agent.id, userId: auth.userId, title },
      select: { id: true },
    });
    sessionId = session.id;
  }

  const rawHistory = await prisma.agentChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const history = rawHistory.map(m => ({ role: m.role as "user" | "model", content: m.content }));
  await prisma.agentChatMessage.create({
    data: { sessionId, role: "user", content: userMessage },
  });

  // Stream Gemini response
  const geminiStream = streamGeminiChat({
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    temperature: agent.temperature,
    history,
    userMessage,
  });

  // Pipe through and save full response when done
  const encoder = new TextEncoder();
  let fullResponse = "";

  const outStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send sessionId first so the client can store it
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId, quota })}\n\n`));

      const reader = geminiStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const decoded = new TextDecoder().decode(value);
        controller.enqueue(value);

        // Extract full text when Gemini signals done
        const lines = decoded.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.full) fullResponse = parsed.full;
          } catch { /* skip */ }
        }
      }

      // Persist model response
      if (fullResponse) {
        await prisma.agentChatMessage.create({
          data: { sessionId, role: "model", content: fullResponse },
        });
        // Update session timestamp
        await prisma.agentChatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
      }

      controller.close();
    },
  });

  return new Response(outStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
