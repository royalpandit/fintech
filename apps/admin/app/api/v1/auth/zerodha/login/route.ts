import { NextResponse } from "next/server";
import { getLoginURL } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/zerodha/login — redirects to Kite login page */
export async function GET() {
  return NextResponse.redirect(getLoginURL());
}
