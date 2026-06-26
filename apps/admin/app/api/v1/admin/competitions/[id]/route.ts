import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  parseCompetitionStatus,
  parseCompetitionVisibility,
  parseOptions,
  parseRoleKeys,
  parseTags,
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
  if (body.tags != null) out.tags = parseTags(body.tags);
  if (body.question != null) out.question = String(body.question);
  if (body.options != null || body.answerOptions != null || body.answer_options != null) {
    out.options = parseOptions(body.options ?? body.answerOptions ?? body.answer_options);
  }
  if (body.participationStartDate != null || body.participation_start_date != null) {
    out.participationStartDate = new Date(
      String(body.participationStartDate ?? body.participation_start_date),
    );
  }
  if (body.participationEndDate != null || body.participation_end_date != null) {
    out.participationEndDate = new Date(
      String(body.participationEndDate ?? body.participation_end_date),
    );
  }
  if (body.startDate != null || body.start_date != null) {
    out.startDate = new Date(String(body.startDate ?? body.start_date));
  }
  if (body.endDate != null || body.end_date != null) {
    out.endDate = new Date(String(body.endDate ?? body.end_date));
  }
  if (body.status != null) out.status = parseCompetitionStatus(body.status);
  if (body.visibility != null) out.visibility = parseCompetitionVisibility(body.visibility);
  if (body.reputationPoints != null || body.reputation_points != null) {
    out.reputationPoints = Number(body.reputationPoints ?? body.reputation_points);
  }
  if (body.wrongPredictionPoints != null || body.wrong_prediction_points != null) {
    out.wrongPredictionPoints = Number(body.wrongPredictionPoints ?? body.wrong_prediction_points);
  }
  if (body.maxPredictionsPerUser != null || body.max_predictions_per_user != null) {
    out.maxPredictionsPerUser = Number(body.maxPredictionsPerUser ?? body.max_predictions_per_user);
  }
  if (body.allowPredictionChange != null || body.allow_prediction_change != null) {
    out.allowPredictionChange = Boolean(body.allowPredictionChange ?? body.allow_prediction_change);
  }
  if (body.requireLogin != null || body.require_login != null) {
    out.requireLogin = Boolean(body.requireLogin ?? body.require_login);
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
    tags: input.tags ?? existing.tags,
    question: input.question ?? existing.question,
    options:
      input.options ??
      existing.options.map((o) => ({ label: o.label, sortOrder: o.sortOrder })),
    participationStartDate: input.participationStartDate ?? existing.participationStartDate,
    participationEndDate: input.participationEndDate ?? existing.participationEndDate,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    status: input.status ?? existing.status,
    visibility: input.visibility ?? existing.visibility,
    reputationPoints: input.reputationPoints ?? existing.reputationPoints,
    wrongPredictionPoints: input.wrongPredictionPoints ?? existing.wrongPredictionPoints,
    maxPredictionsPerUser: input.maxPredictionsPerUser ?? existing.maxPredictionsPerUser,
    allowPredictionChange: input.allowPredictionChange ?? existing.allowPredictionChange,
    requireLogin: input.requireLogin ?? existing.requireLogin,
    maxParticipants: input.maxParticipants ?? existing.maxParticipants,
    allowedRoles: input.allowedRoles ?? existing.allowedRoles.map((r) => r.roleKey),
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
