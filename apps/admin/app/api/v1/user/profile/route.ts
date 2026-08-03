import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) return err("User not found", 404);
  return ok({ user });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ fullName?: string; phone?: string; avatarUrl?: string | null }>(req);

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(body.fullName && { fullName: body.fullName }),
      ...(body.phone && { phone: body.phone }),
      ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
    },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      avatarUrl: true,
    },
  });

  return ok({ user });
}
