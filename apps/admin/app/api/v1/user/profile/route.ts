import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{ fullName?: string; phone?: string }>(req);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.fullName && { fullName: body.fullName }),
      ...(body.phone && { phone: body.phone }),
    },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  return ok({ user });
}
