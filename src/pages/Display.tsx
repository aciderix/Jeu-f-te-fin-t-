import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import { useGameState } from '../hooks/useGameState';
import { useQuestions } from '../hooks/useQuestions';

export default function Display() {
  const { settings, teams } = useGameState();
  const { questions } = useQuestions();
  
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [buzzWinner, setBuzzWinner] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);

  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const suspenseAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentQuestion = settings ? questions.find(q => q.order === settings.current_round) : null;

  // Gestion des pistes audio (Musique d'accueil vs Musique de suspense)
  useEffect(() => {
    if (!audioEnabled) return;

    const isWaiting = !settings?.is_playing && !settings?.tie_breaker_mode;
    const isThinking = settings?.is_playing && !settings?.show_results && !settings?.tie_breaker_mode;

    // Musique d'ambiance d'accueil / attente
    if (bgAudioRef.current && settings?.bg_audio_url) {
      if (isWaiting) {
        bgAudioRef.current.play().catch(() => {});
      } else {
        bgAudioRef.current.pause();
        bgAudioRef.current.currentTime = 0;
      }
    }

    // Musique de suspense pendant le chrono
    if (suspenseAudioRef.current && settings?.suspense_audio_url) {
      if (isThinking) {
        suspenseAudioRef.current.play().catch(() => {});
      } else {
        suspenseAudioRef.current.pause();
        suspenseAudioRef.current.currentTime = 0;
      }
    }
  }, [audioEnabled, settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, settings?.bg_audio_url, settings?.suspense_audio_url]);

  // Gestion du Buzzer en temps réel
  useEffect(() => {
    const channel = supabase.channel('buzzer')
      .on('broadcast', { event: 'buzz' }, (payload) => {
        setBuzzWinner((current) => current ? current : payload.payload.teamId);
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
    }
  }, [settings?.tie_breaker_mode]);

  // Préparation de la manche (Mélange des choix et Timer)
  useEffect(() => {
    if (settings?.is_playing && currentQuestion && !settings.show_results) {
      setTimeLeft(currentQuestion.duration);
      
      if (currentQuestion.phase === 1 || currentQuestion.phase === 2) {
        const required = currentQuestion.phase === 1 ? 2 : 4;
        const allWrongs = [...(currentQuestion.wrong_answers || [])].sort(() => Math.random() - 0.5);
        const selected = [currentQuestion.correct_answer, ...allWrongs.slice(0, required - 1)];
        setChoices(selected.sort(() => Math.random() - 0.5));
      } else {
        setChoices([]);
      }
    }
  }, [settings?.current_round, settings?.is_playing, currentQuestion, settings?.show_results]);

  // Décompte du Timer
  useEffect(() => {
    if (settings?.is_playing && !settings.show_results && !settings.tie_breaker_mode && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 0.1));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, timeLeft]);

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
            // Débloque l'audio sur interaction utilisateur
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

  // Composant Écran d'Attente
  if (!settings?.is_playing && !settings?.tie_breaker_mode) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-8 text-center relative overflow-hidden">
        {AudioElements}
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

  // Composant Manche Bonus (Buzzer)
  if (settings.tie_breaker_mode) {
    const winnerTeam = teams.find(t => t.id === buzzWinner);
    const teamColors: Record<string, string> = {
      'A': 'text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]',
      'B': 'text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]',
      'C': 'text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]',
      'D': 'text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]'
    };

    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-8 text-center bg-red-900/40">
        {AudioElements}
        <h1 className="text-6xl text-3d-yellow mb-12 uppercase drop-shadow-2xl animate-pulse">Manche Buzzer !</h1>
        
        {buzzWinner && winnerTeam ? (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.7 }}
            className="bg-black/80 p-16 rounded-[4rem] border-8 border-white/20 shadow-2xl"
          >
            <p className="text-4xl text-white font-sans mb-6 uppercase tracking-widest">L'équipe a buzzé :</p>
            <p className={`text-9xl font-paytone uppercase ${teamColors[buzzWinner]}`}>
              {winnerTeam.name || `Équipe ${winnerTeam.id}`}
            </p>
          </motion.div>
        ) : (
          <div className="text-4xl text-white/50 font-paytone tracking-widest uppercase animate-pulse">
            En attente d'un buzz...
          </div>
        )}
      </div>
    );
  }

  // Composant Principal de Jeu (Questions)
  const progressPercentage = currentQuestion ? (timeLeft / currentQuestion.duration) * 100 : 0;
  
  return (
    <div className="flex flex-col w-full h-[100dvh] p-6 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black">
      {AudioElements}
      
      {/* Lights effect rotatif */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-40 mix-blend-screen z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vw] h-[200vw] md:w-[150vh] md:h-[150vh] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent animate-[spin_30s_linear_infinite]"></div>
      </div>

      {settings?.bg_video_url && (
        <video autoPlay loop muted className="absolute inset-0 w-full h-full object-cover opacity-20 z-0 mix-blend-screen">
          <source src={settings.bg_video_url} type="video/mp4" />
        </video>
      )}

      <div className="z-10 flex flex-col h-full flex-grow">
        
        {/* En-tête : Scores des équipes */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {teams.map(team => {
            const teamStyles: Record<string, string> = {
              'A': 'bg-blue-600 border-blue-400',
              'B': 'bg-red-600 border-red-400',
              'C': 'bg-green-600 border-green-400',
              'D': 'bg-purple-600 border-purple-400'
            };
            const isEliminated = team.is_eliminated;
            
            return (
              <div 
                key={team.id} 
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-4 shadow-xl backdrop-blur-md transition-all ${isEliminated ? 'bg-gray-800 border-gray-600 opacity-60 grayscale' : teamStyles[team.id]}`}
              >
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

        {/* Zone Centrale : Photo et Infos */}
        <div className="flex-1 flex flex-col items-center justify-center mb-8 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestion?.id || 'none'}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -50 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="relative"
            >
              {/* Cadre style chapiteau */}
              <div className="bg-yellow-500 p-3 rounded-[3rem] shadow-[0_0_40px_rgba(234,179,8,0.4)] border-4 border-yellow-300">
                <div className="border-4 border-dashed border-yellow-800/30 p-2 rounded-[2.5rem] bg-black">
                  <div className="relative overflow-hidden rounded-[2rem] w-full max-w-4xl aspect-[4/3] md:aspect-video flex items-center justify-center bg-gray-900 border-4 border-white/10">
                    {currentQuestion?.photo_url ? (
                      <img 
                        src={currentQuestion.photo_url} 
                        alt="Devinette" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white/50 text-2xl font-paytone">Photo manquante</span>
                    )}
                    
                    {/* Overlay de Révélation (Phase 3 textuelle) */}
                    {settings.current_phase === 3 && settings.show_results && (
                       <motion.div 
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm"
                       >
                         <p className="text-3xl text-yellow-400 font-paytone uppercase mb-4">La réponse était :</p>
                         <p className="text-6xl text-white font-bold drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                           {currentQuestion.correct_answer}
                         </p>
                       </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Barre de temps */}
        {!settings.show_results && currentQuestion && (
          <motion.div 
            animate={{ scale: progressPercentage < 25 && progressPercentage > 0 ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: progressPercentage < 25 ? Infinity : 0, duration: 0.5 }}
            className="w-full max-w-4xl mx-auto mb-8 h-6 bg-black/60 rounded-full border-2 border-white/20 overflow-hidden shadow-inner"
          >
            <motion.div 
              className={`h-full ${progressPercentage < 25 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : progressPercentage < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercentage}%` }}
              layout
            />
          </motion.div>
        )}

        {/* Zone Basse : Propositions (Phases 1 et 2) */}
        {(settings.current_phase === 1 || settings.current_phase === 2) && (
          <div className={`grid gap-6 w-full max-w-5xl mx-auto ${settings.current_phase === 1 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
            <AnimatePresence>
              {choices.map((choice, idx) => {
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
        )}
        
      </div>
    </div>
  );
}

