const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiRole = "user" | "model";

export interface GeminiMessage {
  role: GeminiRole;
  content: string;
}

function apiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

function buildContents(history: GeminiMessage[], userMessage: string) {
  const contents = history.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

/** Stream Gemini response as SSE. Returns a ReadableStream of SSE lines. */
export function streamGeminiChat(opts: {
  model: string;
  systemPrompt: string;
  temperature: number;
  history: GeminiMessage[];
  userMessage: string;
}): ReadableStream<Uint8Array> {
  const { model, systemPrompt, temperature, history, userMessage } = opts;
  const url = `${BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey()}`;

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: buildContents(history, userMessage),
    generationConfig: { temperature, maxOutputTokens: 2048 },
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.slice(0, 200) })}\n\n`));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              const text: string = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch { /* skip malformed chunk */ }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      }
      controller.close();
    },
  });
}

/** Non-streaming single response for simple use cases. */
export async function geminiChat(opts: {
  model: string;
  systemPrompt: string;
  temperature: number;
  history: GeminiMessage[];
  userMessage: string;
}): Promise<string> {
  const { model, systemPrompt, temperature, history, userMessage } = opts;
  const url = `${BASE}/${model}:generateContent?key=${apiKey()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: buildContents(history, userMessage),
      generationConfig: { temperature, maxOutputTokens: 2048 },
    }),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
