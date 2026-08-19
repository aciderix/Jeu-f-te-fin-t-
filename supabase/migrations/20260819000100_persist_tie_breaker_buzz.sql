ALTER TABLE public.tie_breaker_sessions
ADD COLUMN IF NOT EXISTS buzzed_team_id TEXT;