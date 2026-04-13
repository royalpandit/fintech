import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
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
