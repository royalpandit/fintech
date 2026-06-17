import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { getSmartApiSession } from "@/lib/smartapi/session";

export async function GET() {
  try {
    const session = await getSmartApiSession();
    return NextResponse.json({
      ok: true,
      message: "SmartAPI session active",
      hasJwt: Boolean(session.jwtToken),
      publicIp:
        process.env.ANGELONE_CLIENT_PUBLIC_IP ??
        "auto-detected (see server logs)",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: formatApiError(error),
        hint: "Whitelist your public IP at https://smartapi.angelone.in and add ANGELONE_CLIENT_PUBLIC_IP to .env.local",
      },
      { status: 503 },
    );
  }
}
