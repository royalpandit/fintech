import "./globals.css";
import "./theme.css";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import ThemeInitScript from "@/components/theme/theme-init-script";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "India's all-in-one FinMedia platform for social investing, SEBI registered advisors, virtual trading, and market insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body className="theme-root" style={{ margin: 0 }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

