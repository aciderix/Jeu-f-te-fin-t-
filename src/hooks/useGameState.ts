import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { GameSettings, Team } from '../types';

export function useGameState() {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');

  useEffect(() => {
    // Prevent fetching if Supabase is not properly configured
    if (import.meta.env.VITE_SUPABASE_URL === undefined) {
      setError("Supabase variables not configured");
      setLoading(false);
      return;
    }

    const fetchInitialState = async () => {
      try {
        const [settingsResult, teamsResult] = await Promise.all([
          supabase.from('game_settings').select('*').eq('id', 1).single(),
          supabase.from('teams').select('*').order('id')
        ]);

        if (settingsResult.error) {
           if (settingsResult.error.code === 'PGRST205') {
             throw new Error("Tables non trouvées dans Supabase. Veuillez exécuter le script SQL dans votre projet Supabase.");
           }
           throw settingsResult.error;
        }
        if (teamsResult.error) throw teamsResult.error;

        if (settingsResult.data) setSettings(settingsResult.data as GameSettings);
        if (teamsResult.data) setTeams(teamsResult.data as Team[]);
      } catch (err: any) {
        console.error("Error fetching initial state:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialState();

    // Generate a unique ID for the channels to prevent collisions if the hook is used in multiple components
    const hookId = Math.random().toString(36).substring(7);

    // Subscribe to real-time changes
    const settingsSubscription = supabase
      .channel(`game_settings_channel_${hookId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_settings' },
        (payload) => {
          setSettings(payload.new as GameSettings);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnectionStatus('reconnecting');
      });

    const teamsSubscription = supabase
      .channel(`teams_channel_${hookId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setTeams((currentTeams) =>
              currentTeams.map((team) =>
                team.id === payload.new.id ? (payload.new as Team) : team
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setTeams((currentTeams) => 
              [...currentTeams, payload.new as Team].sort((a, b) => a.id.localeCompare(b.id))
            );
          } else if (payload.eventType === 'DELETE') {
            setTeams((currentTeams) =>
              currentTeams.filter((team) => team.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSubscription);
      supabase.removeChannel(teamsSubscription);
    };
  }, []);

  return { settings, teams, loading, error, connectionStatus };
}
