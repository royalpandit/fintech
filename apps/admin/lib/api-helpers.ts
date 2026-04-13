import { NextResponse } from "next/server";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ status: true, ...data });
}

export function err(message: string, statusCode = 400) {
  return NextResponse.json({ status: false, error: message }, { status: statusCode });
}

export async function parseBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
