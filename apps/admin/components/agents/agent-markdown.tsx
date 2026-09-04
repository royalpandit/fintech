/**
 * Markdown renderer for AI agent replies.
 *
 * The previous renderer walked the text one line at a time and wrapped each
 * line in a <div>. That worked for a sentence and fell apart on everything the
 * agents actually produce:
 *
 *   • A blank line became an empty <div> of zero height, so paragraph breaks
 *     vanished and long answers arrived as one unbroken wall of text. This was
 *     the main reason the transcript read badly.
 *   • ``` fences, tables, numbered lists, blockquotes and links had no handling
 *     at all, so they showed up as literal backticks and pipe characters —
 *     and the earnings agents emit tables constantly.
 *   • Raw model output went into dangerouslySetInnerHTML unescaped. Anything
 *     the model echoed back from an uploaded PDF was live HTML in the page.
 *
 * So this parses blocks first, then inline spans, and escapes before it
 * formats. It is deliberately a small subset of Markdown — what Gemini emits
 * in practice — rather than a general parser.
 *
 * Streaming matters here: this re-runs on every token, so an unterminated
 * ``` fence has to render as a code block rather than dumping its raw source
 * until the closing fence arrives.
 */

"use client";

import { memo, useMemo } from "react";

type Block =
  | { t: "p"; text: string }
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "list"; ordered: boolean; items: { text: string; depth: number }[] }
  | { t: "code"; lang: string; code: string }
  | { t: "quote"; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" };

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Inline spans → HTML. Input is escaped first, so every tag below is one we
 * put there ourselves.
 *
 * Code spans are pulled out before anything else runs and put back at the end,
 * so `**not bold**` inside backticks stays literal.
 */
function inline(raw: string): string {
  // NUL as the sentinel rather than a printable placeholder: with the index
  // wrapped in spaces, any bare number already in the prose (" 42 ") would
  // have been swapped for a code span on the way back out.
  const code: string[] = [];
  let s = escapeHtml(raw).replace(/`([^`]+)`/g, (_, t: string) => {
    code.push(t);
    return `\u0000${code.length - 1}\u0000`;
  });

  // [label](url) — http/https/mailto only. A javascript: or data: href here
  // would be a link the model wrote, so the scheme check is not optional.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, href: string) => {
    if (!/^(https?:\/\/|mailto:|\/)/i.test(href)) return m;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });

  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${code[Number(i)]}</code>`);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

const BULLET = /^(\s*)[-•*+]\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/;

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      blocks.push({ t: "p", text: para.join("\n") });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── fenced code ──────────────────────────────────────────────────────
    const fence = trimmed.match(/^```(\w*)/);
    if (fence) {
      flush();
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i++;
      // No closing fence while streaming — take the rest and let the block
      // grow as tokens arrive.
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      blocks.push({ t: "code", lang, code: body.join("\n") });
      continue;
    }

    if (!trimmed) {
      flush();
      continue;
    }

    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }

    const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }

    // ── table: a pipe row followed by a |---|---| divider ────────────────
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      flush();
      const head = splitRow(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      blocks.push({ t: "table", head, rows });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      i--;
      blocks.push({ t: "quote", text: q.join("\n") });
      continue;
    }

    // ── lists ────────────────────────────────────────────────────────────
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const items: { text: string; depth: number }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(ordered ? NUMBERED : BULLET);
        if (m) {
          items.push({ text: m[2], depth: Math.min(2, Math.floor(m[1].length / 2)) });
          i++;
          continue;
        }
        // A plain indented line continues the item above it.
        if (items.length && /^\s{2,}\S/.test(lines[i]) && !lines[i].match(ordered ? BULLET : NUMBERED)) {
          items[items.length - 1].text += " " + lines[i].trim();
          i++;
          continue;
        }
        break;
      }
      i--;
      blocks.push({ t: "list", ordered, items });
      continue;
    }

    para.push(trimmed);
  }

  flush();
  return blocks;
}

function html(s: string) {
  return { __html: inline(s) };
}

/**
 * Memoised on `text`.
 *
 * Streaming replaces the whole messages array on every token, so without this
 * every turn in the transcript re-parsed its full text dozens of times a
 * second — the cost grew with the length of the conversation, which is exactly
 * when the scroll started to feel heavy.
 */
function AgentMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parse(text), [text]);

  return (
    <div className="agent-md">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "hr":
            return <hr key={i} />;

          case "h": {
            const Tag = (["h3", "h4", "h5"] as const)[b.level - 1];
            return <Tag key={i} dangerouslySetInnerHTML={html(b.text)} />;
          }

          case "code":
            return (
              <pre key={i}>
                {b.lang && <span className="agent-md-lang">{b.lang}</span>}
                <code>{b.code}</code>
              </pre>
            );

          case "quote":
            return <blockquote key={i} dangerouslySetInnerHTML={html(b.text)} />;

          case "table":
            return (
              // Wrapped so a wide table scrolls inside itself instead of
              // stretching the transcript column.
              <div key={i} className="agent-md-table">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} dangerouslySetInnerHTML={html(c)} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} dangerouslySetInnerHTML={html(c)} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i}>
                {b.items.map((it, j) => (
                  <li key={j} data-depth={it.depth} dangerouslySetInnerHTML={html(it.text)} />
                ))}
              </Tag>
            );
          }

          default:
            return <p key={i} dangerouslySetInnerHTML={html(b.text)} />;
        }
      })}
    </div>
  );
}

export default memo(AgentMarkdown);
