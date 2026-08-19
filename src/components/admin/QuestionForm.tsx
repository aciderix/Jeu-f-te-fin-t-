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

  const isBonus = phase === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const wrongAnswers = isBonus 
      ? [] 
      : wrongAnswersStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    await onAdd({
      photo_url: photoUrl,
      phase,
      duration: isBonus ? 0 : duration,
      correct_answer: correctAnswer,
      wrong_answers: wrongAnswers,
      order: currentCount + 1,
      is_bonus: isBonus,
    });
    
    setLoading(false);
    setPhotoUrl('');
    setCorrectAnswer('');
    setWrongAnswersStr('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-black/40 p-6 rounded-2xl border-2 border-white/20 flex flex-col gap-4 font-sans text-left shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-yellow-400 font-paytone drop-shadow-md">Ajouter une manche</h2>
        {isBonus && (
          <span className="bg-yellow-500 text-black text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            ⚡ Mort Subite / Buzzer
          </span>
        )}
      </div>
      
      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold">Type de manche / Phase *</label>
        <select 
          value={phase} 
          onChange={e => setPhase(Number(e.target.value))} 
          className={`w-full ${isBonus ? 'bg-yellow-950/80 border-yellow-500 text-yellow-300' : 'bg-black/80 border-white/30 text-white'} border rounded-lg p-3 outline-none focus:border-blue-500 transition-colors shadow-inner`}
        >
          <option value={1}>Phase 1 (2 choix)</option>
          <option value={2}>Phase 2 (4 choix)</option>
          <option value={3}>Phase 3 (Saisie textuelle)</option>
          <option value={0}>⚡ Manche Bonus / Mort Subite (Buzzer & validation orale)</option>
        </select>
        {isBonus && (
          <p className="text-xs text-yellow-300/80 mt-1">
            💡 Les manches bonus sont réservées aux départages en cas d'égalité. La photo sera affichée sur le grand écran, et la bonne réponse sera visible <strong>uniquement par le Maître du Jeu</strong> pour valider la réponse orale de l'équipe qui buzze.
          </p>
        )}
      </div>

      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold">URL de la photo *</label>
        <input required type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors shadow-inner" placeholder="https://..." />
      </div>

      {!isBonus && (
        <div>
          <label className="block text-white/80 text-sm mb-1 font-bold">Durée du chrono (secondes) *</label>
          <input required type="number" min="5" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors shadow-inner" />
        </div>
      )}

      <div>
        <label className="block text-white/80 text-sm mb-1 font-bold text-green-300">Bonne réponse attendue *</label>
        <input required type="text" value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-green-500 transition-colors shadow-inner" placeholder={isBonus ? "Ex: Brad Pitt (visible uniquement par le MJ)" : "Ex: Jean Dujardin"} />
      </div>

      {!isBonus && (
        <div>
          <label className="block text-white/80 text-sm mb-1 font-bold text-red-300">Mauvaises réponses</label>
          <p className="text-xs text-white/50 mb-2">Séparez les propositions par des virgules</p>
          <input type="text" value={wrongAnswersStr} onChange={e => setWrongAnswersStr(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white outline-none focus:border-red-500 transition-colors shadow-inner" placeholder="Ex: George Clooney, Brad Pitt" />
        </div>
      )}

      <button disabled={loading} type="submit" className={`mt-4 ${isBonus ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-300 shadow-[0_6px_0_rgb(161,98,7)]' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_6px_0_rgb(30,58,138)]'} font-bold py-4 rounded-xl border-2 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 uppercase tracking-wider`}>
        {loading ? 'Création...' : isBonus ? '⚡ Ajouter la Question Bonus (Buzzer)' : 'Créer la manche'}
      </button>
    </form>
  );
}
