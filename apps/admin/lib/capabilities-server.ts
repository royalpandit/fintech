// Server-side capability resolution against the admin-editable DB matrix.
// A `professional_capabilities` row overrides the code default for its
// (type, capability) pair; absence falls back to lib/capabilities defaults.

import { prisma } from "./prisma";
import type { ProfessionalType } from "./professional-types";
import { ALL_CAPABILITIES, can, type Capability } from "./capabilities";

type OverrideMatrix = Map<string, Map<string, boolean>>;

let cache: { matrix: OverrideMatrix; at: number } | null = null;
const TTL_MS = 15_000;

async function loadOverrides(): Promise<OverrideMatrix> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.matrix;
  const rows = await prisma.professionalCapability.findMany({
    select: { professionalType: true, capability: true, allowed: true },
  });
  const matrix: OverrideMatrix = new Map();
  for (const r of rows) {
    const byCap = matrix.get(r.professionalType) ?? new Map<string, boolean>();
    byCap.set(r.capability, r.allowed);
    matrix.set(r.professionalType, byCap);
  }
  cache = { matrix, at: Date.now() };
  return matrix;
}

/** Call after any admin edit so the next check sees fresh data. */
export function invalidateCapabilityCache() {
  cache = null;
}

/** Effective allow for (type, capability): DB override if present, else default. */
export async function canType(
  type: ProfessionalType | null | undefined,
  cap: Capability,
): Promise<boolean> {
  if (!type) return can(null, cap);
  const override = (await loadOverrides()).get(type)?.get(cap);
  return override === undefined ? can(type, cap) : override;
}

/** Effective capability list for a type — for exposing to clients. */
export async function effectiveCapabilities(
  type: ProfessionalType | null | undefined,
): Promise<Capability[]> {
  const overrides = type ? (await loadOverrides()).get(type) : undefined;
  return ALL_CAPABILITIES.filter((cap) => {
    const o = overrides?.get(cap);
    return o === undefined ? can(type, cap) : o;
  });
}

/** Full per-capability state for the admin editor (effective + default + changed). */
export async function matrixForType(type: ProfessionalType): Promise<
  { capability: Capability; allowed: boolean; defaultAllowed: boolean; changed: boolean }[]
> {
  const overrides = (await loadOverrides()).get(type);
  return ALL_CAPABILITIES.map((capability) => {
    const def = can(type, capability);
    const o = overrides?.get(capability);
    const allowed = o === undefined ? def : o;
    return { capability, allowed, defaultAllowed: def, changed: allowed !== def };
  });
}

/** Load advisor professional type for capability checks. */
export async function advisorProfessionalType(userId: number) {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { professionalType: true },
  });
  return profile?.professionalType ?? null;
}

/** Whether this advisor user currently holds a capability (defaults + DB overrides). */
export async function advisorCan(userId: number, cap: Capability): Promise<boolean> {
  return canType(await advisorProfessionalType(userId), cap);
}
