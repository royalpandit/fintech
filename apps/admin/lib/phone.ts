/**
 * Normalize an Indian mobile number to its canonical 10-digit local form.
 *
 * Accepts inputs written with a +91 / 91 country code, a leading trunk 0, or
 * spaces / dashes / brackets. Returns the 10-digit string (which must start
 * with 6-9, per the Indian mobile numbering plan) or `null` if it isn't a
 * valid 10-digit mobile number.
 *
 * Used by registration (validate + store canonical) and login (match on the
 * last 10 digits, so a number stored as "+9199..." or "99..." both resolve).
 */
export function normalizeIndianMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");

  // Strip a country code (91) or a leading trunk 0 when present.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

/** True when the input is a valid 10-digit Indian mobile number. */
export function isValidIndianMobile(input: string | null | undefined): boolean {
  return normalizeIndianMobile(input) !== null;
}
