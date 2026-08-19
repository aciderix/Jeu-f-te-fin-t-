-- Run this in your Supabase SQL Editor to update the schema

-- 1. Add is_bonus column to questions table
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT FALSE;

-- 2. Add tie breaker and timer fields to game_settings
ALTER TABLE game_settings
ADD COLUMN IF NOT EXISTS tie_breaker_teams JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tie_breaker_question_id UUID,
ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;

-- 3. To allow live_answers cleanup per phase/round, add question_id or round
ALTER TABLE live_answers
ADD COLUMN IF NOT EXISTS round_id INT DEFAULT 0;

-- Optional: Update RLS policies if needed, but since it's just columns, it's fine.