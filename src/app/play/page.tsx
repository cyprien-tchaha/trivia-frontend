"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Player } from "@/types";

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
    category: string;
    difficulty: number;
    host_name: string;
    topics: string;
  } | null>(null);

  const difficultyLabel = ["", "Easy", "Medium", "Hard", "Expert", "Master"];
  const difficultyColor = ["", "var(--accent)", "#6ee7b7", "var(--accent2)", "#f97316", "var(--danger)"];

  useEffect(() => {
    return () => gameSocket.disconnect();
  }, []);

  async function joinGame() {
    if (!gameCode.trim()) { setError("Please enter a game code"); return; }
    if (!playerName.trim()) { setError("Please enter your name"); return; }
    setLoading(true);
    setError("");
    try {
      const gameRes = await api.get(`/games/${gameCode.toUpperCase()}`);
      const game = gameRes.data;
      if (game.status !== "lobby") {
        setError("This game has already started");
        setLoading(false);
        return;
      }
      const joinRes = await api.post(`/games/${gameCode.toUpperCase()}/join`, {
        player_name: playerName,
      });
      const { player_id } = joinRes.data;
      setPlayerId(player_id);
      setPlayer(player_id, playerName);
      localStorage.removeItem(`host_${gameCode.toUpperCase()}`);
      localStorage.setItem(`player_id_${gameCode.toUpperCase()}`, player_id);
      localStorage.setItem(`player_name_${gameCode.toUpperCase()}`, playerName);
      setGame(game);
      setGameInfo({
        category: game.category,
        difficulty: game.difficulty,
        host_name: game.host_name,
        topics: game.topics || "",
      });
      const playersRes = await api.get(`/games/${gameCode.toUpperCase()}/players`);
      setLocalPlayers(playersRes.data);
      setPlayers(playersRes.data);
      gameSocket.connect(gameCode.toUpperCase());
      gameSocket.onMessage((msg: Record<string, unknown>) => {
        if (msg.event === "player_joined") {
          const newPlayer = msg.player as Player;
          setLocalPlayers((prev) => {
            if (prev.find((p) => p.id === newPlayer.id)) return prev;
            return [...prev, newPlayer];
          });
        }
        if (msg.event === "game_started") {
          router.push(`/game/${gameCode.toUpperCase()}`);
        }
      });
      setStep("lobby");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError("Game not found. Check the code and try again.");
      } else {
        setError("Failed to join game. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === "join") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-up">
          <a href="/"
            className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "var(--text)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "var(--muted)"}>
            ← Back
          </a>

          <div className="mb-8">
            <h1 className="font-display text-4xl font-bold mb-1">
              <span style={{ color: "var(--accent)" }}>fan</span>atic
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Enter the code from your host</p>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mb-6 text-sm"
              style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2"
                style={{ color: "var(--muted)" }}>
                Game Code
              </label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="XXXXXX"
                maxLength={6}
                className="input-field text-center tracking-[0.3em] uppercase"
                style={{ fontSize: "1.75rem", fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: "0.3em" }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2"
                style={{ color: "var(--muted)" }}>
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="Enter your name"
                className="input-field"
              />
            </div>

            <button
              onClick={joinGame}
              disabled={loading}
              className="btn-primary w-full py-4 text-base mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Joining...
                </span>
              ) : "Join Game →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">
        {/* Player avatar */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 font-display font-bold text-3xl animate-pulse-ring"
            style={{
              background: "rgba(0,229,176,0.15)",
              border: "2px solid var(--accent)",
              color: "var(--accent)",
            }}>
            {playerName[0]?.toUpperCase()}
          </div>
          <h2 className="font-display font-bold text-2xl">{playerName}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--accent)" }}>You're in the game!</p>
        </div>

        {/* Game info */}
        {gameInfo && (
          <div className="card p-4 mb-4">
            <p className="text-xs text-center mb-3" style={{ color: "var(--muted)" }}>
              Hosted by <span style={{ color: "var(--text)" }}>{gameInfo.host_name}</span>
            </p>
            <div className="flex justify-center gap-4 text-xs">
              {gameInfo.topics ? (
                <span style={{ color: "var(--muted)" }}>
                  Topics: <span style={{ color: "var(--text)" }}>{gameInfo.topics}</span>
                </span>
              ) : (
                <span style={{ color: "var(--muted)" }}>
                  Category: <span style={{ color: "var(--text)" }} className="capitalize">{gameInfo.category}</span>
                </span>
              )}
              <span style={{ color: "var(--muted)" }}>
                Difficulty:{" "}
                <span style={{ color: difficultyColor[gameInfo.difficulty] }}>
                  {difficultyLabel[gameInfo.difficulty]}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Players list */}
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-semibold text-sm">Lobby</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              {players.length} joined
            </span>
          </div>
          <div className="space-y-2">
            {players.map((player: Player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                style={{
                  background: player.id === playerId ? "rgba(0,229,176,0.08)" : "var(--surface2)",
                  border: `1px solid ${player.id === playerId ? "rgba(0,229,176,0.3)" : "var(--border)"}`,
                }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display"
                  style={{
                    background: player.id === playerId ? "rgba(0,229,176,0.2)" : "var(--surface)",
                    color: player.id === playerId ? "var(--accent)" : "var(--muted)",
                    border: `1px solid ${player.id === playerId ? "rgba(0,229,176,0.4)" : "var(--border)"}`,
                  }}>
                  {player.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium flex-1">{player.name}</span>
                {player.id === playerId && (
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>You</span>
                )}
                <span className="text-xs" style={{ color: "var(--muted)" }}>#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
          Waiting for host to start...
        </div>
      </div>
    </main>
  );
}