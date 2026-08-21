import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { GameSettings } from '../../types';

interface Props {
  settings: GameSettings | null;
}

export default function AdminMediaManager({ settings }: Props) {
  const [bgVideo, setBgVideo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (settings) {
      setBgVideo(settings.bg_video_url || '');
    }
  }, [settings]);

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('game_settings')
        .update({ bg_video_url: bgVideo })
        .eq('id', 1);

      if (error) throw error;

      setMessage({ text: 'Vidéo enregistrée avec succès !', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: "Erreur lors de la sauvegarde de la vidéo.",
        type: 'error'
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="bg-white/5 p-4 rounded-lg border border-white/10 mt-4">
      <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        Habillage sonore & visuel
      </h3>

      <div className="mb-5 rounded-lg border border-purple-400/30 bg-purple-950/30 p-4 text-sm text-white/80">
        <p className="font-bold text-purple-200">Sons locaux du projet</p>
        <p className="mt-1 leading-relaxed">
          Les musiques et bruitages sont lus exclusivement depuis <code className="rounded bg-black/40 px-1.5 py-0.5 text-purple-100">public/audio/</code>.
          Il n’est plus nécessaire de renseigner une URL ni de modifier Supabase.
        </p>
        <p className="mt-2 leading-relaxed text-white/60">
          Remplacez simplement les fichiers MP3 en conservant leur nom. La liste complète des fichiers et de leurs déclencheurs est disponible dans <code className="rounded bg-black/40 px-1.5 py-0.5">public/audio/README.md</code>.
        </p>
      </div>

      <form onSubmit={handleSaveVideo} className="space-y-4">
        <div>
          <label className="block text-white/70 text-xs mb-1 font-bold uppercase tracking-wider">URL Vidéo Jingle / Background</label>
          <input
            type="url"
            value={bgVideo}
            onChange={e => setBgVideo(e.target.value)}
            className="w-full bg-black/50 border border-white/20 rounded p-2 text-white text-sm outline-none focus:border-purple-500 transition-colors"
            placeholder="https://..."
          />
        </div>

        {message && (
          <div className={`p-3 rounded text-sm font-medium ${message.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500/50' : 'bg-red-900/50 text-red-200 border border-red-500/50'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded border border-purple-400 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? 'Sauvegarde...' : 'Enregistrer la vidéo'}
        </button>
      </form>
    </div>
  );
}
