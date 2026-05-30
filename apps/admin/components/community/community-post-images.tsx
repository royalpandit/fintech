"use client";

import { useState } from "react";

type PostImage = { id: number; url: string };

export default function CommunityPostImages({ images }: { images: PostImage[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!images.length) return null;

  return (
    <>
      <div className={`comm-post-media ${images.length === 1 ? "comm-post-media-single" : "comm-post-media-grid"}`}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className="comm-post-media-btn"
            onClick={() => setLightbox(i)}
            aria-label="View full image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="comm-post-media-img" />
          </button>
        ))}
      </div>

      {lightbox != null && (
        <div
          className="comm-post-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[lightbox].url} alt="" className="comm-post-lightbox-img" />
        </div>
      )}
    </>
  );
}
