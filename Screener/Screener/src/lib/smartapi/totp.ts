import { generateSync } from "otplib";

export function generateTotp(secret: string): string {
  return generateSync({ secret });
}
