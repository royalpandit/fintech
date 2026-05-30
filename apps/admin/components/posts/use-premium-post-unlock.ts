"use client";

import { useCallback, useEffect, useState } from "react";
import { unlockCommunityPost, unlockMarketPost } from "@/lib/social-feed-client";
import type { SocialPost } from "@/lib/social-feed-types";

type Kind = "community" | "market";

export function usePremiumPostUnlock(opts: {
  postId: number;
  kind: Kind;
  initialLocked: boolean;
  initialUnlocked: boolean;
  isAuthed: boolean;
  onUnlocked?: (payload: SocialPost | Record<string, unknown>) => void;
}) {
  const [locked, setLocked] = useState(Boolean(opts.initialLocked));
  const [unlocked, setUnlocked] = useState(Boolean(opts.initialUnlocked));
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocked(Boolean(opts.initialLocked));
    setUnlocked(Boolean(opts.initialUnlocked));
  }, [opts.initialLocked, opts.initialUnlocked]);

  const openUnlock = useCallback(() => {
    if (!opts.isAuthed) {
      window.location.href = "/login";
      return;
    }
    setModalOpen(true);
  }, [opts.isAuthed]);

  const confirmUnlock = useCallback(async () => {
    if (!opts.isAuthed) return;
    setLoading(true);
    try {
      if (opts.kind === "community") {
        const full = await unlockCommunityPost(opts.postId);
        opts.onUnlocked?.(full);
        setLocked(full.is_locked);
        setUnlocked(full.is_unlocked);
      } else {
        const full = await unlockMarketPost(opts.postId);
        opts.onUnlocked?.(full);
        setLocked(false);
        setUnlocked(true);
      }
      setModalOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  }, [opts]);

  return {
    locked,
    unlocked,
    modalOpen,
    setModalOpen,
    openUnlock,
    confirmUnlock,
    loading,
  };
}
