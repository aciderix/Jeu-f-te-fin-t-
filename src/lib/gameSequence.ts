export type GameSequenceState =
  | 'idle'
  | 'game_start'
  | 'phase_intro'
  | 'round_intro'
  | 'active'
  | 'reveal'
  | 'phase_summary'
  | 'tie_breaker'
  | 'finale';

export const SEQUENCE_DURATIONS: Record<
  Extract<GameSequenceState, 'game_start' | 'phase_intro' | 'round_intro'>,
  number
> = {
  game_start: 4_000,
  phase_intro: 3_500,
  round_intro: 2_500,
};

export const PHASE_TITLES: Record<number, string> = {
  1: 'Le Face-à-Face',
  2: 'La Demi-Finale',
  3: 'La Grande Finale',
};

export const PHASE_RULES: Record<number, string> = {
  1: 'Choisissez parmi les réponses proposées.',
  2: 'Répondez vite, chaque équipe compte.',
  3: 'Une seule équipe remportera la victoire.',
};

export function nextSequenceState(
  state: Extract<GameSequenceState, 'game_start' | 'phase_intro' | 'round_intro'>,
): GameSequenceState {
  if (state === 'game_start') return 'phase_intro';
  if (state === 'phase_intro') return 'round_intro';
  return 'active';
}
