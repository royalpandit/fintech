import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// The site-wide chatbot agent for the floating widget: the active agent flagged
// as site assistant, else the first active agent. Public so the bubble also
// shows to guests on landing/login (chatting still requires sign-in).
export async function GET() {
  const agent =
    (await prisma.geminiAgent.findFirst({
      where: { isActive: true, isSiteAssistant: true },
      select: { id: true, name: true, avatar: true, description: true },
    })) ??
    (await prisma.geminiAgent.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, avatar: true, description: true },
    }));

  return ok({ agent });
}
