import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { advisorCan } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  if (!(await advisorCan(auth.userId, "report.sell"))) {
    return err("Only SEBI Research Analysts and Advisory Firms can upload reports", 403);
  }

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

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(buf, "application/pdf", `reports/${auth.userId}`, "pdf");

  return ok({ url, fileName: file.name, fileSize: file.size });
}
