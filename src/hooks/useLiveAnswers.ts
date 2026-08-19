import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LiveAnswer } from '../types';

export function useLiveAnswers() {
  const [liveAnswers, setLiveAnswers] = useState<LiveAnswer[]>([]);

  const fetchAnswers = async () => {
    const { data } = await supabase.from('live_answers').select('*');
    if (data) {
      setLiveAnswers(data as LiveAnswer[]);
    }
  };

  const clearAnswers = async () => {
    // Supprime toutes les lignes
    await supabase.from('live_answers').delete().neq('team_id', 'dummy');
    setLiveAnswers([]);
  };

  useEffect(() => {
    fetchAnswers();

    const hookId = Math.random().toString(36).substring(7);

    const subscription = supabase
      .channel(`live_answers_channel_${hookId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_answers' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setLiveAnswers((current) => {
              const exists = current.find(a => a.team_id === payload.new.team_id);
              if (exists) {
                return current.map(a => a.team_id === payload.new.team_id ? payload.new as LiveAnswer : a);
              }
              return [...current, payload.new as LiveAnswer];
            });
          } else if (payload.eventType === 'DELETE') {
            setLiveAnswers((current) => current.filter(a => a.team_id !== payload.old.team_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return { liveAnswers, clearAnswers };
}
