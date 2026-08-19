import React from 'react';
import { Team, Question } from '../../types';

interface Props {
  isOpen: boolean;
  tiedTeams: Team[];
  targetSpots: number;
  bonusQuestion: Question | null;
  buzzedTeam: Team | null;
  failedTeamIds: string[];
  savedTeamIds: string[];
  onValidate: (teamId: string) => void;
  onReject: (teamId: string) => void;
  onNextQuestion: () => void;
  onClose: () => void;
}

export function TieBreakerModal({
  isOpen,
  tiedTeams,
  targetSpots,
  bonusQuestion,
  buzzedTeam,
  failedTeamIds,
  savedTeamIds,
  onValidate,
  onReject,
  onNextQuestion,
  onClose,
}: Props) {
  if (!isOpen) return null;

  const remainingTeamsToQualify = tiedTeams.filter(t => !savedTeamIds.includes(t.id));
  const allCurrentFailed = remainingTeamsToQualify.length > 0 && remainingTeamsToQualify.every(t => failedTeamIds.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black border-4 border-yellow-500/80 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(234,179,8,0.4)] text-left font-sans text-white max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">⚡</span>
            <div>
              <h2 className="text-2xl md:text-3xl font-paytone text-yellow-400 uppercase tracking-wide">
                Départage au Buzzer
              </h2>
              <p className="text-xs text-white/60">
                Mort subite : {targetSpots} place(s) qualificative(s) en jeu
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Équipes en ballotage */}
        <div className="mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
            Équipes en compétition :
          </span>
          <div className="flex flex-wrap gap-2">
            {tiedTeams.map(team => {
              const isSaved = savedTeamIds.includes(team.id);
              const hasFailedThisRound = failedTeamIds.includes(team.id);
              const isCurrentlyBuzzed = buzzedTeam?.id === team.id;

              let badgeStyle = "bg-white/10 border-white/20 text-white";
              let statusLabel = "En attente";

              if (isSaved) {
                badgeStyle = "bg-green-600/30 border-green-500 text-green-300 font-bold";
                statusLabel = "✅ Qualifiée / Sauvée";
              } else if (isCurrentlyBuzzed) {
                badgeStyle = "bg-yellow-500 text-black border-yellow-300 font-bold animate-pulse";
                statusLabel = "🔔 A BUZZÉ !";
              } else if (hasFailedThisRound) {
                badgeStyle = "bg-red-900/40 border-red-500 text-red-300";
                statusLabel = "❌ Faux (verrouillé)";
              }

              return (
                <div key={team.id} className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${badgeStyle}`}>
                  <span className="font-paytone text-lg">{team.id}</span>
                  <span className="text-sm">{team.name || `Équipe ${team.id}`}</span>
                  <span className="text-xs opacity-80">({statusLabel})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aperçu Photo Bonus */}
        <div className="bg-black/60 rounded-2xl p-4 border border-white/10 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-full sm:w-40 h-28 bg-gray-900 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 relative">
              {bonusQuestion?.photo_url ? (
                <img src={bonusQuestion.photo_url} alt="Photo Bonus" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-white/40">Aucune photo</div>
              )}
            </div>
            
            <div className="flex-1 w-full">
              <span className="text-xs text-yellow-400 font-bold uppercase tracking-wider block mb-1">
                🔒 Réponse secrète attendue (visible uniquement par vous) :
              </span>
              <div className="bg-green-950/60 border-2 border-green-500 p-3 rounded-xl">
                <p className="text-2xl font-bold text-green-300 font-sans">
                  {bonusQuestion?.correct_answer || 'Non configurée'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Zone d'action Buzz */}
        {buzzedTeam ? (
          <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-2xl p-4 md:p-6 mb-4 text-center">
            <p className="text-sm uppercase tracking-widest text-yellow-300 font-bold mb-2">
              L'équipe suivante est en train de répondre à l'oral :
            </p>
            <div className="text-3xl md:text-4xl font-paytone text-white mb-4 drop-shadow-md">
              🔔 {buzzedTeam.name || `Équipe ${buzzedTeam.id}`}
            </div>
            
            <p className="text-sm text-white/70 mb-4">
              Écoutez sa réponse orale et comparez avec la réponse secrète ci-dessus :
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => onReject(buzzedTeam.id)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-6 rounded-2xl border-2 border-red-400 shadow-[0_6px_0_rgb(153,27,27)] transition-all active:translate-y-1 active:shadow-none uppercase tracking-wider text-base md:text-lg flex items-center justify-center gap-2"
              >
                <span>❌</span> Mauvaise Réponse
              </button>
              
              <button
                onClick={() => onValidate(buzzedTeam.id)}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-6 rounded-2xl border-2 border-green-400 shadow-[0_6px_0_rgb(21,128,61)] transition-all active:translate-y-1 active:shadow-none uppercase tracking-wider text-base md:text-lg flex items-center justify-center gap-2"
              >
                <span>✅</span> Bonne Réponse
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4 text-center">
            {allCurrentFailed ? (
              <div>
                <p className="text-lg text-red-400 font-bold mb-2">
                  ⚠️ Toutes les équipes en ballotage ont donné une mauvaise réponse sur cette photo.
                </p>
                <p className="text-sm text-white/60 mb-4">
                  Cliquez sur "Photo suivante" pour relancer le buzzer avec un nouvel indice.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-2xl text-yellow-400 font-paytone animate-pulse mb-2">
                  ⏳ En attente qu'une équipe appuie sur son Buzzer...
                </div>
                <p className="text-xs text-white/50">
                  Le buzzer est actif uniquement sur les écrans des équipes en ballotage non éliminées sur cette manche.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            onClick={onNextQuestion}
            className="text-xs md:text-sm bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-4 rounded-xl border border-white/20 transition-colors flex items-center gap-2"
          >
            <span>⏭</span> Passer à la photo bonus suivante
          </button>
          
          <button
            onClick={onClose}
            className="text-xs md:text-sm text-white/50 hover:text-white py-2 px-3 underline"
          >
            Fermer la fenêtre (Le buzzer reste actif)
          </button>
        </div>

      </div>
    </div>
  );
}
