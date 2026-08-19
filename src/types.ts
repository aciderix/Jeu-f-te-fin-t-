export interface GameSettings {
  id: number;
  current_phase: number;
  current_round: number;
  is_playing: boolean;
  show_results: boolean;
  tie_breaker_mode: boolean;
  tie_breaker_teams?: string[]; // IDs des équipes en ballotage (ex: ['B', 'D'])
  tie_breaker_question_id?: string; // ID de la question bonus active
  bg_video_url?: string;
  bg_audio_url?: string;
  suspense_audio_url?: string;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  is_eliminated: boolean;
}

export interface Question {
  id: string;
  phase: number; // 0 = Manche Bonus (Buzzer / Mort subite), 1 = Phase 1, 2 = Phase 2, 3 = Phase 3
  order: number;
  photo_url: string;
  duration: number;
  correct_answer: string;
  wrong_answers: string[];
  is_bonus?: boolean;
}

export interface LiveAnswer {
  team_id: string;
  answer: string;
  time_taken: number;
}
