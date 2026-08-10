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
  "image/gif": "gif",
};

const DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
};

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_DOC = 25 * 1024 * 1024;

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
  if (!(file instanceof File)) return err("file is required");

  const isImage = file.type in IMAGE_TYPES;
  const isDoc = file.type in DOC_TYPES;
  if (!isImage && !isDoc) {
    return err("Unsupported file type. Send an image or a document (pdf, doc, xls, ppt, txt, csv).");
  }

  const max = isImage ? MAX_IMAGE : MAX_DOC;
  if (file.size > max) return err(`File too large (max ${isImage ? "10MB" : "25MB"})`);

  const ext = isImage ? IMAGE_TYPES[file.type] : DOC_TYPES[file.type];
  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadToR2(buf, file.type, `chat/${auth.userId}`, ext);

  return ok({ url, type: isImage ? "image" : "file", name: file.name });
}
