import React, { useState } from 'react';
import { Question } from '../../types';

interface Props {
  onAdd: (q: Omit<Question, 'id'>) => Promise<any>;
  currentCount: number;
}

export default function QuestionForm({ onAdd, currentCount }: Props) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [phase, setPhase] = useState(1);
  const [duration, setDuration] = useState(30);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [wrongAnswersStr, setWrongAnswersStr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const wrongAnswers = wrongAnswersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    await onAdd({
      photo_url: photoUrl,
      phase,
      duration,
      correct_answer: correctAnswer,
      wrong_answers: wrongAnswers,
      order: currentCount + 1,
    });
    
    setLoading(false);
    setPhotoUrl('');
    setCorrectAnswer('');
    setWrongAnswersStr('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-black/40 p-6 rounded-2xl border-2 border-white/20 flex flex-col gap-4 font-sans text-left shadow-xl">
      <h2 className="text-2xl text-yellow-400 font-paytone mb-2 drop-shadow-md">Ajouter une manche</h2>
      
      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold">URL de la photo *</label>
        <input required type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors shadow-inner" placeholder="https://..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-white/80 text-sm mb-1 font-bold">Phase *</label>
          <select value={phase} onChange={e => setPhase(Number(e.target.value))} className="w-full bg-black/80 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors shadow-inner appearance-none">
            <option value={1}>Phase 1 (2 choix)</option>
            <option value={2}>Phase 2 (4 choix)</option>
            <option value={3}>Phase 3 (Saisie textuelle)</option>
          </select>
        </div>
        <div>
          <label className="block text-white/80 text-sm mb-1 font-bold">Durée (secondes) *</label>
          <input required type="number" min="5" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors shadow-inner" />
        </div>
      </div>

      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold text-green-300">Bonne réponse *</label>
        <input required type="text" value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-green-500 transition-colors shadow-inner" placeholder="Ex: Jean Dujardin" />
      </div>

      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold text-red-300">Mauvaises réponses</label>
        <p className="text-xs text-white/50 mb-2">Séparez les propositions par des virgules</p>
        <input type="text" value={wrongAnswersStr} onChange={e => setWrongAnswersStr(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-red-500 transition-colors shadow-inner" placeholder="Ex: George Clooney, Brad Pitt" />
      </div>

      <button disabled={loading} type="submit" className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl border-2 border-blue-400 transition-all active:translate-y-1 active:shadow-none shadow-[0_6px_0_rgb(30,58,138)] disabled:opacity-50 disabled:active:translate-y-0 disabled:shadow-[0_6px_0_rgb(30,58,138)] uppercase tracking-wider">
        {loading ? 'Création...' : 'Créer la manche'}
      </button>
    </form>
  );
}
