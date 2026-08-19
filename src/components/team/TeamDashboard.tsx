import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGameState } from '../../hooks/useGameState';
import { Question } from '../../types';

interface Props {
  teamId: string;
  onLeave: () => void;
}

export default function TeamDashboard({ teamId, onLeave }: Props) {
  const { settings, teams } = useGameState();
  const [question, setQuestion] = useState<Question | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const team = teams.find(t => t.id === teamId);
  const teamColor = 
    teamId === 'A' ? 'bg-blue-600 border-blue-800 shadow-[0_6px_0_rgb(30,58,138)]' :
    teamId === 'B' ? 'bg-red-600 border-red-800 shadow-[0_6px_0_rgb(153,27,27)]' :
    teamId === 'C' ? 'bg-green-600 border-green-800 shadow-[0_6px_0_rgb(21,128,61)]' :
    'bg-purple-600 border-purple-800 shadow-[0_6px_0_rgb(107,33,168)]';

  // 1. Initialiser le channel pour le buzzer
  useEffect(() => {
    const channel = supabase.channel('buzzer');
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Récupérer la question actuelle et les réponses live à chaque changement de manche
  useEffect(() => {
    if (!settings?.current_round) return;

    const fetchRoundData = async () => {
      // Fetch Question
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('order', settings.current_round)
        .single();
      
      if (qData) {
        setQuestion(qData);
        // Mélanger les choix pour les phases 1 et 2
        if (qData.phase === 1 || qData.phase === 2) {
          const required = qData.phase === 1 ? 2 : 4;
          const allWrongs = [...(qData.wrong_answers || [])].sort(() => Math.random() - 0.5);
          const selected = [qData.correct_answer, ...allWrongs.slice(0, required - 1)];
          setChoices(selected.sort(() => Math.random() - 0.5));
        }
        setStartTime(Date.now());
      }

      // Check if team already answered
      const { data: ansData } = await supabase
        .from('live_answers')
        .select('answer')
        .eq('team_id', teamId)
        .single();
      
      if (ansData) {
        setLiveAnswer(ansData.answer);
      } else {
        setLiveAnswer(null);
        setTextInput('');
      }
    };

    fetchRoundData();
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

  // ÉCRAN 2 : Manche Bonus (Tie-Breaker)
  if (settings.tie_breaker_mode) {
    const handleBuzz = () => {
      if (liveAnswer) return;
      supabase.channel('buzzer').send({
        type: 'broadcast',
        event: 'buzz',
        payload: { teamId, timestamp: Date.now() }
      });
      setLiveAnswer('BUZZ');
    };

    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen p-6 text-center">
        <h2 className="text-4xl text-3d-yellow font-paytone mb-2 drop-shadow-lg">Manche Bonus !</h2>
        <p className="text-white/80 font-sans mb-12 uppercase tracking-widest font-bold">Le plus rapide l'emporte</p>
        
        {liveAnswer === 'BUZZ' ? (
          <div className="bg-black/50 p-12 rounded-full border-4 border-white/20 animate-pulse">
            <p className="text-3xl text-white font-paytone uppercase tracking-widest">Buzz Enregistré</p>
          </div>
        ) : (
          <button 
            onClick={handleBuzz}
            className="w-64 h-64 rounded-full bg-red-600 border-8 border-red-800 shadow-[0_15px_0_rgb(153,27,27)] text-white text-5xl font-paytone uppercase tracking-wider transition-all active:translate-y-4 active:shadow-none hover:bg-red-500 flex items-center justify-center"
          >
            Buzzer
          </button>
        )}
      </div>
    );
  }

  // ÉCRAN 3 : Résultats Révélés
  if (settings.show_results) {
    const isCorrect = question && liveAnswer && 
                      liveAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
    
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

  // ÉCRAN 4 : Attente du lancement
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

  // ==========================================
  // ÉCRAN 5 : EN JEU (Affichage des questions)
  // ==========================================

  const submitAnswer = async (answer: string) => {
    if (isSubmitting || liveAnswer) return;
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
                disabled={isSubmitting}
                className={`w-full ${colorClass} text-white font-paytone text-xl md:text-2xl py-4 md:py-6 px-4 rounded-3xl border-2 border-b-4 transition-all active:translate-y-1 break-words disabled:opacity-50 relative overflow-hidden`}
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
            placeholder="Tapez le nom..."
            className="w-full bg-white text-black font-sans font-bold text-2xl p-4 rounded-xl mb-4 text-center outline-none focus:ring-4 focus:ring-blue-500"
            autoFocus
          />
          <button 
            type="submit"
            disabled={isSubmitting || !textInput.trim()}
            className="w-full bg-green-500 hover:bg-green-400 border-green-700 shadow-[0_6px_0_rgb(21,128,61)] text-white text-2xl font-paytone uppercase py-4 rounded-xl border-4 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 disabled:shadow-[0_6px_0_rgb(21,128,61)]"
          >
            Valider
          </button>
        </form>
      )}

    </div>
  );
}
