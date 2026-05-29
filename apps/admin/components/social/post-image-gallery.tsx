"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  FiX,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

type PostImage = { id: number; url: string };

function computeFitZoom(
  img: HTMLImageElement,
  stage: HTMLElement,
): number {
  const pad = 24;
  const sw = Math.max(stage.clientWidth - pad, 1);
  const sh = Math.max(stage.clientHeight - pad, 1);
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  return Math.min(sw / nw, sh / nh, 1);
}

function ImageLightbox({
  images,
  index,
  open,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const [fitZoom, setFitZoom] = useState(1);
  const [zoomMul, setZoomMul] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number } | null>(
    null,
  );
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const src = images[index] ?? "";
  const zoom = fitZoom * zoomMul;

  const applyFit = useCallback(() => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img?.naturalWidth || !stage) return;
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
    const fit = computeFitZoom(img, stage);
    setFitZoom(fit);
    setZoomMul(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return;
    setFitZoom(1);
    setZoomMul(1);
    setPan({ x: 0, y: 0 });
    setDims({ w: 0, h: 0 });
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight" && images.length > 1)
        onIndexChange(Math.min(images.length - 1, index + 1));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, index, images.length, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => applyFit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, applyFit]);

  const zoomIn = () => setZoomMul(z => Math.min(5 / fitZoom, z + 0.25));
  const zoomOut = () => setZoomMul(z => Math.max(0.25 / fitZoom, z - 0.25));
  const resetView = () => {
    applyFit();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoomMul <= 1) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active || zoomMul <= 1) return;
    setPan({
      x: d.px + (e.clientX - d.sx),
      y: d.py + (e.clientY - d.sy),
    });
  };

  const onPointerUp = () => {
    if (dragRef.current) dragRef.current.active = false;
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom: zoomMul };
    } else if (e.touches.length === 1 && zoomMul > 1) {
      dragRef.current = {
        active: true,
        sx: e.touches[0].clientX,
        sy: e.touches[0].clientY,
        px: pan.x,
        py: pan.y,
      };
    }
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.dist;
      setZoomMul(Math.min(5 / fitZoom, Math.max(0.25 / fitZoom, pinchRef.current.zoom * ratio)));
    } else if (e.touches.length === 1 && dragRef.current?.active && zoomMul > 1) {
      setPan({
        x: dragRef.current.px + (e.touches[0].clientX - dragRef.current.sx),
        y: dragRef.current.py + (e.touches[0].clientY - dragRef.current.sy),
      });
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
    if (dragRef.current) dragRef.current.active = false;
  };

  if (!open || !src) return null;

  const zoomPct = Math.round(zoomMul * 100);

  return (
    <div
      className="sf-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full image viewer"
    >
      <div className="sf-lightbox-toolbar" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={zoomOut} aria-label="Zoom out">
          <FiZoomOut size={20} />
        </button>
        <span className="sf-lightbox-zoom-label">{zoomPct}%</span>
        <button type="button" onClick={zoomIn} aria-label="Zoom in">
          <FiZoomIn size={20} />
        </button>
        <button type="button" onClick={resetView} aria-label="Fit to screen">
          <FiMaximize2 size={18} />
        </button>
        {images.length > 1 && (
          <span className="sf-lightbox-counter">
            {index + 1} / {images.length}
          </span>
        )}
        <button type="button" className="sf-lightbox-close" onClick={onClose} aria-label="Close">
          <FiX size={22} />
        </button>
      </div>

      {images.length > 1 && index > 0 && (
        <button
          type="button"
          className="sf-lightbox-nav prev"
          onClick={e => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Previous image"
        >
          <FiChevronLeft size={28} />
        </button>
      )}
      {images.length > 1 && index < images.length - 1 && (
        <button
          type="button"
          className="sf-lightbox-nav next"
          onClick={e => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Next image"
        >
          <FiChevronRight size={28} />
        </button>
      )}

      <div
        ref={stageRef}
        className="sf-lightbox-stage"
        onClick={e => e.stopPropagation()}
        onWheel={e => {
          e.preventDefault();
          setZoomMul(z => Math.min(5 / fitZoom, Math.max(0.25 / fitZoom, z + (e.deltaY < 0 ? 0.12 : -0.12))));
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: zoomMul > 1 ? "none" : "pinch-zoom" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          key={src}
          src={src}
          alt=""
          className="sf-lightbox-img"
          onLoad={applyFit}
          style={{
            width: dims.w || undefined,
            height: dims.h || undefined,
            opacity: dims.w ? 1 : 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: zoomMul > 1 ? "grab" : "default",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

function FeedImagePreview({ url, onOpen }: { url: string; onOpen: () => void }) {
  return (
    <div className="sf-post-image-wrap">
      <button type="button" className="sf-post-image-btn" onClick={onOpen} aria-label="View full image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="sf-post-image" />
      </button>
    </div>
  );
}

export function PostImageGallery({ images }: { images: PostImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const urls = images.slice(0, 4).map(i => i.url);
  const count = urls.length;

  if (!urls.length) return null;

  return (
    <>
      <div className={`sf-post-images count-${count}`}>
        {images.slice(0, 4).map((img, i) => (
          <FeedImagePreview key={img.id} url={img.url} onOpen={() => setLightboxIndex(i)} />
        ))}
      </div>

      <ImageLightbox
        images={urls}
        index={lightboxIndex ?? 0}
        open={lightboxIndex != null}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}

export function PostMediaImage({ url, className = "" }: { url: string; className?: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className={`sf-post-media ${className}`.trim()}>
        <FeedImagePreview url={url} onOpen={() => setLightboxOpen(true)} />
      </div>
      <ImageLightbox
        images={[url]}
        index={0}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={() => {}}
      />
    </>
  );
}
