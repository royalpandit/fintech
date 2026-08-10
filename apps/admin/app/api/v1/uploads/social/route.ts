import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

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
  const typeMap = isVideo ? VIDEO_TYPES : IMAGE_TYPES;
  const ext = typeMap[file.type];
  if (!ext) return err(`Unsupported ${isVideo ? "video" : "image"} format`);

  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (file.size > max) return err(`File too large (max ${isVideo ? "50MB" : "10MB"})`);

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(buf, file.type, `social/${auth.userId}`, ext);

  return ok({ url });
}
