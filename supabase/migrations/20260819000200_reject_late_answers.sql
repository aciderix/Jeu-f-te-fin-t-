CREATE OR REPLACE FUNCTION public.validate_live_answer_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  started_at timestamptz;
  current_round_id integer;
  round_duration integer;
  game_is_playing boolean;
  results_are_visible boolean;
  tie_breaker_is_active boolean;
BEGIN
  SELECT
    CASE
      WHEN question_started_at IS NULL THEN NULL
      ELSE question_started_at::timestamptz
    END,
    current_round,
    is_playing,
    show_results,
    tie_breaker_mode
  INTO started_at, current_round_id, game_is_playing, results_are_visible, tie_breaker_is_active
  FROM public.game_settings
  WHERE id = 1;

  SELECT duration
  INTO round_duration
  FROM public.questions
  WHERE "order" = current_round_id
    AND phase <> 0
    AND COALESCE(is_bonus, false) = false
  ORDER BY id
  LIMIT 1;

  IF NOT COALESCE(game_is_playing, false)
     OR COALESCE(results_are_visible, true)
     OR COALESCE(tie_breaker_is_active, true)
     OR started_at IS NULL
     OR round_duration IS NULL
     OR clock_timestamp() >= started_at + make_interval(secs => round_duration) THEN
    RAISE EXCEPTION 'La fenêtre de réponse est fermée';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_answers_window_trigger ON public.live_answers;
CREATE TRIGGER live_answers_window_trigger
  BEFORE INSERT OR UPDATE ON public.live_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_live_answer_window();