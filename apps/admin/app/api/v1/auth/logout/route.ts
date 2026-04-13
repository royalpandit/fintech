import { ok } from "@/lib/api-helpers";

export async function POST() {
  return ok({ message: "Logged out" });
}
