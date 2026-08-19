import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import TeamDashboard from '../components/team/TeamDashboard';
import { useGameState } from '../hooks/useGameState';

export default function Team() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const { teams, loading } = useGameState();

  // Permet de mémoriser l'équipe choisie en local storage pour éviter de devoir re-sélectionner en cas de rafraîchissement
  useEffect(() => {
    const saved = localStorage.getItem('selectedTeamId');
    if (saved) setSelectedTeam(saved);
  }, []);

  const handleSelectTeam = (id: string) => {
    setSelectedTeam(id);
    localStorage.setItem('selectedTeamId', id);
  };

  const handleLeave = () => {
    setSelectedTeam(null);
    localStorage.removeItem('selectedTeamId');
  };

  if (selectedTeam) {
    return <TeamDashboard teamId={selectedTeam} onLeave={handleLeave} />;
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1, transition: { type: 'spring' } }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-[100dvh] md:min-h-screen p-4 md:p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black -z-10"></div>
      
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-full max-w-sm mb-6 md:mb-12 drop-shadow-2xl"
      >
        <span className="block text-xl md:text-2xl text-white font-sans font-bold drop-shadow-md mb-2 md:mb-4 uppercase tracking-widest">Interface Équipe</span>
        <motion.img 
          src={`${import.meta.env.BASE_URL}logo.png`} 
          alt="À qui qu'elle est cette Tête de visage ?" 
          animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }} 
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} 
          className="w-full h-auto object-contain max-h-[25vh]"
        />
      </motion.div>
      
      <div className="bg-black/40 p-6 md:p-10 rounded-3xl border-4 border-white/20 w-full max-w-xl shadow-2xl backdrop-blur-sm z-10">
        <p className="text-xl md:text-2xl text-white mb-4 md:mb-8 font-sans font-bold">Sélectionnez votre équipe :</p>
        
        {loading ? (
          <div className="animate-pulse text-white text-xl">Chargement des équipes...</div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:gap-6">
            {teams.map(team => {
              const teamStyles: Record<string, string> = {
                'A': 'bg-gradient-to-b from-blue-400 to-blue-700 border-blue-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(30,58,138),0_10px_20px_rgba(0,0,0,0.5)] hover:from-blue-300 hover:to-blue-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(30,58,138),0_5px_10px_rgba(0,0,0,0.5)]',
                'B': 'bg-gradient-to-b from-red-400 to-red-700 border-red-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(153,27,27),0_10px_20px_rgba(0,0,0,0.5)] hover:from-red-300 hover:to-red-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(153,27,27),0_5px_10px_rgba(0,0,0,0.5)]',
                'C': 'bg-gradient-to-b from-green-400 to-green-700 border-green-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(20,83,45),0_10px_20px_rgba(0,0,0,0.5)] hover:from-green-300 hover:to-green-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(20,83,45),0_5px_10px_rgba(0,0,0,0.5)]',
                'D': 'bg-gradient-to-b from-purple-400 to-purple-700 border-purple-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(88,28,135),0_10px_20px_rgba(0,0,0,0.5)] hover:from-purple-300 hover:to-purple-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(88,28,135),0_5px_10px_rgba(0,0,0,0.5)]'
              };
              
              const isEliminated = team.is_eliminated;
              
              return (
                <motion.button 
                  variants={item}
                  key={team.id}
                  onClick={() => handleSelectTeam(team.id)}
                  disabled={isEliminated}
                  className={`
                    ${teamStyles[team.id] || 'bg-gray-600'} 
                    ${isEliminated ? 'filter grayscale opacity-50 cursor-not-allowed' : ''}
                    text-white py-6 md:py-8 px-4 rounded-3xl border-2 border-b-4 transition-all active:translate-y-1 flex flex-col items-center justify-center gap-1 md:gap-2 relative overflow-hidden
                  `}
                >
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
                  <span className="relative z-10 text-4xl md:text-5xl font-paytone drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{team.id}</span>
                  <span className="relative z-10 text-sm font-sans uppercase tracking-wider font-bold truncate w-full max-w-full drop-shadow-md">
                    {team.name || `Équipe ${team.id}`}
                  </span>
                  {isEliminated && <span className="relative z-10 text-xs bg-black/50 px-2 py-1 rounded text-white mt-1">Éliminée</span>}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      <div className="mt-12 z-10">
        <Link to="/" className="text-white/60 hover:text-white underline text-xl transition-colors font-sans px-6 py-3 rounded-xl hover:bg-white/10">Retour au Hub</Link>
      </div>
    </div>
  );
}
