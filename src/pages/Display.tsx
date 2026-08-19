import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import { useGameState } from '../hooks/useGameState';
import { useQuestions } from '../hooks/useQuestions';
import { soundFX } from '../lib/soundEffects';
import { Question } from '../types';

import { getDeterministicChoices } from '../lib/utils';

export default function Display() {
  const { settings, teams } = useGameState();
  const { questions } = useQuestions();
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [buzzWinner, setBuzzWinner] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [rejectedNotice, setRejectedNotice] = useState<string | null>(null);
  const [currentBonusQuestion, setCurrentBonusQuestion] = useState<Question | null>(null);
  const [tiedTeamIds, setTiedTeamIds] = useState<string[]>(settings?.tie_breaker_teams || []);

  // Sync with settings if reloaded
  useEffect(() => {
    if (settings?.tie_breaker_teams) {
      setTiedTeamIds(settings.tie_breaker_teams);
    }
  }, [settings?.tie_breaker_teams]);

  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const suspenseAudioRef = useRef<HTMLAudioElement | null>(null);

  const regularQuestions = questions.filter(q => q.phase !== 0 && !q.is_bonus);
  const bonusQuestions = questions.filter(q => q.phase === 0 || q.is_bonus);

  const currentQuestion = settings ? regularQuestions.find(q => q.order === settings.current_round) : null;

  // Question bonus active
  useEffect(() => {
    if (settings?.tie_breaker_mode && !currentBonusQuestion && bonusQuestions.length > 0) {
      setCurrentBonusQuestion(bonusQuestions[0]);
    }
  }, [settings?.tie_breaker_mode, bonusQuestions, currentBonusQuestion]);

  // Gestion des pistes audio
  useEffect(() => {
    if (!audioEnabled) return;

    const isWaiting = !settings?.is_playing;
    const isThinking = settings?.is_playing && !settings?.show_results && !settings?.tie_breaker_mode;

    if (bgAudioRef.current && settings?.bg_audio_url) {
      if (isWaiting) {
        bgAudioRef.current.play().catch(() => {});
      } else {
        bgAudioRef.current.pause();
        bgAudioRef.current.currentTime = 0;
      }
    }

    if (suspenseAudioRef.current && settings?.suspense_audio_url) {
      if (isThinking) {
        suspenseAudioRef.current.play().catch(() => {});
      } else {
        suspenseAudioRef.current.pause();
        suspenseAudioRef.current.currentTime = 0;
      }
    }
  }, [audioEnabled, settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, settings?.bg_audio_url, settings?.suspense_audio_url]);

  // Gestion du Buzzer et des événements en temps réel
  useEffect(() => {
    const channel = supabase.channel('buzzer')
      .on('broadcast', { event: 'buzz' }, (payload) => {
        const teamId = payload.payload?.teamId;
        if (teamId) {
          setBuzzWinner(teamId);
          soundFX.playBuzzer();
          setRejectedNotice(null);
        }
      })
      .on('broadcast', { event: 'buzz_rejected' }, (payload) => {
        const failedTeamId = payload.payload?.failedTeamId;
        soundFX.playWrong();
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
        soundFX.playCorrect();
        setBuzzWinner(null);
        setRejectedNotice(null);
        setTiedTeamIds([]);
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
    }
  }, [settings?.tie_breaker_mode]);

  // Préparation de la manche (Mélange des choix et Timer)
  useEffect(() => {
    if (settings?.is_playing && currentQuestion && !settings.show_results && !settings.tie_breaker_mode) {
      if (settings.question_started_at) {
        const start = new Date(settings.question_started_at).getTime();
        const elapsed = (Date.now() - start) / 1000;
        setTimeLeft(Math.max(0, currentQuestion.duration - elapsed));
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
    if (settings?.is_playing && !settings.show_results && !settings.tie_breaker_mode && timeLeft > 0) {
      const timer = setInterval(() => {
        if (settings?.question_started_at && currentQuestion) {
           const start = new Date(settings.question_started_at).getTime();
           const elapsed = (Date.now() - start) / 1000;
           setTimeLeft(Math.max(0, currentQuestion.duration - elapsed));
        } else {
           setTimeLeft(prev => Math.max(0, prev - 0.1));
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, [settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, timeLeft, settings?.question_started_at, currentQuestion]);

  // Éléments Audio Communs
  const AudioElements = (
    <>
      {settings?.bg_audio_url && (
        <audio 
          ref={bgAudioRef} 
          src={settings.bg_audio_url} 
          loop 
          preload="auto" 
        />
      )}
      {settings?.suspense_audio_url && (
        <audio 
          ref={suspenseAudioRef} 
          src={settings.suspense_audio_url} 
          loop 
          preload="auto" 
        />
      )}
      <button 
        onClick={() => {
          setAudioEnabled(!audioEnabled);
          if (!audioEnabled) {
            if (bgAudioRef.current && settings?.bg_audio_url && !settings?.is_playing) {
              bgAudioRef.current.play().catch(() => {});
            }
          } else {
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (suspenseAudioRef.current) suspenseAudioRef.current.pause();
          }
        }}
        className="fixed bottom-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-white/70 hover:text-white p-3 rounded-full border border-white/20 backdrop-blur-md transition-all shadow-lg text-xs flex items-center gap-2"
        title={audioEnabled ? "Couper le son" : "Activer le son"}
      >
        {audioEnabled ? (
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

  // 1. ÉCRAN D'ATTENTE (Quand la partie n'est pas lancée)
  if (!settings?.is_playing) {
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
    const winner = teams.find(t => !t.is_eliminated) || teams.sort((a, b) => b.score - a.score)[0];
    
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
          </motion.div>
        </div>
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

      <div className="z-10 flex flex-col h-full flex-grow">
        
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
            
            return (
              <div 
                key={team.id} 
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-4 shadow-xl backdrop-blur-md transition-all relative ${
                  isEliminated 
                    ? 'bg-gray-800 border-gray-600 opacity-60 grayscale' 
                    : hasBuzzed 
                    ? `${teamStyles[team.id]} ring-4 ring-yellow-400 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.8)]`
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
                </span>
                <span className="text-4xl md:text-5xl font-paytone text-yellow-300 drop-shadow-md">
                  {team.score}
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
                    {activeDisplayQuestion?.photo_url ? (
                      <img 
                        src={activeDisplayQuestion.photo_url} 
                        alt="Devinette" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white/50 text-2xl font-paytone">
                        {isTieBreaker ? "Photo Manche Bonus" : "Photo manquante"}
                      </span>
                    )}
                    
                    {/* Overlay de Révélation (Phase 3 texte en fin de manche) */}
                    {!isTieBreaker && settings.current_phase === 3 && settings.show_results && activeDisplayQuestion && (
                       <motion.div 
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm"
                       >
                         <p className="text-3xl text-yellow-400 font-paytone uppercase mb-4">La réponse était :</p>
                         <p className="text-6xl text-white font-bold drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
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

        {/* Zone Basse : Choix Multiples OU Bandeau Manche Bonus (Même style graphique) */}
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
                  <span>MANCHE BONUS : DÉPARTAGE AU BUZZER</span>
                  <span className="animate-bounce">⚡</span>
                </div>
                <p className="text-white/80 text-sm md:text-base font-sans">
                  Le premier qui buzze sur son écran donne sa réponse à l'oral !
                </p>
              </div>
            )}
          </div>
        ) : (
          /* MANCHES NORMALES : Propositions (Phases 1 et 2) */
          (settings.current_phase === 1 || settings.current_phase === 2) && (
            <div className={`grid gap-6 w-full max-w-5xl mx-auto ${settings.current_phase === 1 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
              <AnimatePresence>
                {choices.map((choice) => {
                  const isCorrect = choice === currentQuestion?.correct_answer;
                  const showReveal = settings.show_results;
                  
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
                      className={`flex items-center justify-center p-6 rounded-2xl border-4 transition-all duration-500 text-center ${btnClasses}`}
                    >
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
