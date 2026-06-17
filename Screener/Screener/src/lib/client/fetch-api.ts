/**
 * Safe fetch for our Next.js API routes — never throws on non-JSON bodies.
 */
export async function fetchApi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const text = await res.text();

  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    const friendly = text.toLowerCase().includes("access denied")
      ? "Angel API access denied. Whitelist your public IP at smartapi.angelone.in → My Apps → your app → Static IP."
      : text.slice(0, 180) || `Server returned invalid JSON (HTTP ${res.status})`;

    throw new Error(friendly);
  }

  if (!res.ok) {
    throw new Error(
      (typeof json.error === "string" && json.error) ||
        `Request failed (HTTP ${res.status})`,
    );
  }

  return json as T;
}
