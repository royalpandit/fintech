import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody(req);

  await prisma.aiLog.create({
    data: {
      userId,
      module: "risk_profile",
      inputData: body as any,
      outputData: { risk_score: 6.8, risk_level: "moderate" },
      confidenceScore: 0.88,
    },
  });

  return ok({ risk_score: 6.8, risk_level: "moderate", input: body });
}
