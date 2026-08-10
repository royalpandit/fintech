import NodeCache from "node-cache";
import { randomInt } from "crypto";

// OTP TTL: 5 minutes. Note: node-cache is in-process; in multi-instance
// deployments (e.g. Vercel serverless), swap this for Redis.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export function generateOTP(): string {
  return String(randomInt(100000, 999999));
}

export function storeOTP(phone: string, otp: string): void {
  cache.set(phone, otp);
}

export function verifyOTP(phone: string, otp: string): boolean {
  const stored = cache.get<string>(phone);
  if (!stored || stored !== otp) return false;
  cache.del(phone);
  return true;
}

export async function sendSMSOTP(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.RENFLAIR_API_KEY;
  if (!apiKey) throw new Error("RENFLAIR_API_KEY is not set");
  const url = `https://sms.renflair.in/V1.php?API=${apiKey}&PHONE=${encodeURIComponent(phone)}&OTP=${otp}`;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
