import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/agents — list all agents (admin + super_admin) */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const agents = await prisma.geminiAgent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, fullName: true, role: true } },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({ ok: true, data: agents });
}

/** POST /api/v1/admin/agents — create a new agent */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, avatar, systemPrompt, model, temperature, isActive } = body;

  if (!name?.trim() || !description?.trim() || !systemPrompt?.trim()) {
    return NextResponse.json({ ok: false, error: "name, description and systemPrompt are required" }, { status: 400 });
  }

  const agent = await prisma.geminiAgent.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      avatar: avatar?.trim() || "🤖",
      systemPrompt: systemPrompt.trim(),
      model: model || "gemini-2.0-flash",
      temperature: typeof temperature === "number" ? Math.max(0, Math.min(2, temperature)) : 0.7,
      isActive: isActive !== false,
      createdById: auth.userId,
    },
  });

  return NextResponse.json({ ok: true, data: agent });
}
