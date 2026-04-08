"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "game_load_failed") {
        setLoadError(true);
      }
    }
  }, []);

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
      {loadError && (
        <div style={{
          position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
          borderRadius: "10px", padding: "12px 20px", zIndex: 100,
          color: "#ff4d6d", fontSize: "14px", textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          The game couldn't load. It may have ended or the link expired.
        </div>
      )}

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
          padding: "6px 14px", borderRadius: "999px", marginBottom: "32px",
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
          marginBottom: "12px",
          letterSpacing: "-0.02em",
        }}>
          <span style={{ color: "#00e5b0" }}>fan</span>
          <span style={{ color: "#f0f0f8" }}>atic</span>
        </h1>

        <p style={{
          color: "#6b6b8a", fontSize: "12px",
          letterSpacing: "0.2em", textTransform: "uppercase",
          marginBottom: "40px",
        }}>
          Trivia for obsessives
        </p>

        {/* Stats */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "40px",
          marginBottom: "40px",
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
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          <a href="/host" style={{
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
          </a>
          <a href="/play" style={{
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
          </a>
        </div>

        {/* Tags */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "8px",
          flexWrap: "wrap", marginTop: "32px",
        }}>
          {["Anime", "TV Shows", "Any Show You Want"].map((tag) => (
            <span key={tag} style={{
              padding: "4px 12px", borderRadius: "999px", fontSize: "12px",
              background: "#1c1c27", border: "1px solid #2a2a3a", color: "#6b6b8a",
            }}>{tag}</span>
          ))}
        </div>
      </div>
    </main>
  );
}