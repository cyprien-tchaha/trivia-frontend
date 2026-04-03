"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Player } from "@/types";

export default function HostPage() {
  const router = useRouter();
  const { setGame, setHost, setPlayer, addPlayer, players } = useGameStore();

  const [step, setStep] = useState<"setup" | "lobby">("setup");
  const [hostName, setHostName] = useState("");
  const [category, setCategory] = useState<"anime" | "tv">("anime");
  const [difficulty, setDifficulty] = useState(1);
  const [questionCount, setQuestionCount] = useState(10);
  const [topics, setTopics] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [gameId, setGameId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => gameSocket.disconnect();
  }, []);

  async function createGame() {
    if (!hostName.trim()) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/games/create", {
        host_name: hostName,
        category,
        difficulty,
        question_count: questionCount,
        topics,
      });
      const data = res.data;
      setGameCode(data.code);
      setGameId(data.game_id);
      setGame(data);
      setHost(true);
      setPlayer("host", hostName);
      api.post(`/questions/${data.game_id}/generate`).catch(console.error);
      gameSocket.connect(data.code);
      gameSocket.onMessage((msg: Record<string, unknown>) => {
        if (msg.event === "player_joined") {
          addPlayer(msg.player as Player);
        }
        if (msg.event === "game_started") {
          router.push(`/game/${data.code}`);
        }
      });
      setStep("lobby");
    } catch {
      setError("Failed to create game. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    try {
      await api.post(`/games/${gameCode}/start`);
    } catch {
      setError("Failed to start game");
    }
  }

  const difficultyLabel = ["", "Easy", "Medium", "Hard", "Expert", "Master"];

  if (step === "setup") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <a href="/" className="text-gray-400 hover:text-white text-sm mb-8 block">
            ← Back
          </a>
          <h1 className="text-3xl font-bold mb-2">Host a Game</h1>
          <p className="text-gray-400 mb-8">Set up your trivia session</p>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGame()}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Specific shows or animes{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="e.g. Naruto, Death Note, One Piece"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Separate multiple shows with commas. Leave blank for any {category === "anime" ? "anime" : "TV show"}.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["anime", "tv"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`py-3 rounded-lg font-medium transition-colors ${
                      category === cat
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {cat === "anime" ? "Anime" : "TV Shows"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Difficulty —{" "}
                <span className="text-purple-400">{difficultyLabel[difficulty]}</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                      difficulty === d
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of questions —{" "}
                <span className="text-purple-400">{questionCount}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                      questionCount === n
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createGame}
              disabled={loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
            >
              {loading ? "Creating..." : "Create Game"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Game Lobby</h1>
        <p className="text-gray-400 mb-8">Share the code with your players</p>

        <div className="bg-gray-800 rounded-2xl p-8 text-center mb-6">
          <p className="text-gray-400 text-sm mb-2">Game Code</p>
          <p className="text-6xl font-bold tracking-widest text-purple-400">
            {gameCode}
          </p>
          <p className="text-gray-500 text-sm mt-3">
            Players go to localhost:3000/play
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-3">
            <span>Category: <span className="text-white capitalize">{category}</span></span>
            <span>Difficulty: <span className="text-white">{difficultyLabel[difficulty]}</span></span>
            <span>Questions: <span className="text-white">{questionCount}</span></span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Players</h2>
            <span className="text-sm text-gray-400">{players.length} joined</span>
          </div>
          {players.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              Waiting for players to join...
            </p>
          ) : (
            <div className="space-y-2">
              {players.map((player: Player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2"
                >
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {player.name[0].toUpperCase()}
                  </div>
                  <span>{player.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={startGame}
          disabled={players.length === 0}
          className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
        >
          {players.length === 0 ? "Waiting for players..." : `Start Game (${players.length} players)`}
        </button>
      </div>
    </main>
  );
}