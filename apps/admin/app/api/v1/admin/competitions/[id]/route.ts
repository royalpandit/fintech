import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  parseCompetitionStatus,
  parseRoleKeys,
  serializeCompetition,
  validateCompetitionInput,
  type CompetitionCreateInput,
} from "@/lib/competition";
import { competitionRepository } from "@/lib/competition-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parsePartialBody(body: Record<string, unknown>): Partial<CompetitionCreateInput> {
  const out: Partial<CompetitionCreateInput> = {};
  if (body.title != null) out.title = String(body.title).trim();
  if (body.shortDescription != null || body.short_description != null) {
    out.shortDescription = String(body.shortDescription ?? body.short_description);
  }
  if (body.description != null) out.description = String(body.description);
  if (body.bannerImage != null || body.banner_image != null) {
    out.bannerImage = String(body.bannerImage ?? body.banner_image);
  }
  if (body.startDate != null || body.start_date != null) {
    out.startDate = new Date(String(body.startDate ?? body.start_date));
  }
  if (body.endDate != null || body.end_date != null) {
    out.endDate = new Date(String(body.endDate ?? body.end_date));
  }
  if (body.status != null) out.status = parseCompetitionStatus(body.status);
  if (body.visibility != null) out.visibility = body.visibility === "hidden" ? "hidden" : "public";
  if (body.entryType != null || body.entry_type != null) {
    out.entryType = body.entryType === "paid" || body.entry_type === "paid" ? "paid" : "free";
  }
  if (body.entryFee != null || body.entry_fee != null) {
    out.entryFee = Number(body.entryFee ?? body.entry_fee);
  }
  if (body.prizePool != null || body.prize_pool != null) {
    out.prizePool = Number(body.prizePool ?? body.prize_pool);
  }
  if (body.totalWinners != null || body.total_winners != null) {
    out.totalWinners = Number(body.totalWinners ?? body.total_winners);
  }
  if (body.maxParticipants != null || body.max_participants != null) {
    out.maxParticipants = Number(body.maxParticipants ?? body.max_participants);
  }
  if (body.allowedRoles != null || body.allowed_roles != null) {
    out.allowedRoles = parseRoleKeys(body.allowedRoles ?? body.allowed_roles);
  }
  return out;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const row = await competitionRepository.findCompetitionById(Number(id));
  if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: serializeCompetition(row) });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const input = parsePartialBody(body);

  const existing = await competitionRepository.findCompetitionById(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const merged: CompetitionCreateInput = {
    title: input.title ?? existing.title,
    shortDescription: input.shortDescription ?? existing.shortDescription,
    description: input.description ?? existing.description,
    bannerImage: input.bannerImage ?? existing.bannerImage,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    status: input.status ?? existing.status,
    visibility: input.visibility ?? existing.visibility,
    entryType: input.entryType ?? existing.entryType,
    entryFee: input.entryFee ?? Number(existing.entryFee),
    prizePool: input.prizePool ?? Number(existing.prizePool),
    totalWinners: input.totalWinners ?? existing.totalWinners,
    maxParticipants: input.maxParticipants ?? existing.maxParticipants,
    allowedRoles: input.allowedRoles,
  };

  const err = validateCompetitionInput(merged);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });

  try {
    const row = await competitionRepository.updateCompetition(Number(id), input);
    return NextResponse.json({ ok: true, data: serializeCompetition(row) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json();
  const numId = Number(id);

  try {
    if (body.action === "activate") {
      const row = await competitionRepository.setVisibility(numId, "public");
      return NextResponse.json({ ok: true, data: serializeCompetition(row) });
    }
    if (body.action === "deactivate") {
      const row = await competitionRepository.setVisibility(numId, "hidden");
      return NextResponse.json({ ok: true, data: serializeCompetition(row) });
    }
    if (body.status) {
      const row = await competitionRepository.setStatus(numId, parseCompetitionStatus(body.status));
      return NextResponse.json({ ok: true, data: serializeCompetition(row) });
    }
    return NextResponse.json({ ok: false, error: "Unknown patch action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Patch failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await competitionRepository.deleteCompetition(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 },
    );
  }
}
