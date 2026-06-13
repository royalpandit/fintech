import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Invalid form data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return err("file is required");
  if (file.type !== "application/pdf") return err("Only PDF files are allowed");
  if (file.size > MAX_SIZE) return err("File too large (max 25MB)");

  const dir = path.join(process.cwd(), "public", "uploads", "reports", String(auth.userId));
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const abs = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);

  const url = `/uploads/reports/${auth.userId}/${filename}`;
  // Return the original name + size too so the UI/record can show them.
  return ok({ url, fileName: file.name, fileSize: file.size });
}
