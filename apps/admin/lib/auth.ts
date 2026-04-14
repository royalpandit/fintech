import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export type UserRole = "user" | "advisor" | "admin";

export type AuthPayload = {
  sub: number;
  role: UserRole;
  sid: number;
  iat: number;
  exp: number;
};

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for admin auth");
}

export function parseBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ", 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.trim();
}

export function signAccessToken(payload: { sub: number; role: UserRole; sid: number }) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AuthPayload {
  const payload = jwt.verify(token, JWT_SECRET);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid token payload");
  }
  return payload as unknown as AuthPayload;
}

export async function createSession(userId: number, req: NextRequest) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const deviceId = req.headers.get("x-device-id") || undefined;

  return prisma.userSession.create({
    data: {
      userId,
      deviceId,
      userAgent: req.headers.get("user-agent") || undefined,
      ipAddress,
      refreshTokenHash: randomBytes(64).toString("hex"),
      expiresAt,
    },
  });
}

export async function revokeSession(sessionId: number) {
  return prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function requireAuth(req: NextRequest) {
  const token = parseBearerToken(req);
  if (!token) return null;

  let payload: AuthPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }

  if (!payload?.sub || !payload?.role || !payload?.sid) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { id: payload.sid },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });

  if (!session) return null;
  if (session.userId !== payload.sub) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt && session.expiresAt < new Date()) return null;

  return {
    userId: payload.sub,
    role: payload.role,
    sessionId: payload.sid,
  };
}

export async function requireRole(req: NextRequest, allowedRoles: UserRole[]) {
  const auth = await requireAuth(req);
  if (!auth) return null;
  if (!allowedRoles.includes(auth.role)) return null;
  return auth;
}
