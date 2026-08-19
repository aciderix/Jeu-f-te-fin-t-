import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useGameState } from '../hooks/useGameState';
import { useQuestions } from '../hooks/useQuestions';
import { useLiveAnswers } from '../hooks/useLiveAnswers';

// Fonction pour calculer la distance de Levenshtein (nombre de fautes de frappe/lettres de différence)
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

// Fonction pour normaliser le texte (enlève les accents, majuscules et espaces superflus)
const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export default function GameMaster() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { settings, teams, error: gameStateError } = useGameState();
  const { questions } = useQuestions();
  const { liveAnswers, clearAnswers } = useLiveAnswers();

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

  const handleStartGame = async () => {
    setIsProcessing(true);
    await clearAnswers();
    const firstQuestion = questions.find(q => q.order === 1);
    
    await supabase.from('game_settings').update({
      is_playing: true,
      current_round: 1,
      current_phase: firstQuestion ? firstQuestion.phase : 1,
      show_results: false,
      tie_breaker_mode: false
    }).eq('id', 1);
    setIsProcessing(false);
  };

  const handleRevealAndScore = async () => {
    if (!settings) return;
    setIsProcessing(true);
    
    const currentQuestion = questions.find(q => q.order === settings.current_round);
    
    if (currentQuestion) {
      // Calcul des points
      for (const team of teams) {
        if (team.is_eliminated) continue;
        
        const teamAnswer = liveAnswers.find(a => a.team_id === team.id);
        if (teamAnswer) {
          // Vérification tolérante : normalisation (accents/casse) et Levenshtein (fautes d'orthographe)
          const normInput = normalizeText(teamAnswer.answer);
          const normTarget = normalizeText(currentQuestion.correct_answer);
          
          // Tolérance : 1 erreur autorisée pour les mots courts, 2 pour les mots plus longs (>= 6 lettres)
          const maxTypos = normTarget.length >= 6 ? 2 : 1;
          const isCorrect = getLevenshteinDistance(normInput, normTarget) <= maxTypos;
          
          if (isCorrect) {
            // +1 point pour une bonne réponse
            await supabase.from('teams')
              .update({ score: team.score + 1 })
              .eq('id', team.id);
          }
        }
      }
    }

    // Afficher les résultats sur l'écran collectif
    await supabase.from('game_settings')
      .update({ show_results: true })
      .eq('id', 1);
      
    setIsProcessing(false);
  };

  const handleNextRound = async () => {
    if (!settings) return;
    setIsProcessing(true);
    
    await clearAnswers();
    const nextRoundIndex = settings.current_round + 1;
    const nextQuestion = questions.find(q => q.order === nextRoundIndex);
    
    await supabase.from('game_settings').update({
      current_round: nextRoundIndex,
      current_phase: nextQuestion ? nextQuestion.phase : settings.current_phase,
      show_results: false,
      tie_breaker_mode: false
    }).eq('id', 1);
    
    setIsProcessing(false);
  };

  const handleToggleTieBreaker = async () => {
    if (!settings) return;
    setIsProcessing(true);
    await supabase.from('game_settings').update({
      tie_breaker_mode: !settings.tie_breaker_mode
    }).eq('id', 1);
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

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-black/40 p-4 md:px-8 md:py-6 rounded-2xl border-2 border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white shadow-[0_4px_0_rgb(107,33,168)]">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          </div>
          <h1 className="text-3xl md:text-4xl text-3d-yellow uppercase m-0">Tableau de bord MDJ</h1>
        </div>
        <Link to="/" className="text-white font-bold font-sans bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl border border-white/20 transition-all">
          Quitter
        </Link>
      </div>

      {gameStateError && (
        <div className="w-full max-w-7xl mb-8 bg-red-900/50 border border-red-500 p-6 rounded-xl text-left font-sans text-white">
          <h3 className="font-bold text-xl mb-2">Erreur DB</h3>
          <p>{gameStateError}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Colonne Gauche : Contrôles du Jeu */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-black/40 p-6 rounded-3xl border-2 border-white/20 shadow-xl">
            <h2 className="text-2xl text-white font-paytone mb-6">Contrôles</h2>
            
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
                  <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Manche Suivante ⏭</span>
                </button>

                <div className="h-px bg-white/10 my-2"></div>

                <button 
                  onClick={handleToggleTieBreaker}
                  disabled={isProcessing}
                  className={`w-full relative overflow-hidden ${settings.tie_breaker_mode ? 'bg-gradient-to-b from-red-400 to-red-700 border-red-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(153,27,27),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(153,27,27),0_5px_10px_rgba(0,0,0,0.5)] hover:from-red-300 hover:to-red-600' : 'bg-gradient-to-b from-gray-500 to-gray-800 border-gray-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(31,41,55),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(31,41,55),0_5px_10px_rgba(0,0,0,0.5)] hover:from-gray-400 hover:to-gray-700'} text-white text-lg font-paytone py-4 rounded-3xl border-2 border-b-4 uppercase transition-all active:translate-y-1 disabled:opacity-50`}
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                  <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{settings.tie_breaker_mode ? "Désactiver Buzzer" : "Activer Manche Buzzer"}</span>
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
                <span className="block text-green-300 text-sm font-bold uppercase mb-1">Bonne Réponse :</span>
                <span className="text-2xl text-white font-bold">{currentQuestion.correct_answer}</span>
              </div>
            </div>
          )}
        </div>

        {/* Colonne Droite : Status des Équipes & Réponses */}
        <div className="lg:col-span-7 bg-black/40 p-4 md:p-6 rounded-3xl border-2 border-white/20 shadow-xl flex flex-col h-[60vh] md:h-[75vh] min-h-[500px]">
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
                      
                      {/* Afficher la réponse uniquement si l'équipe a répondu */}
                      {teamAnswer && (
                         <div className="text-right">
                           <span className="block text-xs text-white/50 mb-0.5">{teamAnswer.time_taken.toFixed(1)}s</span>
                           <span className={`font-bold text-lg ${settings?.show_results ? (
                             getLevenshteinDistance(normalizeText(teamAnswer.answer), normalizeText(currentQuestion?.correct_answer || '')) <= ((currentQuestion?.correct_answer?.length || 0) >= 6 ? 2 : 1)
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

      </div>
    </div>
  );
}

