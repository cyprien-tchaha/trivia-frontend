"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Player } from "@/types";

const C = {
  bg: "#0a0a0f", surface: "#13131a", surface2: "#1c1c27",
  border: "#2a2a3a", accent: "#00e5b0", accent2: "#f5a623",
  danger: "#ff4d6d", text: "#f0f0f8", muted: "#6b6b8a",
};

const difficultyLabel = ["", "Easy", "Medium", "Hard", "Expert", "Master"];
const difficultyColor = ["", "#00e5b0", "#6ee7b7", "#f5a623", "#f97316", "#ff4d6d"];

export default function PlayPage() {
  const router = useRouter();
  const { setGame, setPlayer, setPlayers, addPlayer } = useGameStore();

  const [step, setStep] = useState<"join" | "lobby">("join");
  const [gameCode, setGameCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [players, setLocalPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gameInfo, setGameInfo] = useState<{
    category: string; difficulty: number;
    host_name: string; topics: string;
  } | null>(null);

  useEffect(() => { return () => gameSocket.disconnect(); }, []);

  async function joinGame() {
    if (!gameCode.trim()) { setError("Please enter a game code"); return; }
    if (!playerName.trim()) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      const gameRes = await api.get(`/games/${gameCode.toUpperCase()}`);
      const game = gameRes.data;
      if (game.status !== "lobby") { setError("This game has already started"); setLoading(false); return; }
      const joinRes = await api.post(`/games/${gameCode.toUpperCase()}/join`, { player_name: playerName });
      const { player_id } = joinRes.data;
      setPlayerId(player_id);
      setPlayer(player_id, playerName);
      localStorage.removeItem(`host_${gameCode.toUpperCase()}`);
      localStorage.setItem(`player_id_${gameCode.toUpperCase()}`, player_id);
      localStorage.setItem(`player_name_${gameCode.toUpperCase()}`, playerName);
      setGame(game);
      setGameInfo({ category: game.category, difficulty: game.difficulty, host_name: game.host_name, topics: game.topics || "" });
      const playersRes = await api.get(`/games/${gameCode.toUpperCase()}/players`);
      setLocalPlayers(playersRes.data);
      setPlayers(playersRes.data);
      gameSocket.connect(gameCode.toUpperCase());
      gameSocket.onMessage((msg: Record<string, unknown>) => {
        if (msg.event === "player_joined") {
          const np = msg.player as Player;
          setLocalPlayers((prev) => prev.find((p) => p.id === np.id) ? prev : [...prev, np]);
        }
        if (msg.event === "game_started") router.push(`/game/${gameCode.toUpperCase()}`);
      });
      setStep("lobby");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404 ? "Game not found. Check the code." : "Failed to join. Try again.");
    } finally { setLoading(false); }
  }

  const inputStyle = {
    width: "100%", padding: "12px 16px",
    background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: "10px", color: C.text, fontSize: "15px",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  };

  if (step === "join") {
    return (
      <main style={{
        minHeight: "100vh", background: C.bg, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "24px", fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <a href="/" style={{ color: C.muted, fontSize: "14px", textDecoration: "none", display: "block", marginBottom: "32px" }}>← Back</a>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, marginBottom: "4px" }}>
            <span style={{ color: C.accent }}>fan</span><span style={{ color: C.text }}>atic</span>
          </h1>
          <p style={{ color: C.muted, fontSize: "14px", marginBottom: "32px" }}>Enter the code from your host</p>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
              background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
              color: C.danger, fontSize: "14px",
            }}>{error}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>Game Code</label>
              <input
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="XXXXXX"
                maxLength={6}
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800,
                  fontSize: "28px",
                  letterSpacing: "0.25em",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>Your Name</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="Enter your name"
                style={inputStyle}
              />
            </div>
            <button onClick={joinGame} disabled={loading} style={{
              width: "100%", padding: "16px", borderRadius: "12px", fontSize: "15px", fontWeight: 700,
              fontFamily: "'Syne', sans-serif", border: "none",
              background: loading ? "rgba(0,229,176,0.4)" : C.accent,
              color: "#0a0a0f", cursor: loading ? "not-allowed" : "pointer",
            }}>
              {loading ? "Joining..." : "Join Game →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "28px",
            background: "rgba(0,229,176,0.1)", color: C.accent,
            border: "2px solid rgba(0,229,176,0.3)",
          }}>{playerName[0]?.toUpperCase()}</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "22px" }}>{playerName}</h2>
          <p style={{ color: C.accent, fontSize: "13px", marginTop: "4px" }}>You're in!</p>
        </div>

        {/* Game info */}
        {gameInfo && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: "12px", padding: "14px 16px", marginBottom: "12px",
            fontSize: "13px",
          }}>
            <p style={{ color: C.muted, textAlign: "center", marginBottom: "8px" }}>
              Hosted by <span style={{ color: C.text }}>{gameInfo.host_name}</span>
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
              {gameInfo.topics ? (
                <span style={{ color: C.muted }}>Topics: <span style={{ color: C.text }}>{gameInfo.topics}</span></span>
              ) : (
                <span style={{ color: C.muted }}>Category: <span style={{ color: C.text, textTransform: "capitalize" }}>{gameInfo.category}</span></span>
              )}
              <span style={{ color: C.muted }}>
                Difficulty: <span style={{ color: difficultyColor[gameInfo.difficulty] }}>{difficultyLabel[gameInfo.difficulty]}</span>
              </span>
            </div>
          </div>
        )}

        {/* Players */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "16px", padding: "16px", marginBottom: "24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px" }}>Lobby</span>
            <span style={{
              fontSize: "11px", padding: "2px 10px", borderRadius: "999px",
              background: C.surface2, border: `1px solid ${C.border}`, color: C.muted,
            }}>{players.length} joined</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {players.map((p: Player, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "10px",
                background: p.id === playerId ? "rgba(0,229,176,0.06)" : C.surface2,
                border: `1px solid ${p.id === playerId ? "rgba(0,229,176,0.25)" : C.border}`,
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "12px",
                  background: p.id === playerId ? "rgba(0,229,176,0.15)" : C.surface,
                  color: p.id === playerId ? C.accent : C.muted,
                  border: `1px solid ${p.id === playerId ? "rgba(0,229,176,0.3)" : C.border}`,
                }}>{p.name[0].toUpperCase()}</div>
                <span style={{ fontSize: "14px", flex: 1 }}>{p.name}</span>
                {p.id === playerId && <span style={{ fontSize: "12px", color: C.accent, fontWeight: 600 }}>You</span>}
                <span style={{ fontSize: "12px", color: C.muted }}>#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waiting */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: C.muted, fontSize: "13px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.accent, display: "inline-block", animation: "pulse 2s infinite" }} />
          Waiting for host to start...
        </div>
      </div>
    </main>
  );
}