-- Migration: Add sequence state to game_settings
-- Cette migration ajoute un état global de séquence pour synchroniser les transitions d'écran sans dépendre de temporisations locales concurrentes.

ALTER TABLE public.game_settings
ADD COLUMN IF NOT EXISTS sequence_state text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS sequence_started_at timestamptz;

-- Mise à jour de l'état initial si besoin
UPDATE public.game_settings 
SET sequence_state = 'idle' 
WHERE sequence_state IS NULL;
