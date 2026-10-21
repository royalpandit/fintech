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
