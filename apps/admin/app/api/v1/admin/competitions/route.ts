import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  COMPETITION_API_DOCS,
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

function parseBody(body: Record<string, unknown>): CompetitionCreateInput {
  const startDate = new Date(String(body.startDate ?? body.start_date ?? ""));
  const endDate = new Date(String(body.endDate ?? body.end_date ?? ""));
  const participationStartRaw = body.participationStartDate ?? body.participation_start_date;
  const participationEndRaw = body.participationEndDate ?? body.participation_end_date;

  return {
    title: String(body.title ?? "").trim(),
    shortDescription:
      body.shortDescription != null
        ? String(body.shortDescription)
        : body.short_description != null
          ? String(body.short_description)
          : null,
    description: body.description != null ? String(body.description) : null,
    bannerImage:
      body.bannerImage != null
        ? String(body.bannerImage)
        : body.banner_image != null
          ? String(body.banner_image)
          : null,
    tags: parseTags(body.tags),
    question: body.question != null ? String(body.question) : null,
    options: parseOptions(body.options ?? body.answerOptions ?? body.answer_options),
    participationStartDate: participationStartRaw
      ? new Date(String(participationStartRaw))
      : startDate,
    participationEndDate: participationEndRaw ? new Date(String(participationEndRaw)) : endDate,
    startDate,
    endDate,
    status: parseCompetitionStatus(body.status),
    visibility: parseCompetitionVisibility(body.visibility),
    reputationPoints: Number(body.reputationPoints ?? body.reputation_points ?? 10),
    wrongPredictionPoints: Number(body.wrongPredictionPoints ?? body.wrong_prediction_points ?? 0),
    maxPredictionsPerUser: Number(body.maxPredictionsPerUser ?? body.max_predictions_per_user ?? 1),
    allowPredictionChange: Boolean(body.allowPredictionChange ?? body.allow_prediction_change ?? false),
    requireLogin: body.requireLogin !== false && body.require_login !== false,
    entryType: body.entryType === "paid" || body.entry_type === "paid" ? "paid" : "free",
    entryFee: Number(body.entryFee ?? body.entry_fee ?? 0),
    maxParticipants:
      body.maxParticipants != null || body.max_participants != null
        ? Number(body.maxParticipants ?? body.max_participants)
        : null,
    allowedRoles: parseRoleKeys(body.allowedRoles ?? body.allowed_roles ?? body.roleIds ?? body.role_ids),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const filters = competitionRepository.parseListQuery(req.nextUrl.searchParams);
  const rows = await competitionRepository.listCompetitions(filters);

  return NextResponse.json({
    ok: true,
    data: rows.map((c) => serializeCompetition(c)),
    meta: { filters, docs: COMPETITION_API_DOCS.admin.list },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const input = parseBody(body);
  input.createdById = auth.userId;

  const err = validateCompetitionInput(input);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });

  try {
    const row = await competitionRepository.createCompetition(input);
    return NextResponse.json({ ok: true, data: serializeCompetition(row) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to create competition" },
      { status: 400 },
    );
  }
}
