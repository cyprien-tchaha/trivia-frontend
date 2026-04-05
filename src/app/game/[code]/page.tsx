"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Question, Player } from "@/types";

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
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<"question" | "result" | "finished">("question");
  const [answerStart, setAnswerStart] = useState(Date.now());
  const [loading, setLoading] = useState(true);

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
        let questions: Question[] = [];
        let attempts = 0;
        while (questions.length === 0 && attempts < 20) {
          const questionsRes = await api.get(`/questions/${gameData.game_id}`);
          questions = questionsRes.data;
          if (questions.length === 0) await new Promise((r) => setTimeout(r, 1500));
          attempts++;
        }
        setQuestions(questions);
      } catch {
        console.error("Failed to load game");
      } finally {
        setLoading(false);
        setAnswerStart(Date.now());
      }
    }
    loadGame();
    if (!gameSocket.isConnected()) gameSocket.connect(code);

    const unsub = gameSocket.onMessage((msg: Record<string, unknown>) => {
      if (msg.event === "answer_result") {
        setCorrectAnswer(msg.correct_answer as string);
        setPhase("result");
        if (!localStorage.getItem(`host_${(params.code as string).toUpperCase()}`)) {
          setScore(msg.score as number);
        }
      }
      if (msg.event === "score_updated") setPlayers(msg.players as Player[]);
      if (msg.event === "next_question") {
        const idx = msg.question_index as number;
        setCurrentIndex(idx);
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setTimeLeft(30);
        setPhase("question");
        setAnswerStart(Date.now());
      }
      if (msg.event === "game_finished") {
        setPlayers(msg.players as Player[]);
        setPhase("finished");
      }
    });
    return unsub;
  }, [code, showResult]);

  useEffect(() => {
    if (phase !== "question") return;
    if (timeLeft <= 0) {
      if (!selectedAnswer && currentQuestion && !isHost) handleTimeout();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, phase, selectedAnswer, isHost]);

  useEffect(() => {
    if (phase === "finished") return;
    const poll = setInterval(async () => {
      if (gameSocket.isConnected()) return;
      try {
        const gameRes = await api.get(`/games/${code}`);
        const gameData = gameRes.data;
        if (gameData.status === "finished") {
          const playersRes = await api.get(`/games/${code}/players`);
          setPlayers(playersRes.data);
          setPhase("finished");
          return;
        }
        const serverIndex = gameData.current_question_index;
        if (serverIndex > currentIndex && phase === "result") {
          setCurrentIndex(serverIndex);
          setSelectedAnswer(null);
          setCorrectAnswer(null);
          setTimeLeft(30);
          setPhase("question");
          setAnswerStart(Date.now());
        }
      } catch {}
    }, 10000);
    return () => clearInterval(poll);
  }, [code, currentIndex, phase]);

  async function handleTimeout() {
    if (!currentQuestion || !playerId) return;
    setSelectedAnswer("__timeout__");
    try {
      await api.post(`/games/${code}/answer`, {
        player_id: playerId, question_id: currentQuestion.id,
        answer: "", time_taken_ms: 30000,
      });
    } catch {
      showResult(false, currentQuestion.correct_answer ?? "");
    }
  }

  async function submitAnswer(answer: string) {
    if (selectedAnswer || phase !== "question" || !currentQuestion || !playerId || isHost) return;
    setSelectedAnswer(answer);
    const timeTaken = Date.now() - answerStart;
    try {
      const res = await api.post(`/games/${code}/answer`, {
        player_id: playerId, question_id: currentQuestion.id,
        answer, time_taken_ms: timeTaken,
      });
      showResult(res.data.correct, res.data.correct_answer ?? "", res.data.score);
    } catch {
      showResult(false, currentQuestion.correct_answer ?? "");
    }
  }

  async function nextQuestion() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      try { await api.post(`/games/${code}/finish`); }
      catch { setPhase("finished"); }
    } else {
      await api.post(`/games/${code}/question/${nextIndex}`);
      gameSocket.send({ event: "next_question", question_index: nextIndex });
      const playersRes = await api.get(`/games/${code}/players`);
      gameSocket.send({ event: "score_updated", players: playersRes.data });
    }
  }

  // Loading
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading game...</p>
      </main>
    );
  }

  // No questions
  if (questions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-display text-xl font-bold mb-2">No questions found</p>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Something went wrong generating questions.</p>
          <a href="/" className="btn-primary px-6 py-3 inline-block">Go Home</a>
        </div>
      </main>
    );
  }

  // Finished
  if (phase === "finished") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉"];
    const medalBg = [
      "rgba(245,166,35,0.1)", "rgba(160,160,180,0.1)", "rgba(180,100,50,0.1)"
    ];
    const medalBorder = [
      "rgba(245,166,35,0.35)", "rgba(160,160,180,0.35)", "rgba(180,100,50,0.35)"
    ];

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-up">
          <div className="text-center mb-8">
            <p className="text-4xl mb-3">🎉</p>
            <h1 className="font-display text-4xl font-bold mb-1">Game Over</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Final Scores</p>
          </div>

          <div className="space-y-2 mb-8">
            {sorted.map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3 animate-fade-up"
                style={{
                  background: i < 3 ? medalBg[i] : "var(--surface)",
                  border: `1px solid ${i < 3 ? medalBorder[i] : "var(--border)"}`,
                  animationDelay: `${i * 0.08}s`,
                }}>
                <span className="text-xl w-8 text-center">
                  {i < 3 ? medals[i] : <span className="font-display font-bold text-sm" style={{ color: "var(--muted)" }}>{i + 1}</span>}
                </span>
                <span className="flex-1 font-medium">{player.name}</span>
                <span className="font-display font-bold" style={{ color: i === 0 ? "var(--accent2)" : "var(--text)" }}>
                  {player.score} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>pts</span>
                </span>
              </div>
            ))}
          </div>

          <a href="/" className="btn-primary block w-full py-4 text-base text-center">
            Play Again
          </a>
        </div>
      </main>
    );
  }

  // Game
  const timerPercent = (timeLeft / 30) * 100;
  const timerColor = timeLeft > 10 ? "var(--accent)" : timeLeft > 5 ? "var(--accent2)" : "var(--danger)";
  const isCorrect = selectedAnswer === correctAnswer;

  return (
    <main className="min-h-screen flex flex-col p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Question
          </p>
          <p className="font-display font-bold text-lg" style={{ color: "var(--text)" }}>
            {currentIndex + 1}
            <span className="font-normal text-sm" style={{ color: "var(--muted)" }}>
              /{questions.length}
            </span>
          </p>
        </div>

        {/* Timer circle */}
        <div className="relative w-14 h-14">
          <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--surface2)" strokeWidth="3" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke={timerColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="150.8"
              strokeDashoffset={150.8 * (1 - timerPercent / 100)}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display font-bold text-base" style={{ color: timerColor }}>
              {timeLeft}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>Score</p>
          <p className="font-display font-bold text-lg" style={{ color: "var(--accent)" }}>{score}</p>
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="card p-6 animate-fade-up">
            <p className="text-lg font-medium leading-relaxed">{currentQuestion.text}</p>
          </div>

          {/* Answers */}
          <div className="grid grid-cols-1 gap-2.5 animate-fade-up-1">
            {currentQuestion.options?.map((option: string) => {
              let cls = "answer-btn";
              if (phase === "result") {
                if (option === correctAnswer) cls += " correct";
                else if (option === selectedAnswer) cls += " wrong";
                else cls += " dimmed";
              } else if (option === selectedAnswer) {
                cls += " selected";
              }
              return isHost ? (
                <div key={option} className={cls} style={{ cursor: "default", opacity: phase === "result" && option !== correctAnswer ? 0.35 : 1 }}>
                  {option}
                </div>
              ) : (
                <button
                  key={option}
                  onClick={() => submitAnswer(option)}
                  disabled={!!selectedAnswer || phase === "result"}
                  className={cls}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Result feedback */}
          {phase === "result" && (
            <div className="animate-fade-up-2">
              {isHost ? (
                <div className="rounded-xl px-4 py-3 text-center"
                  style={{ background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.2)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Correct answer: <span style={{ color: "var(--accent)" }}>{correctAnswer}</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl px-4 py-4 text-center"
                  style={{
                    background: isCorrect ? "rgba(0,229,176,0.08)" : "rgba(255,77,109,0.08)",
                    border: `1px solid ${isCorrect ? "rgba(0,229,176,0.25)" : "rgba(255,77,109,0.25)"}`,
                  }}>
                  <p className="font-display font-bold text-lg mb-1"
                    style={{ color: isCorrect ? "var(--accent)" : "var(--danger)" }}>
                    {isCorrect ? "Correct!" : "Wrong!"}
                  </p>
                  {!isCorrect && (
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Answer: <span style={{ color: "var(--accent)" }}>{correctAnswer}</span>
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Score: <span className="font-bold" style={{ color: "var(--text)" }}>{score} pts</span>
                  </p>
                </div>
              )}

              {isHost && (
                <button onClick={nextQuestion} className="btn-primary w-full py-4 text-base mt-3">
                  {currentIndex + 1 >= questions.length ? "See Results" : "Next Question →"}
                </button>
              )}

              {!isHost && (
                <p className="text-center text-sm mt-3" style={{ color: "var(--muted)" }}>
                  Waiting for host to continue...
                </p>
              )}
            </div>
          )}

          {/* Scoreboard */}
          <div className="card p-4 animate-fade-up-3">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
              Scoreboard
            </p>
            <div className="space-y-2">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((player, i) => (
                  <div key={player.id} className="flex items-center gap-2.5">
                    <span className="w-4 text-xs text-center font-display font-bold"
                      style={{ color: i === 0 ? "var(--accent2)" : "var(--muted)" }}>
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-display"
                      style={{
                        background: player.id === playerId ? "rgba(0,229,176,0.15)" : "var(--surface2)",
                        color: player.id === playerId ? "var(--accent)" : "var(--muted)",
                        border: `1px solid ${player.id === playerId ? "rgba(0,229,176,0.3)" : "var(--border)"}`,
                      }}>
                      {player.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm"
                      style={{ color: player.id === playerId ? "var(--accent)" : "var(--text)", fontWeight: player.id === playerId ? 600 : 400 }}>
                      {player.name}
                    </span>
                    <span className="font-display font-bold text-sm">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}