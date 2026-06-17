import { smartApiConfig } from "./config";
import { parseSmartApiResponse, SmartApiHttpError } from "./http";
import { generateTotp } from "./totp";
import type { SmartApiEnvelope, SmartApiSession } from "./types";

let cachedSession: (SmartApiSession & { expiresAt: number }) | null = null;
let cachedPublicIp: string | null = null;

const SESSION_TTL_MS = 25 * 60 * 1000;

async function resolvePublicIp(): Promise<string> {
  if (process.env.ANGELONE_CLIENT_PUBLIC_IP) {
    return process.env.ANGELONE_CLIENT_PUBLIC_IP;
  }
  if (cachedPublicIp) return cachedPublicIp;

  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { ip?: string };
    if (data.ip) {
      cachedPublicIp = data.ip;
      return data.ip;
    }
  } catch {
    /* fallback */
  }

  return smartApiConfig.clientPublicIp;
}

async function buildHeaders(jwt?: string): Promise<HeadersInit> {
  const publicIp = await resolvePublicIp();

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": smartApiConfig.clientLocalIp,
    "X-ClientPublicIP": publicIp,
    "X-MACAddress": smartApiConfig.macAddress,
    "X-PrivateKey": smartApiConfig.apiKey(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

async function loginByPassword(): Promise<SmartApiSession> {
  const response = await fetch(
    `${smartApiConfig.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`,
    {
      method: "POST",
      headers: await buildHeaders(),
      body: JSON.stringify({
        clientcode: smartApiConfig.clientCode(),
        password: smartApiConfig.mpin(),
        totp: generateTotp(smartApiConfig.totpSecret()),
      }),
      cache: "no-store",
    },
  );

  const json = await parseSmartApiResponse<SmartApiSession>(response);

  if (!json.status || !json.data?.jwtToken) {
    throw new SmartApiHttpError(
      json.message || json.errorcode || "SmartAPI login failed",
      response.status,
      json.errorcode,
    );
  }

  return json.data;
}

async function refreshTokens(refreshToken: string): Promise<SmartApiSession> {
  const response = await fetch(
    `${smartApiConfig.baseUrl}/rest/auth/angelbroking/jwt/v1/generateTokens`,
    {
      method: "POST",
      headers: await buildHeaders(),
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    },
  );

  const json = await parseSmartApiResponse<SmartApiSession>(response);

  if (!json.status || !json.data?.jwtToken) {
    throw new SmartApiHttpError(
      json.message || json.errorcode || "Token refresh failed",
      response.status,
      json.errorcode,
    );
  }

  return json.data;
}

export async function getSmartApiSession(
  forceRefresh = false,
): Promise<SmartApiSession> {
  if (
    !forceRefresh &&
    cachedSession &&
    Date.now() < cachedSession.expiresAt
  ) {
    return cachedSession;
  }

  if (!forceRefresh && cachedSession?.refreshToken) {
    try {
      const data = await refreshTokens(cachedSession.refreshToken);
      cachedSession = {
        ...data,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      return data;
    } catch {
      clearSmartApiSession();
    }
  }

  const data = await loginByPassword();
  cachedSession = {
    ...data,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return data;
}

export function clearSmartApiSession(): void {
  cachedSession = null;
}

const RETRY_CODES = new Set([
  "AG8001",
  "AG8002",
  "AG8003",
  "AB8050",
  "AB8051",
  "AB1011",
  "AG7002",
]);

export async function smartApiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: Record<string, unknown> },
  retried = false,
): Promise<T> {
  const session = await getSmartApiSession(retried);
  const { body, ...rest } = init ?? {};

  const response = await fetch(`${smartApiConfig.baseUrl}${path}`, {
    ...rest,
    headers: {
      ...(await buildHeaders(session.jwtToken)),
      ...(rest.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let json: SmartApiEnvelope<T>;

  try {
    json = await parseSmartApiResponse<T>(response);
  } catch (error) {
    if (!retried) {
      clearSmartApiSession();
      return smartApiFetch<T>(path, init, true);
    }
    throw error;
  }

  if (!json.status) {
    const shouldRetry =
      !retried &&
      (RETRY_CODES.has(json.errorcode) ||
        json.message?.toLowerCase().includes("access denied") ||
        json.message?.toLowerCase().includes("invalid token"));

    if (shouldRetry) {
      clearSmartApiSession();
      return smartApiFetch<T>(path, init, true);
    }

    throw new SmartApiHttpError(
      json.message || json.errorcode || "SmartAPI request failed",
      response.status,
      json.errorcode,
    );
  }

  return json.data;
}
