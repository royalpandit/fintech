import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import type { ComplianceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_COMPLIANCE = new Set<ComplianceStatus>([
  "pending",
  "approved",
  "flagged",
  "rejected",
  "under_review",
]);

// Moderate a course: approve/reject compliance and toggle publish.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid course id", 400);

  const body = await req.json().catch(() => ({}));
  const data: { complianceStatus?: ComplianceStatus; isPublished?: boolean } = {};

  if (body.complianceStatus !== undefined) {
    if (!ALLOWED_COMPLIANCE.has(body.complianceStatus)) return err("Invalid compliance status", 400);
    data.complianceStatus = body.complianceStatus;
  }
  if (body.isPublished !== undefined) {
    data.isPublished = Boolean(body.isPublished);
  }
  if (Object.keys(data).length === 0) return err("Nothing to update", 400);

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) return err("Course not found", 404);

  const course = await prisma.course.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action:
        data.complianceStatus !== undefined
          ? `course_${data.complianceStatus}`
          : data.isPublished
            ? "course_published"
            : "course_unpublished",
      module: "courses",
      targetKind: "course",
      targetId: id,
    },
  });

  return ok({ course });
}
