import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGameState } from '../../hooks/useGameState';
import { useQuestions } from '../../hooks/useQuestions';
import { getDeterministicChoices } from '../../lib/utils';

// Fonction pour calculer la distance de Levenshtein (tolérance fautes de frappe)
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

// Fonction pour normaliser le texte (sans accents, sans majuscules)
const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

interface Props {
  teamId: string;
  onLeave: () => void;
}

export default function TeamDashboard({ teamId, onLeave }: Props) {
  const { settings, teams } = useGameState();
  const { questions } = useQuestions();
  const [choices, setChoices] = useState<string[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État Realtime du départage au buzzer
  const [buzzedTeamId, setBuzzedTeamId] = useState<string | null>(null);
  const [failedTeamIds, setFailedTeamIds] = useState<string[]>([]);
  const [tiedTeamIds, setTiedTeamIds] = useState<string[]>(settings?.tie_breaker_teams || []);

  useEffect(() => {
    if (settings?.tie_breaker_teams) {
      setTiedTeamIds(settings.tie_breaker_teams);
    }
  }, [settings?.tie_breaker_teams]);

  const regularQuestions = questions.filter(q => q.phase !== 0 && !q.is_bonus);
  const team = teams.find(t => t.id === teamId);
  const question = settings ? regularQuestions.find(q => q.order === settings.current_round) : null;

  const teamColor = 
    teamId === 'A' ? 'bg-blue-600 border-blue-800 shadow-[0_6px_0_rgb(30,58,138)]' :
    teamId === 'B' ? 'bg-red-600 border-red-800 shadow-[0_6px_0_rgb(153,27,27)]' :
    teamId === 'C' ? 'bg-green-600 border-green-800 shadow-[0_6px_0_rgb(21,128,61)]' :
    'bg-purple-600 border-purple-800 shadow-[0_6px_0_rgb(107,33,168)]';

  // 1. Initialiser le channel Realtime pour le buzzer
  useEffect(() => {
    const channel = supabase.channel('buzzer')
      .on('broadcast', { event: 'buzz' }, (payload) => {
        setBuzzedTeamId((current) => current ? current : payload.payload?.teamId);
      })
      .on('broadcast', { event: 'buzz_rejected' }, (payload) => {
        setBuzzedTeamId(null);
        if (payload.payload?.failedTeamIds) {
          setFailedTeamIds(payload.payload.failedTeamIds);
        } else if (payload.payload?.failedTeamId) {
          setFailedTeamIds(prev => [...prev, payload.payload.failedTeamId]);
        }
      })
      .on('broadcast', { event: 'start_tie_breaker' }, (payload) => {
        setBuzzedTeamId(null);
        setFailedTeamIds([]);
        if (payload.payload?.teamsInTie) {
          setTiedTeamIds(payload.payload.teamsInTie);
        }
      })
      .on('broadcast', { event: 'next_bonus_question' }, () => {
        setBuzzedTeamId(null);
        setFailedTeamIds([]);
      })
      .on('broadcast', { event: 'tie_breaker_finished' }, () => {
        setBuzzedTeamId(null);
        setFailedTeamIds([]);
        setTiedTeamIds([]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Réinitialiser les états locaux du buzzer si le mode est désactivé
  useEffect(() => {
    if (!settings?.tie_breaker_mode) {
      setBuzzedTeamId(null);
      setFailedTeamIds([]);
      setTiedTeamIds([]);
    }
  }, [settings?.tie_breaker_mode]);

  // 2. Préparer les choix et le timer à chaque changement de question/manche
  useEffect(() => {
    if (question && settings?.is_playing && !settings.show_results && !settings.tie_breaker_mode) {
      if (question.phase === 1 || question.phase === 2) {
        setChoices(getDeterministicChoices(question));
      } else {
        setChoices([]);
      }
      
      const st = settings.question_started_at ? new Date(settings.question_started_at).getTime() : Date.now();
      setStartTime(st);
      const elapsed = (Date.now() - st) / 1000;
      setTimeLeft(Math.max(0, question.duration - elapsed));
    }
  }, [question, settings?.current_round, settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, settings?.question_started_at]);

  // Décompte du Timer
  useEffect(() => {
    if (settings?.is_playing && !settings.show_results && !settings.tie_breaker_mode && timeLeft > 0) {
      const timer = setInterval(() => {
        if (settings?.question_started_at && question) {
           const start = new Date(settings.question_started_at).getTime();
           const elapsed = (Date.now() - start) / 1000;
           setTimeLeft(Math.max(0, question.duration - elapsed));
        } else {
           setTimeLeft(prev => Math.max(0, prev - 1));
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [settings?.is_playing, settings?.show_results, settings?.tie_breaker_mode, timeLeft, settings?.question_started_at, question]);

  // 3. Vérifier si l'équipe a déjà répondu pour cette manche
  useEffect(() => {
    if (!settings?.current_round) return;

    const checkExistingAnswer = async () => {
      const { data: ansData } = await supabase
        .from('live_answers')
        .select('answer')
        .eq('team_id', teamId)
        .maybeSingle();
      
      if (ansData) {
        setLiveAnswer(ansData.answer);
      } else {
        setLiveAnswer(null);
        setTextInput('');
      }
    };

    checkExistingAnswer();
  }, [settings?.current_round, teamId]);

  // Si l'équipe n'est pas trouvée (chargement en cours)
  if (!team || !settings) {
    return <div className="min-h-screen flex items-center justify-center text-white font-paytone animate-pulse text-2xl">Chargement...</div>;
  }

  // ÉCRAN 1 : Éliminé
  if (team.is_eliminated) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center bg-gray-900 absolute inset-0 z-50">
        <div className="bg-gray-800 p-8 rounded-3xl border-4 border-gray-600 w-full max-w-md shadow-2xl filter grayscale">
          <h2 className="text-4xl text-gray-400 font-paytone mb-4">Équipe {team.id}</h2>
          <p className="text-2xl text-gray-500 font-bold uppercase tracking-widest mb-6">Éliminée</p>
          <div className="text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>
          </div>
          <p className="text-gray-500 font-sans">Merci d'avoir joué !</p>
          <p className="text-xl text-gray-400 font-paytone mt-6">Score final : {team.score}</p>
        </div>
      </div>
    );
  }

  // ÉCRAN 2 : Attente du lancement (Prioritaire sur tout le reste quand le jeu n'est pas lancé)
  if (!settings.is_playing) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
        <div className={`px-8 py-4 rounded-2xl ${teamColor} border-4 mb-12`}>
          <h2 className="text-4xl text-white font-paytone drop-shadow-md">Équipe {team.name || team.id}</h2>
        </div>
        
        <div className="bg-black/40 p-8 rounded-3xl border-2 border-white/10 w-full max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-6"></div>
          <p className="text-xl text-white font-sans opacity-80">En attente du Maître du Jeu...</p>
        </div>
        
        <button onClick={onLeave} className="mt-12 text-white/50 hover:text-white underline font-sans">Changer d'équipe</button>
      </div>
    );
  }

  // ÉCRAN FINALE (Phase 4)
  if (settings.current_phase === 4) {
    const winner = teams.find(t => !t.is_eliminated) || teams.sort((a, b) => b.score - a.score)[0];
    const isWinner = winner?.id === team.id;
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center bg-gray-900 absolute inset-0 z-50">
        <div className={`${isWinner ? 'bg-yellow-600 border-yellow-400' : 'bg-gray-800 border-gray-600'} p-8 rounded-3xl border-4 w-full max-w-md shadow-2xl`}>
          <h2 className={`text-5xl ${isWinner ? 'text-white' : 'text-gray-400'} font-paytone mb-4`}>
            {isWinner ? '🏆 VICTOIRE !' : 'FIN DE PARTIE'}
          </h2>
          <p className={`text-2xl ${isWinner ? 'text-yellow-200' : 'text-gray-500'} font-bold uppercase tracking-widest mb-6`}>
            {isWinner ? 'Félicitations !' : 'Merci d\'avoir joué !'}
          </p>
          <p className={`text-xl ${isWinner ? 'text-white' : 'text-gray-400'} font-paytone mt-6`}>
            Score final : {team.score}
          </p>
        </div>
      </div>
    );
  }

  // ÉCRAN 3 : Manche Bonus (Départage / Mort Subite au Buzzer)
  if (settings.tie_breaker_mode) {
    const isInTieBreaker = tiedTeamIds.length === 0 || tiedTeamIds.includes(teamId);
    const hasFailedThisQuestion = failedTeamIds.includes(teamId);
    const hasCurrentTeamBuzzed = buzzedTeamId === teamId;
    const isOtherTeamBuzzed = buzzedTeamId !== null && buzzedTeamId !== teamId;

    const handleBuzz = () => {
      if (buzzedTeamId || hasFailedThisQuestion) return;
      supabase.channel('buzzer').send({
        type: 'broadcast',
        event: 'buzz',
        payload: { teamId, timestamp: Date.now() }
      });
      setBuzzedTeamId(teamId);
    };

    // Cas 3.1 : L'équipe est déjà qualifiée
    if (!isInTieBreaker) {
      return (
        <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
          <div className="bg-green-950/60 p-8 rounded-3xl border-4 border-green-500 w-full max-w-md shadow-2xl backdrop-blur-md">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl text-yellow-400 font-paytone mb-2">Qualifiés !</h2>
            <p className="text-white font-sans text-lg mb-4">
              Votre équipe est qualifiée pour la phase suivante !
            </p>
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 text-white/70 text-sm">
              Vos adversaires sont actuellement en manche de départage au buzzer.
            </div>
          </div>
        </div>
      );
    }

    // Cas 3.2 : L'équipe est en ballotage / mort subite
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
        <div className="flex items-center gap-2 mb-4 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/40">
          <span className="text-2xl animate-bounce">⚡</span>
          <span className="text-yellow-300 font-paytone text-lg uppercase tracking-wide">Mort Subite</span>
        </div>
        
        <h2 className="text-4xl text-3d-yellow font-paytone mb-2 drop-shadow-lg">Manche Buzzer !</h2>
        <p className="text-white/80 font-sans mb-8 uppercase tracking-widest font-bold text-sm">
          Le premier qui buzze donne sa réponse à l'oral
        </p>
        
        {hasCurrentTeamBuzzed ? (
          <div className="bg-yellow-500/20 p-10 rounded-[3rem] border-4 border-yellow-400 animate-pulse max-w-md shadow-2xl">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-3xl text-yellow-300 font-paytone uppercase tracking-widest mb-3">
              VOUS AVEZ BUZZÉ !
            </p>
            <p className="text-white text-lg font-sans font-bold">
              Donnez votre réponse immédiatement à l'oral au Maître du Jeu !
            </p>
          </div>
        ) : isOtherTeamBuzzed ? (
          <div className="bg-blue-950/60 p-10 rounded-[3rem] border-4 border-blue-400 max-w-md shadow-2xl">
            <div className="text-5xl mb-4 animate-spin">⏳</div>
            <p className="text-2xl text-blue-300 font-paytone uppercase tracking-widest mb-2">
              L'ÉQUIPE {buzzedTeamId} A BUZZÉ
            </p>
            <p className="text-white/80 text-sm font-sans">
              Écoute de sa réponse par le Maître du Jeu... Tenez-vous prêts si sa réponse est fausse !
            </p>
          </div>
        ) : hasFailedThisQuestion ? (
          <div className="bg-red-950/60 p-8 rounded-3xl border-4 border-red-500 max-w-md shadow-2xl">
            <div className="text-5xl mb-3">❌</div>
            <p className="text-2xl text-red-300 font-paytone uppercase tracking-wide mb-2">
              Mauvaise Réponse
            </p>
            <p className="text-white/70 text-sm font-sans">
              Votre buzzer est verrouillé pour cette photo. En attente de la photo suivante...
            </p>
          </div>
        ) : (
          <button 
            onClick={handleBuzz}
            className="w-64 h-64 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-8 border-red-900 shadow-[0_15px_0_rgb(153,27,27),0_20px_40px_rgba(0,0,0,0.6)] text-white text-4xl font-paytone uppercase tracking-wider transition-all active:translate-y-4 active:shadow-none hover:from-red-400 hover:to-red-600 flex flex-col items-center justify-center gap-2 animate-pulse"
          >
            <span className="text-4xl">🔔</span>
            <span>BUZZER !</span>
          </button>
        )}
      </div>
    );
  }

  // ÉCRAN 4 : Résultats Révélés
  if (settings.show_results) {
    const isCorrect = question && liveAnswer && (
      getLevenshteinDistance(normalizeText(liveAnswer), normalizeText(question.correct_answer)) <= (question.correct_answer.length >= 6 ? 2 : 1) ||
      liveAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()
    );
    
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
        <h2 className="text-3xl text-white font-paytone mb-8 opacity-80">Fin de la manche</h2>
        
        <div className={`p-10 rounded-3xl border-4 w-full max-w-md shadow-2xl ${
          isCorrect ? 'bg-green-600/20 border-green-500' : 'bg-red-600/20 border-red-500'
        }`}>
          <p className="text-xl text-white font-sans mb-4">Votre réponse :</p>
          <p className="text-3xl text-white font-bold mb-8 drop-shadow-md break-words">{liveAnswer || 'Aucune réponse'}</p>
          
          <div className="text-5xl font-paytone uppercase tracking-wider">
            {isCorrect ? (
              <span className="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">Vrai !</span>
            ) : (
              <span className="text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]">Faux !</span>
            )}
          </div>
        </div>
        
        <div className="mt-12 bg-black/40 px-8 py-4 rounded-full border-2 border-white/20">
          <p className="text-2xl text-yellow-400 font-paytone">Score Total : {team.score}</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ÉCRAN 5 : EN JEU (Affichage des questions régulières)
  // ==========================================

  const submitAnswer = async (answer: string) => {
    if (isSubmitting || liveAnswer) return;
    if (timeLeft <= 0) return; // Prevent answering if time is up
    setIsSubmitting(true);
    
    const timeTaken = (Date.now() - startTime) / 1000;
    
    const { error } = await supabase
      .from('live_answers')
      .upsert({
        team_id: teamId,
        answer: answer,
        time_taken: timeTaken
      });
      
    if (!error) {
      setLiveAnswer(answer);
    } else {
      alert("Erreur lors de l'envoi de la réponse.");
    }
    setIsSubmitting(false);
  };

  // Si l'équipe a déjà répondu
  if (liveAnswer) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
        <div className="bg-blue-900/60 p-8 rounded-3xl border-4 border-blue-400 w-full max-w-md shadow-2xl backdrop-blur-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 mx-auto mb-6 drop-shadow-lg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>
          <h3 className="text-3xl text-white font-paytone mb-2">Réponse enregistrée</h3>
          <p className="text-white/70 font-sans">En attente des autres joueurs...</p>
        </div>
      </div>
    );
  }

  // Formulaire de réponse (Phase 1, 2, ou 3)
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen p-4 text-center">
      
      {/* Header compact */}
      <div className="flex justify-between items-center w-full max-w-md mb-6 bg-black/40 rounded-xl p-3 border border-white/20">
        <span className={`px-4 py-1 rounded text-white font-bold ${teamColor.split(' ')[0]}`}>Équipe {teamId}</span>
        <span className="text-yellow-400 font-paytone">Phase {settings.current_phase}</span>
      </div>

      {/* Miniature Photo (si dispo) */}
      {question?.photo_url && (
        <div className="mb-6 w-full max-w-sm rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl bg-black/50 relative" style={{ maxHeight: '30vh' }}>
          <img src={question.photo_url} alt="Indice" className="w-full h-full object-contain" />
        </div>
      )}

      {/* Phase 1 et 2 : Boutons */}
      {(settings.current_phase === 1 || settings.current_phase === 2) && (
        <div className={`grid gap-4 w-full max-w-md ${settings.current_phase === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {choices.map((choice, idx) => {
            const btnColors = [
              'bg-gradient-to-b from-pink-400 to-pink-700 border-pink-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(157,23,77),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(157,23,77),0_5px_10px_rgba(0,0,0,0.5)] hover:from-pink-300 hover:to-pink-600',
              'bg-gradient-to-b from-blue-400 to-blue-700 border-blue-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(30,58,138),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(30,58,138),0_5px_10px_rgba(0,0,0,0.5)] hover:from-blue-300 hover:to-blue-600',
              'bg-gradient-to-b from-orange-400 to-orange-700 border-orange-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(154,52,18),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(154,52,18),0_5px_10px_rgba(0,0,0,0.5)] hover:from-orange-300 hover:to-orange-600',
              'bg-gradient-to-b from-teal-400 to-teal-700 border-teal-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(17,94,89),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(17,94,89),0_5px_10px_rgba(0,0,0,0.5)] hover:from-teal-300 hover:to-teal-600'
            ];
            const colorClass = btnColors[idx % btnColors.length];
            return (
              <button 
                key={idx}
                onClick={() => submitAnswer(choice)}
                disabled={isSubmitting || timeLeft <= 0}
                className={`w-full ${colorClass} text-white font-paytone text-xl md:text-2xl py-4 md:py-6 px-4 rounded-3xl border-2 border-b-4 transition-all active:translate-y-1 break-words disabled:opacity-50 relative overflow-hidden ${timeLeft <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{choice}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Phase 3 : Saisie libre */}
      {settings.current_phase === 3 && (
        <form 
          onSubmit={(e) => { e.preventDefault(); if (textInput.trim()) submitAnswer(textInput); }}
          className="w-full max-w-md bg-black/40 p-6 rounded-3xl border-2 border-white/20 shadow-2xl"
        >
          <p className="text-white/80 font-sans mb-4 font-bold uppercase tracking-widest text-sm">Qui est-ce ?</p>
          <input 
            type="text" 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={timeLeft <= 0}
            placeholder={timeLeft <= 0 ? "Temps écoulé !" : "Tapez le nom..."}
            className={`w-full bg-white text-black font-sans font-bold text-2xl p-4 rounded-xl mb-4 text-center outline-none focus:ring-4 focus:ring-blue-500 ${timeLeft <= 0 ? 'opacity-50' : ''}`}
            autoFocus
          />
          <button 
            type="submit"
            disabled={isSubmitting || !textInput.trim() || timeLeft <= 0}
            className="w-full bg-green-500 hover:bg-green-400 border-green-700 shadow-[0_6px_0_rgb(21,128,61)] text-white text-2xl font-paytone uppercase py-4 rounded-xl border-4 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 disabled:shadow-[0_6px_0_rgb(21,128,61)]"
          >
            {timeLeft <= 0 ? 'Temps écoulé' : 'Valider'}
          </button>
        </form>
      )}

    </div>
  );
}
