import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ service: "flexi-backend", uptime: process.uptime() });
}
