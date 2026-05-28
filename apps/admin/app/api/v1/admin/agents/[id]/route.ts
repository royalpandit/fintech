import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, description, avatar, systemPrompt, model, temperature, isActive } = body;

  const agent = await prisma.geminiAgent.update({
    where: { id: Number(params.id) },
    data: {
      ...(name && { name: name.trim() }),
      ...(description && { description: description.trim() }),
      ...(avatar && { avatar: avatar.trim() }),
      ...(systemPrompt && { systemPrompt: systemPrompt.trim() }),
      ...(model && { model }),
      ...(typeof temperature === "number" && { temperature: Math.max(0, Math.min(2, temperature)) }),
      ...(typeof isActive === "boolean" && { isActive }),
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
