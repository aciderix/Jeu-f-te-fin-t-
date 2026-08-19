import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TieBreakerSession } from '../types';

const EMPTY_SESSION: TieBreakerSession = {
  id: 1,
  question_id: null,
  tied_team_ids: [],
  saved_team_ids: [],
  failed_team_ids: [],
  buzzed_team_id: null,
  target_spots: 1,
  status: 'cancelled'
};

export function useTieBreakerSession() {
  const [session, setSession] = useState<TieBreakerSession>(EMPTY_SESSION);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data, error } = await supabase
        .from('tie_breaker_sessions')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data && isMounted) {
        setSession(data as TieBreakerSession);
      }
    };

    loadSession();

    const subscription = supabase
      .channel('tie_breaker_session_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tie_breaker_sessions', filter: 'id=eq.1' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSession(EMPTY_SESSION);
          } else if (payload.new) {
            setSession(payload.new as TieBreakerSession);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, []);

  return { tieBreakerSession: session };
}