ALTER TABLE public.game_settings
ADD COLUMN IF NOT EXISTS tie_breaker_teams JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tie_breaker_question_id UUID,
ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS winner_team_id TEXT;

CREATE TABLE IF NOT EXISTS public.tie_breaker_sessions (
  id integer PRIMARY KEY DEFAULT 1,
  question_id uuid,
  tied_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_spots integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'cancelled' CHECK (status IN ('active', 'finished', 'cancelled'))
);

INSERT INTO public.tie_breaker_sessions (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tie_breaker_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Allow public read access on tie_breaker_sessions"
    ON public.tie_breaker_sessions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow public insert access on tie_breaker_sessions"
    ON public.tie_breaker_sessions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow public update access on tie_breaker_sessions"
    ON public.tie_breaker_sessions FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tie_breaker_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tie_breaker_sessions;
  END IF;
END $$;