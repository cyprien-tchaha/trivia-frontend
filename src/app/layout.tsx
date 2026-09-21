import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font at build time: no layout shift, no render-blocking
// request to Google, and it drops the <link> that triggered Next's
// no-page-custom-font warning. Exposed as CSS variables so globals.css and
// the inline styles in src/lib/theme.ts can both reach them.
const display = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fanatic — AI-Powered Trivia for Obsessives",
  description: "Real-time multiplayer trivia powered by AI. Anime, TV shows, and any show you love.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
