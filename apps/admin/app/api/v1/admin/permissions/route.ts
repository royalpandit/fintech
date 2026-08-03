import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { isProfessionalType, type ProfessionalType } from "@/lib/professional-types";
import { ALL_CAPABILITIES, CAPABILITY_PRESETS, isCapability } from "@/lib/capabilities";
import { invalidateCapabilityCache, matrixForType } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

// Super-admin permission matrix editor. A `professional_capabilities` row
// overrides the code default for one (type, capability); absence = default.

// GET ?type=research_analyst → effective + default + changed for every capability.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const type = new URL(req.url).searchParams.get("type");
  if (!isProfessionalType(type)) return err("Invalid professional type");

  return ok({ type, rows: await matrixForType(type as ProfessionalType) });
}

// PUT { type, capability, allowed } → toggle one cell.
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{ type?: string; capability?: string; allowed?: boolean }>(req);
  if (!isProfessionalType(body.type)) return err("Invalid professional type");
  if (!isCapability(body.capability)) return err("Invalid capability");
  if (typeof body.allowed !== "boolean") return err("`allowed` must be boolean");

  const type = body.type as ProfessionalType;
  const capability = body.capability;
  const allowed = body.allowed;

  await prisma.professionalCapability.upsert({
    where: { professionalType_capability: { professionalType: type, capability } },
    create: { professionalType: type, capability, allowed, updatedByAdminId: auth.userId },
    update: { allowed, updatedByAdminId: auth.userId },
  });
  invalidateCapabilityCache();

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "permission_toggle",
      module: "permissions",
      targetKind: "professional_type",
      payload: { type, capability, allowed },
    },
  });

  return ok({ type, rows: await matrixForType(type) });
}

// POST { type, preset } → apply a preset bundle to a type (writes every capability).
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{ type?: string; preset?: string }>(req);
  if (!isProfessionalType(body.type)) return err("Invalid professional type");
  const preset = CAPABILITY_PRESETS.find((p) => p.id === body.preset);
  if (!preset) return err("Invalid preset");

  const type = body.type as ProfessionalType;
  const granted = new Set<string>(preset.capabilities);

  await prisma.$transaction(
    ALL_CAPABILITIES.map((capability) =>
      prisma.professionalCapability.upsert({
        where: { professionalType_capability: { professionalType: type, capability } },
        create: {
          professionalType: type,
          capability,
          allowed: granted.has(capability),
          updatedByAdminId: auth.userId,
        },
        update: { allowed: granted.has(capability), updatedByAdminId: auth.userId },
      }),
    ),
  );
  invalidateCapabilityCache();

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "permission_preset",
      module: "permissions",
      targetKind: "professional_type",
      payload: { type, preset: preset.id },
    },
  });

  return ok({ type, rows: await matrixForType(type) });
}

// DELETE ?type=... → reset a type to code defaults (removes all overrides).
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const type = new URL(req.url).searchParams.get("type");
  if (!isProfessionalType(type)) return err("Invalid professional type");

  await prisma.professionalCapability.deleteMany({
    where: { professionalType: type as ProfessionalType },
  });
  invalidateCapabilityCache();

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "permission_reset",
      module: "permissions",
      targetKind: "professional_type",
      payload: { type },
    },
  });

  return ok({ type, rows: await matrixForType(type as ProfessionalType) });
}
