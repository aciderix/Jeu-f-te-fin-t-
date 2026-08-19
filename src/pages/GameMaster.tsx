import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useGameState } from '../hooks/useGameState';
import { useQuestions } from '../hooks/useQuestions';
import { useLiveAnswers } from '../hooks/useLiveAnswers';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TieBreakerModal } from '../components/gamemaster/TieBreakerModal';
import { PhaseEndModal } from '../components/gamemaster/PhaseEndModal';
import { soundFX } from '../lib/soundEffects';
import { Team } from '../types';
import { useTieBreakerSession } from '../hooks/useTieBreakerSession';
import { isAnswerCorrect } from '../lib/utils';

export default function GameMaster() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'teams'>('controls');

  // Modales de fin de phase et départage
  const [showPhaseEndModal, setShowPhaseEndModal] = useState(false);
  const [showTieBreakerModal, setShowTieBreakerModal] = useState(false);
  const [pendingNextRound, setPendingNextRound] = useState<number | null>(null);

  // État du départage au buzzer
  const [tiedTeams, setTiedTeams] = useState<Team[]>([]);
  const [targetSpots, setTargetSpots] = useState<number>(1);
  const [bonusQuestionIndex, setBonusQuestionIndex] = useState<number>(0);
  const [buzzedTeamId, setBuzzedTeamId] = useState<string | null>(null);
  const [failedTeamIds, setFailedTeamIds] = useState<string[]>([]);
  const [savedTeamIds, setSavedTeamIds] = useState<string[]>([]);

  const { settings, teams, error: gameStateError } = useGameState();
  const { tieBreakerSession } = useTieBreakerSession();
  const { questions } = useQuestions();
  const { liveAnswers, clearAnswers } = useLiveAnswers();

  // Questions régulières et questions bonus
  const regularQuestions = questions.filter(q => q.phase !== 0 && !q.is_bonus);
  const bonusQuestions = questions.filter(q => q.phase === 0 || q.is_bonus);
  const currentBonusQuestion = bonusQuestions.find(q => q.id === tieBreakerSession.question_id)
    || bonusQuestions[bonusQuestionIndex]
    || null;

  const scheduleQuestionStart = async (updates: Record<string, unknown>) => {
    const round = updates.current_round;
    await supabase.from('game_settings').update({
      ...updates,
      question_started_at: null
    }).eq('id', 1);

    window.setTimeout(() => {
      let request = supabase.from('game_settings')
        .update({ question_started_at: new Date().toISOString() })
        .eq('id', 1);
      if (typeof round === 'number') request = request.eq('current_round', round);
      void request.then(() => {});
    }, 1500);
  };

  useEffect(() => {
    if (tieBreakerSession.status !== 'active') return;

    const sessionTeams = teams.filter(team => tieBreakerSession.tied_team_ids.includes(team.id));
    const currentRegularQuestions = questions.filter(q => q.phase !== 0 && !q.is_bonus);
    const currentRegularIndex = settings
      ? currentRegularQuestions.findIndex(question => question.order === settings.current_round)
      : -1;
    const nextRegularQuestion = currentRegularQuestions[currentRegularIndex + 1];
    setTiedTeams(sessionTeams);
    setTargetSpots(tieBreakerSession.target_spots);
    setSavedTeamIds(tieBreakerSession.saved_team_ids);
    setFailedTeamIds(tieBreakerSession.failed_team_ids);
    setBuzzedTeamId(tieBreakerSession.buzzed_team_id);
    setPendingNextRound(nextRegularQuestion?.order || null);
    setShowTieBreakerModal(true);
  }, [tieBreakerSession, teams, settings, questions]);

  // Écoute du canal Realtime buzzer
  useEffect(() => {
    const channel = supabase.channel('buzzer')
      .on('broadcast', { event: 'buzz' }, (payload) => {
        const teamId = payload.payload?.teamId;
        if (!teamId) return;
        
        // Si pas de buzz en cours et que l'équipe n'a pas déjà échoué
        setBuzzedTeamId((current) => {
          if (current) return current;
          soundFX.playBuzzer();
          void supabase.from('tie_breaker_sessions').update({ buzzed_team_id: teamId }).eq('id', 1);
          // Ouvre la modale de validation si elle était fermée
          setShowTieBreakerModal(true);
          return teamId;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === '1234') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setPinCode('');
    }
  };

  // Démarrer la partie
  const handleStartGame = async () => {
    setIsProcessing(true);
    await clearAnswers();
    const firstQuestion = regularQuestions.find(q => q.order === 1) || regularQuestions[0];
    
    await scheduleQuestionStart({
      is_playing: true,
      current_round: firstQuestion ? firstQuestion.order : 1,
      current_phase: firstQuestion ? firstQuestion.phase : 1,
      show_results: false,
      tie_breaker_mode: false,
      winner_team_id: null
    });
    setIsProcessing(false);
  };

  // Révéler et compter les scores
  const handleRevealAndScore = async () => {
    if (!settings) return;
    setIsProcessing(true);
    
    const currentQuestion = questions.find(q => q.order === settings.current_round);
    
    if (currentQuestion) {
      for (const team of teams) {
        if (team.is_eliminated) continue;
        
        const teamAnswer = liveAnswers.find(a => a.team_id === team.id);
        if (teamAnswer) {
          const isCorrect = isAnswerCorrect(teamAnswer.answer, currentQuestion.correct_answer);
          
          if (isCorrect) {
            await supabase.from('teams')
              .update({ score: team.score + 1 })
              .eq('id', team.id);
          }
        }
      }
    }

    await supabase.from('game_settings')
      .update({ show_results: true })
      .eq('id', 1);
      
    setIsProcessing(false);
  };

  // Passer à la manche suivante ou détecter la fin de phase
  const handleNextRound = async () => {
    if (!settings) return;
    setIsProcessing(true);

    const currentQuestion = regularQuestions.find(q => q.order === settings.current_round);
    const currentIndex = regularQuestions.findIndex(q => q.order === settings.current_round);
    const nextQuestion = regularQuestions[currentIndex + 1];

    const isPhaseEnd = !nextQuestion || (currentQuestion && nextQuestion.phase !== currentQuestion.phase);

    if (isPhaseEnd && currentQuestion) {
      // Détection des éliminations ou des égalités
      const { data: latestTeams } = await supabase.from('teams').select('*').order('id');
      const teamsForDecision = (latestTeams as Team[] | null) || teams;
      const activeTeams = teamsForDecision.filter(t => !t.is_eliminated).sort((a, b) => b.score - a.score);
      const phase = currentQuestion.phase;

      if (phase === 1) {
        // Phase 1 : 4 équipes -> 3 qualifiées, 1 éliminée
        // Seuil d'élimination : 3ème vs 4ème
        if (activeTeams.length >= 4 && activeTeams[2].score === activeTeams[3].score) {
          const cutoffScore = activeTeams[2].score;
          const inTie = activeTeams.filter(t => t.score === cutoffScore);
          const safeCount = activeTeams.filter(t => t.score > cutoffScore).length;
          const spots = 3 - safeCount;

          setTiedTeams(inTie);
          setTargetSpots(spots);
          setPendingNextRound(nextQuestion ? nextQuestion.order : settings.current_round + 1);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        } else if (activeTeams.length >= 4) {
          // Pas d'égalité, T4 éliminée
          setTiedTeams([]);
          setPendingNextRound(nextQuestion ? nextQuestion.order : settings.current_round + 1);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        }
      } else if (phase === 2) {
        // Phase 2 : 3 équipes -> 2 qualifiées, 1 éliminée
        // Seuil d'élimination : 2ème vs 3ème
        if (activeTeams.length >= 3 && activeTeams[1].score === activeTeams[2].score) {
          const cutoffScore = activeTeams[1].score;
          const inTie = activeTeams.filter(t => t.score === cutoffScore);
          const safeCount = activeTeams.filter(t => t.score > cutoffScore).length;
          const spots = 2 - safeCount;

          setTiedTeams(inTie);
          setTargetSpots(spots);
          setPendingNextRound(nextQuestion ? nextQuestion.order : settings.current_round + 1);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        } else if (activeTeams.length >= 3) {
          // Pas d'égalité, T3 éliminée
          setTiedTeams([]);
          setPendingNextRound(nextQuestion ? nextQuestion.order : settings.current_round + 1);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        }
      } else if (phase === 3) {
        // Phase 3 : Duel final -> 1 vainqueur
        if (activeTeams.length >= 2 && activeTeams[0].score === activeTeams[1].score) {
          setTiedTeams(activeTeams);
          setTargetSpots(1);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        } else {
          setTiedTeams([]);
          setShowPhaseEndModal(true);
          setIsProcessing(false);
          return;
        }
      }
    }

    // Manche suivante classique dans la même phase
    await clearAnswers();
    const nextRoundIndex = nextQuestion ? nextQuestion.order : settings.current_round + 1;
    
    await scheduleQuestionStart({
      current_round: nextRoundIndex,
      current_phase: nextQuestion ? nextQuestion.phase : settings.current_phase,
      show_results: false,
      tie_breaker_mode: false
    });
    
    setIsProcessing(false);
  };

  // Lancer le départage au buzzer
  const handleLaunchTieBreaker = async () => {
    setShowPhaseEndModal(false);
    setIsProcessing(true);

    const bonusQ = bonusQuestions[0] || null;
    const tiedIds = tiedTeams.map(t => t.id);

    setBonusQuestionIndex(0);
    setFailedTeamIds([]);
    setSavedTeamIds([]);
    setBuzzedTeamId(null);

    await supabase.from('game_settings').update({
      tie_breaker_mode: true,
      tie_breaker_teams: tiedIds,
      tie_breaker_question_id: bonusQ?.id || null
    }).eq('id', 1);

    await supabase.from('tie_breaker_sessions').upsert({
      id: 1,
      question_id: bonusQ?.id || null,
      tied_team_ids: tiedIds,
      saved_team_ids: [],
      failed_team_ids: [],
      buzzed_team_id: null,
      target_spots: targetSpots,
      status: 'active'
    });

    // Broadcast Realtime pour réveiller les écrans
    supabase.channel('buzzer').send({
      type: 'broadcast',
      event: 'start_tie_breaker',
      payload: {
        teamsInTie: tiedIds,
        question: bonusQ,
        targetSpots
      }
    });

    setShowTieBreakerModal(true);
    setIsProcessing(false);
  };

  // Lancer manuellement le départage
  const handleManualTieBreakerStart = async () => {
    setIsProcessing(true);
    const activeTeamsList = teams.filter(t => !t.is_eliminated).sort((a, b) => b.score - a.score);
    const bonusQ = bonusQuestions[0] || null;
    const tiedIds = activeTeamsList.map(t => t.id);

    setTiedTeams(activeTeamsList);
    setTargetSpots(1);
    setBonusQuestionIndex(0);
    setFailedTeamIds([]);
    setSavedTeamIds([]);
    setBuzzedTeamId(null);

    await supabase.from('game_settings').update({
      tie_breaker_mode: true,
      tie_breaker_teams: tiedIds,
      tie_breaker_question_id: bonusQ?.id || null
    }).eq('id', 1);

    await supabase.from('tie_breaker_sessions').upsert({
      id: 1,
      question_id: bonusQ?.id || null,
      tied_team_ids: tiedIds,
      saved_team_ids: [],
      failed_team_ids: [],
      buzzed_team_id: null,
      target_spots: 1,
      status: 'active'
    });

    // Broadcast Realtime pour réveiller les écrans
    supabase.channel('buzzer').send({
      type: 'broadcast',
      event: 'start_tie_breaker',
      payload: {
        teamsInTie: tiedIds,
        question: bonusQ,
        targetSpots: 1
      }
    });

    setShowTieBreakerModal(true);
    setIsProcessing(false);
  };

  // Valider la bonne réponse d'une équipe en départage
  const handleValidateTieAnswer = async (teamId: string) => {
    soundFX.playCorrect();
    const { data: persistedSession } = await supabase
      .from('tie_breaker_sessions')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const persistedTiedIds = Array.isArray(persistedSession?.tied_team_ids)
      ? persistedSession.tied_team_ids as string[]
      : tiedTeams.map(team => team.id);
    const persistedSavedIds = Array.isArray(persistedSession?.saved_team_ids)
      ? persistedSession.saved_team_ids as string[]
      : savedTeamIds;
    const persistedTargetSpots = typeof persistedSession?.target_spots === 'number'
      ? persistedSession.target_spots
      : targetSpots;
    const newSaved = Array.from(new Set([...persistedSavedIds, teamId]));
    setSavedTeamIds(newSaved);
    setBuzzedTeamId(null);

    await supabase.from('tie_breaker_sessions').update({
      saved_team_ids: newSaved,
      failed_team_ids: [],
      buzzed_team_id: null
    }).eq('id', 1);

    // Vérifier si le départage est terminé
    const remainingToEliminate = persistedTiedIds.length - persistedTargetSpots;
    const remainingInTie = persistedTiedIds.filter(teamIdInTie => !newSaved.includes(teamIdInTie));

    if (remainingInTie.length <= remainingToEliminate) {
      // Toutes les places qualificatives sont attribuées !
      // Les équipes restantes dans remainingInTie sont éliminées
      for (const elimTeamId of remainingInTie) {
        await supabase.from('teams').update({ is_eliminated: true }).eq('id', elimTeamId);
      }

      await supabase.from('game_settings').update({
        tie_breaker_mode: false,
        tie_breaker_teams: [],
        tie_breaker_question_id: null
      }).eq('id', 1);

      await supabase.from('tie_breaker_sessions').update({
        saved_team_ids: newSaved,
        failed_team_ids: [],
        buzzed_team_id: null,
        status: 'finished'
      }).eq('id', 1);

      supabase.channel('buzzer').send({
        type: 'broadcast',
        event: 'tie_breaker_finished',
        payload: {
          savedTeamIds: newSaved,
          eliminatedTeamIds: remainingInTie
        }
      });

      setShowTieBreakerModal(false);
      
      // Passer à la phase suivante
      const nextRound = pendingNextRound || (() => {
        const currentRegularIndex = settings
          ? regularQuestions.findIndex(question => question.order === settings.current_round)
          : -1;
        return regularQuestions[currentRegularIndex + 1]?.order || null;
      })();

      if (nextRound) {
        await clearAnswers();
        const nextQ = regularQuestions.find(q => q.order === nextRound);
        await scheduleQuestionStart({
          current_round: nextRound,
          current_phase: nextQ ? nextQ.phase : (settings ? settings.current_phase + 1 : 1),
          show_results: false
        });
      } else if (settings?.current_phase === 3) {
        // Fin de la finale
        const winnerId = newSaved[0] || teamId;
        await supabase.from('game_settings').update({
          current_phase: 4,
          show_results: true,
          winner_team_id: winnerId
        }).eq('id', 1);
      }
    } else {
      // Encore des places à attribuer, passer à la photo suivante
      handleNextBonusQuestion();
    }
  };

  // Refuser la réponse (mauvaise réponse)
  const handleRejectTieAnswer = async (teamId: string) => {
    soundFX.playWrong();
    const newFailed = [...failedTeamIds, teamId];
    setFailedTeamIds(newFailed);
    setBuzzedTeamId(null);

    await supabase.from('tie_breaker_sessions').update({
      failed_team_ids: newFailed,
      buzzed_team_id: null
    }).eq('id', 1);

    supabase.channel('buzzer').send({
      type: 'broadcast',
      event: 'buzz_rejected',
      payload: {
        failedTeamId: teamId,
        failedTeamIds: newFailed
      }
    });
  };

  // Passer à la photo bonus suivante
  const handleNextBonusQuestion = async () => {
    const persistedIndex = bonusQuestions.findIndex(question => question.id === tieBreakerSession.question_id);
    const currentIndex = persistedIndex >= 0 ? persistedIndex : bonusQuestionIndex;
    const nextIndex = (currentIndex + 1) % (bonusQuestions.length || 1);
    setBonusQuestionIndex(nextIndex);
    setFailedTeamIds([]);
    setBuzzedTeamId(null);

    const nextBonusQ = bonusQuestions[nextIndex] || null;
    await supabase.from('tie_breaker_sessions').update({
      question_id: nextBonusQ?.id || null,
      failed_team_ids: [],
      buzzed_team_id: null
    }).eq('id', 1);
    if (nextBonusQ) {
      supabase.channel('buzzer').send({
        type: 'broadcast',
        event: 'next_bonus_question',
        payload: {
          question: nextBonusQ
        }
      });
    }
  };

  // Confirmer le passage à la phase suivante (sans égalité)
  const handleConfirmNextPhaseWithoutTie = async () => {
    if (!settings) return;

    const { data: latestTeams } = await supabase.from('teams').select('*').order('id');
    const teamsForDecision = (latestTeams as Team[] | null) || teams;
    const currentPhaseTeams = teamsForDecision.filter(t => !t.is_eliminated).sort((a, b) => b.score - a.score);
    const phase = settings.current_phase;
    const tieRequiresBuzzer = (phase === 1 && currentPhaseTeams.length >= 4 && currentPhaseTeams[2].score === currentPhaseTeams[3].score)
      || (phase === 2 && currentPhaseTeams.length >= 3 && currentPhaseTeams[1].score === currentPhaseTeams[2].score)
      || (phase === 3 && currentPhaseTeams.length >= 2 && currentPhaseTeams[0].score === currentPhaseTeams[1].score);

    if (tieRequiresBuzzer) {
      const cutoffIndex = phase === 1 ? 2 : phase === 2 ? 1 : 0;
      const cutoffScore = currentPhaseTeams[cutoffIndex]?.score;
      const tied = currentPhaseTeams.filter(team => team.score === cutoffScore);
      setTiedTeams(tied);
      setTargetSpots(phase === 1 ? 3 - currentPhaseTeams.filter(team => team.score > cutoffScore).length : phase === 2 ? 2 - currentPhaseTeams.filter(team => team.score > cutoffScore).length : 1);
      setShowPhaseEndModal(true);
      return;
    }

    setShowPhaseEndModal(false);
    setIsProcessing(true);

    const activeTeams = currentPhaseTeams;

    // Élimination de l'équipe au score le plus bas
    if (phase === 1 && activeTeams.length >= 4) {
      await supabase.from('teams').update({ is_eliminated: true }).eq('id', activeTeams[3].id);
    } else if (phase === 2 && activeTeams.length >= 3) {
      await supabase.from('teams').update({ is_eliminated: true }).eq('id', activeTeams[2].id);
    }

    if (phase < 3 && pendingNextRound) {
      await clearAnswers();
      const nextQ = regularQuestions.find(q => q.order === pendingNextRound);
      await scheduleQuestionStart({
        current_round: pendingNextRound,
        current_phase: nextQ ? nextQ.phase : phase + 1,
        show_results: false,
        tie_breaker_mode: false,
        winner_team_id: null
      });
    } else if (phase === 3 && activeTeams.length > 0) {
      const winner = activeTeams[0];
      await supabase.from('teams').update({ is_eliminated: true }).neq('id', winner.id);
      await supabase.from('game_settings').update({
        current_phase: 4,
        show_results: true,
        tie_breaker_mode: false,
        winner_team_id: winner.id,
        question_started_at: new Date().toISOString()
      }).eq('id', 1);
    }

    setIsProcessing(false);
  };

  // Réinitialiser la partie
  const executeRestartGame = async () => {
    setIsProcessing(true);
    await supabase.from('teams').update({ score: 0, is_eliminated: false }).neq('id', 'dummy');
    await clearAnswers();

    await supabase.from('game_settings').update({
      is_playing: false,
      current_round: 1,
      current_phase: 1,
      show_results: false,
      tie_breaker_mode: false,
      tie_breaker_teams: [],
      tie_breaker_question_id: null,
      question_started_at: null,
      winner_team_id: null
    }).eq('id', 1);

    await supabase.from('tie_breaker_sessions').update({
      question_id: null,
      tied_team_ids: [],
      saved_team_ids: [],
      failed_team_ids: [],
      buzzed_team_id: null,
      target_spots: 1,
      status: 'cancelled'
    }).eq('id', 1);

    setShowResetModal(false);
    setShowPhaseEndModal(false);
    setShowTieBreakerModal(false);
    setIsProcessing(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-8 text-center relative overflow-hidden">
        <div className="w-full max-w-xs mb-8 drop-shadow-2xl">
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="Logo" 
            className="w-full h-auto object-contain max-h-[20vh] animate-pulse"
          />
        </div>
        
        <h1 className="text-3xl md:text-5xl text-white font-sans font-bold mb-8 uppercase drop-shadow-xl tracking-widest">Maître du Jeu</h1>
        
        <form onSubmit={handleLogin} className="bg-black/60 p-10 rounded-3xl border-4 border-purple-600/60 w-full max-w-md text-center shadow-2xl backdrop-blur-md z-10">
          <p className="text-2xl text-white mb-8 font-sans font-bold drop-shadow-md">Accès Restreint</p>
          <div className="mb-8">
            <input 
              type="password" 
              value={pinCode} 
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full text-center text-4xl tracking-[0.5em] p-6 rounded-2xl bg-white/10 border-2 border-white/20 text-white outline-none focus:border-purple-500 focus:bg-white/20 transition-all shadow-inner font-sans"
              placeholder="••••"
              autoFocus
            />
            {authError && <p className="text-red-400 font-sans mt-3 text-sm font-bold bg-red-900/40 py-2 rounded">❌ Code PIN incorrect</p>}
          </div>
          <button type="submit" className="w-full relative overflow-hidden bg-gradient-to-b from-purple-500 to-purple-800 border-purple-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(88,28,135),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(88,28,135),0_5px_10px_rgba(0,0,0,0.5)] hover:from-purple-400 hover:to-purple-700 text-white font-paytone text-2xl py-5 rounded-3xl border-2 border-b-4 transition-all active:translate-y-1 uppercase tracking-wider">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
            <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Prendre le contrôle</span>
          </button>
        </form>

        <div className="mt-12">
          <Link to="/" className="text-white/60 hover:text-white underline text-xl transition-colors font-sans px-6 py-3 rounded-xl hover:bg-white/10">Retour au Hub</Link>
        </div>
      </div>
    );
  }

  const currentQuestion = settings ? questions.find(q => q.order === settings.current_round) : null;
  const activeTeams = teams.filter(t => !t.is_eliminated).sort((a, b) => b.score - a.score);
  const eliminatedTeam = activeTeams.length > 0 ? activeTeams[activeTeams.length - 1] : null;
  const winnerTeam = activeTeams.length > 0 ? activeTeams[0] : null;
  const hasTie = tiedTeams.length > 0;
  const buzzedTeam = teams.find(t => t.id === buzzedTeamId) || null;
  const answeredActiveTeamCount = liveAnswers.filter(answer => activeTeams.some(team => team.id === answer.team_id)).length;
  const allActiveTeamsAnswered = activeTeams.length > 0 && answeredActiveTeamCount >= activeTeams.length;
  const regularQuestionsForDisplay = questions.filter(q => q.phase !== 0 && !q.is_bonus);
  const currentRegularIndex = currentQuestion
    ? regularQuestionsForDisplay.findIndex(question => question.order === currentQuestion.order)
    : -1;
  const nextRegularQuestion = regularQuestionsForDisplay[currentRegularIndex + 1];
  const isCurrentPhaseEnding = Boolean(currentQuestion && (!nextRegularQuestion || nextRegularQuestion.phase !== currentQuestion.phase));

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-black/40 p-4 md:px-8 md:py-6 rounded-2xl border-2 border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white shadow-[0_4px_0_rgb(107,33,168)]">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl text-3d-yellow uppercase m-0">Tableau de bord MDJ</h1>
            <p className="text-xs text-white/50 font-sans">
              {bonusQuestions.length} question(s) bonus disponible(s) en réserve
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {settings?.tie_breaker_mode && (
            <button
              onClick={() => setShowTieBreakerModal(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold font-sans px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-2 animate-pulse"
            >
              <span>⚡</span> Ouvrir Départage Buzzer
            </button>
          )}

          <button 
            onClick={() => setShowResetModal(true)}
            className="flex items-center justify-center bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-white p-3 rounded-xl transition-colors shadow-lg"
            title="Annuler et réinitialiser la partie"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
          <Link to="/" className="text-white flex items-center font-bold font-sans bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl border border-white/20 transition-all shadow-lg">
            Quitter
          </Link>
        </div>
      </div>

      {gameStateError && (
        <div className="w-full max-w-7xl mb-8 bg-red-900/50 border border-red-500 p-6 rounded-xl text-left font-sans text-white">
          <h3 className="font-bold text-xl mb-2">Erreur DB</h3>
          <p>{gameStateError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="w-full max-w-7xl flex justify-center gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('controls')} 
          className={`flex-1 md:flex-none px-6 md:px-12 py-4 rounded-full font-paytone text-lg md:text-xl transition-all border-2 ${activeTab === 'controls' ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
        >
          Contrôles
        </button>
        <button 
          onClick={() => setActiveTab('teams')} 
          className={`flex-1 md:flex-none px-6 md:px-12 py-4 rounded-full font-paytone text-lg md:text-xl transition-all border-2 relative ${activeTab === 'teams' ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
        >
          État des Équipes
          {liveAnswers.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-sans font-bold w-6 h-6 flex items-center justify-center rounded-full animate-pulse border-2 border-white shadow-lg">
              {liveAnswers.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-7xl flex flex-col gap-8">
        
        {/* Vue Contrôles */}
        {activeTab === 'controls' && (
          <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
          <div className="bg-black/40 p-6 rounded-3xl border-2 border-white/20 shadow-xl">
            <h2 className="text-2xl text-white font-paytone mb-6">Contrôles</h2>

            {settings?.is_playing && !settings.show_results && (
              <div className="mb-5 rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Réponses reçues</p>
                <p className="font-paytone text-xl text-yellow-300">{answeredActiveTeamCount} / {activeTeams.length} équipes en jeu</p>
              </div>
            )}

            {settings?.is_playing && !settings.show_results && allActiveTeamsAnswered && (
              <div className="mb-5 rounded-2xl border-2 border-green-400/70 bg-green-950/50 p-4 text-center shadow-[0_0_20px_rgba(74,222,128,0.2)]">
                <p className="font-paytone text-xl uppercase tracking-wider text-green-300">Toutes les équipes ont répondu</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/70">{answeredActiveTeamCount} / {activeTeams.length} réponses · Révéler les résultats quand vous êtes prêt</p>
              </div>
            )}

            {settings?.is_playing && settings.show_results && isCurrentPhaseEnding && (
              <div className="mb-5 rounded-2xl border-2 border-yellow-400/70 bg-yellow-950/40 p-4 text-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <p className="font-paytone text-xl uppercase tracking-wider text-yellow-300">Phase {currentQuestion?.phase} terminée</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/75">Clôturez la phase pour confirmer le classement. En cas d’égalité, le départage au buzzer sera proposé.</p>
              </div>
            )}
            
            {!settings?.is_playing ? (
              <button 
                onClick={handleStartGame}
                disabled={isProcessing}
                className="w-full relative overflow-hidden bg-gradient-to-b from-green-400 to-green-700 border-green-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(20,83,45),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(20,83,45),0_5px_10px_rgba(0,0,0,0.5)] hover:from-green-300 hover:to-green-600 text-white text-2xl font-paytone py-6 rounded-3xl border-2 border-b-4 uppercase tracking-wider transition-all active:translate-y-1 disabled:opacity-50"
              >
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Démarrer la partie</span>
              </button>
            ) : (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleRevealAndScore}
                  disabled={isProcessing || settings.show_results}
                  className="w-full relative overflow-hidden bg-gradient-to-b from-yellow-400 to-yellow-600 border-yellow-800 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(133,77,14),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(133,77,14),0_5px_10px_rgba(0,0,0,0.5)] hover:from-yellow-300 hover:to-yellow-500 text-white text-xl font-paytone py-5 rounded-3xl border-2 border-b-4 uppercase tracking-wider transition-all active:translate-y-1 disabled:opacity-50"
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                  <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Révéler & Attribuer</span>
                </button>
                
                <button 
                  onClick={handleNextRound}
                  disabled={isProcessing || !settings.show_results}
                  className="w-full relative overflow-hidden bg-gradient-to-b from-blue-400 to-blue-700 border-blue-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(30,58,138),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(30,58,138),0_5px_10px_rgba(0,0,0,0.5)] hover:from-blue-300 hover:to-blue-600 text-white text-xl font-paytone py-5 rounded-3xl border-2 border-b-4 uppercase tracking-wider transition-all active:translate-y-1 disabled:opacity-50"
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                  <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{isCurrentPhaseEnding ? 'Clôturer la phase' : 'Manche Suivante ⏭'}</span>
                </button>

                <div className="h-px bg-white/10 my-2"></div>

                <button 
                  onClick={() => {
                    if (settings.tie_breaker_mode) {
                      if (window.confirm("Êtes-vous sûr de vouloir annuler le départage en cours ? Cette action est irréversible.")) {
                        supabase.from('game_settings').update({ tie_breaker_mode: false, tie_breaker_teams: [], tie_breaker_question_id: null }).eq('id', 1);
                        supabase.from('tie_breaker_sessions').update({ status: 'cancelled' }).eq('id', 1);
                      }
                    } else {
                      handleManualTieBreakerStart();
                    }
                  }}
                  disabled={isProcessing}
                  className={`w-full relative overflow-hidden ${settings.tie_breaker_mode ? 'bg-gradient-to-b from-red-400 to-red-700 border-red-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(153,27,27),0_10px_20px_rgba(0,0,0,0.5)] hover:from-red-300 hover:to-red-600' : 'bg-gradient-to-b from-gray-500 to-gray-800 border-gray-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(31,41,55),0_10px_20px_rgba(0,0,0,0.5)] hover:from-gray-400 hover:to-gray-700'} text-white text-lg font-paytone py-4 rounded-3xl border-2 border-b-4 uppercase transition-all active:translate-y-1 disabled:opacity-50`}
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                  <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    {settings.tie_breaker_mode ? "Arrêter le Mode Buzzer" : "⚡ Lancer un Départage Manuel au Buzzer"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Détails de la question en cours */}
          {settings?.is_playing && currentQuestion && (
            <div className="bg-black/40 p-6 rounded-3xl border-2 border-white/20 shadow-xl font-sans text-left">
              <h2 className="text-xl text-yellow-400 font-paytone mb-4">Manche #{settings.current_round} - Phase {settings.current_phase}</h2>
              <div className="bg-white/10 rounded-xl overflow-hidden mb-4 border border-white/10 relative">
                {currentQuestion.photo_url ? (
                  <img src={currentQuestion.photo_url} alt="Secret" className="w-full aspect-video object-cover filter blur-sm hover:blur-none transition-all duration-500" />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center text-white/50">Pas d'image</div>
                )}
                <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-xs text-white">Survolez pour voir net</div>
              </div>
              <div className="bg-green-900/40 border border-green-500/50 p-4 rounded-xl">
                <span className="block text-green-300 text-sm font-bold uppercase mb-1">Bonne Réponse Attendue :</span>
                <span className="text-2xl text-white font-bold">{currentQuestion.correct_answer}</span>
              </div>
            </div>
          )}
        </div>
        )}

        {activeTab === 'teams' && (
          <div className="w-full max-w-4xl mx-auto bg-black/40 p-4 md:p-6 rounded-3xl border-2 border-white/20 shadow-xl flex flex-col h-[70vh] min-h-[500px]">
            <h2 className="text-xl md:text-2xl text-white font-paytone mb-4 md:mb-6 flex items-center justify-between">
              <span>État des Équipes</span>
              <span className="text-xs md:text-sm font-sans font-normal bg-blue-600/30 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30">
                {liveAnswers.length} Réponse(s)
              </span>
            </h2>
            
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            {teams.map(team => {
              const teamAnswer = liveAnswers.find(a => a.team_id === team.id);
              const isEliminated = team.is_eliminated;
              
              const teamColor = 
                team.id === 'A' ? 'bg-blue-600 text-white' :
                team.id === 'B' ? 'bg-red-600 text-white' :
                team.id === 'C' ? 'bg-green-600 text-white' : 'bg-purple-600 text-white';

              let borderClass = 'border-white/10';
              let statusText = 'En attente...';
              let statusColor = 'text-gray-400';

              if (isEliminated) {
                statusText = 'Éliminée';
                borderClass = 'border-gray-700 bg-gray-900/50 opacity-50 grayscale';
              } else if (teamAnswer) {
                borderClass = 'border-blue-500 bg-blue-900/20';
                statusText = 'A répondu !';
                statusColor = 'text-blue-400 font-bold';
              }

              return (
                <div key={team.id} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${borderClass}`}>
                  <div className={`w-14 h-14 rounded-full flex flex-shrink-0 items-center justify-center text-2xl font-paytone shadow-inner border-2 border-white/20 ${teamColor}`}>
                    {team.id}
                  </div>
                  
                  <div className="flex-1 font-sans">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-bold text-lg">{team.name || `Équipe ${team.id}`}</span>
                      
                      {/* Contrôle manuel du score */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => supabase.from('teams').update({ score: Math.max(0, team.score - 1) }).eq('id', team.id)}
                          className="w-6 h-6 bg-red-500/20 hover:bg-red-500/50 border border-red-500 rounded text-red-300 font-bold flex items-center justify-center"
                        >-</button>
                        <span className="text-white/60 text-sm">Score: <strong className="text-yellow-400 text-xl">{team.score}</strong></span>
                        <button 
                          onClick={() => supabase.from('teams').update({ score: team.score + 1 }).eq('id', team.id)}
                          className="w-6 h-6 bg-green-500/20 hover:bg-green-500/50 border border-green-500 rounded text-green-300 font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center bg-black/50 p-3 rounded-lg border border-white/5">
                      <span className={`${statusColor} text-sm`}>{statusText}</span>
                      
                      {teamAnswer && (
                         <div className="text-right">
                           <span className="block text-xs text-white/50 mb-0.5">{teamAnswer.time_taken.toFixed(1)}s</span>
                           <span className={`font-bold text-lg ${settings?.show_results ? (
                             isAnswerCorrect(teamAnswer.answer, currentQuestion?.correct_answer || '')
                             ? 'text-green-400' : 'text-red-400'
                           ) : 'text-white'}`}>
                             {settings?.show_results || settings?.tie_breaker_mode ? teamAnswer.answer : '••••••••'}
                           </span>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}

      </div>

      {/* Modale de fin de phase / confirmation d'élimination ou égalité */}
      <PhaseEndModal 
        isOpen={showPhaseEndModal}
        phase={settings?.current_phase || 1}
        hasTie={hasTie}
        tiedTeams={tiedTeams}
        eliminatedTeam={eliminatedTeam}
        winnerTeam={winnerTeam}
        onLaunchTieBreaker={handleLaunchTieBreaker}
        onConfirmNextPhase={handleConfirmNextPhaseWithoutTie}
        onCancel={() => setShowPhaseEndModal(false)}
      />

      {/* Modale de contrôle en direct du départage au buzzer */}
      <TieBreakerModal 
        isOpen={showTieBreakerModal}
        tiedTeams={tiedTeams.length > 0 ? tiedTeams : activeTeams}
        targetSpots={targetSpots}
        bonusQuestion={currentBonusQuestion}
        buzzedTeam={buzzedTeam}
        failedTeamIds={failedTeamIds}
        savedTeamIds={savedTeamIds}
        onValidate={handleValidateTieAnswer}
        onReject={handleRejectTieAnswer}
        onNextQuestion={handleNextBonusQuestion}
        onClose={() => setShowTieBreakerModal(false)}
      />

      {/* Modale de réinitialisation complète */}
      <ConfirmModal 
        isOpen={showResetModal}
        title="⚠️ Attention ⚠️"
        message="Êtes-vous sûr de vouloir ANNULER ET RÉINITIALISER TOUTE LA PARTIE ? Les scores seront remis à 0."
        onConfirm={executeRestartGame}
        onCancel={() => setShowResetModal(false)}
        confirmText="Oui, réinitialiser"
        cancelText="Non, annuler"
      />
    </div>
  );
}
