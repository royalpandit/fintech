import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Invalid form data");
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "image");
  if (!(file instanceof File)) return err("file is required");

  const isVideo = kind === "video";
  const allowed = isVideo ? VIDEO_TYPES : IMAGE_TYPES;
  if (!allowed.has(file.type)) {
    return err(`Unsupported ${isVideo ? "video" : "image"} format`);
  }

  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (file.size > max) {
    return err(`File too large (max ${isVideo ? "50MB" : "10MB"})`);
  }

  const ext =
    file.type === "image/jpeg" || file.type === "image/jpg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "video/quicktime"
            ? "mov"
            : file.type === "video/webm"
              ? "webm"
              : "mp4";

  const dir = path.join(process.cwd(), "public", "uploads", "social", String(auth.userId));
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const abs = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);

  const url = `/uploads/social/${auth.userId}/${filename}`;
  return ok({ url });
}
