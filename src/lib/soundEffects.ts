type MusicMode = 'ambient' | 'suspense' | 'none';

type SoundName =
  | 'ambient'
  | 'suspense'
  | 'new-round'
  | 'start'
  | 'buzzer'
  | 'buzz-start'
  | 'validated'
  | 'correct'
  | 'wrong'
  | 'qualified'
  | 'eliminated'
  | 'tie'
  | 'tick'
  | 'timeup'
  | 'victory';

const SOUND_NAMES: SoundName[] = [
  'ambient',
  'suspense',
  'new-round',
  'start',
  'buzzer',
  'buzz-start',
  'validated',
  'correct',
  'wrong',
  'qualified',
  'eliminated',
  'tie',
  'tick',
  'timeup',
  'victory',
];

/**
 * Gestionnaire audio 100 % local.
 *
 * Tous les fichiers sont placés dans public/audio et sont résolus avec BASE_URL,
 * ce qui rend la solution compatible avec le mode développement, GitHub Pages
 * et l'installation PWA. Les paramètres audio éventuellement présents dans
 * Supabase sont volontairement ignorés : aucune URL distante n'est lue.
 */
class AudioManager {
  private audioFiles: Partial<Record<SoundName, HTMLAudioElement>> = {};
  private preloaded = false;
  private unlocked = false;
  private enabled = false;
  private musicMode: MusicMode = 'none';

  private get audioBasePath() {
    return `${import.meta.env.BASE_URL || '/'}audio/`;
  }

  private preloadAudio() {
    if (this.preloaded || typeof window === 'undefined') return;

    SOUND_NAMES.forEach((name) => {
      const audio = new Audio(`${this.audioBasePath}${name}.mp3`);
      audio.preload = 'auto';
      audio.loop = name === 'ambient' || name === 'suspense';
      audio.volume = name === 'ambient' || name === 'suspense' ? 0.42 : 0.8;
      this.audioFiles[name] = audio;
    });

    this.preloaded = true;
  }

  private canPlay() {
    return this.unlocked && this.enabled;
  }

  async unlock() {
    this.preloadAudio();
    this.unlocked = true;
    this.playSelectedMusic();
  }

  get isEnabled() {
    return this.enabled;
  }

  toggleEnabled() {
    if (this.enabled) {
      this.enabled = false;
      this.stopAllAudio();
      return false;
    }

    this.enabled = true;
    void this.unlock();
    return true;
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.toggleEnabled();
  }

  /**
   * Les arguments sont conservés pour ne pas modifier les appelants existants.
   * Les URLs fournies par Supabase ne sont pas utilisées : les musiques sont
   * toujours public/audio/ambient.mp3 et public/audio/suspense.mp3.
   */
  configureMusic(_ambientUrl?: string, _suspenseUrl?: string) {
    this.preloadAudio();
    this.playSelectedMusic();
  }

  setMusicMode(mode: MusicMode) {
    this.musicMode = mode;
    this.pauseMusic(this.audioFiles.ambient);
    this.pauseMusic(this.audioFiles.suspense);
    this.playSelectedMusic();
  }

  playNewRound() {
    this.playFile('new-round');
  }

  playStart() {
    this.playFile('start');
  }

  playCountdownTick(_urgent: boolean) {
    this.playFile('tick');
  }

  stopCountdownTick() {
    this.pauseMusic(this.audioFiles.tick);
  }

  playTimeUp() {
    this.playFile('timeup');
  }

  playRevealCorrect() {
    this.playFile('correct');
  }

  playPhaseEnd(result: 'qualified' | 'tie' | 'eliminated') {
    this.playFile(result);
  }

  playVictory() {
    this.playFile('victory');
    window.setTimeout(() => this.setMusicMode('ambient'), 1800);
  }

  playBuzzer() {
    this.playFile('buzzer');
  }

  playBuzzStart() {
    this.playFile('buzz-start');
  }

  playValidated() {
    this.playFile('validated');
  }

  playCorrect() {
    this.playFile('correct');
  }

  playWrong() {
    this.playFile('wrong');
  }

  private playFile(name: SoundName) {
    if (!this.canPlay()) return;

    const audio = this.audioFiles[name];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {
      // Le bouton son est nécessaire pour satisfaire la politique d'autoplay.
    });
  }

  private playSelectedMusic() {
    if (!this.canPlay()) return;

    const selected = this.musicMode === 'ambient'
      ? this.audioFiles.ambient
      : this.musicMode === 'suspense'
        ? this.audioFiles.suspense
        : null;

    selected?.play().catch(() => {
      // Le bouton son est nécessaire pour satisfaire la politique d'autoplay.
    });
  }

  private pauseMusic(audio?: HTMLAudioElement) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  private stopAllAudio() {
    SOUND_NAMES.forEach((name) => this.pauseMusic(this.audioFiles[name]));
  }
}

export const audioManager = new AudioManager();
export const soundFX = audioManager;
