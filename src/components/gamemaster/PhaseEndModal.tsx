import React from 'react';
import { Team } from '../../types';

interface Props {
  isOpen: boolean;
  phase: number;
  hasTie: boolean;
  tiedTeams: Team[];
  eliminatedTeam: Team | null;
  winnerTeam: Team | null;
  onLaunchTieBreaker: () => void;
  onConfirmNextPhase: () => void;
  onCancel: () => void;
}

export function PhaseEndModal({
  isOpen,
  phase,
  hasTie,
  tiedTeams,
  eliminatedTeam,
  winnerTeam,
  onLaunchTieBreaker,
  onConfirmNextPhase,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-gray-900 to-black border-4 border-yellow-500 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-[0_0_50px_rgba(234,179,8,0.5)] text-center font-sans text-white">
        
        {/* Header */}
        <div className="text-5xl mb-4 animate-bounce">
          {phase === 3 ? '🏆' : hasTie ? '⚡' : '🏁'}
        </div>

        <h2 className="text-3xl md:text-4xl font-paytone text-3d-yellow uppercase mb-2">
          {phase === 3 ? 'Fin de la Finale !' : `Fin de la Phase ${phase}`}
        </h2>

        {/* Scénario 1 : Phase 3 terminée (Victoire) */}
        {phase === 3 && !hasTie && winnerTeam && (
          <div className="my-6 p-6 bg-yellow-500/10 border-2 border-yellow-400 rounded-2xl">
            <p className="text-lg text-white/80 uppercase tracking-widest font-bold mb-2">Grande Victoire</p>
            <p className="text-4xl font-paytone text-yellow-400 mb-2">
              🎉 {winnerTeam.name || `Équipe ${winnerTeam.id}`}
            </p>
            <p className="text-xl text-white font-bold">Score final : {winnerTeam.score} points</p>
          </div>
        )}

        {/* Scénario 2 : Égalité en fin de phase (Buzzer requis) */}
        {hasTie && (
          <div className="my-6 p-6 bg-red-950/40 border-2 border-red-500 rounded-2xl">
            <p className="text-lg text-red-300 uppercase tracking-widest font-bold mb-3">
              ⚡ Égalité de score détectée !
            </p>
            <p className="text-white text-base mb-4">
              Les équipes suivantes sont à égalité pour la qualification ({tiedTeams[0]?.score || 0} pts) :
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              {tiedTeams.map(t => (
                <span key={t.id} className="bg-red-600 text-white font-paytone text-xl px-4 py-2 rounded-xl shadow-lg border border-red-300">
                  {t.name || `Équipe ${t.id}`}
                </span>
              ))}
            </div>
            <p className="text-sm text-yellow-300/90 font-medium">
              Une manche bonus au buzzer (mort subite) est nécessaire pour départager les équipes.
            </p>
          </div>
        )}

        {/* Scénario 3 : Pas d'égalité, élimination automatique */}
        {!hasTie && phase < 3 && eliminatedTeam && (
          <div className="my-6 p-6 bg-blue-950/40 border-2 border-blue-500 rounded-2xl">
            <p className="text-base text-white/80 mb-2">
              Score le plus bas ({eliminatedTeam.score} pts) :
            </p>
            <p className="text-3xl font-paytone text-red-400 mb-3">
              ❌ {eliminatedTeam.name || `Équipe ${eliminatedTeam.id}`} est éliminée
            </p>
            <p className="text-sm text-green-300 font-bold">
              Les autres équipes sont directement qualifiées pour la Phase {phase + 1} !
            </p>
          </div>
        )}

        {/* Boutons d'actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-bold border border-white/20 transition-all text-sm uppercase tracking-wider"
          >
            Annuler
          </button>
          
          {hasTie ? (
            <button
              onClick={onLaunchTieBreaker}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-paytone text-xl py-4 px-6 rounded-2xl border-2 border-yellow-300 shadow-[0_6px_0_rgb(161,98,7)] transition-all active:translate-y-1 active:shadow-none uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>⚡</span> Lancer le Départage au Buzzer
            </button>
          ) : (
            <button
              onClick={onConfirmNextPhase}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-paytone text-xl py-4 px-6 rounded-2xl border-2 border-blue-400 shadow-[0_6px_0_rgb(30,58,138)] transition-all active:translate-y-1 active:shadow-none uppercase tracking-wider"
            >
              {phase === 3 ? "Terminer la partie" : `Passer à la Phase ${phase + 1} ⏭`}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
