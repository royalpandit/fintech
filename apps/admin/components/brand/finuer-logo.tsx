import Link from "next/link";
import { BRAND_LOGO_DARK_SRC, BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";

type FinuerLogoProps = {
  href?: string;
  height?: number;
  className?: string;
  onClick?: () => void;
};

export default function FinuerLogo({
  href,
  height = 36,
  className = "",
  onClick,
}: FinuerLogoProps) {
  const imgStyle = { height, width: "auto" } as const;

  const img = (
    <span className="finuer-logo-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_SRC}
        alt={BRAND_NAME}
        className={`finuer-logo finuer-logo-light ${className}`.trim()}
        style={imgStyle}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_DARK_SRC}
        alt={BRAND_NAME}
        className={`finuer-logo finuer-logo-dark ${className}`.trim()}
        style={imgStyle}
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="finuer-logo-link" onClick={onClick} aria-label={BRAND_NAME}>
        {img}
      </Link>
    );
  }

  return img;
}
