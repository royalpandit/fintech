import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { resolveImageExt } from "@/lib/upload-types";

export const dynamic = "force-dynamic";

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

  let ext: string;
  if (isVideo) {
    const videoExt = VIDEO_TYPES[file.type];
    if (!videoExt) return err("Unsupported video format. Please upload an MP4, MOV or WebM.");
    ext = videoExt;
  } else {
    const resolved = resolveImageExt(file);
    if (resolved.error) return err(resolved.error);
    ext = resolved.ext;
  }

  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (file.size > max) return err(`File too large (max ${isVideo ? "50MB" : "10MB"})`);
  if (file.size === 0) return err("That file is empty.");

  // Fall back to a sane content type when the browser reported none, so R2
  // serves the image back with a header the browser will actually render.
  const contentType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(buf, contentType, `social/${auth.userId}`, ext);

  return ok({ url });
}
