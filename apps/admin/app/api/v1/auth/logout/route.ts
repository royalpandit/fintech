import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, revokeSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  await revokeSession(auth.sessionId);
  return ok({ message: "Logged out" });
}
