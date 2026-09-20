"use client";

import Link from "next/link";
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
      color: "#ff4d6d", fontSize: "14px", textAlign: "center",
      fontFamily: "'DM Sans', sans-serif",
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
      background: "#0a0a0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <Suspense fallback={null}>
        <LoadErrorBanner />
      </Suspense>

      {/* Glow effects */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "20%", left: "-10%",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,229,176,0.07) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", right: "-10%",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,166,35,0.05) 0%, transparent 70%)",
        }} />
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: "480px", textAlign: "center" }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "6px 14px", borderRadius: "999px", marginBottom: "20px",
          background: "rgba(0,229,176,0.08)",
          border: "1px solid rgba(0,229,176,0.2)",
          color: "#00e5b0", fontSize: "11px", fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#00e5b0", animation: "pulse 2s infinite",
          }} />
          AI-Powered Trivia
        </div>

        {/* Logo */}
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "clamp(4rem, 15vw, 7rem)",
          fontWeight: 800,
          lineHeight: 1,
          marginBottom: "10px",
          letterSpacing: "-0.02em",
        }}>
          <span style={{ color: "#00e5b0" }}>fan</span>
          <span style={{ color: "#f0f0f8" }}>atic</span>
        </h1>

        <p style={{
          color: "#6b6b8a", fontSize: "12px",
          letterSpacing: "0.2em", textTransform: "uppercase",
          marginBottom: "28px",
        }}>
          Trivia for obsessives
        </p>

        {/* Stats */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "40px",
          marginBottom: "28px",
        }}>
          {[
            { value: "AI", label: "Generated" },
            { value: "5", label: "Difficulty levels" },
            { value: "Live", label: "Multiplayer" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "24px", fontWeight: 700,
                color: "#00e5b0",
              }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "#6b6b8a", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", marginBottom: "24px" }}>
          <Link href="/host" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "16px 24px",
            background: "#00e5b0", color: "#0a0a0f",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px",
            borderRadius: "12px", textDecoration: "none",
            transition: "filter 0.15s ease",
          }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.filter = "brightness(1)"}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Host a Game
          </Link>
          <Link href="/play" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "16px 24px",
            background: "#13131a", color: "#f0f0f8",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px",
            borderRadius: "12px", textDecoration: "none",
            border: "1.5px solid #2a2a3a",
            transition: "border-color 0.15s ease, color 0.15s ease",
          }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#00e5b0";
              (e.currentTarget as HTMLElement).style.color = "#00e5b0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
              (e.currentTarget as HTMLElement).style.color = "#f0f0f8";
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            Join a Game
          </Link>
        </div>

        {/* Quick-start chips */}
        <p style={{ fontSize: "11px", color: "#6b6b8a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
          Quick start
        </p>
        <div style={{
          display: "flex", justifyContent: "center", gap: "8px",
          flexWrap: "wrap", marginBottom: "20px",
        }}>
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => router.push(cat.topic ? `/host?topic=${encodeURIComponent(cat.topic)}` : "/host")}
              style={{
                padding: "7px 14px", borderRadius: "999px", fontSize: "13px",
                background: "#1c1c27", border: "1px solid #2a2a3a", color: "#a0a0b8",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: "12px", color: "#4a4a6a" }}>
          Play solo or share your code with friends
        </p>

      </div>
    </main>
  );
}
