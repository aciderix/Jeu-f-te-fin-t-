-- Run this script in the Supabase SQL Editor to initialize your database schema.

-- 1. Table: game_settings
CREATE TABLE IF NOT EXISTS public.game_settings (
  id integer PRIMARY KEY,
  current_phase integer NOT NULL DEFAULT 0,
  current_round integer NOT NULL DEFAULT 1,
  is_playing boolean NOT NULL DEFAULT false,
  show_results boolean NOT NULL DEFAULT false,
  tie_breaker_mode boolean NOT NULL DEFAULT false,
  tie_breaker_teams jsonb DEFAULT '[]'::jsonb,
  tie_breaker_question_id uuid,
  question_started_at text,
  bg_video_url text,
  bg_audio_url text,
  suspense_audio_url text
);

-- Insert the default settings row (id = 1)
INSERT INTO public.game_settings (id, current_phase, current_round, is_playing, show_results, tie_breaker_mode)
VALUES (1, 0, 1, false, false, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Table: teams
CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY,
  name text,
  score integer NOT NULL DEFAULT 0,
  is_eliminated boolean NOT NULL DEFAULT false
);

-- Insert the 4 default teams
INSERT INTO public.teams (id, name, score, is_eliminated) VALUES
  ('A', 'Équipe A', 0, false),
  ('B', 'Équipe B', 0, false),
  ('C', 'Équipe C', 0, false),
  ('D', 'Équipe D', 0, false)
ON CONFLICT (id) DO NOTHING;

-- 3. Table: questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase integer NOT NULL,
  "order" integer NOT NULL,
  photo_url text,
  duration integer NOT NULL DEFAULT 30,
  correct_answer text NOT NULL,
  wrong_answers jsonb,
  is_bonus boolean DEFAULT false
);

-- 4. Table: live_answers
CREATE TABLE IF NOT EXISTS public.live_answers (
  team_id text NOT NULL,
  answer text NOT NULL,
  time_taken double precision NOT NULL,
  PRIMARY KEY (team_id)
);

-- Enable Realtime for relevant tables
alter publication supabase_realtime add table public.game_settings;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.live_answers;

-- Allow anonymous access (public) for simplicity, as requested in specs.
-- NOTE: In a real production app, you should use Row Level Security (RLS).
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on game_settings" ON public.game_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update access on game_settings" ON public.game_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow public update access on teams" ON public.teams FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on questions" ON public.questions FOR DELETE USING (true);

CREATE POLICY "Allow public read access on live_answers" ON public.live_answers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on live_answers" ON public.live_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on live_answers" ON public.live_answers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on live_answers" ON public.live_answers FOR DELETE USING (true);
