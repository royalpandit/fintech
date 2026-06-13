import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isInteger(id)) return err("Invalid report id");

  // Only allow deleting your own report.
  const report = await prisma.advisorReport.findFirst({
    where: { id, advisorUserId: auth.userId, deletedAt: null },
    select: { id: true },
  });
  if (!report) return err("Report not found", 404);

  await prisma.advisorReport.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "report_deleted",
      module: "reports",
      targetKind: "advisor_report",
      targetId: id,
    },
  });

  return ok({ deleted: true });
}
