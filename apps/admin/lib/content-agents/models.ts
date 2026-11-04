/*
 * The two production text models, and the agents are split across them.
 *
 * Not for variety — for headroom. The free tier allows 200,000 tokens a day
 * and counts them per model, which the rate-limit headers show: a call to one
 * leaves the other's remaining count untouched. Two hundred posts at the ~1,350
 * tokens they actually use is around 270,000, over the cap on any single model
 * and comfortably under it across two.
 *
 * Both are marked production. Groq's other free text model, qwen3.8-27b, is
 * preview — "evaluation purposes only" — so it is deliberately not here.
 *
 * No "server-only" here: the seed script imports it from plain Node.
 */

export const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const;

export const GROQ_DEFAULT_MODEL = GROQ_MODELS[0];

/** Stable per agent, so an agent's voice does not change between posts. */
export function groqModelForAgent(agentNo: number): string {
  return GROQ_MODELS[agentNo % GROQ_MODELS.length]!;
}

/*
 * Where a call goes when its own model will not take it.
 *
 * The limits that actually bite are per model and per window: the response
 * headers on this key report 8,000 tokens a minute and 1,000 requests a day
 * each, and the free tier adds a daily token cap on top. One model meeting any
 * of those is not a reason for an empty slot when another model is idle — so a
 * refused call walks this list instead of failing.
 *
 * Order is by how well each writes these posts. qwen3.8-27b is last because it
 * is a preview model — Groq labels preview models for evaluation, not
 * production — so it carries the schedule only when both production models have
 * nothing left to give. The rest of the account's catalogue is unusable here and
 * deliberately absent: gpt-oss-safeguard-20b is a policy classifier, allam-2-7b
 * has a 4,096-token window that these prompts do not fit in, and the whisper,
 * orpheus and prompt-guard models are not chat models at all.
 */
export const GROQ_FALLBACK_ORDER = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
] as const;

/** The models to try for a call, preferred first and each listed once. */
export function groqModelChain(preferred: string): string[] {
  return [preferred, ...GROQ_FALLBACK_ORDER.filter(m => m !== preferred)];
}
