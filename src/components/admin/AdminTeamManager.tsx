import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Team } from '../../types';

interface Props {
  teams: Team[];
}

export default function AdminTeamManager({ teams }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEditClick = (team: Team) => {
    setEditingId(team.id);
    setTempName(team.name || '');
  };

  const handleSave = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('teams').update({ name: tempName }).eq('id', id);
    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message);
    }
    setEditingId(null);
    setLoading(false);
  };

  const handleResetScores = async () => {
    if (window.confirm("Attention : cela va remettre tous les scores à 0 et réanimer toutes les équipes. Continuer ?")) {
      setLoading(true);
      const { error } = await supabase.from('teams')
        .update({ score: 0, is_eliminated: false })
        .in('id', ['A', 'B', 'C', 'D']);
        
      if (error) {
        alert("Erreur lors de la réinitialisation : " + error.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 p-4 rounded-lg border border-white/10 mt-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">Configuration des équipes</h3>
        <button 
          onClick={handleResetScores}
          disabled={loading || teams.length === 0}
          className="bg-red-900/50 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded border border-red-500/50 transition-colors disabled:opacity-50"
        >
          Réinitialiser la partie
        </button>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-white/50 italic">Les équipes n'ont pas encore été chargées depuis la base de données.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teams.map((team) => (
            <div key={team.id} className="bg-black/40 border border-white/10 p-3 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-3 w-full">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white ${
                  team.id === 'A' ? 'bg-blue-600' :
                  team.id === 'B' ? 'bg-red-600' :
                  team.id === 'C' ? 'bg-green-600' : 'bg-purple-600'
                }`}>
                  {team.id}
                </div>
                
                {editingId === team.id ? (
                  <div className="flex-1 flex gap-2">
                    <input 
                      type="text" 
                      value={tempName} 
                      onChange={(e) => setTempName(e.target.value)}
                      className="bg-white/10 border border-white/30 rounded px-2 py-1 text-white text-sm w-full outline-none focus:border-blue-500"
                      placeholder="Nom de l'équipe"
                      autoFocus
                    />
                    <button 
                      onClick={() => handleSave(team.id)}
                      disabled={loading}
                      className="text-green-400 hover:text-green-300 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex justify-between items-center group cursor-pointer" onClick={() => handleEditClick(team)}>
                    <span className="text-white font-medium truncate">{team.name || `Équipe ${team.id}`}</span>
                    <span className="text-white/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
