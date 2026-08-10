import { NextRequest } from "next/server";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { generateOTP, storeOTP, sendSMSOTP } from "@/lib/otp";
import { normalizeIndianMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await parseBody<{ phone?: string }>(req);
  const raw = (body.phone ?? "").trim();
  if (!raw) return err("Phone number is required");

  const mobile = normalizeIndianMobile(raw);
  if (!mobile) return err("Enter a valid 10-digit Indian mobile number");

  const otp = generateOTP();
  storeOTP(mobile, otp);

  const sent = await sendSMSOTP(raw, otp);
  if (!sent) return err("Could not send OTP. Please try again.");

  return ok({ message: "OTP sent" });
}
