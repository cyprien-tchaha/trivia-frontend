"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Question, Player } from "@/types";

const C = {
  bg: "#0a0a0f", surface: "#13131a", surface2: "#1c1c27",
  border: "#2a2a3a", accent: "#00e5b0", accent2: "#f5a623",
  danger: "#ff4d6d", text: "#f0f0f8", muted: "#6b6b8a",
};

export default function GamePage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const { playerId: storePlayerId, isHost: storeIsHost } = useGameStore();
  const storedPlayerId = typeof window !== "undefined" ? localStorage.getItem(`player_id_${code}`) : null;
  const storedIsHost = typeof window !== "undefined" && localStorage.getItem(`host_${code}`) === "true";
  const isHost = storeIsHost || (storedIsHost && !storedPlayerId);
  const playerId = storePlayerId || storedPlayerId;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<"question" | "result" | "finished">("question");
  const [answerStart, setAnswerStart] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const currentQuestion = questions[currentIndex];

  const showResult = useCallback((correct: boolean, correct_answer: string, newScore?: number) => {
    setCorrectAnswer(correct_answer);
    if (newScore !== undefined) setScore(newScore);
    setPhase("result");
  }, []);

  useEffect(() => {
    async function loadGame() {
      try {
        const gameRes = await api.get(`/games/${code}`);
        const gameData = gameRes.data;
        const playersRes = await api.get(`/games/${code}/players`);
        setPlayers(playersRes.data);
        let qs: Question[] = [];
        let attempts = 0;
        while (qs.length === 0 && attempts < 20) {
          const qRes = await api.get(`/questions/${gameData.game_id}`);
          qs = qRes.data;
          if (qs.length === 0) await new Promise((r) => setTimeout(r, 1500));
          attempts++;
        }
        setQuestions(qs);
        // Check if player already answered current question
        const currentQ = qs[gameData.current_question_index];
        if (currentQ && !isHost) {
          const myPlayerId = storePlayerId || localStorage.getItem(`player_id_${code}`);
          if (myPlayerId) {
            try {
              const answerCheck = await api.get(`/games/${code}/player-answer/${myPlayerId}/${currentQ.id}`);
              if (answerCheck.data.answered) {
                setCorrectAnswer(answerCheck.data.correct_answer);
                setSelectedAnswer(answerCheck.data.answer);
                setScore(answerCheck.data.score);
                setPhase("result");
              }
            } catch {}
          }
        }
        setCurrentIndex(gameData.current_question_index);
      } catch { console.error("Failed to load game"); }
      finally { setLoading(false); setAnswerStart(Date.now()); }
    }
    loadGame();
    if (!gameSocket.isConnected()) gameSocket.connect(code);
    const unsub = gameSocket.onMessage((msg: Record<string, unknown>) => {
      if (msg.event === "answer_result") {
        const ca = msg.correct_answer as string;
        const msgPlayerId = msg.player_id as string;
        const myPlayerId = storePlayerId || localStorage.getItem(`player_id_${code}`);
        const amHost = localStorage.getItem(`host_${code}`) === "true";
        if (amHost) {
          if (ca) setCorrectAnswer(ca);
          setAnswerSubmitted(true);
        } else if (msgPlayerId === myPlayerId) {
          // Only update from WebSocket if we don't already have a result
          // This prevents the flash caused by double update
          setPhase((currentPhase) => {
            if (currentPhase !== "result") {
              if (ca) setCorrectAnswer(ca);
              setScore(msg.score as number);
              return "result";
            }
            return currentPhase;
          });
        }
      }

      if (msg.event === "all_answered") {
        setAllAnswered(true);
        setCorrectAnswer(msg.correct_answer as string);
        // Refresh player scores from server
        (async () => {
          try {
            const pr = await api.get(`/games/${code}/players`);
            setPlayers(pr.data);
          } catch {}
        })();
      }

      if (msg.event === "score_updated") {
        // Always fetch fresh scores from server instead of trusting broadcast data
        (async () => {
          try {
            const gameRes = await api.get(`/games/${code}`);
            const pr = await api.get(`/games/${code}/players`);
            setPlayers(pr.data);
          } catch {}
        })();
      }
      if (msg.event === "next_question") {
        const idx = msg.question_index as number;
        setCurrentIndex(idx); setSelectedAnswer(null); setCorrectAnswer(null);
        setTimeLeft(60); setPhase("question"); setAnswerStart(Date.now());
        setAnswerSubmitted(false);
        setAllAnswered(false);
      }
      if (msg.event === "game_finished") { setPlayers(msg.players as Player[]); setPhase("finished"); }
      if (msg.event === "game_reset") {
        setResetting(true);
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setTimeLeft(60);
        setScore(0);
        setPlayers([]);
        setQuestions([]);
        setPhase("question");
        (async () => {
          try {
            const gameRes = await api.get(`/games/${code}`);
            let qs: Question[] = [];
            let attempts = 0;
            while (qs.length === 0 && attempts < 20) {
              await new Promise((r) => setTimeout(r, 2000));
              const qRes = await api.get(`/questions/${gameRes.data.game_id}`);
              qs = qRes.data;
              attempts++;
            }
            setQuestions(qs);
            setAnswerStart(Date.now());
          } catch {}
          finally { setResetting(false); }
        })();
      }
    });
    return unsub;
  }, [code, showResult]);

  useEffect(() => {
    if (phase !== "question") return;
    if (timeLeft <= 0) {
      if (!selectedAnswer && currentQuestion && !isHost) handleTimeout();
      if (isHost) setAllAnswered(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, selectedAnswer, isHost]);

  useEffect(() => {
    if (phase === "finished") return;
    const poll = setInterval(async () => {
      if (gameSocket.isConnected()) return;
      try {
        const gameRes = await api.get(`/games/${code}`);
        const gameData = gameRes.data;
        if (gameData.status === "finished") {
          const pr = await api.get(`/games/${code}/players`);
          setPlayers(pr.data); setPhase("finished"); return;
        }
        const si = gameData.current_question_index;
        if (si > currentIndex && phase === "result") {
          setCurrentIndex(si); setSelectedAnswer(null); setCorrectAnswer(null);
          setTimeLeft(60); setPhase("question"); setAnswerStart(Date.now());
        }
      } catch {}
    }, 10000);
    return () => clearInterval(poll);
  }, [code, currentIndex, phase]);

  async function handleTimeout() {
    if (!currentQuestion || !playerId) return;
    const answerToSubmit = selectedAnswer || "";
    setSelectedAnswer(answerToSubmit || "__timeout__");
    const timeTaken = Date.now() - answerStart;
    try {
      const res = await api.post(`/games/${code}/answer`, {
        player_id: playerId, question_id: currentQuestion.id,
        answer: answerToSubmit, time_taken_ms: timeTaken,
      });
      showResult(res.data.correct, res.data.correct_answer ?? "", res.data.score);
    } catch {
      showResult(false, currentQuestion.correct_answer ?? "");
    }
  }
  async function selectAnswer(answer: string) {
    if (phase !== "question" || !currentQuestion || !playerId || isHost) return;
    setSelectedAnswer(answer);
  }

  async function submitAnswer() {
    if (!selectedAnswer || phase !== "question" || !currentQuestion || !playerId || isHost) return;
    const timeTaken = Date.now() - answerStart;
    setPhase("result");
    try {
      const res = await api.post(`/games/${code}/answer`, {
        player_id: playerId, question_id: currentQuestion.id,
        answer: selectedAnswer, time_taken_ms: timeTaken,
      });
      showResult(res.data.correct, res.data.correct_answer ?? "", res.data.score);
    } catch {
      showResult(false, currentQuestion.correct_answer ?? "");
    }
  }

  async function nextQuestion() {
    const nextIndex = currentIndex + 1;
    setCorrectAnswer(null);
    setSelectedAnswer(null);
    setAllAnswered(false);
    setAnswerSubmitted(false);
    if (nextIndex >= questions.length) {
      try {
        // Fetch final scores before finishing
        const pr = await api.get(`/games/${code}/players`);
        setPlayers(pr.data);
        await api.post(`/games/${code}/finish`);
      }
      catch { setPhase("finished"); }
    } else {
      setCurrentIndex(nextIndex);
      setTimeLeft(60);
      setPhase("question");
      setAnswerStart(Date.now());
      await api.post(`/games/${code}/question/${nextIndex}`);
      // Fetch fresh scores from DB
      const pr = await api.get(`/games/${code}/players`);
      setPlayers(pr.data);
      gameSocket.send({ event: "next_question", question_index: nextIndex });
      gameSocket.send({ event: "score_updated", players: pr.data });
    }
  }

  if (resetting) return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <svg className="spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={C.border} strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke={C.accent} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "16px" }}>New round loading...</p>
      <p style={{ color: C.muted, fontSize: "13px" }}>AI is generating fresh questions</p>
    </main>
  );

  if (loading) return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <svg className="spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={C.border} strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke={C.accent} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p style={{ color: C.muted, fontSize: "14px" }}>Loading game...</p>
    </main>
  );

  if (questions.length === 0) return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>No questions found</p>
        <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>Something went wrong generating questions.</p>
        <a href="/" style={{ padding: "12px 24px", background: C.accent, color: "#0a0a0f", borderRadius: "10px", textDecoration: "none", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Go Home</a>
      </div>
    </main>
  );

  if (phase === "finished") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    const medalBg = ["rgba(245,166,35,0.08)", "rgba(160,160,180,0.08)", "rgba(180,100,50,0.08)"];
    const medalBorder = ["rgba(245,166,35,0.3)", "rgba(160,160,180,0.3)", "rgba(180,100,50,0.3)"];

    async function resetGame() {
      try {
        await api.post(`/games/${code}/reset`);
        await api.post(`/questions/${sorted[0]?.id || "x"}/generate`).catch(() => {});
      } catch {}
    }

    return (
      <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏆</div>
            <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent, marginBottom: "8px" }}>
              Winner
            </p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "40px", fontWeight: 800, marginBottom: "4px" }}>
              {sorted[0]?.name}
            </h1>
            <p style={{ color: C.accent2, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "4px" }}>
              {sorted[0]?.score} pts
            </p>
            <p style={{ color: C.muted, fontSize: "13px" }}>Final Standings</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
            {sorted.map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "14px 16px", borderRadius: "12px",
                background: i < 3 ? medalBg[i] : C.surface,
                border: `1px solid ${i < 3 ? medalBorder[i] : C.border}`,
              }}>
                <span style={{ fontSize: "22px", width: "28px", textAlign: "center" }}>
                  {i < 3 ? medals[i] : <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: C.muted, fontSize: "14px" }}>{i + 1}</span>}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: i === 0 ? C.accent2 : C.text }}>
                  {p.score} <span style={{ fontSize: "12px", fontWeight: 400, color: C.muted }}>pts</span>
                </span>
              </div>
            ))}
          </div>

          {isHost ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={async () => {
                  setResetting(true);
                  try {
                    // Reset game and scores
                    await api.post(`/games/${code}/reset`);
                    // Get game info to regenerate questions
                    const gameRes = await api.get(`/games/${code}`);
                    const gameData = gameRes.data;
                    // Trigger new question generation
                    await api.post(`/questions/${gameData.game_id}/generate`);
                    // Reset local state
                    setPhase("question");
                    setCurrentIndex(0);
                    setSelectedAnswer(null);
                    setCorrectAnswer(null);
                    setTimeLeft(60);
                    setScore(0);
                    setPlayers([]);
                    // Reload questions after generation
                    let qs: Question[] = [];
                    let attempts = 0;
                    while (qs.length === 0 && attempts < 20) {
                      await new Promise((r) => setTimeout(r, 2000));
                      const qRes = await api.get(`/questions/${gameData.game_id}`);
                      qs = qRes.data;
                      attempts++;
                    }
                    setQuestions(qs);
                    setAnswerStart(Date.now());
                    // Broadcast to all players
                    gameSocket.send({ event: "game_reset", game_id: gameData.game_id });
                  } catch (e) {
                    console.error("Reset failed", e);
                  }
                }}
                style={{
                  width: "100%", padding: "16px", borderRadius: "12px",
                  fontSize: "15px", fontWeight: 700, fontFamily: "'Syne', sans-serif",
                  border: "none", background: C.accent, color: "#0a0a0f", cursor: "pointer",
                }}
              >
                Play Again — Same Players
              </button>
              <a href="/" style={{
                display: "block", width: "100%", padding: "16px", textAlign: "center",
                background: C.surface, color: C.muted, borderRadius: "12px",
                textDecoration: "none", fontFamily: "'Syne', sans-serif",
                fontWeight: 700, fontSize: "15px",
                border: `1px solid ${C.border}`,
              }}>
                New Game
              </a>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{
                padding: "16px", borderRadius: "12px", marginBottom: "12px",
                background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.accent, display: "inline-block", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: "14px", color: C.accent }}>Waiting for host to restart...</span>
              </div>
              <a href="/" style={{
                display: "inline-block", padding: "12px 24px",
                background: C.surface, color: C.muted, borderRadius: "10px",
                textDecoration: "none", fontFamily: "'Syne', sans-serif",
                fontWeight: 700, fontSize: "14px", border: `1px solid ${C.border}`,
              }}>
                Leave Game
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  const timerPercent = (timeLeft / 60) * 100;
  const timerColor = timeLeft > 10 ? C.accent : timeLeft > 5 ? C.accent2 : C.danger;
  const isCorrect = selectedAnswer === correctAnswer;
  const circumference = 2 * Math.PI * 24;

  return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", padding: "16px", maxWidth: "640px", margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "16px", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Question</p>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px" }}>
            {currentIndex + 1}<span style={{ color: C.muted, fontWeight: 400, fontSize: "14px" }}>/{questions.length}</span>
          </p>
        </div>

        {/* Timer */}
        <div style={{ position: "relative", width: "56px", height: "56px" }}>
          <svg style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke={C.surface2} strokeWidth="3" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={timerColor} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - timerPercent / 100)}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "16px", color: timerColor }}>{timeLeft}</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Score</p>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", color: C.accent }}>{score}</p>
        </div>
      </div>

      {currentQuestion && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Question */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
            <p style={{ fontSize: "17px", fontWeight: 500, lineHeight: 1.5 }}>{currentQuestion.text}</p>
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {currentQuestion.options?.map((option: string) => {
              let bg = C.surface2;
              let border = C.border;
              let color = C.text;
              let opacity = 1;

              if (phase === "result") {
                if (option === correctAnswer) { bg = "rgba(0,229,176,0.12)"; border = C.accent; color = C.accent; }
                else if (option === selectedAnswer) { bg = "rgba(255,77,109,0.1)"; border = C.danger; color = C.danger; }
                else { opacity = 0.3; }
              } else if (option === selectedAnswer) {
                bg = "rgba(0,229,176,0.08)"; border = C.accent;
              }

              const style = {
                width: "100%", padding: "16px 20px", borderRadius: "12px", textAlign: "left" as const,
                background: bg, border: `1.5px solid ${border}`, color, opacity,
                fontSize: "15px", fontFamily: "'DM Sans', sans-serif", cursor: isHost || selectedAnswer || phase === "result" ? "default" : "pointer",
                transition: "all 0.12s ease",
              };

              return isHost ? (
                <div key={option} style={style}>{option}</div>
              ) : (
                <button
                  key={option}
                  onClick={() => selectAnswer(option)}
                  disabled={phase === "result"}
                  style={style}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Confirm answer button */}
          {phase === "question" && !isHost && selectedAnswer && (
            <button
              onClick={submitAnswer}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                fontSize: "15px", fontWeight: 700, fontFamily: "'Syne', sans-serif",
                border: "none", background: C.accent, color: "#0a0a0f",
                cursor: "pointer", marginBottom: "4px",
              }}
            >
              Lock In Answer →
            </button>
          )}

          {phase === "question" && !isHost && !selectedAnswer && (
            <div style={{
              width: "100%", padding: "14px", borderRadius: "12px",
              fontSize: "14px", textAlign: "center",
              color: C.muted, border: `1px dashed ${C.border}`,
            }}>
              Select an answer above
            </div>
          )}

          {/* Result */}
          {(phase === "result" || (isHost && (allAnswered || timeLeft <= 0))) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {isHost ? (
                <div style={{ padding: "14px", borderRadius: "12px", textAlign: "center", background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.2)" }}>
                  <p style={{ fontSize: "13px", color: C.muted }}>
                    Correct answer: <span style={{ color: C.accent, fontWeight: 600 }}>{correctAnswer}</span>
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: "16px", borderRadius: "12px", textAlign: "center",
                  background: isCorrect ? "rgba(0,229,176,0.07)" : "rgba(255,77,109,0.07)",
                  border: `1px solid ${isCorrect ? "rgba(0,229,176,0.2)" : "rgba(255,77,109,0.2)"}`,
                }}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "18px", color: isCorrect ? C.accent : C.danger, marginBottom: "4px" }}>
                    {isCorrect ? "Correct!" : "Wrong!"}
                  </p>
                  {!isCorrect && <p style={{ fontSize: "13px", color: C.muted, marginBottom: "4px" }}>Answer: <span style={{ color: C.accent }}>{correctAnswer}</span></p>}
                  <p style={{ fontSize: "12px", color: C.muted }}>Score: <span style={{ fontWeight: 700, color: C.text }}>{score} pts</span></p>
                </div>
              )}

              {isHost && (
                <button onClick={nextQuestion} style={{
                  width: "100%", padding: "16px", borderRadius: "12px", fontSize: "15px", fontWeight: 700,
                  fontFamily: "'Syne', sans-serif", border: "none",
                  background: C.accent, color: "#0a0a0f", cursor: "pointer",
                }}>
                  {currentIndex + 1 >= questions.length ? "See Results" : "Next Question →"}
                </button>
              )}
              {!isHost && phase === "result" && <p style={{ textAlign: "center", color: C.muted, fontSize: "13px" }}>Waiting for host to continue...</p>}
            </div>
          )}

          {/* Scoreboard — host only during game */}
          {isHost && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "14px" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: "10px" }}>Scoreboard</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[...players].sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "16px", fontSize: "12px", textAlign: "center", fontFamily: "'Syne', sans-serif", fontWeight: 700, color: i === 0 ? C.accent2 : C.muted }}>{i + 1}</span>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 700, fontFamily: "'Syne', sans-serif",
                    background: p.id === playerId ? "rgba(0,229,176,0.15)" : C.surface2,
                    color: p.id === playerId ? C.accent : C.muted,
                    border: `1px solid ${p.id === playerId ? "rgba(0,229,176,0.3)" : C.border}`,
                  }}>{p.name[0].toUpperCase()}</div>
                  <span style={{ flex: 1, fontSize: "14px", color: p.id === playerId ? C.accent : C.text, fontWeight: p.id === playerId ? 600 : 400 }}>{p.name}</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "14px" }}>{p.score}</span>
                </div>
              ))}
            </div>
          </div>
          )}
          </div>
        )}
    </main>
  );
}