import "server-only";

/*
 * Groq, for the scheduled writers.
 *
 * Chosen over Gemini for this job on cost: Gemini's Google Search grounding sits
 * behind a quota that a handful of calls exhausted, and two hundred posts a day
 * would need billing. Groq's free tier allows a thousand requests a day, which
 * covers the schedule with room to spare.
 *
 * The trade is that Groq cannot search. Asked what the Nifty closed at, these
 * models answer "NO CURRENT DATA" — honest, and useless on its own. So they are
 * never asked to know anything: lib/content-agents/context.ts fetches the
 * figures first and the prompt carries them. The model analyses; it does not
 * recall.
 */

const BASE = "https://api.groq.com/openai/v1";

// Model ids and the per-agent split live in ./content-agents/models, which
// carries no server-only guard so the seed script can read them too.
export { GROQ_MODELS, GROQ_DEFAULT_MODEL, groqModelForAgent } from "@/lib/content-agents/models";
import { groqModelChain } from "@/lib/content-agents/models";

function apiKey(): string {
  const k = process.env.GROQ_API_KEY?.trim();
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

/*
 * Models that have just said no, and until when.
 *
 * A model that answered 429 a second ago will answer 429 again, and every one
 * of those round trips is spent inside a cron tick that has other slots to
 * publish. So a refusal is remembered for as long as the response says to wait,
 * and the next call skips straight to a model that can take it.
 *
 * In-process and therefore per serverless instance: a cold start forgets, and
 * then learns again from one request. That is the right trade here — the memory
 * is an optimisation, not the correctness, which is the fallback walk below.
 */
const cooldowns = new Map<string, number>();

function cooled(model: string): boolean {
  const until = cooldowns.get(model);
  if (until == null) return false;
  if (until <= Date.now()) {
    cooldowns.delete(model);
    return false;
  }
  return true;
}

/**
 * How long to leave a model alone.
 *
 * Groq's Retry-After is in seconds and is honest about both windows: a per
 * minute ceiling comes back as a few seconds, an exhausted daily allowance as
 * hours. Clamped at both ends so a missing header does not mean no cooldown and
 * an enormous one does not take a model out for the rest of the day on a single
 * bad reading.
 */
function cooldownMs(retryAfter: string | null, message: string | undefined): number {
  const secs = Number(retryAfter);
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30 * 60_000);
  // Daily caps are worth a longer rest than a per-minute one, even unlabelled.
  return /day|daily|TPD|RPD/i.test(message ?? "") ? 15 * 60_000 : 60_000;
}

type Attempt = { model: string; why: string };

/**
 * One completion, from whichever model will produce it.
 *
 * `model` is the preference; the rest of the chain is tried when that one is
 * rate limited, out of daily allowance, retired, or broken. Only a refusal by
 * the service is worth another model — a bad key or a malformed request will be
 * just as bad everywhere, so those throw immediately.
 */
export async function groqComplete(opts: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const chain = groqModelChain(opts.model);
  const refused: Attempt[] = [];

  for (const [i, model] of chain.entries()) {
    // The preferred model is always tried, cooldown or not, when it is the only
    // one left to try; otherwise a cooled model is skipped without a round trip.
    if (cooled(model) && i < chain.length - 1) {
      refused.push({ model, why: "cooling down from an earlier refusal" });
      continue;
    }

    try {
      const text = await completeWith(model, opts);
      if (i > 0) {
        console.warn(
          "[groq] %s served this call; %s",
          model,
          refused.map(r => `${r.model}: ${r.why}`).join("; "),
        );
      }
      return text;
    } catch (e) {
      if (!(e instanceof RetryableGroqError)) throw e;
      refused.push({ model, why: e.message });
    }
  }

  throw new Error(
    `Groq had no model able to answer — ${refused.map(r => `${r.model}: ${r.why}`).join("; ")}`,
  );
}

/** A refusal by this model that another model might not repeat. */
class RetryableGroqError extends Error {}

async function completeWith(model: string, opts: {
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    signal: opts.signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      temperature: opts.temperature,
      max_tokens: opts.maxTokens ?? 1600,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message;
    // The per-minute token ceiling is the one a schedule actually meets, and it
    // is worth naming so a throttled run is not mistaken for a broken key.
    const retry = res.headers.get("retry-after");
    const detail = `HTTP ${res.status}: ${msg ?? "unknown error"}${retry ? ` (retry after ${retry}s)` : ""}`;

    /*
     * Whose problem is it: this model's, or the request's?
     *
     * 429 is an allowance — per minute or per day — and 404 means the model is
     * gone, which is how a retired id fails. Both are answered by asking a
     * different model. 5xx is Groq having a moment, and worth one too. A 400 or
     * a 401 is the request or the key, identical everywhere, so it raises
     * rather than walking the whole chain to collect the same answer three
     * times.
     */
    const switchable = res.status === 429 || res.status === 404 || res.status >= 500;
    if (switchable) {
      cooldowns.set(model, Date.now() + cooldownMs(retry, msg));
      throw new RetryableGroqError(detail);
    }
    throw new Error(`Groq ${detail}`);
  }

  const choice = (data as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  })?.choices?.[0];

  /*
   * These models think before answering, and the thinking is billed against
   * max_tokens. Given twenty it spent all twenty reasoning and returned an
   * empty string with finish_reason "length" — so a ceiling that is merely
   * tight does not fail loudly, it truncates the post mid-sentence. Caught
   * here rather than published half-written.
   */
  if (choice?.finish_reason === "length") {
    // Worth another model rather than an empty slot: how much of the ceiling
    // goes on reasoning differs between them, and the next one may fit.
    throw new RetryableGroqError("hit the token ceiling — the post would be cut off");
  }

  const text = choice?.message?.content?.trim();
  if (!text) throw new RetryableGroqError("returned an empty completion");
  return text;
}
