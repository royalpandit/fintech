import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeStarterPrompts } from "../route";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/agents/[id] */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const agent = await prisma.geminiAgent.findUnique({
    where: { id: Number(params.id) },
    include: { createdBy: { select: { id: true, fullName: true } }, _count: { select: { sessions: true } } },
  });
  if (!agent) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: agent });
}

/** PUT /api/v1/admin/agents/[id] */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    name,
    description,
    avatar,
    systemPrompt,
    model,
    temperature,
    isActive,
    isSiteAssistant,
    starterPrompts,
  } = body;
  // Not the `...(x && ...)` guard the fields below use: clearing every prompt is
  // a valid edit, and an empty array would be silently ignored by that pattern.
  const prompts = normalizeStarterPrompts(starterPrompts);
  const id = Number(params.id);

  // Only one agent can be the site assistant — clear the flag on the others first.
  if (isSiteAssistant === true) {
    await prisma.geminiAgent.updateMany({
      where: { isSiteAssistant: true, id: { not: id } },
      data: { isSiteAssistant: false },
    });
  }

  const agent = await prisma.geminiAgent.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(avatar && { avatar: avatar.trim() }),
      ...(systemPrompt && { systemPrompt: systemPrompt.trim() }),
      ...(model && { model }),
      ...(typeof temperature === "number" && { temperature: Math.max(0, Math.min(2, temperature)) }),
      ...(typeof isActive === "boolean" && { isActive }),
      ...(typeof isSiteAssistant === "boolean" && { isSiteAssistant }),
      ...(prompts !== undefined && { starterPrompts: prompts }),
    },
  });

  return NextResponse.json({ ok: true, data: agent });
}

/** DELETE /api/v1/admin/agents/[id] */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await prisma.geminiAgent.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
