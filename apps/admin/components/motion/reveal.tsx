"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealVariant = "up" | "left" | "right" | "scale" | "fade" | "pop";

type RevealTag =
  | "div"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "aside"
  | "li"
  | "ul";

type Props = {
  children: ReactNode;
  as?: RevealTag;
  className?: string;
  variant?: RevealVariant;
  /** Stagger offset in ms, applied via the --reveal-delay custom property. */
  delay?: number;
  /** Re-animate every time the element re-enters the viewport. */
  repeat?: boolean;
  id?: string;
  style?: CSSProperties;
};

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "",
  left: "reveal--left",
  right: "reveal--right",
  scale: "reveal--scale",
  fade: "reveal--fade",
  pop: "reveal--pop",
};

/**
 * Fades content in as it scrolls into view.
 *
 * The hidden state lives in CSS behind `html.has-js` (see theme.css), so if
 * scripting is unavailable the content renders visible rather than blank.
 */
export default function Reveal({
  children,
  as = "div",
  className = "",
  variant = "up",
  delay = 0,
  repeat = false,
  id,
  style,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Older browsers (and jsdom) simply show everything.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (!repeat) observer.unobserve(entry.target);
          } else if (repeat) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [repeat]);

  const classes = ["reveal", VARIANT_CLASS[variant], visible ? "is-visible" : "", className]
    .filter(Boolean)
    .join(" ");

  return createElement(
    as,
    {
      ref,
      id,
      className: classes,
      style: delay ? ({ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties) : style,
    },
    children,
  );
}
