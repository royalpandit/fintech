import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 env vars not configured (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload a file buffer to Cloudflare R2 and return its public URL.
 * @param buf     File content
 * @param contentType  MIME type
 * @param folder  Key prefix (e.g. "social/42", "reports/42", "chat/42")
 * @param ext     File extension without dot (e.g. "jpg", "pdf")
 */
export async function uploadToR2(
  buf: Buffer,
  contentType: string,
  folder: string,
  ext: string,
): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error("CLOUDFLARE_R2_BUCKET_NAME or CLOUDFLARE_R2_PUBLIC_URL is not set");
  }
  const key = `${folder}/${randomUUID()}.${ext}`;
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  );
  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}
