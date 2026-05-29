import "./globals.css";

export const metadata = {
  title: "Corescent — Learn. Invest. Connect. Grow.",
  description:
    "India's all-in-one FinMedia platform for social investing, SEBI registered advisors, virtual trading, and market insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

