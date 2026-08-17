import "./globals.css";
import "./theme.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import ThemeInitScript from "@/components/theme/theme-init-script";
import { ThemeProvider } from "@/components/theme/theme-provider";
import AmbientBackground from "@/components/motion/ambient-background";
import ChatWidget from "@/components/chat-widget";

export const metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "India's all-in-one FinMedia platform for social investing, SEBI registered advisors, virtual trading, and market insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="theme-root" style={{ margin: 0 }}>
        {/* One mount covers every route — auth pages and the whole app.
            The landing page renders its own richer background and hides this
            one via CSS (see .landing-root rule in theme.css). */}
        <AmbientBackground />
        <ThemeProvider>
          {children}
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}

