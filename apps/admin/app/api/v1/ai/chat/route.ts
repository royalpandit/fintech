import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await parseBody<{ message?: string; context?: string }>(req);

  if (!body.message) return err("message is required");

  await prisma.aiLog.create({
    data: {
      userId: userId || null,
      module: "chat",
      inputData: { message: body.message, context: body.context },
      outputData: { answer: "Informational response generated." },
      confidenceScore: 0.92,
    },
  });

  return ok({
    answer: "Informational response generated.",
    confidence_score: 0.92,
    context: body.context,
  });
}
