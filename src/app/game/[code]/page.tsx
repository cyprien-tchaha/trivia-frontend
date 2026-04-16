"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

type FloatingReaction = { id: number; emoji: string; x: number };

function ReportButton({ questionId, code }: { questionId?: string; code: string }) {
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (!questionId) return null;

  async function report() {
    if (reported || reporting) return;
    setReporting(true);
    try {
      await api.post(`/questions/${questionId}/report`, { code });
      setReported(true);
    } catch {}
    finally { setReporting(false); }
  }

  return (
    <button
      onClick={report}
      disabled={reported || reporting}
      style={{
        background: "none",
        border: `1px solid ${reported ? "rgba(107,107,138,0.3)" : "rgba(255,77,109,0.3)"}`,
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px",
        color: reported ? C.muted : "rgba(255,77,109,0.7)",
        cursor: reported ? "default" : "pointer",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s ease",
      }}
    >
      {reported ? "✓ Reported" : reporting ? "Reporting..." : "🚩 Report question"}
    </button>
  );
}

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
  const [correctCount, setCorrectCount] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<"question" | "result" | "finished">("question");
  const [answerStart, setAnswerStart] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const [commentary, setCommentary] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [gameTopics, setGameTopics] = useState<string>("");
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [reactionCounter, setReactionCounter] = useState(0);
  const currentQuestion = questions[currentIndex];

  const gameIdRef = useRef("");
  const gameTopicsRef = useRef("");
  const questionsRef = useRef<Question[]>([]);
  const currentIndexRef = useRef(0);
  const commentaryFetchedRef = useRef(false);

  const showResult = useCallback((correct: boolean, correct_answer: string, newScore?: number) => {
    setCorrectAnswer(correct_answer);
    if (newScore !== undefined) setScore(newScore);
    if (correct) setCorrectCount((n) => n + 1);
    setPhase("result");
  }, []);

  async function fetchCommentary(gId: string, question: Question, correctCount: number, totalCount: number, topics: string) {
    try {
      const res = await api.post(`/questions/${gId}/commentary`, {
        question_text: question.text,
        correct_answer: question.correct_answer,
        topics,
        correct_count: correctCount,
        total_count: totalCount,
      });
      setCommentary(res.data.commentary || "");
    } catch {
      setCommentary("");
    }
  }

  function spawnReaction(emoji: string) {
    const id = Date.now() + Math.random();
    const x = 10 + Math.random() * 80;
    setReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  }

  function sendReaction(emoji: string) {
    setReactionCounter((n) => n + 1);
    gameSocket.send({ event: "reaction", emoji });
    spawnReaction(emoji);
  }

  useEffect(() => {
    async function loadGame() {
      try {
        const myPlayerId = storePlayerId || localStorage.getItem(`player_id_${code}`);
        let playerNeedsResume = false;

        if (!isHost && myPlayerId) {
          const leftGame = localStorage.getItem(`left_game_${code}`);
          const lastHide = localStorage.getItem(`last_hide_${code}`);
          const hideWasRecent = lastHide && (Date.now() - parseInt(lastHide)) < 30000;

          if (leftGame === "true" && !hideWasRecent) {
            setKicked(true);
            setLoading(false);
            return;
          } else if (hideWasRecent) {
            playerNeedsResume = true;
            localStorage.removeItem(`last_hide_${code}`);
            localStorage.removeItem(`left_game_${code}`);
          }
        }

        if (!isHost && myPlayerId) {
          try {
            const playerCheck = await api.get(`/games/${code}/players`);
            const stillInGame = playerCheck.data.find((p: { id: string }) => p.id === myPlayerId);
            if (!stillInGame) {
              setKicked(true);
              setLoading(false);
              return;
            }
          } catch {}
        }

        const gameRes = await api.get(`/games/${code}`);
        const gameData = gameRes.data;
        setGameId(gameData.game_id);
        gameIdRef.current = gameData.game_id;
        setGameTopics(gameData.topics || "");
        gameTopicsRef.current = gameData.topics || "";

        if (gameData.status === "finished") {
          const playersRes = await api.get(`/games/${code}/players`);
          setPlayers(playersRes.data);
          setPhase("finished");
          setLoading(false);
          return;
        }

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
        questionsRef.current = qs;

        if (!isHost && myPlayerId) {
          if (!playerNeedsResume) {
            // Player never left — just sync index from server, do NOT call /resume
            const idx = Number(gameData.current_question_index) || 0;
            setCurrentIndex(idx);
            currentIndexRef.current = idx;
            setPhase("question");
          } else {
            // Player refreshed — call /resume to clear grace window and restore state
            try {
              const resumePromise = api.get(`/games/${code}/resume/${myPlayerId}`);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 3000)
              );
              const resumeRes = await Promise.race([resumePromise, timeoutPromise]) as { data: Record<string, unknown> };
              const resumeData = resumeRes.data;
              const idx = Number(resumeData.current_question_index) || 0;
              setCurrentIndex(idx);
              currentIndexRef.current = idx;
              setScore(Number(resumeData.player_score) || 0);
              if (resumeData.already_answered) {
                setSelectedAnswer(resumeData.answer as string || "");
                setCorrectAnswer(resumeData.correct_answer as string || "");
                setPhase("result");
              } else {
                setPhase("question");
                setTimeLeft(60);
              }
            } catch {
              const idx = Number(gameData.current_question_index) || 0;
              setCurrentIndex(idx);
              currentIndexRef.current = idx;
              setPhase("question");
            }
          }
        } else {
          const idx = Number(gameData.current_question_index) || 0;
          setCurrentIndex(idx);
          currentIndexRef.current = idx;
        }
      } catch (e) {
        console.error("Failed to load game", e);
        if (typeof window !== "undefined") {
          window.location.href = "/?error=game_load_failed";
        }
      } finally {
        setLoading(false);
        setAnswerStart(Date.now());
      }
    }

    loadGame();
    if (!gameSocket.isConnected()) {
      setTimeout(() => gameSocket.connect(code), 100);
    }

    const unsub = gameSocket.onMessage((msg: Record<string, unknown>) => {
      if (msg.event !== "reaction") {
        const currentQ = questionsRef.current[currentIndexRef.current];
        console.log(`[SOCKET] event=${msg.event} currentQ=${currentQ?.id?.slice(0,8)} msgQ=${(msg.question_id as string)?.slice(0,8)} phase=${phase} correctAnswer=${correctAnswer} selectedAnswer=${selectedAnswer} allAnswered=${allAnswered}`);
      }
      
      if (msg.event === "reaction") {
        spawnReaction(msg.emoji as string);
        return;
      }

      if (msg.event === "answer_result") {
        const ca = msg.correct_answer as string;
        const msgPlayerId = msg.player_id as string;
        const msgQuestionId = msg.question_id as string;
        const myPlayerId = storePlayerId || localStorage.getItem(`player_id_${code}`);
        const amHost = localStorage.getItem(`host_${code}`) === "true";

        // Ignore answer_result for a different question than current
        const currentQ = questionsRef.current[currentIndexRef.current];
        if (msgQuestionId && currentQ && msgQuestionId !== currentQ.id) return;

        if (amHost) {
          if (ca) setCorrectAnswer(ca);
          setAnswerSubmitted(true);
        } else if (msgPlayerId === myPlayerId) {
          setScore(msg.score as number);
          setPhase((prev) => {
            if (prev !== "result") return "result";
            return prev;
          });
        }
      }

      if (msg.event === "all_answered") {
        const msgQuestionId = msg.question_id as string;
        const currentQ = questionsRef.current[currentIndexRef.current];
        if (msgQuestionId && currentQ && msgQuestionId !== currentQ.id) return;
        setAllAnswered(true);
        // Only set correctAnswer for host — players get it from their own submission
        const amHost = localStorage.getItem(`host_${code}`) === "true";
        if (amHost) setCorrectAnswer(msg.correct_answer as string);
        (async () => {
          try {
            const pr = await api.get(`/games/${code}/players`);
            setPlayers(pr.data);
            const rightCount = (msg.correct_count as number) ?? 0;
            const totalCount = pr.data.length;
            const q = questionsRef.current[currentIndexRef.current];
            if (q && gameIdRef.current && !commentaryFetchedRef.current) {
              commentaryFetchedRef.current = true;
              fetchCommentary(gameIdRef.current, q, rightCount, totalCount, gameTopicsRef.current);
            }
          } catch {}
        })();
      }

      if (msg.event === "score_updated") {
        (async () => {
          try {
            const pr = await api.get(`/games/${code}/players`);
            setPlayers(pr.data);
          } catch {}
        })();
      }

      if (msg.event === "next_question") {
        const idx = msg.question_index as number;
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setTimeLeft(60);
        setPhase("question");
        setAnswerStart(Date.now());
        setAnswerSubmitted(false);
        setAllAnswered(false);
        setCommentary("");
        setReactions([]);
        commentaryFetchedRef.current = false;
      }

      if (msg.event === "game_finished") {
        setPlayers(msg.players as Player[]);
        setPhase("finished");
      }

      if (msg.event === "player_rejoined") {
        const rejoined = msg.player as Player;
        setPlayers((prev) => {
          const exists = prev.find((p) => p.id === rejoined.id);
          if (exists) return prev.map((p) => p.id === rejoined.id ? rejoined : p);
          return [...prev, rejoined];
        });
      }

      if (msg.event === "player_left") {
        const leftId = msg.player_id as string;
        setPlayers((prev) => prev.filter((p) => p.id !== leftId));
        const amHostNow = localStorage.getItem(`host_${code}`) === "true";
        console.log("player_left, amHostNow:", amHostNow);
        if (amHostNow) {
          setTimeout(async () => {
            try {
              const playersRes = await api.get(`/games/${code}/players`);
              const activePlayers = playersRes.data;
              if (activePlayers.length === 0) return;
              const gameRes = await api.get(`/games/${code}`);
              const gameData = gameRes.data;
              const qRes = await api.get(`/questions/${gameData.game_id}`);
              const qs = qRes.data;
              const currentQ = qs[gameData.current_question_index];
              if (!currentQ) return;
              const answersRes = await api.get(`/games/${code}/question-answers/${currentQ.id}`);
              console.log("answers:", answersRes.data.count, "players:", activePlayers.length);
              if (answersRes.data.count >= activePlayers.length) {
                setAllAnswered(true);
                setCorrectAnswer(currentQ.correct_answer);
              }
            } catch (e) { console.log("error:", e); }
          }, 1500);
        }
      }

      if (msg.event === "game_reset") {
        setResetting(true);
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        setSelectedAnswer(null);
        setCorrectAnswer(null);
        setTimeLeft(60);
        setScore(0);
        setCorrectCount(0);
        setCommentary("");
        setReactions([]);
        setPlayers([]);
        setQuestions([]);
        questionsRef.current = [];
        commentaryFetchedRef.current = false;
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
            questionsRef.current = qs;
            setAnswerStart(Date.now());
          } catch {}
          finally { setResetting(false); }
        })();
      }

      if (msg.event === "socket_reconnected") {
        (async () => {
          try {
            const myPlayerId = storePlayerId || localStorage.getItem(`player_id_${code}`);
            const amHost = localStorage.getItem(`host_${code}`) === "true";

            // Always clear grace window on any reconnect — covers tab switch, screen lock, refresh
            if (!amHost && myPlayerId) {
              try { await api.get(`/games/${code}/resume/${myPlayerId}`); } catch {}
            }

            const gameRes = await api.get(`/games/${code}`);
            const gameData = gameRes.data;
            if (gameData.status === "finished") {
              const pr = await api.get(`/games/${code}/players`);
              setPlayers(pr.data);
              setPhase("finished");
              return;
            }
            const si = gameData.current_question_index;
            if (si !== currentIndexRef.current) {
              setCurrentIndex(si);
              currentIndexRef.current = si;
              setSelectedAnswer(null);
              setCorrectAnswer(null);
              setTimeLeft(60);
              setPhase("question");
              setAnswerStart(Date.now());
              setAllAnswered(false);
              setCommentary("");
              commentaryFetchedRef.current = false;
            }
            const pr = await api.get(`/games/${code}/players`);
            setPlayers(pr.data);
          } catch {}
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
    if (isHost && currentQuestion && timeLeft % 3 === 0) {
      (async () => {
        try {
          const playersRes = await api.get(`/games/${code}/players`);
          const activePlayers = playersRes.data;
          if (activePlayers.length === 0) return;
          const answersRes = await api.get(`/games/${code}/question-answers/${currentQuestion.id}`);
          if (answersRes.data.count >= activePlayers.length) {
            setAllAnswered(true);
          }
        } catch {}
      })();
    }
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, selectedAnswer, isHost, currentQuestion]);

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

  useEffect(() => {
    if (phase === "finished") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave? You will be removed from the game.";
      if (!isHost && playerId) {
        localStorage.setItem(`last_hide_${code}`, Date.now().toString());
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${code}/leave`,
          JSON.stringify({ player_id: playerId })
        );
      }
      return e.returnValue;
    };
    const handlePageHide = () => {
      if (!isHost && playerId) {
        localStorage.setItem(`last_hide_${code}`, Date.now().toString());
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${code}/leave`,
          JSON.stringify({ player_id: playerId })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [phase, playerId, code, isHost]);

  useEffect(() => {
    if (!allAnswered || !isHost) return;
    if (commentaryFetchedRef.current) return;
    const q = questionsRef.current[currentIndexRef.current];
    if (!q || !gameIdRef.current) return;
    commentaryFetchedRef.current = true;
    (async () => {
      try {
        const answersRes = await api.get(`/games/${code}/question-answers/${q.id}`);
        const pr = await api.get(`/games/${code}/players`);
        const correctCount = answersRes.data.correct_count ?? 0;
        fetchCommentary(gameIdRef.current, q, correctCount, pr.data.length, gameTopicsRef.current);
      } catch {}
    })();
  }, [allAnswered]);

  async function handleTimeout() {
    if (!currentQuestion || !playerId) return;
    const questionId = currentQuestion.id;
    const answerToSubmit = selectedAnswer || "";
    setSelectedAnswer(answerToSubmit || "__timeout__");
    const timeTaken = Date.now() - answerStart;
    try {
      const res = await api.post(`/games/${code}/answer`, {
        player_id: playerId, question_id: currentQuestion.id,
        answer: answerToSubmit, time_taken_ms: timeTaken,
      });
      // Only show result if still on the same question
      if (questionsRef.current[currentIndexRef.current]?.id === questionId) {
        showResult(res.data.correct, res.data.correct_answer ?? "", res.data.score);
      }
    } catch {
      if (questionsRef.current[currentIndexRef.current]?.id === questionId) {
        showResult(false, currentQuestion.correct_answer ?? "");
      }
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
      if (!res.data.duplicate) {
        setCorrectAnswer(res.data.correct_answer ?? "");
        setScore(res.data.score);
        if (res.data.correct) setCorrectCount((n) => n + 1);
      }
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
    setCommentary("");
    setReactions([]);
    commentaryFetchedRef.current = false;
    if (nextIndex >= questions.length) {
      try {
        const pr = await api.get(`/games/${code}/players`);
        setPlayers(pr.data);
        await api.post(`/games/${code}/finish`);
      } catch { setPhase("finished"); }
    } else {
      setCurrentIndex(nextIndex);
      currentIndexRef.current = nextIndex;
      setTimeLeft(60);
      setPhase("question");
      setAnswerStart(Date.now());
      await api.post(`/games/${code}/question/${nextIndex}`);
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

  if (kicked) return (
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <div style={{ fontSize: "56px", marginBottom: "16px" }}>😬</div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>You left the game</h1>
        <p style={{ color: C.muted, fontSize: "15px", marginBottom: "32px", lineHeight: 1.5 }}>
          You refreshed the page during an active game and were removed. The game continues without you.
        </p>
        <a href="/" style={{
          display: "inline-block", padding: "14px 32px",
          background: C.accent, color: "#0a0a0f",
          borderRadius: "12px", textDecoration: "none",
          fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px",
        }}>Go Home</a>
      </div>
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
    const myPlayer = sorted.find((p) => p.id === playerId);
    const myRank = sorted.findIndex((p) => p.id === playerId) + 1;
    return (
      <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px", paddingTop: "8px" }}>
            <div style={{ fontSize: "52px", marginBottom: "10px" }}>🏆</div>
            <p style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent, marginBottom: "6px" }}>Winner</p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "40px", fontWeight: 800, marginBottom: "4px" }}>{sorted[0]?.name}</h1>
            <p style={{ color: C.accent2, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "2px" }}>{sorted[0]?.score} pts</p>
            {sorted.length === 1 && (
              <p style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>Solo game</p>
            )}
          </div>
          {!isHost && myPlayer && (
            <div style={{
              background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)",
              borderRadius: "12px", padding: "14px 16px", marginBottom: "12px",
              display: "flex", justifyContent: "space-around", alignItems: "center",
            }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'Syne', sans-serif", color: C.accent }}>{myPlayer.score}</p>
                <p style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>points</p>
              </div>
              <div style={{ width: "1px", height: "36px", background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'Syne', sans-serif", color: C.accent }}>{correctCount}/{questions.length}</p>
                <p style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>correct</p>
              </div>
              <div style={{ width: "1px", height: "36px", background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'Syne', sans-serif", color: myRank === 1 ? C.accent2 : C.text }}>#{myRank}</p>
                <p style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>ranking</p>
              </div>
            </div>
          )}
          <p style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: "8px" }}>Final Standings</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
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
              <button onClick={async () => {
                setResetting(true);
                try {
                  await api.post(`/games/${code}/reset`);
                  const gameRes = await api.get(`/games/${code}`);
                  const gameData = gameRes.data;
                  await api.post(`/questions/${gameData.game_id}/generate`);
                  setPhase("question");
                  setCurrentIndex(0);
                  currentIndexRef.current = 0;
                  setSelectedAnswer(null);
                  setCorrectAnswer(null);
                  setTimeLeft(60);
                  setScore(0);
                  setCorrectCount(0);
                  setCommentary("");
                  setReactions([]);
                  commentaryFetchedRef.current = false;
                  setPlayers([]);
                  let qs: Question[] = [];
                  let attempts = 0;
                  while (qs.length === 0 && attempts < 20) {
                    await new Promise((r) => setTimeout(r, 2000));
                    const qRes = await api.get(`/questions/${gameData.game_id}`);
                    qs = qRes.data;
                    attempts++;
                  }
                  setQuestions(qs);
                  questionsRef.current = qs;
                  setAnswerStart(Date.now());
                  gameSocket.send({ event: "game_reset", game_id: gameData.game_id });
                } catch (e) { console.error("Reset failed", e); }
              }} style={{
                width: "100%", padding: "16px", borderRadius: "12px",
                fontSize: "15px", fontWeight: 700, fontFamily: "'Syne', sans-serif",
                border: "none", background: C.accent, color: "#0a0a0f", cursor: "pointer",
              }}>Play Again — Same Players</button>
              <a href="/" style={{
                display: "block", width: "100%", padding: "14px", textAlign: "center",
                color: C.muted, borderRadius: "12px", textDecoration: "none",
                fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "14px",
                border: `1px solid ${C.border}`,
              }}>New Game</a>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{
                padding: "16px", borderRadius: "12px", marginBottom: "12px",
                background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.accent, display: "inline-block" }} />
                <span style={{ fontSize: "14px", color: C.accent }}>Waiting for host to restart...</span>
              </div>
              <a href="/" style={{
                display: "inline-block", padding: "12px 24px",
                background: C.surface, color: C.muted, borderRadius: "10px",
                textDecoration: "none", fontFamily: "'Syne', sans-serif",
                fontWeight: 700, fontSize: "14px", border: `1px solid ${C.border}`,
              }}>Leave Game</a>
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
    <main style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", padding: "16px", maxWidth: "640px", margin: "0 auto", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "visible" }}>

      {reactions.map((r) => (
        <div key={r.id} style={{
          position: "fixed",
          left: `${r.x}%`,
          bottom: "120px",
          fontSize: "28px",
          pointerEvents: "none",
          animationName: "floatUp",
          animationDuration: "1.8s",
          animationTimingFunction: "ease-out",
          animationFillMode: "forwards",
          zIndex: 50,
        }}>
          {r.emoji}
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "16px", marginBottom: "16px" }}>
        <div>
          <p style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Question</p>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px" }}>
            {currentIndex + 1}<span style={{ color: C.muted, fontWeight: 400, fontSize: "14px" }}>/{questions.length}</span>
          </p>
        </div>
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
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", color: C.accent }}>
            {score} <span style={{ fontSize: "12px", color: C.muted, fontWeight: 400 }}>pts</span>
          </p>
        </div>
      </div>

      {currentQuestion && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
            <p style={{ fontSize: "17px", fontWeight: 500, lineHeight: 1.5 }}>{currentQuestion.text}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {currentQuestion.options?.map((option: string) => {
              let bg = C.surface2;
              let border = C.border;
              let color = C.text;
              let opacity = 1;
              if (phase === "result") {
                if (option === correctAnswer) { bg = "rgba(0,229,176,0.12)"; border = C.accent; color = C.accent; }
                else if (option === selectedAnswer && option !== correctAnswer) { bg = "rgba(255,77,109,0.1)"; border = C.danger; color = C.danger; }
                else { opacity = 0.35; }
              } else if (option === selectedAnswer) {
                bg = "rgba(0,229,176,0.08)"; border = C.accent;
              }
              const icon = phase === "result"
                ? option === correctAnswer ? "✓" : option === selectedAnswer ? "✗" : null
                : null;
              const style = {
                width: "100%", padding: "16px 20px",
                minHeight: "56px",
                borderRadius: "12px", textAlign: "left" as const,
                background: bg, border: `1.5px solid ${border}`, color, opacity,
                fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
                cursor: isHost || selectedAnswer || phase === "result" ? "default" : "pointer",
                transition: "all 0.12s ease",
                display: "flex", alignItems: "center", gap: "10px",
              };
              return isHost ? (
                <div key={option} style={style}>
                  {icon && <span style={{ fontWeight: 700, flexShrink: 0 }}>{icon}</span>}
                  {option}
                </div>
              ) : (
                <button key={option} onClick={() => selectAnswer(option)} disabled={phase === "result"} style={style}>
                  {icon && <span style={{ fontWeight: 700, flexShrink: 0 }}>{icon}</span>}
                  {option}
                </button>
              );
            })}
          </div>

          {phase === "question" && !isHost && selectedAnswer && (
            <button onClick={submitAnswer} style={{
              width: "100%", padding: "14px", borderRadius: "12px",
              fontSize: "15px", fontWeight: 700, fontFamily: "'Syne', sans-serif",
              border: "none", background: C.accent, color: "#0a0a0f", cursor: "pointer",
            }}>Lock In Answer →</button>
          )}

          {phase === "question" && !isHost && !selectedAnswer && (
            <p style={{ textAlign: "center", color: C.muted, fontSize: "13px", padding: "4px 0" }}>
              Select an answer above
            </p>
          )}

          {(phase === "result" || (isHost && (allAnswered || timeLeft <= 0))) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {isHost ? (
                <>
                  <div style={{ padding: "14px", borderRadius: "12px", textAlign: "center", background: "rgba(0,229,176,0.06)", border: "1px solid rgba(0,229,176,0.2)" }}>
                    <p style={{ fontSize: "13px", color: C.muted }}>
                      Correct answer: <span style={{ color: C.accent, fontWeight: 600 }}>{correctAnswer}</span>
                    </p>
                  </div>
                  {commentary && (
                    <p style={{
                      textAlign: "center", fontSize: "14px", color: C.muted,
                      fontStyle: "italic", animationName: "fadeUp", animationDuration: "0.5s",
                      animationDelay: "0.4s", animationFillMode: "both",
                    }}>
                      {commentary}
                    </p>
                  )}
                </>
              ) : (
                <>
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
                  {commentary && (
                    <p style={{
                      textAlign: "center", fontSize: "14px", color: C.muted,
                      fontStyle: "italic", animationName: "fadeUp", animationDuration: "0.5s",
                      animationDelay: "0.4s", animationFillMode: "both",
                    }}>
                      {commentary}
                    </p>
                  )}
                </>
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
              {!isHost && phase === "result" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <p style={{ textAlign: "center", color: C.muted, fontSize: "13px" }}>Waiting for host to continue...</p>
                  <ReportButton questionId={currentQuestion?.id} code={code} />
                </div>
              )}
            </div>
          )}

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

          <div style={{
            display: "flex", justifyContent: "center", gap: "12px",
            paddingTop: "4px", paddingBottom: "8px",
          }}>
            {["🔥", "😱", "💀"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                style={{
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: "999px", padding: "8px 16px",
                  fontSize: "20px", cursor: "pointer",
                  transition: "transform 0.1s ease, border-color 0.1s ease",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          80%  { transform: translateY(-160px) scale(1.2); opacity: 0.8; }
          100% { transform: translateY(-200px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </main>
  );
}