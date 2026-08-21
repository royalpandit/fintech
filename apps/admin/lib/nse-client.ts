import "server-only";

/**
 * NSE website client.
 *
 * Their JSON endpoints 401/403 unless the request carries cookies from a prior
 * GET of nseindia.com. We handshake once, reuse the jar for a few minutes, and
 * redo it if a call comes back forbidden.
 */

const BASE = (process.env.NSE_BASE_URL || "https://www.nseindia.com").replace(/\/$/, "");
const UA =
  process.env.NSE_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type Jar = { header: string; until: number };
let jar: Jar | null = null;
let handshakeInflight: Promise<string> | null = null;

const JAR_TTL_MS = 6 * 60_000;

function browserHeaders(cookie?: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${BASE}/`,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function cookieHeaderFrom(res: Response): string {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const list = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
  if (list.length) {
    return list
      .map((c) => c.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(";").slice(0, 1).join("") : "";
}

async function handshake(): Promise<string> {
  if (jar && Date.now() < jar.until && jar.header) return jar.header;
  if (handshakeInflight) return handshakeInflight;

  handshakeInflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${BASE}/`, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });
      const header = cookieHeaderFrom(res);
      if (!header) throw new Error("NSE handshake returned no cookies");
      jar = { header, until: Date.now() + JAR_TTL_MS };
      return header;
    } finally {
      clearTimeout(timer);
      handshakeInflight = null;
    }
  })();

  return handshakeInflight;
}

export function nsePath(envName: string, fallback: string): string {
  const raw = process.env[envName]?.trim() || fallback;
  return raw.startsWith("http") ? raw : `${BASE}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export async function nseGetJson<T>(
  pathOrUrl: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const attempt = async (cookie: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url.toString(), {
        headers: browserHeaders(cookie),
        cache: "no-store",
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  let cookie = await handshake();
  let res = await attempt(cookie);
  if (res.status === 401 || res.status === 403) {
    jar = null;
    cookie = await handshake();
    res = await attempt(cookie);
  }
  if (!res.ok) throw new Error(`NSE HTTP ${res.status} on ${url.pathname}`);
  return (await res.json()) as T;
}
