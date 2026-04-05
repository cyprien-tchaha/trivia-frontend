import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fanatic — AI-Powered Trivia for Obsessives",
  description: "Real-time multiplayer trivia powered by AI. Anime, TV shows, and any show you love.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}