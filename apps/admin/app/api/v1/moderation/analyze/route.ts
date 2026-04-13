import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, parseBody } from "@/lib/api-helpers";

const BLOCKED_PHRASES = [
  "guaranteed returns",
  "100% safe",
  "no risk",
  "buy now before it explodes",
];

export async function POST(req: NextRequest) {
  const body = await parseBody<{ content?: string }>(req);
  const text = (body.content || "").toLowerCase();
  const hit = BLOCKED_PHRASES.find((w) => text.includes(w));

  const result = {
    risk_level: hit ? "high" : "low",
    status: hit ? "flagged" : "approved",
    reason: hit
      ? `Blocked phrase detected: ${hit}`
      : "No critical compliance issue detected",
  };

  await prisma.complianceLog.create({
    data: {
      module: "content_moderation",
      status: hit ? "flagged" : "approved",
      notes: result.reason,
      createdBy: "ai",
    },
  });

  return ok(result);
}
