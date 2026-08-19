import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { notifyReportResolved } from "@/lib/notify";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["open", "resolved", "dismissed"]);

// Resolve / dismiss / re-open a content report.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  if (!Number.isFinite(id)) return err("Invalid report id", 400);

  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!ALLOWED_STATUS.has(status)) return err("Invalid status", 400);

  const existing = await prisma.contentReport.findUnique({ where: { id } });
  if (!existing) return err("Report not found", 404);

  const report = await prisma.contentReport.update({
    where: { id },
    data: {
      status,
      resolutionNote: body.resolutionNote ? String(body.resolutionNote) : existing.resolutionNote,
      resolvedByAdminId: status === "open" ? null : auth.userId,
      resolvedAt: status === "open" ? null : new Date(),
    },
  });

  // Tell the person who filed it what happened.
  if (status !== "open" && status !== existing.status) {
    await notifyReportResolved({
      userId: report.reporterUserId,
      outcome:
        report.resolutionNote ||
        (status === "resolved"
          ? "We reviewed your report and took action on the content."
          : "We reviewed your report and found no violation."),
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: `report_${status}`,
      module: "reports",
      targetKind: "content_report",
      targetId: id,
    },
  });

  return ok({ report });
}
