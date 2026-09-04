/**
 * Starter prompts arrive from the editor as one textarea, one prompt per line.
 * Blank lines are dropped so a trailing newline does not become an empty chip,
 * and the list is capped at 4 — beyond that the empty state stops being a
 * suggestion and starts being a menu.
 *
 * This lives in lib/ rather than beside the POST handler that uses it because a
 * route module may only export route handlers and Next's own config keys. An
 * exported helper there fails the production build ("Property
 * 'normalizeStarterPrompts' is incompatible with index signature"), even though
 * dev and `tsc` both accept it.
 */
export function normalizeStarterPrompts(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  const raw = Array.isArray(input)
    ? input.map((v) => String(v))
    : String(input ?? "").split("\n");
  return raw
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line) => line.slice(0, 120));
}
