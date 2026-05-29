import type { ReactNode } from "react";

/** Render #hashtags, @mentions, and $cashtags with highlight spans */
export function formatPostText(text: string): ReactNode[] {
  const parts = text.split(/(\#[\w]+|\@[\w]+|\$[\w]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#")) {
      return (
        <span key={i} className="sf-tag hash">
          {part}
        </span>
      );
    }
    if (part.startsWith("@")) {
      return (
        <span key={i} className="sf-tag mention">
          {part}
        </span>
      );
    }
    if (part.startsWith("$")) {
      return (
        <span key={i} className="sf-tag cashtag">
          {part}
        </span>
      );
    }
    return part;
  });
}
