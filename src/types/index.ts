export interface Game {
  game_id: string;
  code: string;
  host_name: string;
  status: "lobby" | "active" | "finished";
  category: "anime" | "tv";
  difficulty: number;
  question_count: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  order_index: number;
  correct_answer?: string;
}