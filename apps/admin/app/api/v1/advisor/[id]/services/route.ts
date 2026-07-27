import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { advisorServices } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

// Public — an advisor's active subscription services (for the subscribe modal).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const advisorId = Number(params.id);
  if (!Number.isFinite(advisorId)) return err("Invalid advisor id");
  // Only services accepting new subscribers show in the subscribe modal.
  const services = (await advisorServices(advisorId, { activeOnly: true }))
    .filter((s) => !s.paused)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      price: s.price,
      yearlyPrice: s.yearlyPrice,
      hasTrial: s.hasTrial,
      trialDays: s.trialDays,
      isBundle: s.isBundle,
    }));
  return ok({ data: services });
}
