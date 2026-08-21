import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import { useGameState } from '../hooks/useGameState';
import { useQuestions } from '../hooks/useQuestions';
import { useLiveAnswers } from '../hooks/useLiveAnswers';
import { audioManager } from '../lib/soundEffects';
import { Question } from '../types';
import { useTieBreakerSession } from '../hooks/useTieBreakerSession';

import { getDeterministicChoices, isAnswerCorrect } from '../lib/utils';
import { GameSequenceState, SEQUENCE_DURATIONS } from '../lib/gameSequence';

type RoundStatus = 'intro' | 'active' | 'time_up' | 'reveal' | 'phase_summary' | 'finale' | 'tie_breaker' | 'waiting_start';

interface ScoreCountUpProps {
  start: number;
  target: number;
  active: boolean;
}

function ScoreCountUp({ start, target, active }: ScoreCountUpProps) {
  const [displayScore, setDisplayScore] = useState(start);

  useEffect(() => {
    if (!active || start >= target) {
      setDisplayScore(target);
      return;
    }

    setDisplayScore(start);
    const step = Math.max(1, Math.ceil((target - start) / 12));
    const timer = window.setInterval(() => {
      setDisplayScore(current => {
        const next = Math.min(target, current + step);
        if (next >= target) window.clearInterval(timer);
        return next;
      });
    }, 45);

    return () => window.clearInterval(timer);
  }, [active, start, target]);

  return <>{displayScore}</>;
}

export default function Display() {
  const { settings, teams, connectionStatus } = useGameState();
  const { tieBreakerSession } = useTieBreakerSession();
  const { questions } = useQuestions();
  const { liveAnswers } = useLiveAnswers();
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [buzzWinner, setBuzzWinner] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [rejectedNotice, setRejectedNotice] = useState<string | null>(null);
  const [currentBonusQuestion, setCurrentBonusQuestion] = useState<Question | null>(null);
  const [tiedTeamIds, setTiedTeamIds] = useState<string[]>([]);
  const [savedTeamIds, setSavedTeamIds] = useState<string[]>([]);
  const [failedTeamIds, setFailedTeamIds] = useState<string[]>([]);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [roundStatus, setRoundStatus] = useState<RoundStatus>('intro');
  const [revealFrozen, setRevealFrozen] = useState(false);
  const [sequenceNow, setSequenceNow] = useState(() => Date.now());
  
  const lastCountdownMarkRef = useRef<number | null>(null);
  const lastTimeUpRoundRef = useRef<number | null>(null);
  const lastRevealQuestionRef = useRef<string | null>(null);
  const lastPhaseSummaryQuestionRef = useRef<string | null>(null);
  const finalePlayedRef = useRef(false);
  const lastSequenceAudioRef = useRef<string | null>(null);
  

  // Sync with settings if reloaded
  useEffect(() => {
    setTiedTeamIds(tieBreakerSession.tied_team_ids);
    setSavedTeamIds(tieBreakerSession.saved_team_ids);
    setFailedTeamIds(tieBreakerSession.failed_team_ids);
    setBuzzWinner(tieBreakerSession.buzzed_team_id);
  }, [tieBreakerSession]);

  // Horloge de rendu : elle n'invente aucune transition, elle rend uniquement
  // les échéances centralisées dans Supabase.
  useEffect(() => {
    if (!settings?.sequence_started_at && !settings?.question_started_at) return;
    setSequenceNow(Date.now());
    const timer = window.setInterval(() => setSequenceNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [settings?.sequence_started_at, settings?.question_started_at]);

  const regularQuestions = questions.filter(q => q.phase !== 0 && !q.is_bonus);
  const bonusQuestions = questions.filter(q => q.phase === 0 || q.is_bonus);

  const currentQuestion = settings ? regularQuestions.find(q => q.order === settings.current_round) : null;
  const activeTeams = teams.filter(team => !team.is_eliminated).sort((a, b) => b.score - a.score);
  const phaseStandings = [...teams].sort((a, b) => b.score - a.score);
  const answeredActiveTeamCount = liveAnswers.filter(answer => activeTeams.some(team => team.id === answer.team_id)).length;
  const allActiveTeamsAnswered = activeTeams.length > 0 && answeredActiveTeamCount >= activeTeams.length;

  const currentRegularIndex = currentQuestion
    ? regularQuestions.findIndex(question => question.id === currentQuestion.id)
    : -1;
  const isPhaseEnd = currentQuestion
    ? !regularQuestions[currentRegularIndex + 1] || regularQuestions[currentRegularIndex + 1].phase !== currentQuestion.phase
    : false;
  const currentBonusIndex = currentBonusQuestion
    ? bonusQuestions.findIndex(question => question.id === currentBonusQuestion.id)
    : -1;

  const isFinale = settings?.current_phase === 4;
  const databaseSequence = settings?.sequence_state as GameSequenceState | undefined;
  const sequenceElapsed = settings?.sequence_started_at
    ? Math.max(0, sequenceNow - new Date(settings.sequence_started_at).getTime())
    : 0;
  const questionStartedAt = settings?.question_started_at
    ? new Date(settings.question_started_at).getTime()
    : null;
  const questionExpired = Boolean(
    currentQuestion
    && questionStartedAt
    && sequenceNow >= questionStartedAt + currentQuestion.duration * 1_000
  );

  // Aucun écran ne décide lui-même de la prochaine transition : tous lisent le même
  // état et le même horodatage dans Supabase.
  const synchronizedSequence: GameSequenceState | 'time_up' | null = (() => {
    if (!databaseSequence) return null;
    if (databaseSequence === 'game_start') {
      if (sequenceElapsed < SEQUENCE_DURATIONS.game_start) return 'game_start';
      if (sequenceElapsed < SEQUENCE_DURATIONS.game_start + SEQUENCE_DURATIONS.phase_intro) return 'phase_intro';
      if (sequenceElapsed < SEQUENCE_DURATIONS.game_start + SEQUENCE_DURATIONS.phase_intro + SEQUENCE_DURATIONS.round_intro) return 'round_intro';
      return questionExpired ? 'time_up' : 'active';
    }
    if (databaseSequence === 'phase_intro') {
      if (sequenceElapsed < SEQUENCE_DURATIONS.phase_intro) return 'phase_intro';
      if (sequenceElapsed < SEQUENCE_DURATIONS.phase_intro + SEQUENCE_DURATIONS.round_intro) return 'round_intro';
      return questionExpired ? 'time_up' : 'active';
    }
    if (databaseSequence === 'round_intro') {
      return sequenceElapsed < SEQUENCE_DURATIONS.round_intro ? 'round_intro' : (questionExpired ? 'time_up' : 'active');
    }
    return databaseSequence === 'active' && questionExpired ? 'time_up' : databaseSequence;
  })();

  const displayStatus = synchronizedSequence
    ?? (isFinale
      ? 'finale'
      : settings?.tie_breaker_mode
        ? 'tie_breaker'
        : roundStatus);

  useEffect(() => {
    if (!databaseSequence || !settings?.sequence_started_at) return;
    const sequenceKey = `${databaseSequence}:${settings.sequence_started_at}`;
    if (lastSequenceAudioRef.current === sequenceKey) return;

    lastSequenceAudioRef.current = sequenceKey;
    if (databaseSequence === 'game_start') {
      audioManager.playStart();
    } else if (databaseSequence === 'phase_intro' || databaseSequence === 'round_intro') {
      audioManager.playNewRound();
    }
  }, [databaseSequence, settings?.sequence_started_at]);

  const phaseLabel = currentQuestion?.phase === 1
    ? 'PHASE 1 - 2 PROPOSITIONS'
    : currentQuestion?.phase === 2
    ? 'PHASE 2 - 4 PROPOSITIONS'
    : 'PHASE 3 - REPONSE LIBRE';
  const instructionLabel = currentQuestion?.phase === 1
    ? 'Choisissez parmi les 2 réponses'
    : currentQuestion?.phase === 2
    ? 'Choisissez parmi les 4 réponses'
    : 'Réponse libre sur les téléphones';
  const formattedTime = `00:${Math.max(0, Math.ceil(timeLeft)).toString().padStart(2, '0')}`;
  const activeTieTeamCount = tiedTeamIds.filter(teamId => !savedTeamIds.includes(teamId)).length;
  const correctTeamIds = currentQuestion
    ? liveAnswers
      .filter(answer => isAnswerCorrect(answer.answer, currentQuestion.correct_answer))
      .map(answer => answer.team_id)
    : [];
  const phaseTie = currentQuestion?.phase === 1 && activeTeams.length >= 4
    ? activeTeams[2].score === activeTeams[3].score
    : currentQuestion?.phase === 2 && activeTeams.length >= 3
    ? activeTeams[1].score === activeTeams[2].score
    : currentQuestion?.phase === 3 && activeTeams.length >= 2
    ? activeTeams[0].score === activeTeams[1].score
    : false;
  const phaseEliminated = currentQuestion?.phase === 1 && activeTeams.length >= 4
    ? activeTeams[3]
    : currentQuestion?.phase === 2 && activeTeams.length >= 3
    ? activeTeams[2]
    : null;
  const phaseQualifiedTeams = phaseEliminated
    ? activeTeams.filter(team => team.id !== phaseEliminated.id)
    : activeTeams;
  const phaseWinner = currentQuestion?.phase === 3 && !phaseTie ? activeTeams[0] : null;
  const phaseTiedTeams = currentQuestion?.phase === 1 && activeTeams.length >= 4 && phaseTie
    ? activeTeams.filter(team => team.score === activeTeams[2].score)
    : currentQuestion?.phase === 2 && activeTeams.length >= 3 && phaseTie
    ? activeTeams.filter(team => team.score === activeTeams[1].score)
    : currentQuestion?.phase === 3 && activeTeams.length >= 2 && phaseTie
    ? activeTeams.filter(team => team.score === activeTeams[0].score)
    : [];
  const roundStatusLabel: Record<RoundStatus, string> = {
    intro: 'PRÉPAREZ-VOUS',
    active: 'EN JEU',
    time_up: 'TEMPS ÉCOULÉ',
    reveal: 'RÉVÉLATION',
    phase_summary: 'FIN DE PHASE',
    finale: 'GRANDE FINALE',
    tie_breaker: 'DÉPARTAGE EN COURS',
    waiting_start: 'EN ATTENTE'
  };

  // Question bonus active
  useEffect(() => {
    if (settings?.tie_breaker_mode) {
      const persistedQuestion = bonusQuestions.find(q => q.id === tieBreakerSession.question_id);
      setCurrentBonusQuestion(persistedQuestion || bonusQuestions[0] || null);
    }
  }, [settings?.tie_breaker_mode, bonusQuestions, tieBreakerSession.question_id]);

  useEffect(() => {
    setImageLoadError(false);
    setImageLoading(Boolean(currentQuestion?.photo_url || currentBonusQuestion?.photo_url));
  }, [currentQuestion?.id, currentBonusQuestion?.id]);

  // État de secours pour une ancienne partie ne possédant pas encore
  // sequence_state. Les séquences récentes sont rendues directement depuis Supabase.
  useEffect(() => {
    if (!settings || settings.sequence_state) return;

    if (settings.current_phase === 4) {
      setRoundStatus('finale');
    } else if (settings.tie_breaker_mode) {
      setRoundStatus('tie_breaker');
    } else if (settings.show_results) {
      setRoundStatus('reveal');
    } else if (settings.question_started_at) {
      setRoundStatus('active');
    } else {
      setRoundStatus('waiting_start');
    }
  }, [settings?.sequence_state, settings?.current_phase, settings?.tie_breaker_mode, settings?.show_results, settings?.question_started_at]);

  useEffect(() => {
    if (settings?.tie_breaker_mode || settings?.current_phase === 4) return;

    if (settings?.show_results && roundStatus !== 'phase_summary') {
      setRoundStatus('reveal');
    } else if (!settings?.show_results && roundStatus === 'reveal') {
      setRoundStatus('active');
    }
  }, [settings?.show_results, settings?.tie_breaker_mode, settings?.current_phase, roundStatus]);

  useEffect(() => {
    if (roundStatus !== 'active' || timeLeft > 0 || settings?.show_results || !settings?.question_started_at) return;
    setRoundStatus('time_up');
  }, [roundStatus, timeLeft, settings?.show_results, settings?.question_started_at]);

  useEffect(() => {
    if (displayStatus !== 'reveal') {
      setRevealFrozen(false);
      return;
    }

    setRevealFrozen(true);
    const freezeTimer = window.setTimeout(() => setRevealFrozen(false), 200);
    return () => window.clearTimeout(freezeTimer);
  }, [displayStatus]);

  // Le passage à phase_summary ne se fait plus automatiquement.
  // Il est déclenché par un état explicite 'phase_summary' enregistré dans game_settings,
  // ou en déduisant que is_playing est false alors qu'on vient de terminer une phase.
  useEffect(() => {
    if (isPhaseEnd && settings?.show_results && settings?.is_playing === false && !settings?.tie_breaker_mode && settings?.current_phase < 4) {
      setRoundStatus('phase_summary');
    }
  }, [isPhaseEnd, settings?.show_results, settings?.is_playing, settings?.tie_breaker_mode, settings?.current_phase]);

  useEffect(() => {
    if (!settings?.is_playing || !currentQuestion || settings.tie_breaker_mode) return;
    // Le son de nouvelle manche est désormais géré par les séquences de transition.
    lastCountdownMarkRef.current = null;
    lastTimeUpRoundRef.current = null;
    lastRevealQuestionRef.current = null;
    lastPhaseSummaryQuestionRef.current = null;
  }, [currentQuestion?.id, settings?.is_playing, settings?.tie_breaker_mode]);

  useEffect(() => {
    audioManager.configureMusic(settings?.bg_audio_url, settings?.suspense_audio_url);
    const isWaiting = !settings?.is_playing;
    const isThinking = settings?.is_playing && !settings?.show_results && !settings?.tie_breaker_mode;
    audioManager.setMusicMode(isWaiting ? 'ambient' : isThinking ? 'suspense' : 'none');
  }, [settings?.bg_audio_url, settings?.suspense_audio_url, settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode]);

  useEffect(() => {
        if (displayStatus === 'active' && timeLeft > 0) {
      const seconds = Math.ceil(timeLeft);
      const shouldTick = seconds <= 5 || (seconds <= 10 && seconds % 2 === 0);
      if (shouldTick && lastCountdownMarkRef.current !== seconds) {
        lastCountdownMarkRef.current = seconds;
        audioManager.playCountdownTick(seconds <= 5);
      }
    } else {
      // Empêche un fichier tick.mp3 un peu long de continuer après le zéro.
      audioManager.stopCountdownTick();
    }

    if (displayStatus === 'time_up' && settings?.current_round !== undefined && lastTimeUpRoundRef.current !== settings.current_round) {
      lastTimeUpRoundRef.current = settings.current_round;
      audioManager.playTimeUp();
    }
  }, [displayStatus, timeLeft, settings?.current_round]);

  useEffect(() => {
    if (displayStatus === 'reveal' && currentQuestion && lastRevealQuestionRef.current !== currentQuestion.id) {
      lastRevealQuestionRef.current = currentQuestion.id;
      if (correctTeamIds.length > 0) audioManager.playRevealCorrect();
    }
  }, [displayStatus, currentQuestion?.id, correctTeamIds.length]);

  useEffect(() => {
    if (displayStatus === 'phase_summary' && currentQuestion && lastPhaseSummaryQuestionRef.current !== currentQuestion.id) {
      lastPhaseSummaryQuestionRef.current = currentQuestion.id;
      audioManager.playPhaseEnd(phaseTie ? 'tie' : phaseEliminated ? 'eliminated' : 'qualified');
    }
  }, [displayStatus, currentQuestion?.id, phaseTie, phaseEliminated]);

  useEffect(() => {
    if (isFinale && !finalePlayedRef.current) {
      finalePlayedRef.current = true;
      audioManager.playVictory();
    } else if (!isFinale) {
      finalePlayedRef.current = false;
    }
  }, [isFinale]);

  // Gestion des pistes audio
  // Gestion du Buzzer et des événements en temps réel
  useEffect(() => {
    const channel = supabase.channel('buzzer')
      .on('broadcast', { event: 'buzz' }, (payload) => {
        const teamId = payload.payload?.teamId;
        if (teamId) {
          setBuzzWinner(teamId);
          audioManager.playBuzzer();
          setRejectedNotice(null);
        }
      })
      .on('broadcast', { event: 'buzz_rejected' }, (payload) => {
        const failedTeamId = payload.payload?.failedTeamId;
        audioManager.playWrong();
        setBuzzWinner(null);
        setRejectedNotice(`Mauvaise réponse de l'Équipe ${failedTeamId} ! Le buzzer reste ouvert pour les autres.`);
        setTimeout(() => {
          setRejectedNotice(null);
        }, 4000);
      })
      .on('broadcast', { event: 'start_tie_breaker' }, (payload) => {
        setBuzzWinner(null);
        setRejectedNotice(null);
        if (payload.payload?.teamsInTie) {
          setTiedTeamIds(payload.payload.teamsInTie);
        }
        if (payload.payload?.question) {
          setCurrentBonusQuestion(payload.payload.question);
        }
      })
      .on('broadcast', { event: 'next_bonus_question' }, (payload) => {
        setBuzzWinner(null);
        setRejectedNotice(null);
        if (payload.payload?.question) {
          setCurrentBonusQuestion(payload.payload.question);
        }
      })
      .on('broadcast', { event: 'tie_breaker_finished' }, () => {
        audioManager.playRevealCorrect();
        setBuzzWinner(null);
        setRejectedNotice(null);
        setTiedTeamIds([]);
        setSavedTeamIds([]);
        setFailedTeamIds([]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Réinitialiser le buzzer si on quitte le mode tie-breaker
  useEffect(() => {
    if (!settings?.tie_breaker_mode) {
      setBuzzWinner(null);
      setRejectedNotice(null);
      setTiedTeamIds([]);
      setSavedTeamIds([]);
      setFailedTeamIds([]);
    }
  }, [settings?.tie_breaker_mode]);

  // Préparation de la manche (Mélange des choix et Timer)
  useEffect(() => {
    if (settings?.is_playing && currentQuestion && !settings.show_results && !settings.tie_breaker_mode) {
      if (settings.question_started_at) {
        const start = new Date(settings.question_started_at).getTime();
        const elapsed = (Date.now() - start) / 1000;
        setTimeLeft(Math.max(0, Math.min(currentQuestion.duration, currentQuestion.duration - elapsed)));
      } else {
        setTimeLeft(currentQuestion.duration);
      }
      
      if (currentQuestion.phase === 1 || currentQuestion.phase === 2) {
        setChoices(getDeterministicChoices(currentQuestion));
      } else {
        setChoices([]);
      }
    }
  }, [settings?.current_round, settings?.is_playing, currentQuestion, settings?.show_results, settings?.tie_breaker_mode, settings?.question_started_at]);

  // Décompte du Timer
  useEffect(() => {
    if (settings?.is_playing && !settings.show_results && !settings.tie_breaker_mode && displayStatus === 'active' && settings.question_started_at && timeLeft > 0) {
      const timer = setInterval(() => {
        if (settings?.question_started_at && currentQuestion) {
           const start = new Date(settings.question_started_at).getTime();
           const elapsed = (Date.now() - start) / 1000;
           setTimeLeft(Math.max(0, Math.min(currentQuestion.duration, currentQuestion.duration - elapsed)));
        } else {
           setTimeLeft(prev => Math.max(0, prev - 0.1));
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, [settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, displayStatus, timeLeft, settings?.question_started_at, currentQuestion]);

  // Éléments Audio Communs
  const AudioElements = (
    <>
      <button 
        onClick={() => {
          const enabled = audioManager.toggleEnabled();
          setAudioEnabled(enabled);
        }}
        className="fixed bottom-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-white/70 hover:text-white p-3 rounded-full border border-white/20 backdrop-blur-md transition-all shadow-lg text-xs flex items-center gap-2"
        title={audioEnabled ? "Couper le son" : "Activer le son"}
      >
        {audioEnabled && audioManager.isEnabled ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span className="font-sans">Son ON</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            <span className="font-sans">Activer le son</span>
          </>
        )}
      </button>
    </>
  );

  // 1. ÉCRAN D'ATTENTE (Quand la partie n'est pas lancée et qu'on n'est pas en bilan de phase)
  if (!settings?.is_playing && displayStatus !== 'phase_summary' && displayStatus !== 'finale') {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-8 text-center relative overflow-hidden bg-sunburst">
        {AudioElements}
        
        {/* Background animé rotatif */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[150vh] md:h-[150vh] animate-[spin_40s_linear_infinite] opacity-30">
            <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
          </div>
        </div>

        {settings?.bg_video_url && (
          <video autoPlay loop muted className="absolute w-full h-full object-cover opacity-30 z-0">
            <source src={settings.bg_video_url} type="video/mp4" />
          </video>
        )}
        <div className="z-10 flex flex-col items-center w-full max-w-4xl">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 1 }}
            className="w-full flex justify-center mb-8 drop-shadow-2xl"
          >
            <motion.img 
              src={`${import.meta.env.BASE_URL}logo.png`} 
              alt="À qui qu'elle est cette Tête de visage ?" 
              animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} 
              className="w-full h-auto object-contain max-h-[50vh]"
            />
          </motion.div>
          <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className="mt-12 bg-black/50 px-8 py-4 rounded-full border-2 border-white/20 backdrop-blur-md"
          >
            <p className="text-2xl text-white font-paytone tracking-widest uppercase">Préparez-vous...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // 1.5. ÉCRAN DE FIN DE PARTIE (Phase 4)
  if (settings?.current_phase === 4) {
    const winner = teams.find(t => t.id === settings.winner_team_id)
      || teams.find(t => !t.is_eliminated)
      || [...teams].sort((a, b) => b.score - a.score)[0];
    
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-8 text-center relative overflow-hidden bg-sunburst">
        {AudioElements}
        
        {/* Background animé rotatif */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[150vh] md:h-[150vh] animate-[spin_40s_linear_infinite] opacity-30">
            <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-yellow-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-orange-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
          </div>
        </div>

        <div className="z-10 flex flex-col items-center w-full max-w-4xl">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.6, duration: 1.5 }}
            className="w-full flex flex-col items-center justify-center mb-8 drop-shadow-2xl"
          >
            <div className="text-8xl mb-6">🏆</div>
            <h1 className="text-5xl md:text-7xl font-paytone text-3d-yellow uppercase mb-4 tracking-widest">
              GRANDE VICTOIRE
            </h1>
            <div className="bg-black/60 border-4 border-yellow-400 p-8 rounded-3xl backdrop-blur-md shadow-[0_0_50px_rgba(234,179,8,0.5)]">
              <p className="text-6xl md:text-8xl font-paytone text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] mb-4">
                {winner?.name || `Équipe ${winner?.id}`}
              </p>
              <p className="text-3xl text-yellow-300 font-bold uppercase">
                Avec {winner?.score} points !
              </p>
            </div>
            <div className="mt-8 w-full max-w-xl rounded-2xl border border-white/15 bg-black/50 p-4 text-left">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.25em] text-white/50">Classement final</p>
              <div className="grid gap-2">
                {[...teams].sort((a, b) => b.score - a.score).map((team, index) => (
                  <div key={team.id} className={`flex items-center justify-between rounded-lg px-4 py-2 ${team.id === winner?.id ? 'bg-yellow-400/20 text-yellow-200' : 'bg-white/5 text-white/70'}`}>
                    <span className="font-paytone">{index + 1}. {team.name || `Équipe ${team.id}`}</span>
                    <span className="font-paytone">{team.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (displayStatus === 'phase_summary' && currentQuestion && !settings?.tie_breaker_mode) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-sunburst p-6 text-center">
        {AudioElements}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 w-full max-w-4xl rounded-[2rem] border-4 border-yellow-400 bg-black/75 p-6 shadow-[0_0_60px_rgba(234,179,8,0.45)] backdrop-blur-md md:p-10"
        >
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">Phase {currentQuestion.phase}</p>
          <h1 className="mb-8 font-paytone text-5xl uppercase tracking-wider text-white md:text-7xl">FIN DE PHASE</h1>

          <div className="mb-8 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-white/50">Classement</p>
            <div className="grid gap-3">
              {phaseStandings.map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left ${team.is_eliminated ? 'border-red-500/50 bg-red-950/30 opacity-70' : index === 0 ? 'border-yellow-400 bg-yellow-400/15' : 'border-white/10 bg-black/30'}`}
                >
                  <span className="font-paytone text-lg text-white">{index + 1}. {team.name || `Équipe ${team.id}`} {team.is_eliminated ? ' - ÉLIMINÉE' : ''}</span>
                  <span className="font-paytone text-2xl text-yellow-300">{team.score}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-green-400/40 bg-green-950/30 p-3 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-green-300">Équipes qualifiées</p>
            <p className="mt-1 font-paytone text-lg text-white">
              {phaseTie ? activeTeams.filter(team => !phaseTiedTeams.some(tiedTeam => tiedTeam.id === team.id)).map(team => team.name || `Équipe ${team.id}`).join(' · ') || 'Départage nécessaire' : phaseQualifiedTeams.map(team => team.name || `Équipe ${team.id}`).join(' · ')}
            </p>
          </div>

          {phaseTie ? (
            <div className="rounded-2xl border-2 border-red-500 bg-red-950/50 p-4">
              <p className="font-paytone text-3xl uppercase text-red-300">ÉGALITÉ POUR LA QUALIFICATION</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-yellow-300">Le maître du jeu doit lancer le départage au buzzer</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/65">La mort subite départagera les équipes à égalité</p>
            </div>
          ) : phaseEliminated ? (
            <div className="rounded-2xl border-2 border-blue-400 bg-blue-950/50 p-4">
              <p className="font-paytone text-2xl uppercase text-white">{phaseEliminated.name || `Équipe ${phaseEliminated.id}`} éliminée</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-widest text-green-300">Les autres équipes sont qualifiées</p>
            </div>
          ) : phaseWinner ? (
            <div className="rounded-2xl border-2 border-yellow-400 bg-yellow-950/40 p-4">
              <p className="font-paytone text-2xl uppercase text-yellow-300">{phaseWinner.name || `Équipe ${phaseWinner.id}`} prend la tête</p>
            </div>
          ) : null}

          {!phaseTie && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="mt-8 rounded-full border border-white/20 bg-black/50 px-8 py-4"
            >
              <p className="font-paytone text-2xl uppercase tracking-widest text-white/50">
                Prêts pour la Phase {currentQuestion.phase + 1} ?
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // 2. ÉCRAN PRINCIPAL DE JEU (Identique en manche normale ou manche bonus au buzzer)
  const isTieBreaker = Boolean(settings.tie_breaker_mode);
  const activeDisplayQuestion = isTieBreaker ? currentBonusQuestion : currentQuestion;
  const progressPercentage = activeDisplayQuestion && !isTieBreaker ? (timeLeft / activeDisplayQuestion.duration) * 100 : 0;
  const buzzedTeam = teams.find(t => t.id === buzzWinner);

  return (
    <div className="flex flex-col w-full h-[100dvh] p-6 relative overflow-hidden bg-sunburst">
      {AudioElements}
      
      {/* Background animé rotatif */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[150vh] md:h-[150vh] animate-[spin_40s_linear_infinite] opacity-30">
          <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
        </div>
      </div>

      {settings?.bg_video_url && (
        <video autoPlay loop muted className="absolute inset-0 w-full h-full object-cover opacity-20 z-0 mix-blend-screen">
          <source src={settings.bg_video_url} type="video/mp4" />
        </video>
      )}

      <AnimatePresence>
        {displayStatus === 'game_start' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ type: 'spring', duration: 1.5, bounce: 0.4 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="À qui qu'elle est cette Tête de visage ?"
              className="w-full max-w-3xl drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.p
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="mt-12 text-center text-3xl font-paytone uppercase tracking-[0.3em] text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] md:text-5xl"
            >
              Préparez-vous
            </motion.p>
          </motion.div>
        )}

        {displayStatus === 'phase_intro' && currentQuestion && (
          <motion.div
            initial={{ x: '-100vw', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100vw', opacity: 0 }}
            transition={{ type: 'spring', duration: 0.8, bounce: 0.2 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="w-full border-y-8 border-purple-500 bg-gradient-to-r from-blue-900/90 via-purple-900/90 to-blue-900/90 py-16 shadow-[0_0_100px_rgba(168,85,247,0.5)]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mx-auto max-w-5xl px-4 text-center"
              >
                <h2 className="mb-4 font-paytone text-6xl uppercase tracking-widest text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] md:text-9xl">
                  Phase {currentQuestion.phase}
                </h2>
                <p className="font-paytone text-2xl uppercase tracking-widest text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] md:text-5xl">
                  {currentQuestion.phase === 1 ? 'Le Face-à-Face' : currentQuestion.phase === 2 ? 'Le Carré Magique' : 'Le Sprint Final'}
                </p>
                <div className="mx-auto mt-8 h-2 w-24 rounded-full bg-white/50" />
                <p className="mt-8 text-lg font-bold uppercase tracking-[0.25em] text-white/90 md:text-2xl">
                  {currentQuestion.phase === 1 ? '2 Propositions · 1 Bonne réponse' : currentQuestion.phase === 2 ? '4 Propositions · 1 Bonne réponse' : 'Saisie libre sur les téléphones'}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {displayStatus === 'round_intro' && (
          <motion.div
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.5 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <div className="rounded-[2rem] border-4 border-yellow-400 bg-black/80 px-8 py-10 text-center shadow-[0_0_60px_rgba(234,179,8,0.5)] md:px-16">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-yellow-300">À vous de jouer</p>
              <h2 className="font-paytone text-5xl uppercase tracking-widest text-yellow-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] md:text-8xl">
                Manche {settings?.current_round || 1}
              </h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {displayStatus === 'time_up' && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute left-1/2 top-28 z-30 w-[min(92%,42rem)] -translate-x-1/2"
        >
          <div className="rounded-2xl border-2 border-yellow-400/80 bg-black/85 px-6 py-3 text-center shadow-[0_0_28px_rgba(234,179,8,0.35)] backdrop-blur-md">
            <p className="font-paytone text-3xl uppercase tracking-[0.18em] text-yellow-300 md:text-5xl">TEMPS ÉCOULÉ</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-white/65">Réponses figées · révélation à venir</p>
          </div>
        </motion.div>
      )}

      {revealFrozen && (
        <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]" aria-hidden="true" />
      )}

      <div className="z-10 flex flex-col h-full flex-grow">

        {/* HUD de régie : manche, phase, consigne et état local */}
        <div className="w-full max-w-6xl mx-auto mb-4 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-2xl border-2 border-white/15 bg-black/55 px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-300/80">{roundStatusLabel[displayStatus]}</p>
            <p className="text-lg md:text-2xl font-paytone text-white">
              {isTieBreaker ? 'DÉPARTAGE' : `MANCHE ${Math.max(1, currentRegularIndex + 1)} / ${regularQuestions.length}`}
            </p>
          </div>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm md:text-lg font-paytone uppercase tracking-wider text-yellow-300">
              {isTieBreaker ? `DÉPARTAGE - ${tieBreakerSession.target_spots} PLACE${tieBreakerSession.target_spots > 1 ? 'S' : ''} À PRENDRE` : phaseLabel}
            </p>
            <p className="truncate text-xs md:text-sm font-sans font-bold uppercase tracking-widest text-white/75">
              {isTieBreaker ? 'Le premier qui buzze répond à l’oral' : instructionLabel}
            </p>
            {!isTieBreaker && (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/45">
                Réponses : {answeredActiveTeamCount} / {activeTeams.length} équipes en jeu
              </p>
            )}
          </div>

          <div className="text-right">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${connectionStatus === 'connected' ? 'text-green-300' : 'text-yellow-300'}`}>
              {connectionStatus === 'connected' ? 'Synchronisé' : connectionStatus === 'reconnecting' ? 'Reconnexion...' : 'Connexion...'}
            </p>
          </div>

          {!isTieBreaker ? (
            <div className="text-right">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white/50">Chrono</p>
              <p className={`font-paytone text-3xl md:text-4xl tabular-nums ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {formattedTime}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-white/50">Question bonus</p>
              <p className="font-paytone text-3xl text-yellow-300">{currentBonusIndex >= 0 ? currentBonusIndex + 1 : '-'}</p>
            </div>
          )}
        </div>

        {!isTieBreaker && displayStatus === 'active' && allActiveTeamsAnswered && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-4 w-full max-w-3xl rounded-xl border-2 border-green-400/70 bg-green-950/60 px-4 py-2 text-center shadow-[0_0_20px_rgba(74,222,128,0.2)]"
          >
            <p className="font-paytone text-lg uppercase tracking-wider text-green-300">Toutes les équipes ont répondu</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Le maître du jeu peut révéler les résultats</p>
          </motion.div>
        )}
        
        {/* En-tête : Scores des 4 équipes (Strictement identique) */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {teams.map(team => {
            const teamStyles: Record<string, string> = {
              'A': 'bg-blue-600 border-blue-400',
              'B': 'bg-red-600 border-red-400',
              'C': 'bg-green-600 border-green-400',
              'D': 'bg-purple-600 border-purple-400'
            };
            const isEliminated = team.is_eliminated;
            const isTied = isTieBreaker && (tiedTeamIds.length === 0 || tiedTeamIds.includes(team.id));
            const hasBuzzed = buzzWinner === team.id;
            const isSaved = isTieBreaker && savedTeamIds.includes(team.id);
            const isFailed = isTieBreaker && failedTeamIds.includes(team.id);
            const earnedPoint = !isTieBreaker && correctTeamIds.includes(team.id);
            const scoreBeforeReveal = Math.max(0, team.score - (earnedPoint ? 1 : 0));
            
            return (
              <div 
                key={team.id} 
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-4 shadow-xl backdrop-blur-md transition-all relative ${
                  isEliminated 
                    ? 'bg-gray-800 border-gray-600 opacity-60 grayscale' 
                    : hasBuzzed 
                    ? `${teamStyles[team.id]} ring-4 ring-yellow-400 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.8)]`
                    : isSaved
                    ? 'bg-green-700 border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                    : isFailed
                    ? 'bg-red-900 border-red-500 opacity-70'
                    : isTied
                    ? `${teamStyles[team.id]} shadow-[0_0_20px_rgba(234,179,8,0.5)]`
                    : teamStyles[team.id]
                }`}
              >
                {/* Badge Manche Bonus pour les équipes en ballotage */}
                {isTieBreaker && isTied && !isEliminated && (
                  <span className="absolute -top-3 bg-yellow-400 text-black text-[10px] font-paytone px-2 py-0.5 rounded-full uppercase shadow">
                    ⚡ Ballotée
                  </span>
                )}
                {hasBuzzed && (
                  <span className="absolute -top-3 bg-yellow-300 text-black text-[11px] font-paytone px-3 py-0.5 rounded-full uppercase shadow animate-bounce">
                    🔔 A BUZZÉ !
                  </span>
                )}

                <span className="text-xl md:text-2xl font-bold font-sans text-white uppercase tracking-wider truncate w-full text-center">
                  {team.name || `Équipe ${team.id}`}
                  {displayStatus === 'reveal' && earnedPoint && (
                    <motion.span
                      initial={{ opacity: 0, y: 8, scale: 0.7 }}
                      animate={{ opacity: 1, y: -8, scale: 1 }}
                      className="ml-3 inline-block text-2xl font-paytone text-green-300 drop-shadow-[0_0_10px_rgba(74,222,128,0.9)]"
                    >
                      +1
                    </motion.span>
                  )}
                </span>
                <span className="text-4xl md:text-5xl font-paytone text-yellow-300 drop-shadow-md">
                  <ScoreCountUp
                    start={scoreBeforeReveal}
                    target={team.score}
                    active={displayStatus === 'reveal' && earnedPoint}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* Notification temporaire si refus de réponse en Manche Bonus */}
        {isTieBreaker && rejectedNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-600 border-2 border-white px-6 py-2 rounded-2xl text-white font-paytone text-lg shadow-2xl max-w-2xl mx-auto mb-3"
          >
            {rejectedNotice}
          </motion.div>
        )}

        {/* Zone Centrale : Cadre photo emblématique du jeu (Strictement identique) */}
        <div className="flex-1 flex flex-col items-center justify-center mb-6 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeDisplayQuestion?.id || (isTieBreaker ? 'tie-breaker' : 'none')}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -50 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="relative"
            >
              {/* Cadre doré iconique */}
              <div className="bg-yellow-500 p-3 rounded-[3rem] shadow-[0_0_40px_rgba(234,179,8,0.4)] border-4 border-yellow-300">
                <div className="border-4 border-dashed border-yellow-800/30 p-2 rounded-[2.5rem] bg-black">
                  <div className="relative overflow-hidden rounded-[2rem] w-full max-w-4xl aspect-[4/3] md:aspect-video flex items-center justify-center bg-gray-900 border-4 border-white/10">
                    {activeDisplayQuestion?.photo_url && !imageLoadError ? (
                      <img 
                        src={activeDisplayQuestion.photo_url} 
                        alt="Devinette" 
                        className="w-full h-full object-contain bg-black p-2"
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoadError(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 text-center">
                        <span className="text-5xl" aria-hidden="true">▧</span>
                        <span className="text-xl font-paytone text-white/70">
                          {imageLoading ? 'Chargement de l’image...' : imageLoadError ? 'Image indisponible' : isTieBreaker ? 'Photo manche bonus' : 'Photo manquante'}
                        </span>
                        <span className="max-w-md text-xs font-sans uppercase tracking-widest text-white/40">
                          {imageLoading ? 'Préparation de la photo.' : imageLoadError ? 'Le jeu continue, consultez votre écran.' : 'Aucune image configurée pour cette question.'}
                        </span>
                      </div>
                    )}
                    
                    {/* Overlay de Révélation (Phase 3 texte en fin de manche) */}
                    {!isTieBreaker && displayStatus === 'reveal' && activeDisplayQuestion && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                         className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm"
                       >
                         <p className="mb-3 text-2xl font-paytone uppercase text-green-300 md:text-4xl">✓ BONNE RÉPONSE</p>
                         <p className="mb-2 text-sm font-bold uppercase tracking-widest text-yellow-400">La réponse était</p>
                         <p className="text-4xl font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] md:text-6xl">
                           {activeDisplayQuestion.correct_answer}
                         </p>
                       </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Barre de temps (en manche régulière uniquement) */}
        {!isTieBreaker && !settings.show_results && activeDisplayQuestion && (
          <motion.div 
            animate={{ scale: progressPercentage < 25 && progressPercentage > 0 ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: progressPercentage < 25 ? Infinity : 0, duration: 0.5 }}
            className="w-full max-w-4xl mx-auto mb-6 h-6 bg-black/60 rounded-full border-2 border-white/20 overflow-hidden shadow-inner"
          >
            <motion.div 
              className={`h-full ${progressPercentage < 25 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : progressPercentage < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercentage}%` }}
              layout
            />
          </motion.div>
        )}

        {/* Zone Basse : Choix Multiples, réponse libre ou départage */}
        {isTieBreaker ? (
          /* MANCHE BONUS : Bandeau harmonieux dans le même esprit que le reste du jeu */
          <div className="w-full max-w-4xl mx-auto">
            {buzzWinner && buzzedTeam ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-black/60 p-6 rounded-3xl border-4 border-yellow-400 text-center shadow-2xl backdrop-blur-md"
              >
                <p className="text-xl md:text-2xl text-yellow-300 font-paytone uppercase mb-2 animate-pulse">
                  🔔 L'ÉQUIPE A BUZZÉ :
                </p>
                <div className="text-4xl md:text-6xl font-paytone text-white uppercase drop-shadow-lg mb-2">
                  {buzzedTeam.name || `Équipe ${buzzedTeam.id}`}
                </div>
                <p className="text-base text-white/80 font-sans font-bold">
                  Réponse orale en cours avec le Maître du Jeu...
                </p>
              </motion.div>
            ) : (
              <div className="bg-black/50 p-6 rounded-3xl border-2 border-yellow-500/40 text-center shadow-xl backdrop-blur-md flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-yellow-400 font-paytone text-2xl md:text-3xl uppercase tracking-wider">
                  <span className="animate-bounce">⚡</span>
                  <span>DÉPARTAGE - {tieBreakerSession.target_spots} PLACE{tieBreakerSession.target_spots > 1 ? 'S' : ''} À PRENDRE</span>
                  <span className="animate-bounce">⚡</span>
                </div>
                <p className="text-white/80 text-sm md:text-base font-sans">
                  QUESTION BONUS {currentBonusIndex >= 0 ? currentBonusIndex + 1 : '-'} - {activeTieTeamCount} ÉQUIPE{activeTieTeamCount > 1 ? 'S' : ''} EN LICE
                </p>
              </div>
            )}
          </div>
        ) : settings.current_phase === 3 ? (
          <div className="w-full max-w-4xl mx-auto bg-black/55 p-6 rounded-3xl border-2 border-blue-400/60 text-center shadow-xl backdrop-blur-md">
            <p className="text-2xl md:text-4xl font-paytone uppercase tracking-wider text-yellow-300">QUI EST-CE ?</p>
            <p className="mt-1 text-sm md:text-base font-sans font-bold uppercase tracking-widest text-white/80">Répondez sur votre écran</p>
            <p className="mt-3 text-lg font-paytone text-white">
              {liveAnswers.length} / {teams.length} réponses enregistrées
            </p>
          </div>
        ) : (
          /* MANCHES NORMALES : Propositions (Phases 1 et 2) */
          (settings.current_phase === 1 || settings.current_phase === 2) && (
            <div className={`grid gap-6 w-full max-w-5xl mx-auto ${settings.current_phase === 1 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
              <AnimatePresence>
                {choices.map((choice) => {
                  const isCorrect = choice === currentQuestion?.correct_answer;
                  const showReveal = displayStatus === 'reveal';
                  
                  let btnClasses = "bg-blue-900/80 border-blue-500 text-white shadow-[0_8px_0_rgb(30,58,138)]";
                  
                  if (showReveal) {
                    if (isCorrect) {
                      btnClasses = "bg-green-500 border-green-300 text-white shadow-[0_0_30px_rgba(34,197,94,0.8)] scale-110 z-10";
                    } else {
                      btnClasses = "bg-gray-800 border-gray-700 text-gray-500 opacity-50 scale-95";
                    }
                  }

                  return (
                    <motion.div
                      key={choice}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`relative flex items-center justify-center p-6 rounded-2xl border-4 transition-all duration-500 text-center ${btnClasses} ${displayStatus === 'time_up' ? 'grayscale' : ''}`}
                    >
                      {showReveal && isCorrect && (
                        <span className="absolute -top-4 rounded-full border-2 border-green-200 bg-green-500 px-4 py-1 text-xs font-paytone uppercase text-white shadow-lg">
                          ✓ Bonne réponse
                        </span>
                      )}
                      <span className="text-2xl md:text-3xl font-bold font-sans drop-shadow-md break-words">{choice}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        )}
        
      </div>
    </div>
  );
}
