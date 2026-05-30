import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  centered?: boolean;
};

/** Wraps page content so background/text follow the active theme */
export default function ThemePage({ children, className = "", centered = false }: Props) {
  return (
    <div className={`theme-page${centered ? " theme-page-centered" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
