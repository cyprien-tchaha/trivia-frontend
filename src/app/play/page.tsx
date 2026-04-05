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
  } | null>(null);

  const difficultyLabel = ["", "Easy", "Medium", "Hard", "Expert", "Master"];

  useEffect(() => {
    return () => gameSocket.disconnect();
  }, []);

  async function joinGame() {
    if (!gameCode.trim()) {
      setError("Please enter a game code");
      return;
    }
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
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
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <a href="/" className="text-gray-400 hover:text-white text-sm mb-8 block">
            ← Back
          </a>
          <h1 className="text-3xl font-bold mb-2">Join a Game</h1>
          <p className="text-gray-400 mb-8">Enter the code from your host</p>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Game code
              </label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="e.g. TWUENO"
                maxLength={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-center text-2xl font-bold tracking-widest uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinGame()}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={joinGame}
              disabled={loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
            >
              {loading ? "Joining..." : "Join Game"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            {playerName[0]?.toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{playerName}</h1>
          <p className="text-green-400 text-sm mt-1">You're in!</p>
        </div>

        {gameInfo && (
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <p className="text-center text-gray-400 text-sm mb-1">
              Hosted by <span className="text-white">{gameInfo.host_name}</span>
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-400 mt-2">
              <span>
                Category:{" "}
                <span className="text-white capitalize">{gameInfo.category}</span>
              </span>
              <span>
                Difficulty:{" "}
                <span className="text-white">
                  {difficultyLabel[gameInfo.difficulty]}
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Players in lobby</h2>
            <span className="text-sm text-gray-400">{players.length} joined</span>
          </div>
          <div className="space-y-2">
            {players.map((player: Player) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  player.id === playerId ? "bg-purple-900/50 border border-purple-700" : "bg-gray-700"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  player.id === playerId ? "bg-purple-600" : "bg-gray-600"
                }`}>
                  {player.name[0].toUpperCase()}
                </div>
                <span>{player.name}</span>
                {player.id === playerId && (
                  <span className="text-purple-400 text-xs ml-auto">You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Waiting for host to start the game...
          </div>
        </div>
      </div>
    </main>
  );
}