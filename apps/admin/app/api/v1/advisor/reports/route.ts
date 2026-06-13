import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const reports = await prisma.advisorReport.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return ok({ data: reports });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    title?: string;
    description?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    accessType?: "free" | "paid";
    price?: number;
  }>(req);

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const fileUrl = (body.fileUrl ?? "").trim();
  const accessType: "free" | "paid" = body.accessType === "paid" ? "paid" : "free";

  if (!title || title.length < 3) return err("Title must be at least 3 characters");
  if (!fileUrl) return err("Please upload a PDF file");

  let price: number | null = null;
  if (accessType === "paid") {
    price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return err("A paid report needs a price greater than 0");
    }
  }

  const report = await prisma.advisorReport.create({
    data: {
      advisorUserId: auth.userId,
      title,
      description: description || null,
      fileUrl,
      fileName: body.fileName?.trim() || null,
      fileSize: typeof body.fileSize === "number" ? body.fileSize : null,
      accessType,
      price,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "report_created",
      module: "reports",
      targetKind: "advisor_report",
      targetId: report.id,
    },
  });

  return ok({ report });
}
