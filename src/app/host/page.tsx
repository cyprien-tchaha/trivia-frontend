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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questionsReady, setQuestionsReady] = useState(false);

  useEffect(() => {
    return () => gameSocket.disconnect();
  }, []);

  async function createGame() {
    if (!hostName.trim()) { setError("Please enter your name"); return; }
    setLoading(true);
    setError("");
    try {
      let finalTopics = topics.trim();
      if (finalTopics) {
        const validation = await api.post("/questions/validate-topics", { topics: finalTopics });
        if (validation.data.unknown.length > 0) {
          setError(`Not found: ${validation.data.unknown.join(", ")}. Check the spelling.`);
          setLoading(false);
          return;
        }
        if (validation.data.corrected) finalTopics = validation.data.corrected;
      }
      const res = await api.post("/games/create", {
        host_name: hostName, category, difficulty,
        question_count: questionCount, topics: finalTopics,
      });
      const data = res.data;
      setGameCode(data.code);
      setGame(data);
      setHost(true);
      setPlayer("host", hostName);
      localStorage.setItem(`host_${data.code}`, "true");
      api.post(`/questions/${data.game_id}/generate`).catch(console.error);
      const pollQuestions = async () => {
        let attempts = 0;
        while (attempts < 20) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const qRes = await api.get(`/questions/${data.game_id}`);
            if (qRes.data.length > 0) { setQuestionsReady(true); return; }
          } catch {}
          attempts++;
        }
      };
      pollQuestions();
      gameSocket.connect(data.code);
      gameSocket.onMessage((msg: Record<string, unknown>) => {
        if (msg.event === "player_joined") addPlayer(msg.player as Player);
        if (msg.event === "game_started") router.push(`/game/${data.code}`);
      });
      setStep("lobby");
    } catch {
      setError("Failed to create game. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    try { await api.post(`/games/${gameCode}/start`); }
    catch { setError("Failed to start game"); }
  }

  const difficultyLabel = ["", "Easy", "Medium", "Hard", "Expert", "Master"];
  const difficultyColor = ["", "var(--accent)", "#6ee7b7", "var(--accent2)", "#f97316", "var(--danger)"];

  if (step === "setup") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-up">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "var(--text)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "var(--muted)"}>
            ← Back
          </a>

          <div className="mb-8">
            <h1 className="font-display text-4xl font-bold mb-1">
              <span style={{ color: "var(--accent)" }}>fan</span>atic
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Set up your game session</p>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mb-6 text-sm animate-fade-up"
              style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Host name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                Your name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGame()}
                placeholder="Enter your name"
                className="input-field"
              />
            </div>

            {/* Topics */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                Shows / Anime <span style={{ color: "var(--border)" }}>— optional</span>
              </label>
              <input
                type="text"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="e.g. Naruto, Breaking Bad, One Piece"
                className="input-field"
              />
              <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                Leave blank to use the category below
              </p>
            </div>

            {/* Category — hidden when topics entered */}
            {!topics.trim() && (
              <div>
                <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["anime", "tv"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className="py-3 rounded-xl font-display font-semibold text-sm transition-all"
                      style={{
                        background: category === cat ? "rgba(0,229,176,0.12)" : "var(--surface2)",
                        border: `1.5px solid ${category === cat ? "var(--accent)" : "var(--border)"}`,
                        color: category === cat ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {cat === "anime" ? "🎌 Anime" : "📺 TV Shows"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                Difficulty —{" "}
                <span style={{ color: difficultyColor[difficulty] }}>{difficultyLabel[difficulty]}</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="py-2.5 rounded-xl font-display font-bold text-sm transition-all"
                    style={{
                      background: difficulty === d ? "rgba(0,229,176,0.12)" : "var(--surface2)",
                      border: `1.5px solid ${difficulty === d ? difficultyColor[d] : "var(--border)"}`,
                      color: difficulty === d ? difficultyColor[d] : "var(--muted)",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                Questions — <span style={{ color: "var(--accent)" }}>{questionCount}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className="py-2.5 rounded-xl font-display font-bold text-sm transition-all"
                    style={{
                      background: questionCount === n ? "rgba(0,229,176,0.12)" : "var(--surface2)",
                      border: `1.5px solid ${questionCount === n ? "var(--accent)" : "var(--border)"}`,
                      color: questionCount === n ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createGame}
              disabled={loading}
              className="btn-primary w-full py-4 text-base mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Creating...
                </span>
              ) : "Create Game →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Lobby
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">
        {/* Game code card */}
        <div className="card p-8 text-center mb-4" style={{ position: "relative", overflow: "hidden" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(0,229,176,0.08) 0%, transparent 70%)" }} />
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Game Code</p>
          <p className="font-display font-bold tracking-[0.2em] mb-3"
            style={{ fontSize: "clamp(2.5rem, 10vw, 4rem)", color: "var(--accent)", lineHeight: 1 }}>
            {gameCode}
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            fanatic-trivia.vercel.app/play
          </p>
        </div>

        {/* Game info */}
        <div className="card-inner px-4 py-3 mb-4 flex justify-between text-xs" style={{ color: "var(--muted)" }}>
          <span>Category: <span style={{ color: "var(--text)" }} className="capitalize">{category}</span></span>
          <span>Difficulty: <span style={{ color: difficultyColor[difficulty] }}>{difficultyLabel[difficulty]}</span></span>
          <span>Questions: <span style={{ color: "var(--text)" }}>{questionCount}</span></span>
        </div>

        {/* Players */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-semibold text-sm">Players</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              {players.length} joined
            </span>
          </div>
          {players.length === 0 ? (
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                Waiting for players...
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((player: Player, i) => (
                <div key={player.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display"
                    style={{ background: "rgba(0,229,176,0.15)", color: "var(--accent)", border: "1px solid rgba(0,229,176,0.3)" }}>
                    {player.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{player.name}</span>
                  <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm"
            style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {/* Questions status */}
        {!questionsReady && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
            style={{ background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)" }}>
            <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-sm" style={{ color: "var(--accent)" }}>Generating questions with AI...</span>
          </div>
        )}

        {questionsReady && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
            style={{ background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)" }}>
            <span style={{ color: "var(--accent)" }}>✓</span>
            <span className="text-sm" style={{ color: "var(--accent)" }}>Questions ready!</span>
          </div>
        )}

        <button
          onClick={startGame}
          disabled={players.length === 0 || !questionsReady}
          className="btn-primary w-full py-4 text-base"
        >
          {!questionsReady
            ? "Waiting for questions..."
            : players.length === 0
            ? "Waiting for players..."
            : `Start Game — ${players.length} player${players.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </main>
  );
}