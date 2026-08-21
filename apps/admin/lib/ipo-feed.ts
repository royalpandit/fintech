import "server-only";

import { nseGetJson, nsePath } from "@/lib/nse-client";
import { fetchText, firstSuccess, type Provider } from "@/lib/provider-failover";

export type IpoIssue = {
  symbol: string;
  company: string;
  status: string;
  openDate: string;
  closeDate: string;
  issuePrice: string;
  issueSize: string;
  gmp: string | null;
  gmpSource?: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "ipo", "currentIssues", "issues"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function mapNseRow(r: Record<string, unknown>): IpoIssue {
  return {
    symbol: str(r.symbol || r.Symbol || r.scripId),
    company: str(r.companyName || r.company || r.CompanyName || r.issuerName),
    status: str(r.status || r.issueStatus || r.series || "Open"),
    openDate: str(r.issueStartDate || r.openDate || r.biddingStartDate),
    closeDate: str(r.issueEndDate || r.closeDate || r.biddingEndDate),
    issuePrice: str(r.issuePrice || r.priceBand || r.floorPrice),
    issueSize: str(r.issueSize || r.size),
    gmp: null,
  };
}

async function fetchNseIpos(): Promise<IpoIssue[]> {
  const url = nsePath("NSE_IPO_PATH", "/api/ipo-current-issue");
  const raw = await nseGetJson<unknown>(url);
  const issues = asRows(raw).map(mapNseRow).filter((r) => r.company || r.symbol);
  if (!issues.length) throw new Error("NSE IPO payload empty");
  return issues;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " "));
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(limited|ltd|ipo|mainboard|sme)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type GmpMap = Map<string, { gmp: string; source: string }>;

function parseGmpTables(html: string, source: string): GmpMap {
  const map: GmpMap = new Map();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1] ?? ""));
    if (cells.length < 2) continue;
    const company = cells.find((c) => /[a-zA-Z]{3,}/.test(c) && !/gmp|kostak|subject|company|ipo/i.test(c)) ?? cells[0];
    const gmpCell =
      cells.find((c) => /₹|rs\.?/i.test(c) && /\d/.test(c)) ??
      cells.find((c) => /^[-+]?\s*\d+(\.\d+)?\s*%?$/.test(c.replace(/,/g, "")));
    if (!company || company.length < 3 || !gmpCell) continue;
    const key = normName(company);
    if (key.length < 3) continue;
    if (!map.has(key)) map.set(key, { gmp: gmpCell, source });
  }
  if (!map.size) throw new Error(`${source} GMP table empty`);
  return map;
}

async function fetchChittorgarhGmp(): Promise<GmpMap> {
  const url =
    process.env.CHITTORGARH_GMP_URL ||
    "https://www.chittorgarh.com/report/live-ipo-gmp-grey-market-premium-latest/21/";
  const html = await fetchText(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  return parseGmpTables(html, "chittorgarh");
}

async function fetchIpowatchGmp(): Promise<GmpMap> {
  const url = process.env.IPOWATCH_GMP_URL || "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/";
  const html = await fetchText(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  return parseGmpTables(html, "ipowatch");
}

function attachGmp(issues: IpoIssue[], gmp: GmpMap): IpoIssue[] {
  return issues.map((ipo) => {
    const key = normName(ipo.company || ipo.symbol);
    let hit: { gmp: string; source: string } | undefined;
    if (gmp.has(key)) hit = gmp.get(key);
    else {
      for (const [k, v] of gmp) {
        if (k.includes(key) || key.includes(k)) {
          hit = v;
          break;
        }
      }
    }
    return hit ? { ...ipo, gmp: hit.gmp, gmpSource: hit.source } : ipo;
  });
}

let cache: { data: IpoIssue[]; provider: string; at: number } | null = null;
const TTL = 15 * 60_000;

export async function getIpoBoard(): Promise<{ issues: IpoIssue[]; provider: string; stale?: boolean }> {
  if (cache && Date.now() - cache.at < TTL) {
    return { issues: cache.data, provider: cache.provider };
  }

  const listProviders: Provider<IpoIssue[]>[] = [
    { name: "nse", run: fetchNseIpos },
    {
      name: "chittorgarh-list",
      run: async () => {
        const gmp = await fetchChittorgarhGmp();
        const issues: IpoIssue[] = [...gmp.entries()].map(([name, v]) => ({
          symbol: "",
          company: name.replace(/\b\w/g, (c) => c.toUpperCase()),
          status: "GMP",
          openDate: "",
          closeDate: "",
          issuePrice: "",
          issueSize: "",
          gmp: v.gmp,
          gmpSource: v.source,
        }));
        if (!issues.length) throw new Error("no GMP rows");
        return issues;
      },
    },
  ];

  try {
    const { value, provider } = await firstSuccess(listProviders);
    let issues = value;
    try {
      const gmpProviders: Provider<GmpMap>[] = [
        { name: "chittorgarh", run: fetchChittorgarhGmp },
        { name: "ipowatch", run: fetchIpowatchGmp },
      ];
      const gmp = await firstSuccess(gmpProviders);
      issues = attachGmp(issues, gmp.value);
    } catch {
      // GMP is enrichment — the NSE list still stands without it.
    }
    cache = { data: issues, provider, at: Date.now() };
    return { issues, provider };
  } catch (e) {
    if (cache) return { issues: cache.data, provider: cache.provider, stale: true };
    throw e;
  }
}
