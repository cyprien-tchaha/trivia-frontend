"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { gameSocket } from "@/lib/socket";
import { useGameStore } from "@/store/gameStore";
import { Question, Player } from "@/types";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { playerId: storePlayerId, isHost: storeIsHost } = useGameStore();
  const isHost = storeIsHost || (typeof window !== "undefined" && localStorage.getItem(`host_${code}`) === "true");
  const playerId = storePlayerId || (typeof window !== "undefined" ? localStorage.getItem(`player_id_${code}`) : null);

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
        const questionsRes = await api.get(`/questions/${gameData.game_id}`);
        setQuestions(questionsRes.data);
        const playersRes = await api.get(`/games/${code}/players`);
        setPlayers(playersRes.data);
      } catch {
        console.error("Failed to load game");
      } finally {
        setLoading(false);
        setAnswerStart(Date.now());
      }
    }
    loadGame();

    const unsub = gameSocket.onMessage((msg: Record<string, unknown>) => {
      if (msg.event === "answer_result") {
        showResult(
          msg.correct as boolean,
          msg.correct_answer as string,
          msg.score as number
        );
      }
      if (msg.event === "score_updated") {
        setPlayers(msg.players as Player[]);
      }
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
      } catch {
        // silently ignore
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [code, currentIndex, phase]);

  async function handleTimeout() {
    if (!currentQuestion || !playerId) return;
    setSelectedAnswer("__timeout__");
    try {
      await api.post(`/games/${code}/answer`, {
        player_id: playerId,
        question_id: currentQuestion.id,
        answer: "",
        time_taken_ms: 30000,
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
        player_id: playerId,
        question_id: currentQuestion.id,
        answer,
        time_taken_ms: timeTaken,
      });
      showResult(res.data.correct, res.data.correct_answer ?? "", res.data.score);
    } catch {
      showResult(false, currentQuestion.correct_answer ?? "");
    }
  }

  async function nextQuestion() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      try { await api.post(`/games/${code}/finish`); } catch { setPhase("finished"); }
    } else {
      await api.post(`/games/${code}/question/${nextIndex}`);
      gameSocket.send({ event: "next_question", question_index: nextIndex });
      const playersRes = await api.get(`/games/${code}/players`);
      gameSocket.send({ event: "score_updated", players: playersRes.data });
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Loading game...</p>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p className="text-xl font-bold mb-4">No questions found</p>
          <p className="text-gray-400 mb-6">Questions need to be added to this game.</p>
          <a href="/" className="px-6 py-3 bg-purple-600 rounded-lg">Go Home</a>
        </div>
      </main>
    );
  }

  if (phase === "finished") {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold text-center mb-2">Game Over!</h1>
          <p className="text-gray-400 text-center mb-8">Final Scores</p>
          <div className="space-y-3 mb-8">
            {sorted.map((player, i) => (
              <div
                key={player.id}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 ${
                  i === 0 ? "bg-yellow-900/50 border border-yellow-600" :
                  i === 1 ? "bg-gray-700/50 border border-gray-500" :
                  i === 2 ? "bg-orange-900/50 border border-orange-700" :
                  "bg-gray-800"
                }`}
              >
                <span className="text-2xl font-bold w-8">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{player.name}</p>
                </div>
                <span className="font-bold text-lg">{player.score} pts</span>
              </div>
            ))}
          </div>
          
            <a href="/"
            className="block w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-lg text-center transition-colors"
          >
            Play Again
          </a>
        </div>
      </main>
    );
  }

  const timerPercent = (timeLeft / 30) * 100;
  const timerColor = timeLeft > 10 ? "bg-green-500" : timeLeft > 5 ? "bg-yellow-500" : "bg-red-500";

  return (
    <main className="flex min-h-screen flex-col p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 pt-4">
        <span className="text-sm text-gray-400">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-sm text-gray-400">
          Score: <span className="text-white font-bold">{score}</span>
        </span>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
          timeLeft > 10 ? "bg-green-700" : timeLeft > 5 ? "bg-yellow-700" : "bg-red-700"
        }`}>
          {timeLeft}
        </div>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-2 mb-6">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${timerColor}`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {currentQuestion && (
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-xl font-semibold leading-relaxed">
              {currentQuestion.text}
            </p>
          </div>

          {isHost ? (
            <div className="grid grid-cols-1 gap-3 mb-6">
              {currentQuestion.options?.map((option: string) => {
                let style = "border-gray-700 bg-gray-800 opacity-60 cursor-default";
                if (phase === "result") {
                  if (option === correctAnswer) {
                    style = "bg-green-900/70 border-green-500 text-green-200";
                  } else {
                    style = "bg-gray-800 border-gray-700 opacity-40";
                  }
                }
                return (
                  <div
                    key={option}
                    className={`w-full px-6 py-4 rounded-xl border text-left font-medium ${style}`}
                  >
                    {option}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 mb-6">
              {currentQuestion.options?.map((option: string) => {
                let style = "bg-gray-800 hover:bg-gray-700 border-gray-700";
                if (phase === "result") {
                  if (option === correctAnswer) {
                    style = "bg-green-900/70 border-green-500 text-green-200";
                  } else if (option === selectedAnswer && option !== correctAnswer) {
                    style = "bg-red-900/70 border-red-500 text-red-200";
                  } else {
                    style = "bg-gray-800 border-gray-700 opacity-50";
                  }
                } else if (option === selectedAnswer) {
                  style = "bg-purple-900/70 border-purple-500";
                }
                return (
                  <button
                    key={option}
                    onClick={() => submitAnswer(option)}
                    disabled={!!selectedAnswer || phase === "result"}
                    className={`w-full px-6 py-4 rounded-xl border text-left font-medium transition-all ${style}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {phase === "result" && (
            <div className="mb-4">
              {isHost ? (
                <div className="rounded-xl p-4 text-center mb-4 bg-gray-800 border border-gray-700">
                  <p className="text-lg font-bold text-gray-300">Round complete</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Correct answer: <span className="text-green-400 font-semibold">{correctAnswer}</span>
                  </p>
                </div>
              ) : (
                <div className={`rounded-xl p-4 text-center mb-4 ${
                  selectedAnswer === correctAnswer
                    ? "bg-green-900/50 border border-green-600"
                    : "bg-red-900/50 border border-red-600"
                }`}>
                  <p className="text-lg font-bold">
                    {selectedAnswer === correctAnswer ? "Correct!" : "Wrong!"}
                  </p>
                  {selectedAnswer !== correctAnswer && (
                    <p className="text-sm text-gray-300 mt-1">
                      Correct answer: <span className="text-green-400 font-semibold">{correctAnswer}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-300 mt-1">
                    Score: <span className="font-bold text-white">{score} pts</span>
                  </p>
                </div>
              )}

              {isHost && (
                <button
                  onClick={nextQuestion}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-lg transition-colors"
                >
                  {currentIndex + 1 >= questions.length ? "See Results" : "Next Question →"}
                </button>
              )}

              {!isHost && (
                <p className="text-center text-gray-400 text-sm">
                  Waiting for host to continue...
                </p>
              )}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Scoreboard</span>
            </div>
            <div className="space-y-1">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((player, i) => (
                  <div key={player.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-4">{i + 1}</span>
                    <span className={`flex-1 ${player.id === playerId ? "text-purple-400 font-semibold" : ""}`}>
                      {player.name}
                    </span>
                    <span className="font-bold">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}