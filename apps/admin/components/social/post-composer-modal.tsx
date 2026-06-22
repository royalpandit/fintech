"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiImage,
  FiSmile,
  FiVideo,
  FiBarChart2,
  FiTrendingUp,
  FiFileText,
  FiX,
  FiDollarSign,
} from "react-icons/fi";
import EmojiPicker from "./emoji-picker";
import SymbolSearchPicker from "./symbol-search-picker";
import AttachedSymbolCard, { type AttachedSymbol } from "./attached-symbol-card";
import {
  createSocialPost,
  uploadSocialMedia,
} from "@/lib/social-feed-client";
import type { FeedSentiment, FeedPostAccessType } from "@/lib/social-feed-types";
import { useTheme } from "@/components/theme/theme-provider";

type Mode = "post" | "article";

type PreviewImage = { id: string; file: File; url: string };
type PreviewVideo = { id: string; file: File; url: string };

function getInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "??";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function PostComposerModal({
  open,
  onClose,
  onPosted,
  userName,
  isAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: (post: import("@/lib/social-feed-types").SocialPost) => void;
  userName: string;
  isAuthed: boolean;
}) {
  const [mode, setMode] = useState<Mode>("post");
  const { theme: appTheme } = useTheme();
  // Default the composer to the app's current theme; the local toggle below
  // can still override it for this session. Re-sync whenever the app theme flips.
  const [theme, setTheme] = useState<"dark" | "light">(appTheme);
  useEffect(() => {
    setTheme(appTheme);
  }, [appTheme]);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [thumbnail, setThumbnail] = useState<PreviewImage | null>(null);
  const [sentiment, setSentiment] = useState<FeedSentiment>("neutral");
  const [symbols, setSymbols] = useState<AttachedSymbol[]>([]);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [videos, setVideos] = useState<PreviewVideo[]>([]);
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [postAccessType, setPostAccessType] = useState<FeedPostAccessType>("free");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setText("");
    setTitle("");
    setArticleBody("");
    setThumbnail(null);
    setSentiment("neutral");
    setSymbols([]);
    images.forEach(i => URL.revokeObjectURL(i.url));
    videos.forEach(v => URL.revokeObjectURL(v.url));
    setImages([]);
    setVideos([]);
    setTargetPrice("");
    setStopLoss("");
    setMode("post");
    setPostAccessType("free");
    setError("");
  }, [images, videos]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(prev => prev + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = text.slice(0, start) + snippet + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next: PreviewImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }
    setImages(prev => [...prev, ...next].slice(0, 4));
  };

  const addVideos = (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    if (!file.type.startsWith("video/")) return;
    setVideos([{ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }]);
  };

  const addSymbol = (sym: AttachedSymbol) => {
    setSymbols(prev => {
      if (prev.some(s => s.token === sym.token)) return prev;
      return [...prev, sym].slice(0, 3);
    });
    insertAtCursor(`$${sym.symbol} `);
  };

  const publish = async () => {
    if (!isAuthed) {
      setError("Sign in to post");
      return;
    }
    const content = mode === "article" ? articleBody.trim() : text.trim();
    if (!content && mode !== "article") {
      setError("Write something to share");
      return;
    }
    if (mode === "article" && !title.trim()) {
      setError("Article title is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const imageUrls: string[] = [];
      for (const img of images) {
        imageUrls.push(await uploadSocialMedia(img.file, "image"));
      }
      const videoUrls: string[] = [];
      for (const vid of videos) {
        videoUrls.push(await uploadSocialMedia(vid.file, "video"));
      }
      let thumbnailUrl: string | undefined;
      if (thumbnail) {
        thumbnailUrl = await uploadSocialMedia(thumbnail.file, "image");
      }

      const created = await createSocialPost({
        content: mode === "article" ? title : content,
        postAccessType,
        postType: mode === "article" ? "article" : symbols.length ? "chart" : imageUrls.length ? "image" : videoUrls.length ? "video" : "text",
        title: mode === "article" ? title : undefined,
        articleBody: mode === "article" ? articleBody : undefined,
        thumbnailUrl,
        sentiment,
        targetPrice: targetPrice ? Number(targetPrice) : undefined,
        stopLossPrice: stopLoss ? Number(stopLoss) : undefined,
        imageUrls,
        videoUrls,
        symbols: symbols.map(s => ({
          symbol: s.symbol,
          tradingSymbol: s.tradingSymbol,
          exchange: s.exchange,
          token: s.token,
        })),
      });

      handleClose();
      onPosted(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="sf-modal-overlay" onClick={handleClose} role="presentation">
      <div
        className={`sf-composer sf-theme-${theme}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Create post"
      >
        <header className="sf-composer-head">
          <div className="sf-composer-user">
            <div className="sf-avatar">{getInitials(userName)}</div>
            <div>
              <div className="sf-composer-name">{userName || "Guest"}</div>
              <div className="sf-composer-sub">Share your insights</div>
            </div>
          </div>
          <div className="sf-composer-head-actions">
            <button
              type="button"
              className="sf-theme-toggle"
              onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
            <button type="button" className="sf-close-btn" onClick={handleClose} aria-label="Close">
              <FiX size={18} />
            </button>
          </div>
        </header>

        {mode === "article" ? (
          <div className="sf-composer-body">
            <input
              className="sf-article-title"
              placeholder="Article title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className="sf-thumb-row">
              <button type="button" className="sf-thumb-btn" onClick={() => thumbInputRef.current?.click()}>
                {thumbnail ? "Change thumbnail" : "+ Thumbnail"}
              </button>
              {thumbnail && (
                <div className="sf-thumb-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnail.url} alt="" />
                  <button type="button" onClick={() => setThumbnail(null)}>×</button>
                </div>
              )}
            </div>
            <textarea
              className="sf-composer-textarea article"
              placeholder="Write your article…"
              value={articleBody}
              onChange={e => setArticleBody(e.target.value)}
              rows={12}
            />
          </div>
        ) : (
          <div className="sf-composer-body">
            <textarea
              ref={textareaRef}
              className="sf-composer-textarea"
              placeholder="Share your insights… Use #NIFTY @mentions $TCS"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
            />

            {symbols.length > 0 && (
              <div className="sf-attached-symbols">
                {symbols.map(s => (
                  <AttachedSymbolCard
                    key={s.token}
                    item={s}
                    onRemove={() => setSymbols(prev => prev.filter(x => x.token !== s.token))}
                  />
                ))}
              </div>
            )}

            {(targetPrice || stopLoss || symbols.length > 0) && (
              <div className="sf-idea-fields">
                <input
                  type="number"
                  placeholder="Target ₹"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Stop loss ₹"
                  value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)}
                />
              </div>
            )}

            {images.length > 0 && (
              <div className="sf-media-preview-grid">
                {images.map(img => (
                  <div key={img.id} className="sf-media-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(img.url);
                        setImages(prev => prev.filter(i => i.id !== img.id));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {videos.length > 0 && (
              <div className="sf-media-preview">
                <video src={videos[0].url} controls />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(videos[0].url);
                    setVideos([]);
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="sf-composer-foot">
          <div className="sf-toolbar">
            <div className="sf-toolbar-left">
              <div className="sf-tool-wrap">
                <button
                  type="button"
                  className={`sf-tool-btn${showEmoji ? " active" : ""}`}
                  onClick={() => {
                    setShowEmoji(v => !v);
                    setShowSymbolPicker(false);
                  }}
                  title="Emoji"
                >
                  <FiSmile size={18} />
                </button>
                {showEmoji && (
                  <EmojiPicker
                    onSelect={insertAtCursor}
                    onClose={() => setShowEmoji(false)}
                  />
                )}
              </div>
              <button
                type="button"
                className="sf-tool-btn"
                onClick={() => imageInputRef.current?.click()}
                title="Upload image"
              >
                <FiImage size={18} />
              </button>
              <button
                type="button"
                className="sf-tool-btn"
                onClick={() => videoInputRef.current?.click()}
                title="Upload video"
              >
                <FiVideo size={18} />
              </button>
              <button
                type="button"
                className="sf-tool-btn"
                onClick={() => insertAtCursor("$")}
                title="Tag symbol"
              >
                <FiDollarSign size={18} />
              </button>
              <div className="sf-tool-wrap">
                <button
                  type="button"
                  className={`sf-tool-btn${showSymbolPicker ? " active" : ""}`}
                  onClick={() => {
                    setShowSymbolPicker(v => !v);
                    setShowEmoji(false);
                  }}
                  title="Attach chart"
                >
                  <FiBarChart2 size={18} />
                </button>
                {showSymbolPicker && (
                  <SymbolSearchPicker
                    onSelect={addSymbol}
                    onClose={() => setShowSymbolPicker(false)}
                  />
                )}
              </div>
              <button type="button" className="sf-tool-btn" title="Trend">
                <FiTrendingUp size={18} />
              </button>
              <span className="sf-toolbar-sep" />
              <button
                type="button"
                className={`sf-article-btn${mode === "article" ? " active" : ""}`}
                onClick={() => setMode(m => (m === "article" ? "post" : "article"))}
              >
                <FiFileText size={16} /> Article
              </button>
            </div>

            <div className="sf-toolbar-right">
              <div className="sf-sentiment-toggle">
                {(["bullish", "bearish", "neutral"] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`sf-sentiment-btn ${s}${sentiment === s ? " active" : ""}`}
                    onClick={() => setSentiment(s)}
                    title={s}
                  >
                    {s === "bullish" ? "▲" : s === "bearish" ? "▼" : "●"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="sf-post-btn"
                onClick={publish}
                disabled={loading}
              >
                {loading ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
          {error && <p className="sf-composer-error">{error}</p>}
        </footer>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          hidden
          onChange={e => addImages(e.target.files)}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          hidden
          onChange={e => addVideos(e.target.files)}
        />
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          hidden
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) setThumbnail({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) });
          }}
        />
      </div>
    </div>
  );
}
