import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuestions } from '../hooks/useQuestions';
import { useGameState } from '../hooks/useGameState';
import QuestionForm from '../components/admin/QuestionForm';
import QuestionList from '../components/admin/QuestionList';
import AdminTeamManager from '../components/admin/AdminTeamManager';
import AdminMediaManager from '../components/admin/AdminMediaManager';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState(false);
  
  const { questions, loading: questionsLoading, addQuestion, deleteQuestion } = useQuestions();
  const { teams, settings, error: gameStateError } = useGameState();

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

        <h1 className="text-3xl md:text-5xl text-white font-sans font-bold mb-12 uppercase drop-shadow-xl tracking-widest">Administration</h1>
        
        <form onSubmit={handleLogin} className="bg-black/60 p-10 rounded-3xl border-4 border-red-600/60 w-full max-w-md text-center shadow-2xl backdrop-blur-md z-10">
          <p className="text-2xl text-white mb-8 font-sans font-bold drop-shadow-md">Accès Restreint</p>
          
          <div className="mb-8">
            <input 
              type="password" 
              value={pinCode} 
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full text-center text-4xl tracking-[0.5em] p-6 rounded-2xl bg-white/10 border-2 border-white/20 text-white outline-none focus:border-red-500 focus:bg-white/20 transition-all shadow-inner font-sans"
              placeholder="••••"
              autoFocus
            />
            {authError && <p className="text-red-400 font-sans mt-3 text-sm font-bold bg-red-900/40 py-2 rounded">❌ Code PIN incorrect</p>}
          </div>
          
          <button type="submit" className="w-full relative overflow-hidden bg-gradient-to-b from-red-500 to-red-800 border-red-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(153,27,27),0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(153,27,27),0_5px_10px_rgba(0,0,0,0.5)] hover:from-red-400 hover:to-red-700 text-white font-paytone text-2xl py-5 rounded-3xl border-2 border-b-4 transition-all active:translate-y-1 uppercase tracking-wider">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
            <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">Déverrouiller</span>
          </button>
        </form>

        <div className="mt-12">
          <Link to="/" className="text-white/60 hover:text-white underline text-xl transition-colors font-sans px-6 py-3 rounded-xl hover:bg-white/10">Retour au Hub</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4 md:p-8">
      {/* Header Admin */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-black/40 p-4 md:px-8 md:py-6 rounded-2xl border-2 border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-[0_4px_0_rgb(153,27,27)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h1 className="text-3xl md:text-4xl text-3d-yellow uppercase m-0">Espace Admin</h1>
        </div>
        <Link to="/" className="text-white font-bold font-sans bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl border border-white/20 transition-all flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
          Quitter l'Admin
        </Link>
      </div>

      {gameStateError && (
        <div className="w-full max-w-7xl mb-8 bg-red-900/50 border border-red-500 p-6 rounded-xl text-left font-sans shadow-xl">
          <h3 className="text-red-300 font-bold text-xl mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            Erreur de Base de Données
          </h3>
          <p className="text-white mb-4">{gameStateError}</p>
          <div className="bg-black/50 p-4 rounded text-sm font-mono overflow-x-auto border border-white/10 text-white/80">
            Copiez le contenu du fichier <span className="text-yellow-400">supabase-schema.sql</span> (à la racine du projet) et exécutez-le dans le SQL Editor de votre dashboard Supabase pour initialiser les tables requises.
          </div>
        </div>
      )}
      
      {/* Main Grid */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Forms and Settings */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <QuestionForm onAdd={addQuestion} currentCount={questions.length} />
          
          <div className="bg-black/40 p-6 rounded-2xl border-2 border-white/20 font-sans text-left shadow-xl">
             <h2 className="text-xl text-yellow-400 font-paytone mb-4 drop-shadow-sm flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
               Paramètres Globaux
             </h2>
             
             <AdminTeamManager teams={teams} />
             <AdminMediaManager settings={settings} />
             
          </div>
        </div>

        {/* Right Column: List of Questions */}
        <div className="lg:col-span-7">
          <QuestionList questions={questions} loading={questionsLoading} onDelete={deleteQuestion} />
        </div>
      </div>
    </div>
  );
}
