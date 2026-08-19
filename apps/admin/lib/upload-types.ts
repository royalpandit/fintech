/**
 * Image type resolution for uploads.
 *
 * The upload routes used to key purely off `file.type` against a four-entry map
 * (jpeg/jpg/png/webp), which rejected perfectly ordinary pictures — GIFs, AVIF,
 * BMP, and anything the browser reported with an empty MIME type — behind a
 * flat "Unsupported image format". This resolves the extension from the MIME
 * type *or* the filename, and returns a message that says what to do when a
 * format genuinely can't be used.
 */

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
};

/** Filename extensions we accept when the browser reports no usable MIME type. */
const IMAGE_EXT_ALIASES: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  jfif: "jpg",
  jpe: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  avif: "avif",
  bmp: "bmp",
};

/**
 * Formats browsers can't render in an <img>, so storing them would produce a
 * broken picture. Each maps to advice rather than a dead end.
 */
const UNRENDERABLE: Record<string, string> = {
  heic: "iPhone HEIC photos can't be displayed on the web. In Settings → Camera → Formats choose “Most Compatible”, or export the photo as JPG and try again.",
  heif: "HEIF photos can't be displayed on the web. Export the photo as JPG and try again.",
  tif: "TIFF images can't be displayed on the web. Save it as JPG or PNG and try again.",
  tiff: "TIFF images can't be displayed on the web. Save it as JPG or PNG and try again.",
};

export const IMAGE_ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp";

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export type ImageTypeResult = { ext: string; error?: never } | { ext?: never; error: string };

/** Work out the storage extension for an uploaded image, or explain why not. */
export function resolveImageExt(file: { type: string; name: string }): ImageTypeResult {
  const mime = (file.type || "").toLowerCase();
  const ext = extensionOf(file.name || "");

  // SVG is executable markup — never serve one back as a user avatar.
  if (mime === "image/svg+xml" || ext === "svg") {
    return { error: "SVG images aren't supported. Please upload a JPG, PNG or WebP." };
  }

  const unrenderable = UNRENDERABLE[ext] ?? (mime.includes("heic") || mime.includes("heif") ? UNRENDERABLE.heic : null);
  if (unrenderable) return { error: unrenderable };

  const byMime = IMAGE_MIME_TO_EXT[mime];
  if (byMime) return { ext: byMime };

  // Browsers (and Windows in particular) sometimes hand over an empty or
  // generic MIME type — fall back to the filename before giving up.
  const byExt = IMAGE_EXT_ALIASES[ext];
  if (byExt) return { ext: byExt };

  const seen = mime || (ext ? `.${ext}` : "unknown");
  return {
    error: `That file type (${seen}) isn't supported. Please upload a JPG, PNG, WebP, GIF or AVIF image.`,
  };
}
