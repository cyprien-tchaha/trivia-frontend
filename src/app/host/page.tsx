"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
const difficultyDesc = ["", "Beginner friendly", "Some knowledge needed", "You should know this well", "Deep fan territory", "Obsessive only"];
const difficultyColor = ["", "#00e5b0", "#6ee7b7", "#f5a623", "#f97316", "#ff4d6d"];

function HostPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [copied, setCopied] = useState(false);

  // Pre-fill topic from quick-start chip on home page
  useEffect(() => {
    const topicParam = searchParams.get("topic");
    if (topicParam) setTopics(topicParam);
  }, [searchParams]);

  useEffect(() => { return () => gameSocket.disconnect(); }, []);

  async function createGame() {
    if (!hostName.trim()) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      let finalTopics = topics.trim();
      if (finalTopics) {
        const validation = await api.post("/questions/validate-topics", { topics: finalTopics });
        if (validation.data.unknown.length > 0) {
          setError(`Not found: ${validation.data.unknown.join(", ")}. Check the spelling.`);
          setLoading(false); return;
        }
        if (validation.data.corrected) finalTopics = validation.data.corrected;
      }
      const res = await api.post("/games/create", {
        host_name: hostName, category, difficulty,
        question_count: questionCount, topics: finalTopics,
      });
      const data = res.data;
      setGameCode(data.code);
      setGame(data); setHost(true); setPlayer("host", hostName);
      localStorage.setItem(`host_${data.code}`, "true");
      api.post(`/questions/${data.game_id}/generate`).catch(console.error);
      const poll = async () => {
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
      poll();
      gameSocket.connect(data.code);
      gameSocket.onMessage((msg: Record<string, unknown>) => {
        if (msg.event === "player_joined") addPlayer(msg.player as Player);
        if (msg.event === "game_started") router.push(`/game/${data.code}`);
      });
      setStep("lobby");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 500) setError("Our AI is taking a breather. Wait a few seconds and try again.");
      else if (status === 400) setError("Something looks off with your settings. Try adjusting and resubmitting.");
      else setError("Couldn't create the game. Check your connection and try again.");
    }
    finally { setLoading(false); }
  }

  async function startGame() {
    try { await api.post(`/games/${gameCode}/start`); }
    catch { setError("Failed to start game"); }
  }

  const inputStyle = {
    width: "100%", padding: "12px 16px",
    background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: "10px", color: C.text, fontSize: "15px",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  };

  if (step === "setup") {
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
          <p style={{ color: C.muted, fontSize: "14px", marginBottom: "32px" }}>Set up your game session</p>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
              background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
              color: C.danger, fontSize: "14px",
            }}>{error}</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Name */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>Your Name</label>
              <input value={hostName} onChange={(e) => setHostName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createGame()} placeholder="Enter your name" style={inputStyle} />
            </div>

            {/* Topics */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>
                Topic <span style={{ color: C.border, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— optional</span>
              </label>
              <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. One Piece, Breaking Bad, Marvel…" style={inputStyle} />
              <p style={{ fontSize: "12px", color: C.muted, marginTop: "6px" }}>Leave blank to use the category selector</p>
            </div>

            {/* Category */}
            {!topics.trim() && (
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>Category</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {(["anime", "tv"] as const).map((cat) => (
                    <button key={cat} onClick={() => setCategory(cat)} style={{
                      padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                      fontFamily: "'Syne', sans-serif", cursor: "pointer", transition: "all 0.15s",
                      background: category === cat ? "rgba(0,229,176,0.1)" : C.surface2,
                      border: `1.5px solid ${category === cat ? C.accent : C.border}`,
                      color: category === cat ? C.accent : C.muted,
                    }}>
                      {cat === "anime" ? "🎌 Anime" : "📺 TV Shows"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>
                Difficulty — <span style={{ color: difficultyColor[difficulty] }}>{difficultyLabel[difficulty]}</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                {[1, 2, 3, 4, 5].map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                    fontFamily: "'Syne', sans-serif", cursor: "pointer",
                    background: difficulty === d ? "rgba(0,229,176,0.1)" : C.surface2,
                    border: `1.5px solid ${difficulty === d ? difficultyColor[d] : C.border}`,
                    color: difficulty === d ? difficultyColor[d] : C.muted,
                  }}>{d}</button>
                ))}
              </div>
              <p style={{ fontSize: "12px", color: difficultyColor[difficulty], marginTop: "8px" }}>
                {difficultyDesc[difficulty]}
              </p>
            </div>

            {/* Question count */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>
                Questions — <span style={{ color: C.accent }}>{questionCount}</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} onClick={() => setQuestionCount(n)} style={{
                    padding: "10px", borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                    fontFamily: "'Syne', sans-serif", cursor: "pointer",
                    background: questionCount === n ? "rgba(0,229,176,0.1)" : C.surface2,
                    border: `1.5px solid ${questionCount === n ? C.accent : C.border}`,
                    color: questionCount === n ? C.accent : C.muted,
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Solo hint */}
            <p style={{ fontSize: "12px", color: C.muted, textAlign: "center" }}>
              You can play solo or share the code with friends after creating
            </p>

            {/* Submit */}
            <button onClick={createGame} disabled={loading} style={{
              width: "100%", padding: "16px", borderRadius: "12px", fontSize: "15px", fontWeight: 700,
              fontFamily: "'Syne', sans-serif", cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(0,229,176,0.4)" : C.accent,
              color: "#0a0a0f", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {loading ? "Creating..." : "Create Game →"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Lobby
  return (
    <main style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>

        {/* Game code — clamp so it never clips */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "16px", padding: "32px", textAlign: "center",
          marginBottom: "12px", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% 0%, rgba(0,229,176,0.07) 0%, transparent 70%)",
          }} />
          <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.muted, marginBottom: "12px" }}>Game Code</p>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(2rem, 12vw, 3.5rem)", letterSpacing: "0.12em",
            color: C.accent, lineHeight: 1, marginBottom: "12px",
            wordBreak: "break-all",
          }}>{gameCode}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px" }}>
            <p style={{ fontSize: "12px", color: C.muted }}>playfanatic.app/play/{gameCode}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://playfanatic.app/play/${gameCode}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                cursor: "pointer", fontSize: "12px",
                padding: "2px 8px", borderRadius: "6px",
                transition: "all 0.15s ease",
                background: copied ? "rgba(0,229,176,0.1)" : "none",
                border: `1px solid ${copied ? C.accent : "transparent"}`,
                color: copied ? C.accent : C.muted,
              }}
            >
              {copied ? "✓ Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{
          background: C.surface2, border: `1px solid ${C.border}`,
          borderRadius: "10px", padding: "10px 16px",
          display: "flex", justifyContent: "space-between",
          fontSize: "12px", color: C.muted, marginBottom: "12px",
        }}>
          <span>Category: <span style={{ color: C.text }}>{category === "anime" ? "Anime" : "TV Shows"}</span></span>
          <span>Difficulty: <span style={{ color: difficultyColor[difficulty] }}>{difficultyLabel[difficulty]}</span></span>
          <span>Questions: <span style={{ color: C.text }}>{questionCount}</span></span>
        </div>

        {/* Players */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "16px", padding: "16px", marginBottom: "12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px" }}>Players</span>
            <span style={{
              fontSize: "11px", padding: "2px 10px", borderRadius: "999px",
              background: C.surface2, border: `1px solid ${C.border}`, color: C.muted,
            }}>{players.length} joined</span>
          </div>
          {players.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: C.muted, fontSize: "14px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.accent, display: "inline-block" }} />
              Waiting for players...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {players.map((p: Player, i) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px",
                  background: C.surface2, border: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "13px",
                    background: "rgba(0,229,176,0.1)", color: C.accent,
                    border: "1px solid rgba(0,229,176,0.25)",
                  }}>{p.name[0].toUpperCase()}</div>
                  <span style={{ fontSize: "14px", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: "12px", color: C.muted }}>#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: "10px", marginBottom: "12px",
            background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
            color: C.danger, fontSize: "14px",
          }}>{error}</div>
        )}

        {/* Single status line */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "10px", marginBottom: "12px",
          background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)",
        }}>
          {!questionsReady ? (
            <>
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="rgba(0,229,176,0.3)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#00e5b0" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: "13px", color: C.accent }}>Generating questions with AI...</span>
            </>
          ) : (
            <>
              <span style={{ color: C.accent, fontSize: "16px" }}>✓</span>
              <span style={{ fontSize: "13px", color: C.accent }}>Questions ready!</span>
            </>
          )}
        </div>

        {/* Start button — solo allowed once questions ready */}
        <button onClick={startGame} disabled={!questionsReady} style={{
          width: "100%", padding: "16px", borderRadius: "12px", fontSize: "15px", fontWeight: 700,
          fontFamily: "'Syne', sans-serif", border: "none",
          background: !questionsReady ? C.surface2 : C.accent,
          color: !questionsReady ? C.muted : "#0a0a0f",
          cursor: !questionsReady ? "not-allowed" : "pointer",
        }}>
          {!questionsReady
            ? "Waiting for questions..."
            : players.length === 0
              ? "Start Solo →"
              : `Start Game — ${players.length} player${players.length > 1 ? "s" : ""}`}
        </button>

        {players.length === 0 && questionsReady && (
          <p style={{ fontSize: "12px", color: C.muted, textAlign: "center", marginTop: "10px" }}>
            Or share the link above to invite friends
          </p>
        )}

      </div>
    </main>
  );
}

export default function HostPage() {
  return (
    <Suspense fallback={null}>
      <HostPageInner />
    </Suspense>
  );
}