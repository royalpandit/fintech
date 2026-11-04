"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import Link from "next/link";
import AgentMarkdown from "@/components/agents/agent-markdown";

/**
 * The user explicitly asks for an agent's read so opening the holding page
 * does not start a paid model request.
 */
export default function HoldingInsightPanel({
  symbol,
  agentKey,
  label,
  blurb,
  icon,
}: {
  symbol: string;
  agentKey: string;
  label: string;
  blurb: string;
  icon: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const run = useCallback(
    async () => {
      setLoading(true);
      setError("");
      setQuotaExceeded(false);
      try {
        const res = await fetch(
          `/api/v1/portfolio/holding-insight?symbol=${encodeURIComponent(symbol)}&agent=${agentKey}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (json.ok) setText(json.text);
        else {
          setError(json.error || "That agent could not answer right now.");
          setQuotaExceeded(json.code === "AI_QUERY_LIMIT");
          setIsPro(Boolean(json.isPro));
        }
      } catch (e) {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [symbol, agentKey],
  );

  useEffect(() => {
    setText("");
    setError("");
    setQuotaExceeded(false);
    setIsPro(false);
  }, [symbol, agentKey]);

  return (
    <article className="hi-panel">
      <header className="hi-panel-head">
        <span className="hi-panel-icon" aria-hidden>
          {icon}
        </span>
        <div className="hi-panel-id">
          <h3 className="hi-panel-title">{label}</h3>
          <p className="hi-panel-blurb">{blurb}</p>
        </div>
        <button
          type="button"
          className="hi-panel-refresh"
          onClick={() => void run()}
          disabled={loading}
          title={text ? "Ask again" : `Ask ${label}`}
          aria-label={text ? `Ask ${label} again` : `Ask ${label}`}
        >
          {loading ? <FiRefreshCw size={13} className="hi-spin" /> : text ? <FiRefreshCw size={13} /> : "Ask"}
        </button>
      </header>

      <div className="hi-panel-body">
        {loading ? (
          <div className="hi-skeleton" aria-label={`${label} is thinking`}>
            <span style={{ width: "92%" }} />
            <span style={{ width: "78%" }} />
            <span style={{ width: "85%" }} />
            <span style={{ width: "45%" }} />
          </div>
        ) : error ? (
          <div className="hi-error">
            <p>{error}</p>
            {quotaExceeded && !isPro ? (
              <Link href="/user/subscriptions#finuer-pro">Upgrade to Finuer Pro</Link>
            ) : !quotaExceeded ? (
              <button type="button" onClick={() => void run()}>Try again</button>
            ) : null}
          </div>
        ) : !text ? (
          <div className="hi-error">
            <p>Ask this agent to analyze your holding. No AI query runs until you click Ask.</p>
          </div>
        ) : (
          <AgentMarkdown text={text} />
        )}
      </div>
    </article>
  );
}
