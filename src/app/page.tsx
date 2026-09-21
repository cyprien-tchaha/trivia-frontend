"use client";

import Link from "next/link";
import { BODY, C, DISPLAY, tile } from "@/lib/theme";
import AccountChip from "@/components/AccountChip";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LOAD_ERRORS: Record<string, string> = {
  game_load_failed: "The game couldn't load. It may have ended or the link expired.",
  removed_by_host: "The host removed you from the game.",
};

function LoadErrorBanner() {
  // Derived during render instead of pushed into state from an effect, which
  // cost an extra render on every mount. useSearchParams opts its subtree out
  // of static prerendering, which is why only this banner lives behind the
  // Suspense boundary below — wrapping the whole page would leave the static
  // HTML empty until hydration.
  const loadError = LOAD_ERRORS[useSearchParams().get("error") ?? ""] ?? "";
  if (!loadError) return null;

  return (
    <div style={{
      position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)",
      background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
      borderRadius: "10px", padding: "12px 20px", zIndex: 100,
      color: "#FF3B5C", fontSize: "14px", textAlign: "center",
      fontFamily: BODY,
    }}>
      {loadError}
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Wake up Railway backend when home page loads
    fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}/health`)
      .catch(() => {}); // Silently ignore if it fails
  }, []);

  const categories = [
    { label: "One Piece", topic: "One Piece" },
    { label: "Naruto", topic: "Naruto" },
    { label: "Jujutsu Kaisen", topic: "Jujutsu Kaisen" },
    { label: "Breaking Bad", topic: "Breaking Bad" },
    { label: "Marvel", topic: "Marvel" },
    { label: "Any Topic →", topic: "" },
  ];

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px 40px",
      fontFamily: BODY,
    }}>
      <Suspense fallback={null}>
        <LoadErrorBanner />
      </Suspense>

      <div style={{
        position: "fixed", top: "16px", right: "16px", zIndex: 40,
      }}>
        <AccountChip />
      </div>

      {/* Soft blobs that drift behind the card — depth without competing
          with the content, since every surface above is opaque. */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden>
        <div className="drift" style={{
          position: "absolute", top: "-8%", left: "-12%",
          width: "520px", height: "520px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,194,30,0.30) 0%, transparent 65%)",
        }} />
        <div className="drift" style={{
          position: "absolute", bottom: "-14%", right: "-10%",
          width: "460px", height: "460px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,224,198,0.26) 0%, transparent 65%)",
          animationDelay: "-7s",
        }} />
      </div>

      <div className="pop-in" style={{ position: "relative", width: "100%", maxWidth: "500px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "8px 16px", borderRadius: "999px", marginBottom: "18px",
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.35)",
          color: "#FFFFFF", fontSize: "12px", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          backdropFilter: "blur(4px)",
        }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.accent2 }} />
          AI-Powered Trivia
        </div>

        <h1 style={{
          fontFamily: DISPLAY,
          fontSize: "clamp(4rem, 16vw, 7.5rem)",
          fontWeight: 700,
          lineHeight: 0.95,
          marginBottom: "8px",
          letterSpacing: "-0.03em",
          color: "#FFFFFF",
          textShadow: "0 6px 0 rgba(23,4,56,0.28)",
        }}>
          <span style={{ color: C.accent }}>fan</span>atic
        </h1>

        <p style={{
          color: "rgba(255,255,255,0.88)", fontSize: "13px", fontWeight: 700,
          letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "26px",
        }}>
          Trivia for obsessives
        </p>

        {/* Stats, as solid chips so they hold their own over the gradient */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "26px" }}>
          {[
            { value: "AI", label: "Generated" },
            { value: "5", label: "Levels" },
            { value: "Live", label: "Multiplayer" },
          ].map((stat, i) => (
            <div key={stat.label} className={`pop-in d${i + 1}`} style={{
              flex: 1, padding: "12px 8px", borderRadius: "16px",
              background: "rgba(23,4,56,0.30)",
              border: "1px solid rgba(255,255,255,0.20)",
            }}>
              <div style={{ fontFamily: DISPLAY, fontSize: "24px", fontWeight: 700, color: C.accent }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.80)", marginTop: "2px", fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%", marginBottom: "26px" }}>
          <Link href="/host" className="btn-3d heartbeat" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "20px 24px", background: C.accent, color: "#3B1A00",
            fontFamily: DISPLAY, fontWeight: 700, fontSize: "20px",
            borderRadius: "20px", textDecoration: "none",
            boxShadow: "0 6px 0 #C48A00, 0 12px 24px rgba(23,4,56,0.40)",
            ["--btn-edge" as string]: "#C48A00",
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Host a Game
          </Link>

          <Link href="/play" className="btn-3d" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "20px 24px", background: "#FFFFFF", color: "#5B21C6",
            fontFamily: DISPLAY, fontWeight: 700, fontSize: "20px",
            borderRadius: "20px", textDecoration: "none",
            boxShadow: "0 6px 0 #CBB8F0, 0 12px 24px rgba(23,4,56,0.30)",
            ["--btn-edge" as string]: "#CBB8F0",
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            Join a Game
          </Link>
        </div>

        <p style={{
          fontSize: "11px", color: "rgba(255,255,255,0.80)", fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px",
        }}>
          Quick start
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "22px" }}>
          {categories.map((cat, i) => {
            // Chips borrow the answer-tile palette, so the colour language is
            // the same one players meet in the game itself.
            const t = tile(i);
            return (
              <button
                key={cat.label}
                onClick={() => router.push(cat.topic ? `/host?topic=${encodeURIComponent(cat.topic)}` : "/host")}
                className="btn-3d"
                style={{
                  padding: "10px 16px", borderRadius: "999px", fontSize: "14px",
                  background: t.color, border: "none", color: t.text,
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: DISPLAY, fontWeight: 600,
                  boxShadow: `0 4px 0 ${t.shadow}`,
                  ["--btn-edge" as string]: t.shadow,
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)", fontWeight: 600 }}>
          Play solo or share your code with friends
        </p>
      </div>
    </main>
  );
}
