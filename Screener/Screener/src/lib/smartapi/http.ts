import type { SmartApiEnvelope } from "./types";

export class SmartApiHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "SmartApiHttpError";
  }
}

/** Parse Angel response safely — they sometimes return plain text e.g. "Access denied..." */
export async function parseSmartApiResponse<T>(
  response: Response,
): Promise<SmartApiEnvelope<T>> {
  const text = await response.text();

  if (!text.trim()) {
    throw new SmartApiHttpError(
      `Empty response from Angel API (HTTP ${response.status})`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as SmartApiEnvelope<T>;
  } catch {
    const hint = text.toLowerCase().includes("access denied")
      ? " Angel API access denied — register your public IP in the SmartAPI dashboard (smartapi.angelone.in) and set ANGELONE_CLIENT_PUBLIC_IP in .env.local if needed."
      : "";

    throw new SmartApiHttpError(
      `${text.slice(0, 200).trim() || `Invalid response (HTTP ${response.status})`}.${hint}`,
      response.status,
    );
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof SmartApiHttpError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed";
}
