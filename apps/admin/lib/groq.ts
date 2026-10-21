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

/** 131k context, and the strongest of the three text models the free tier serves. */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

function apiKey(): string {
  const k = process.env.GROQ_API_KEY?.trim();
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

export async function groqComplete(opts: {
  model: string;
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
      model: opts.model,
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
    throw new Error(
      `Groq HTTP ${res.status}: ${msg ?? "unknown error"}${retry ? ` (retry after ${retry}s)` : ""}`,
    );
  }

  const text = (data as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content?.trim();

  if (!text) throw new Error("Groq returned an empty completion");
  return text;
}
