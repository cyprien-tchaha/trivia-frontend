import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fanatic — AI-Powered Trivia for Obsessives",
  description: "Real-time multiplayer trivia powered by AI. Anime, TV shows, and any show you love.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}