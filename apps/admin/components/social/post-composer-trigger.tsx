"use client";

function getInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "??";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export default function PostComposerTrigger({
  userName,
  onClick,
}: {
  userName: string;
  onClick: () => void;
}) {
  const displayName = firstName(userName);

  return (
    <button
      type="button"
      className="sf-composer-trigger"
      onClick={onClick}
      aria-label={`Create a post, What's on your mind, ${displayName}?`}
    >
      <div className="sf-composer-trigger-avatar sf-avatar" aria-hidden>
        {getInitials(userName)}
      </div>

      <span className="sf-composer-trigger-input">
        What&apos;s on your mind, {displayName}?
      </span>

      <span className="sf-composer-trigger-icons" aria-hidden>
        <span className="sf-composer-trigger-icon video" title="Video">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </span>
        <span className="sf-composer-trigger-icon image" title="Photo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
          </svg>
        </span>
        <span className="sf-composer-trigger-icon emoji" title="Feeling">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
