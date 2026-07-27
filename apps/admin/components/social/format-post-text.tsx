import type { ReactNode } from "react";
import Link from "next/link";

type TagKind = "hash" | "mention" | "cashtag";

function tagKind(part: string): TagKind | null {
  if (part.startsWith("#")) return "hash";
  if (part.startsWith("@")) return "mention";
  if (part.startsWith("$")) return "cashtag";
  return null;
}

/**
 * Render #hashtags, @mentions and $cashtags as highlighted links.
 * Each one searches the platform for the term (people, posts, courses).
 */
export function formatPostText(text: string): ReactNode[] {
  const parts = text.split(/(\#[\w]+|\@[\w]+|\$[\w]+)/g);
  return parts.map((part, i) => {
    const kind = tagKind(part);
    if (!kind) return part;
    const term = part.slice(1);
    return (
      <Link
        key={i}
        href={`/user/search?q=${encodeURIComponent(term)}`}
        className={`sf-tag ${kind}`}
        // The card body isn't a link, but stop propagation anyway so clicking a
        // tag never triggers a parent row/card handler.
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </Link>
    );
  });
}
