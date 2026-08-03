// Rule-based compliance scanner for advisor content.
//
// SEBI advertising norms prohibit assured/guaranteed-return language and require
// risk disclaimers. This runs deterministically (no external API) so the AI
// Compliance console works today; when the Gemini integration is connected it
// can layer an LLM pass on top of these signals.

export type RiskLevel = "high" | "medium" | "low" | "clear";

export type ComplianceResult = {
  level: RiskLevel;
  score: number; // 0–100, higher = riskier
  flags: string[];
};

// Phrases that are effectively prohibited (assured returns / no-risk claims).
const HIGH_RISK: { phrase: RegExp; label: string }[] = [
  { phrase: /guaranteed?\s+(returns?|profits?|money|income)/i, label: "Guaranteed returns claim" },
  { phrase: /assured\s+(returns?|profits?|income)/i, label: "Assured returns claim" },
  { phrase: /risk[-\s]?free/i, label: "\"Risk-free\" claim" },
  { phrase: /100%\s*(safe|sure|guaranteed|profit)/i, label: "Absolute-certainty claim" },
  { phrase: /no\s+(loss|risk)/i, label: "\"No loss/risk\" claim" },
  { phrase: /sure\s?shot/i, label: "\"Sure shot\" claim" },
  { phrase: /double\s+your\s+money/i, label: "\"Double your money\" claim" },
];

// Phrases that warrant review but aren't automatically prohibited.
const MEDIUM_RISK: { phrase: RegExp; label: string }[] = [
  { phrase: /multibagger/i, label: "\"Multibagger\" hype" },
  { phrase: /\binsider\b/i, label: "Possible insider-info reference" },
  { phrase: /\bjackpot\b/i, label: "\"Jackpot\" hype" },
  { phrase: /buy\s+(now|immediately|blindly)/i, label: "Pressure-to-buy language" },
  { phrase: /\bmust\s+buy\b/i, label: "\"Must buy\" language" },
  { phrase: /\b(pump|target\s+hit\s+100%)\b/i, label: "Pump-style language" },
  { phrase: /\bhot\s+tip\b/i, label: "\"Hot tip\" language" },
];

export function scanCompliance(text: string, hasDisclaimer: boolean): ComplianceResult {
  const flags: string[] = [];
  let score = 0;

  const body = text || "";

  for (const rule of HIGH_RISK) {
    if (rule.phrase.test(body)) {
      flags.push(rule.label);
      score += 45;
    }
  }
  for (const rule of MEDIUM_RISK) {
    if (rule.phrase.test(body)) {
      flags.push(rule.label);
      score += 20;
    }
  }
  if (!hasDisclaimer) {
    flags.push("Missing risk disclaimer");
    score += 15;
  }

  score = Math.min(100, score);

  let level: RiskLevel = "clear";
  if (score >= 45) level = "high";
  else if (score >= 20) level = "medium";
  else if (score > 0) level = "low";

  return { level, score, flags };
}
