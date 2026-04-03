import { create } from "zustand";
import { Game, Player, Question } from "@/types";

interface GameStore {
  game: Game | null;
  playerId: string | null;
  playerName: string | null;
  isHost: boolean;
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  selectedAnswer: string | null;
  setGame: (game: Game) => void;
  setPlayer: (id: string, name: string) => void;
  setHost: (v: boolean) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  setQuestions: (q: Question[]) => void;
  nextQuestion: () => void;
  selectAnswer: (a: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  playerId: null,
  playerName: null,
  isHost: false,
  players: [],
  questions: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  setGame: (game) => set({ game }),
  setPlayer: (playerId, playerName) => set({ playerId, playerName }),
  setHost: (isHost) => set({ isHost }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) => set((s) => ({ players: [...s.players, player] })),
  setQuestions: (questions) => set({ questions }),
  nextQuestion: () => set((s) => ({ currentQuestionIndex: s.currentQuestionIndex + 1, selectedAnswer: null })),
  selectAnswer: (selectedAnswer) => set({ selectedAnswer }),
  reset: () => set({
    game: null, playerId: null, playerName: null, isHost: false,
    players: [], questions: [], currentQuestionIndex: 0, selectedAnswer: null,
  }),
}));