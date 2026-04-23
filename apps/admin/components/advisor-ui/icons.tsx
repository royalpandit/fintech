import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function base(props: Props) {
  const { size = 18, ...rest } = props;
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", ...rest };
}

export function Wallet(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H5a2 2 0 1 0 0 4h16v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function Users(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6M15 20c.3-2 1.7-4 4-4s3.7 1.5 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrendUp(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M3 17 9 11l4 4 8-9M21 11V7h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Target(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function FileText(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Shield(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m8.5 12 2.5 2.5L15.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertTriangle(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M10.3 3.9 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 9v4M12 17v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Bell(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M6 8a6 6 0 1 1 12 0c0 3 1 5 2 6H4c1-1 2-3 2-6ZM10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MessageSquare(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M21 12c0 4-4 7-9 7-1.3 0-2.5-.2-3.6-.6L3 20l1.6-5.2A6.8 6.8 0 0 1 3 12c0-4 4-7 9-7s9 3 9 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sparkle(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArrowUpRight(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownRight(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M7 7l10 10M17 9v8H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Clock(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Zap(props: Props) {
  return (
    <svg {...base(props)}>
      <path
        d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircle(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
