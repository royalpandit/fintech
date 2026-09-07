"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import AgentMarkdown from "@/components/agents/agent-markdown";

/**
 * One agent's read on the holding, fetched on mount.
 *
 * Each panel fetches independently so three slow model calls run at once
 * instead of in series, and a stalled or unavailable agent leaves the other two
 * — and the position data above them — perfectly usable.
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
  const [loading, setLoading] = useState(true);

  const run = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/v1/portfolio/holding-insight?symbol=${encodeURIComponent(symbol)}&agent=${agentKey}`,
          { cache: "no-store", signal },
        );
        const json = await res.json();
        if (signal?.aborted) return;
        if (json.ok) setText(json.text);
        else setError(json.error || "That agent could not answer right now.");
      } catch (e) {
        // An abort is the component unmounting, not a failure to report.
        if ((e as Error)?.name !== "AbortError") setError("Network error.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [symbol, agentKey],
  );

  useEffect(() => {
    const ac = new AbortController();
    void run(ac.signal);
    return () => ac.abort();
  }, [run]);

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
          title="Ask again"
          aria-label={`Ask ${label} again`}
        >
          <FiRefreshCw size={13} className={loading ? "hi-spin" : undefined} />
        </button>
      </header>

      <div className="hi-panel-body">
        {loading ? (
          /* Shaped like the paragraphs it is replacing, so the panel does not
             jump when the answer lands. */
          <div className="hi-skeleton" aria-label={`${label} is thinking`}>
            <span style={{ width: "92%" }} />
            <span style={{ width: "78%" }} />
            <span style={{ width: "85%" }} />
            <span style={{ width: "45%" }} />
          </div>
        ) : error ? (
          <div className="hi-error">
            <p>{error}</p>
            <button type="button" onClick={() => void run()}>
              Try again
            </button>
          </div>
        ) : (
          <AgentMarkdown text={text} />
        )}
      </div>
    </article>
  );
}
