import { Question } from '../../types';

interface Props {
  questions: Question[];
  onDelete: (id: string) => void;
  loading: boolean;
}

export default function QuestionList({ questions, onDelete, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-black/40 p-6 rounded-2xl border-2 border-white/20 flex flex-col items-center justify-center h-[600px] shadow-xl">
        <div className="text-2xl text-white animate-pulse font-paytone tracking-widest">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 p-6 rounded-2xl border-2 border-white/20 flex flex-col gap-4 font-sans text-left h-[600px] overflow-y-auto shadow-xl">
      <h2 className="text-2xl text-yellow-400 font-paytone mb-2 drop-shadow-md sticky top-0 bg-transparent backdrop-blur-md pb-2 z-10">
        Manches configurées ({questions.length})
      </h2>
      
      {questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50 text-lg italic text-center">Aucune question n'a encore été ajoutée au jeu.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="bg-white/10 border border-white/20 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start relative hover:bg-white/15 transition-colors">
              {/* Image Preview Container */}
              <div className="w-full sm:w-32 h-32 bg-black/50 rounded-lg flex-shrink-0 overflow-hidden border border-white/10 shadow-inner">
                {q.photo_url ? (
                  <img src={q.photo_url} alt="Question preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-white/30 p-2 text-center">Image manquante</div>
                )}
              </div>
              
              {/* Question Data */}
              <div className="flex-grow w-full">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider text-white">Phase {q.phase}</span>
                  <span className="bg-gray-700 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider text-white">⏱ {q.duration}s</span>
                  <span className="text-white/40 text-xs ml-auto">N°{q.order}</span>
                </div>
                
                <div className="bg-black/30 rounded p-3 mb-2 border border-green-500/30">
                  <span className="text-green-400 font-bold block text-sm uppercase mb-1">Bonne réponse</span>
                  <p className="text-white text-lg font-bold">{q.correct_answer}</p>
                </div>

                {q.wrong_answers && q.wrong_answers.length > 0 && (
                  <div className="bg-black/30 rounded p-3 border border-red-500/30">
                    <span className="text-red-400 font-bold block text-sm uppercase mb-1">Propositions factices</span>
                    <p className="text-white/80 text-sm">{q.wrong_answers.join(' • ')}</p>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <button 
                onClick={() => {
                  if (window.confirm("Voulez-vous vraiment supprimer cette manche ?")) {
                    onDelete(q.id);
                  }
                }} 
                className="absolute top-4 right-4 text-red-500 hover:text-white p-2 bg-black/40 hover:bg-red-600 rounded-lg transition-colors border border-red-500/30 hover:border-red-500" 
                title="Supprimer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
