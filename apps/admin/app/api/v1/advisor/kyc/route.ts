import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DOC_TYPES = ["pan", "aadhaar", "sebi_cert", "other"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const docs = await prisma.kycDocument.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentType: true,
      documentFileUrl: true,
      verificationStatus: true,
      rejectionReason: true,
      verifiedAt: true,
      createdAt: true,
      verifiedBy: { select: { fullName: true } },
    },
  });

  const byType = docs.reduce<Record<string, boolean>>((acc, d) => {
    if (d.verificationStatus === "approved") acc[d.documentType] = true;
    return acc;
  }, {});

  return ok({
    documents: docs,
    completeness: {
      pan: Boolean(byType.pan),
      aadhaar: Boolean(byType.aadhaar),
      sebi_cert: Boolean(byType.sebi_cert),
      approvedCount: Object.values(byType).filter(Boolean).length,
      totalRequired: 3,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    documentType?: string;
    documentNumber?: string;
    documentFileUrl?: string;
  }>(req);

  const documentType = body.documentType;
  if (!documentType || !DOC_TYPES.includes(documentType as any)) {
    return err("Valid documentType is required (pan | aadhaar | sebi_cert | other)");
  }

  const fileUrl = (body.documentFileUrl ?? "").trim();
  if (!fileUrl) return err("documentFileUrl is required");

  // Simple format check (not full encryption). Real implementation uses KMS/envelope encryption.
  const docNumber = (body.documentNumber ?? "").trim();
  if (docNumber.length < 4) return err("Document number is required");

  // If a pending doc of the same type exists, supersede it.
  const existing = await prisma.kycDocument.findFirst({
    where: {
      userId: auth.userId,
      documentType: documentType as any,
      verificationStatus: { in: ["pending", "rejected"] },
    },
    select: { id: true },
  });

  const doc = existing
    ? await prisma.kycDocument.update({
        where: { id: existing.id },
        data: {
          documentNumberEnc: docNumber,
          documentFileUrl: fileUrl,
          verificationStatus: "pending",
          rejectionReason: null,
        },
      })
    : await prisma.kycDocument.create({
        data: {
          userId: auth.userId,
          documentType: documentType as any,
          documentNumberEnc: docNumber,
          documentFileUrl: fileUrl,
          verificationStatus: "pending",
        },
      });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: existing ? "kyc_resubmitted" : "kyc_uploaded",
      module: "users",
      targetKind: "kyc_document",
      targetId: doc.id,
      payload: { documentType } as any,
    },
  });

  return ok({ document: doc });
}
