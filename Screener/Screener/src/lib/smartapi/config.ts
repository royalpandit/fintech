function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const smartApiConfig = {
  baseUrl: "https://apiconnect.angelone.in",
  apiKey: () => requireEnv("ANGELONE_API_KEY"),
  clientCode: () => requireEnv("ANGELONE_CLIENT_CODE"),
  mpin: () => requireEnv("ANGELONE_MPIN"),
  totpSecret: () => requireEnv("ANGELONE_TOTP_SECRET"),
  /** SmartAPI requires these headers on every request */
  clientLocalIp: process.env.ANGELONE_CLIENT_LOCAL_IP ?? "127.0.0.1",
  clientPublicIp: process.env.ANGELONE_CLIENT_PUBLIC_IP ?? "127.0.0.1",
  macAddress: process.env.ANGELONE_MAC_ADDRESS ?? "00:00:00:00:00:00",
} as const;
