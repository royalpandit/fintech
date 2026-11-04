import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  isProfessionalType,
  validateProfessionalCredentials,
  type ProfessionalDetails,
} from "@/lib/professional-types";

export const dynamic = "force-dynamic";

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
  const registrationNo = String(body.sebiRegistrationNo ?? "").trim().toUpperCase();
  const pan = String(body.pan ?? "").trim().toUpperCase();
  const firmName = body.firmName ? String(body.firmName).trim() : null;
  const validTill = body.validTill ? String(body.validTill) : null;

  if (!legalName || !registrationNo || !pan) {
    return err("Legal name, registration identifier, and PAN are required.", 400);
  }
  if (!PAN_REGEX.test(pan)) {
    return err("PAN must be a valid 10-character PAN (e.g. ABCDE1234F).", 400);
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: {
      id: true,
      sebiRegistrationNo: true,
      professionalType: true,
      verificationDetails: true,
    },
  });
  if (!profile) return err("Advisor profile not found", 404);

  if (registrationNo !== profile.sebiRegistrationNo) {
    return err("The registration identifier must match the one submitted with your application.", 400);
  }

  const savedDetails: ProfessionalDetails =
    profile.verificationDetails && typeof profile.verificationDetails === "object" &&
    !Array.isArray(profile.verificationDetails)
      ? Object.fromEntries(
          Object.entries(profile.verificationDetails).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  if (!isProfessionalType(profile.professionalType)) {
    return err("Unsupported professional type. Contact support.", 400);
  }
  const credentialError = validateProfessionalCredentials(
    profile.professionalType,
    profile.sebiRegistrationNo,
    savedDetails,
  );
  if (credentialError) {
    return err(`Your application credentials need correction: ${credentialError}`, 400);
  }

  const now = new Date();
  const updatedDetails: ProfessionalDetails = {
    ...savedDetails,
    legalName,
    pan,
    ...(firmName ? { firmName } : {}),
    ...(validTill ? { validTill } : {}),
  };
  await prisma.$transaction([
    prisma.advisorProfile.update({
      where: { userId: auth.userId },
      data: {
        verificationFormSubmittedAt: now,
        verificationDetails: updatedDetails,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: auth.userId,
        action: "advisor.verification_submitted",
        module: "advisors",
        targetKind: "advisor_profile",
        targetId: profile.id,
        payload: { registrationNo, firmName, validTill },
      },
    }),
  ]);

  return ok({ verifiedAt: now.toISOString() });
}
