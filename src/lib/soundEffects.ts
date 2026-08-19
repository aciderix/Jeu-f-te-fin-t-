type MusicMode = 'ambient' | 'suspense' | 'none';
type OscillatorKind = OscillatorType;

class AudioManager {
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private ambientAudio: HTMLAudioElement | null = null;
  private suspenseAudio: HTMLAudioElement | null = null;
  private ambientSource: MediaElementAudioSourceNode | null = null;
  private suspenseSource: MediaElementAudioSourceNode | null = null;
  private activeOscillators = new Set<OscillatorNode>();
  private unlocked = false;
  private enabled = false;
  private musicMode: MusicMode = 'none';
  private configuredAmbientUrl = '';
  private configuredSuspenseUrl = '';

  private getContext() {
    if (!this.context && typeof window !== 'undefined') {
      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return null;

      this.context = new AudioContextConstructor();
      this.masterBus = this.context.createGain();
      this.musicBus = this.context.createGain();
      this.fxBus = this.context.createGain();
      this.musicBus.connect(this.masterBus);
      this.fxBus.connect(this.masterBus);
      this.masterBus.connect(this.context.destination);
      this.masterBus.gain.value = 0;
      this.musicBus.gain.value = 0.42;
      this.fxBus.gain.value = 0.8;
    }

    return this.context;
  }

  private canPlay() {
    return this.unlocked && this.enabled && this.getContext() !== null;
  }

  async unlock() {
    this.unlocked = true;
    const context = this.getContext();
    if (context?.state === 'suspended') await context.resume().catch(() => {});
    this.setMasterGain(1);
    this.playSelectedMusic();
  }

  get isEnabled() {
    return this.enabled;
  }

  toggleEnabled() {
    if (this.enabled) {
      this.enabled = false;
      this.setMasterGain(0);
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

  configureMusic(ambientUrl?: string, suspenseUrl?: string) {
    if (ambientUrl !== this.configuredAmbientUrl) {
      this.configuredAmbientUrl = ambientUrl || '';
      this.ambientAudio = this.createMusicElement(this.configuredAmbientUrl, this.ambientAudio, this.ambientSource, source => {
        this.ambientSource = source;
      });
    }
    if (suspenseUrl !== this.configuredSuspenseUrl) {
      this.configuredSuspenseUrl = suspenseUrl || '';
      this.suspenseAudio = this.createMusicElement(this.configuredSuspenseUrl, this.suspenseAudio, this.suspenseSource, source => {
        this.suspenseSource = source;
      });
    }
    this.playSelectedMusic();
  }

  setMusicMode(mode: MusicMode) {
    this.musicMode = mode;
    this.pauseMusic(this.ambientAudio);
    this.pauseMusic(this.suspenseAudio);
    this.playSelectedMusic();
  }

  playNewRound() {
    this.playSequence([
      { frequency: 392, duration: 0.12, delay: 0 },
      { frequency: 523.25, duration: 0.22, delay: 0.1 }
    ], 'sine', 0.14);
  }

  playStart() {
    this.playTone(880, 0.15, 'square', 0.16, 0, 1320);
  }

  playCountdownTick(urgent: boolean) {
    this.playTone(urgent ? 740 : 520, urgent ? 0.08 : 0.06, 'sine', urgent ? 0.1 : 0.055);
  }

  playTimeUp() {
    this.playTone(110, 0.42, 'sawtooth', 0.2, 0, 70);
  }

  playRevealCorrect() {
    this.playSequence([
      { frequency: 523.25, duration: 0.22, delay: 0 },
      { frequency: 659.25, duration: 0.22, delay: 0.08 },
      { frequency: 783.99, duration: 0.35, delay: 0.16 }
    ], 'triangle', 0.16);
  }

  playPhaseEnd(result: 'qualified' | 'tie' | 'eliminated') {
    if (result === 'tie') {
      this.playTone(180, 0.35, 'sawtooth', 0.15, 0, 120);
      return;
    }
    this.playSequence(result === 'eliminated'
      ? [{ frequency: 220, duration: 0.3, delay: 0 }]
      : [{ frequency: 392, duration: 0.16, delay: 0 }, { frequency: 523.25, duration: 0.28, delay: 0.12 }], 'triangle', 0.13);
  }

  playVictory() {
    this.playSequence([
      { frequency: 523.25, duration: 0.25, delay: 0 },
      { frequency: 659.25, duration: 0.25, delay: 0.18 },
      { frequency: 783.99, duration: 0.55, delay: 0.36 }
    ], 'triangle', 0.18);
    window.setTimeout(() => this.setMusicMode('ambient'), 1800);
  }

  playBuzzer() {
    this.playTone(440, 0.35, 'sawtooth', 0.22, 0, 220);
  }

  playCorrect() {
    this.playRevealCorrect();
  }

  playWrong() {
    this.playTone(160, 0.4, 'sawtooth', 0.2, 0, 110);
  }

  private createMusicElement(
    url: string,
    previous: HTMLAudioElement | null,
    previousSource: MediaElementAudioSourceNode | null,
    onSource: (source: MediaElementAudioSourceNode | null) => void
  ) {
    this.pauseMusic(previous);
    previousSource?.disconnect();
    onSource(null);
    if (!url || typeof window === 'undefined') return null;

    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    const context = this.getContext();
    if (context && this.musicBus) {
      const source = context.createMediaElementSource(audio);
      source.connect(this.musicBus);
      onSource(source);
    }
    return audio;
  }

  private playSelectedMusic() {
    if (!this.canPlay()) return;
    const selected = this.musicMode === 'ambient' ? this.ambientAudio : this.musicMode === 'suspense' ? this.suspenseAudio : null;
    if (selected) selected.play().catch(() => {});
  }

  private pauseMusic(audio: HTMLAudioElement | null) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  private setMasterGain(value: number) {
    const context = this.getContext();
    if (!context || !this.masterBus) return;
    this.masterBus.gain.cancelScheduledValues(context.currentTime);
    this.masterBus.gain.setValueAtTime(value, context.currentTime);
  }

  private playSequence(notes: Array<{ frequency: number; duration: number; delay: number }>, kind: OscillatorKind, volume: number) {
    if (!this.canPlay()) return;
    notes.forEach(note => this.playTone(note.frequency, note.duration, kind, volume, note.delay));
  }

  private playTone(frequency: number, duration: number, kind: OscillatorKind, volume: number, delay = 0, endFrequency?: number) {
    if (!this.canPlay()) return;
    const context = this.getContext();
    if (!context || !this.fxBus) return;

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.fxBus);
    this.activeOscillators.add(oscillator);
    oscillator.onended = () => this.activeOscillators.delete(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private stopAllAudio() {
    this.pauseMusic(this.ambientAudio);
    this.pauseMusic(this.suspenseAudio);
    this.activeOscillators.forEach(oscillator => {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
    });
    this.activeOscillators.clear();
  }
}

export const audioManager = new AudioManager();
export const soundFX = audioManager;
