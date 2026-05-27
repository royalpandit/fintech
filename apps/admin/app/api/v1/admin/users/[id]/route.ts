import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

type AccountStatus = "active" | "pending" | "suspended";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden — super admin only", 403);

  const userId = Number(params.id);
  if (!Number.isFinite(userId) || userId < 1) return err("Invalid user id", 400);

  const body = await parseBody<{
    action?: "verify" | "suspend" | "reactivate";
    status?: AccountStatus;
  }>(req);

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true, status: true, emailVerifiedAt: true },
  });
  if (!target) return err("User not found", 404);

  if (target.role === "super_admin" && auth.userId !== userId) {
    return err("Cannot modify another super admin account", 403);
  }

  let status: AccountStatus | undefined;
  let emailVerifiedAt: Date | null | undefined;

  if (body.action === "verify") {
    status = "active";
    emailVerifiedAt = target.emailVerifiedAt ?? new Date();
  } else if (body.action === "suspend") {
    status = "suspended";
  } else if (body.action === "reactivate") {
    status = "active";
  } else if (body.status && ["active", "pending", "suspended"].includes(body.status)) {
    status = body.status;
    if (body.status === "active" && target.role === "user") {
      emailVerifiedAt = target.emailVerifiedAt ?? new Date();
    }
  } else {
    return err("Provide action (verify, suspend, reactivate) or status", 400);
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(emailVerifiedAt !== undefined ? { emailVerifiedAt } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: auth.userId,
        action: body.action === "verify" ? "user_verified" : "user_status_updated",
        module: "users",
        targetKind: "user",
        targetId: userId,
        payload: { action: body.action, status, emailVerified: Boolean(updated.emailVerifiedAt) } as any,
      },
    });

    return updated;
  });

  return ok({ user });
}
