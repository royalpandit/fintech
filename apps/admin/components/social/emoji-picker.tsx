"use client";

import { useState } from "react";

const CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "frequent",
    label: "Frequently used",
    emojis: ["👍", "😀", "😂", "🚀", "📈", "📉", "🔥", "💰", "🎯", "💡", "⚡", "✅"],
  },
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌",
      "😍", "🥰", "😘", "😎", "🤔", "😐", "😑", "😶", "🙄", "😏", "😴", "🤯",
    ],
  },
  {
    id: "markets",
    label: "Markets",
    emojis: ["📈", "📉", "💹", "🏦", "💵", "💴", "💶", "💷", "🪙", "📊", "🧾", "💎"],
  },
];

export default function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState("frequent");
  const [q, setQ] = useState("");
  const active = CATEGORIES.find(c => c.id === cat) ?? CATEGORIES[0];
  const filtered = q.trim()
    ? CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(q))
    : active.emojis;

  return (
    <div className="sf-emoji-picker" role="dialog" aria-label="Emoji picker">
      <input
        type="search"
        className="sf-emoji-search"
        placeholder="Search"
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {!q && <div className="sf-emoji-cat-label">{active.label}</div>}
      <div className="sf-emoji-grid">
        {filtered.map(e => (
          <button
            key={e}
            type="button"
            className="sf-emoji-btn"
            onClick={() => {
              onSelect(e);
              onClose();
            }}
          >
            {e}
          </button>
        ))}
      </div>
      {!q && (
        <div className="sf-emoji-tabs">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={cat === c.id ? "active" : ""}
              onClick={() => setCat(c.id)}
              title={c.label}
            >
              {c.emojis[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
