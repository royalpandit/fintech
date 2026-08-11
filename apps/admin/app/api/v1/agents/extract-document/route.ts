import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { err, ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_CHARS = 40_000; // keep chat context bounded

const PDF_TYPES = new Set(["application/pdf"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function truncate(text: string) {
  const cleaned = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (cleaned.length <= MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_CHARS)}\n\n[…document truncated for length…]`;
}

/** Turn a 2D cell grid into a Markdown table the model can read. */
function tableToMarkdown(rows: string[][]): string {
  const cleaned = rows
    .map((r) => r.map((c) => String(c ?? "").replace(/\n+/g, " ").trim()))
    .filter((r) => r.some((c) => c.length > 0));
  if (!cleaned.length) return "";

  const cols = Math.max(...cleaned.map((r) => r.length));
  const norm = cleaned.map((r) => {
    const row = [...r];
    while (row.length < cols) row.push("");
    return row;
  });

  const header = norm[0];
  const body = norm.slice(1);
  const sep = header.map(() => "---");
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;

  if (!body.length) {
    // Single-row "table" — still useful as a pipe line
    return line(header);
  }
  return [line(header), line(sep), ...body.map(line)].join("\n");
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; tablesMarkdown: string }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    let text = textResult.text ?? "";

    const tableChunks: string[] = [];
    try {
      const tableResult = await parser.getTable();
      const pages = tableResult?.pages ?? [];
      let tableIdx = 0;
      for (const page of pages) {
        const tables = page?.tables ?? [];
        for (const table of tables) {
          const rows = Array.isArray(table) ? (table as string[][]) : [];
          const md = tableToMarkdown(rows);
          if (!md) continue;
          tableIdx += 1;
          tableChunks.push(`### Table ${tableIdx}\n${md}`);
        }
      }
    } catch (e) {
      // Table detection is best-effort; text extraction still proceeds.
      console.warn("[extract-document] getTable failed:", e);
    }

    return { text, tablesMarkdown: tableChunks.join("\n\n") };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocx(buffer: Buffer): Promise<{ text: string; tablesMarkdown: string }> {
  const mammoth = await import("mammoth");
  // Raw text for body; HTML convert preserves table structure we can flatten.
  const raw = await mammoth.extractRawText({ buffer });
  let text = raw.value ?? "";
  let tablesMarkdown = "";

  try {
    const html = await mammoth.convertToHtml({ buffer });
    const tables = [...(html.value.match(/<table[\s\S]*?<\/table>/gi) ?? [])];
    if (tables.length) {
      const chunks: string[] = [];
      tables.forEach((tbl, i) => {
        const rows: string[][] = [];
        const trs = tbl.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
        for (const tr of trs) {
          const cells = [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) =>
            m[1]
              .replace(/<[^>]+>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim(),
          );
          if (cells.length) rows.push(cells);
        }
        const md = tableToMarkdown(rows);
        if (md) chunks.push(`### Table ${i + 1}\n${md}`);
      });
      tablesMarkdown = chunks.join("\n\n");
    }
  } catch (e) {
    console.warn("[extract-document] docx table parse failed:", e);
  }

  return { text, tablesMarkdown };
}

/**
 * POST /api/v1/agents/extract-document
 * multipart form field `file` — PDF or DOCX.
 * Returns extracted plain text (+ Markdown tables when detected) for the chatbot.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Invalid multipart body", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return err("file is required", 400);
  if (file.size <= 0) return err("Empty file", 400);
  if (file.size > MAX_BYTES) return err("File too large (max 8 MB)", 400);

  const name = file.name || "document";
  const mime = (file.type || "").toLowerCase();
  const lower = name.toLowerCase();
  const isPdf = PDF_TYPES.has(mime) || lower.endsWith(".pdf");
  const isDocx =
    DOCX_TYPES.has(mime) || lower.endsWith(".docx") || lower.endsWith(".doc");

  if (!isPdf && !isDocx) {
    return err("Only PDF and Word (.docx) files are supported", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isDocx && lower.endsWith(".doc") && !lower.endsWith(".docx")) {
      return err("Please upload a .docx file (legacy .doc is not supported)", 400);
    }

    const { text, tablesMarkdown } = isPdf
      ? await extractPdf(buffer)
      : await extractDocx(buffer);

    const parts = [
      text.trim(),
      tablesMarkdown
        ? `\n\n## Extracted tables\n\n${tablesMarkdown}`
        : "",
    ];
    const extracted = truncate(parts.join("").trim());
    if (!extracted) {
      return err("Could not extract any text from that document", 422);
    }

    return ok({
      fileName: name,
      mime: mime || (isPdf ? "application/pdf" : "application/docx"),
      charCount: extracted.length,
      hasTables: Boolean(tablesMarkdown),
      text: extracted,
    });
  } catch (e) {
    console.error("[extract-document]", e);
    return err("Failed to read document text", 500);
  }
}
