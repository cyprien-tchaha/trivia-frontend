"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

const C = {
  bg: "#0a0a0f", surface: "#13131a", surface2: "#1c1c27",
  border: "#2a2a3a", accent: "#00e5b0", accent2: "#f5a623",
  danger: "#ff4d6d", text: "#f0f0f8", muted: "#6b6b8a",
  success: "#00e5b0",
};

interface GameStatus {
  game: {
    code: string;
    status: string;
    current_question: number;
    question_count: number;
  };
  players: { id: string; name: string; score: number }[];
  websocket_connections: number;
  players_in_grace_window: number;
}

interface HealthStatus {
  status: string;
  environment: string;
}

export default function AdminPage() {
  const [gameCode, setGameCode] = useState("");
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Health check on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await api.get("/health".replace("/api", ""));
        setHealth(res.data);
      } catch {
        setHealth({ status: "unreachable", environment: "unknown" });
      }
    }
    // Hit health directly without /api prefix
    fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => setHealth({ status: "unreachable", environment: "unknown" }));
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !gameCode) return;
    const interval = setInterval(() => {
      fetchGameStatus(gameCode);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, gameCode]);

  async function fetchGameStatus(code: string) {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/games/${code.toUpperCase()}/admin`);
      setGameStatus(res.data);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) setError("Game not found. Check the code.");
      else setError("Failed to fetch game status.");
      setGameStatus(null);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (status: string) => {
    if (status === "active") return C.accent;
    if (status === "lobby") return C.accent2;
    if (status === "finished") return C.muted;
    return C.danger;
  };

  const healthColor = health?.status === "ok" ? C.accent : C.danger;

  return (
    <main style={{
      minHeight: "100vh", background: C.bg, padding: "24px",
      fontFamily: "'DM Sans', sans-serif", color: C.text,
    }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: "4px" }}>
            <span style={{ color: C.accent }}>fan</span>atic admin
          </h1>
          <p style={{ color: C.muted, fontSize: "13px" }}>Beta monitoring dashboard</p>
        </div>

        {/* Railway health */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "12px", padding: "16px", marginBottom: "16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "4px" }}>Railway Backend</p>
            <p style={{ fontSize: "15px", fontWeight: 600, color: healthColor }}>
              {health ? health.status.toUpperCase() : "Checking..."}
            </p>
          </div>
          <div style={{
            width: "12px", height: "12px", borderRadius: "50%",
            background: health?.status === "ok" ? C.accent : C.danger,
            boxShadow: health?.status === "ok" ? `0 0 8px ${C.accent}` : "none",
          }} />
        </div>

        {/* Game lookup */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "12px", padding: "16px", marginBottom: "16px",
        }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "12px" }}>Monitor a Game</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchGameStatus(gameCode)}
              placeholder="Enter game code"
              maxLength={6}
              style={{
                flex: 1, padding: "10px 14px",
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: "8px", color: C.text, fontSize: "15px",
                fontFamily: "'DM Sans', sans-serif", outline: "none",
                letterSpacing: "0.1em",
              }}
            />
            <button
              onClick={() => fetchGameStatus(gameCode)}
              disabled={loading}
              style={{
                padding: "10px 20px", borderRadius: "8px", fontSize: "14px",
                fontWeight: 600, fontFamily: "'Syne', sans-serif",
                background: C.accent, color: "#0a0a0f", border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "..." : "Check"}
            </button>
          </div>
          {error && (
            <p style={{ color: C.danger, fontSize: "13px", marginTop: "8px" }}>{error}</p>
          )}
        </div>

        {/* Game status */}
        {gameStatus && (
          <>
            {/* Auto refresh toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "12px",
            }}>
              <p style={{ fontSize: "12px", color: C.muted }}>
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
              </p>
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                style={{
                  padding: "4px 12px", borderRadius: "999px", fontSize: "12px",
                  background: autoRefresh ? "rgba(0,229,176,0.1)" : C.surface2,
                  border: `1px solid ${autoRefresh ? C.accent : C.border}`,
                  color: autoRefresh ? C.accent : C.muted,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {autoRefresh ? "⏸ Auto-refresh ON" : "▶ Auto-refresh OFF"}
              </button>
            </div>

            {/* Game info */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: "12px", padding: "16px", marginBottom: "12px",
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "12px" }}>Game Info</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { label: "Code", value: gameStatus.game.code },
                  { label: "Status", value: gameStatus.game.status.toUpperCase(), color: statusColor(gameStatus.game.status) },
                  { label: "Question", value: `${gameStatus.game.current_question + 1} / ${gameStatus.game.question_count}` },
                  { label: "WS Connections", value: gameStatus.websocket_connections.toString() },
                  { label: "Players", value: gameStatus.players.length.toString() },
                  { label: "In Grace Window", value: gameStatus.players_in_grace_window.toString(), color: gameStatus.players_in_grace_window > 0 ? C.accent2 : C.muted },
                ].map((item) => (
                  <div key={item.label} style={{
                    background: C.surface2, borderRadius: "8px", padding: "10px 12px",
                  }}>
                    <p style={{ fontSize: "11px", color: C.muted, marginBottom: "4px" }}>{item.label}</p>
                    <p style={{ fontSize: "16px", fontWeight: 700, fontFamily: "'Syne', sans-serif", color: item.color || C.text }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Players */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: "12px", padding: "16px",
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "12px" }}>
                Players ({gameStatus.players.length})
              </p>
              {gameStatus.players.length === 0 ? (
                <p style={{ color: C.muted, fontSize: "14px" }}>No players yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...gameStatus.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "10px 12px", borderRadius: "8px", background: C.surface2,
                      }}>
                        <span style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: 700,
                          fontSize: "13px", color: i === 0 ? C.accent2 : C.muted,
                          width: "20px",
                        }}>#{i + 1}</span>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: "rgba(0,229,176,0.1)", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: 700, color: C.accent,
                        }}>{p.name[0].toUpperCase()}</div>
                        <span style={{ flex: 1, fontSize: "14px" }}>{p.name}</span>
                        <span style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: 700,
                          fontSize: "14px", color: C.accent,
                        }}>{p.score} pts</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}