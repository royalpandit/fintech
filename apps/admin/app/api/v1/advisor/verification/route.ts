import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEBI_REGEX = /^INA[0-9]{9}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Self-service advisor verification form submission (sets verificationFormSubmittedAt).
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body", 400);
  }

  const legalName = String(body.legalName ?? "").trim();
  const sebiRegistrationNo = String(body.sebiRegistrationNo ?? "").trim().toUpperCase();
  const pan = String(body.pan ?? "").trim().toUpperCase();
  const firmName = body.firmName ? String(body.firmName).trim() : null;
  const validTill = body.validTill ? String(body.validTill) : null;

  if (!legalName || !sebiRegistrationNo || !pan) {
    return err("Legal name, SEBI registration number, and PAN are required.", 400);
  }
  if (!SEBI_REGEX.test(sebiRegistrationNo)) {
    return err("SEBI registration number must look like INA000000000.", 400);
  }
  if (!PAN_REGEX.test(pan)) {
    return err("PAN must be a valid 10-character PAN (e.g. ABCDE1234F).", 400);
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true, sebiRegistrationNo: true },
  });
  if (!profile) return err("Advisor profile not found", 404);

  if (sebiRegistrationNo !== profile.sebiRegistrationNo) {
    const taken = await prisma.advisorProfile.findUnique({
      where: { sebiRegistrationNo },
      select: { id: true },
    });
    if (taken && taken.id !== profile.id) {
      return err("That SEBI registration number is already in use.", 409);
    }
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.advisorProfile.update({
      where: { userId: auth.userId },
      data: {
        sebiRegistrationNo,
        verificationFormSubmittedAt: now,
        verificationDetails: { legalName, pan, firmName, validTill },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: auth.userId,
        action: "advisor.verification_submitted",
        module: "advisors",
        targetKind: "advisor_profile",
        targetId: profile.id,
        payload: { sebiRegistrationNo, firmName, validTill },
      },
    }),
  ]);

  return ok({ verifiedAt: now.toISOString() });
}
