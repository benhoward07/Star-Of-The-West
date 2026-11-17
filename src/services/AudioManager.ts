/**
 * Plays a topic's narration.
 *
 * If a recorded MP3 exists (public/audio/topic1.mp3 ...) it is played.
 * Otherwise the narration script is read aloud with the device's built-in
 * voice, one sentence at a time so the current sentence can be highlighted
 * and pause/resume works reliably on iPhone.
 */

export type NarrationState = 'idle' | 'playing' | 'paused' | 'ended';
export type NarrationMode = 'mp3' | 'speech' | 'text';

export interface NarrationSource {
  audioFile: string;
  narration: string;
}

export interface NarrationHandlers {
  onState(state: NarrationState): void;
  /** Index of the sentence being spoken, or -1 when unknown (recorded audio) or stopped. */
  onSentence(index: number): void;
}

/** Split narration into sentences. Write scripts without abbreviations like "Maj." */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [];
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

export class AudioManager {
  private recorded = new Map<string, boolean>();
  private source: NarrationSource | null = null;
  private handlers: NarrationHandlers | null = null;
  private sentences: string[] = [];
  private sentenceIndex = 0;
  private audio: HTMLAudioElement | null = null;
  private state: NarrationState = 'idle';
  /** Bumped whenever playback is interrupted, so stale speech callbacks are ignored. */
  private token = 0;

  /** Check once, at startup, which recorded narration files actually exist. */
  async probe(files: string[]): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        try {
          const response = await fetch(file, { method: 'HEAD' });
          const type = response.headers.get('content-type') ?? '';
          this.recorded.set(file, response.ok && type.startsWith('audio'));
        } catch {
          this.recorded.set(file, false);
        }
      }),
    );
  }

  get canSpeak(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  modeFor(source: NarrationSource): NarrationMode {
    if (this.recorded.get(source.audioFile)) return 'mp3';
    return this.canSpeak ? 'speech' : 'text';
  }

  get currentState(): NarrationState {
    return this.state;
  }

  /** Get a narration ready. Call play() from a tap to start it (an iPhone requirement). */
  load(source: NarrationSource, handlers: NarrationHandlers): void {
    this.stop();
    this.source = source;
    this.handlers = handlers;
    this.sentences = splitSentences(source.narration);
    this.sentenceIndex = 0;
    this.setState('idle');
  }

  /** Start or resume. Must be called directly from a tap handler the first time. */
  play(): void {
    if (!this.source) return;
    const mode = this.modeFor(this.source);
    if (mode === 'mp3') this.playRecording();
    else if (mode === 'speech') this.speakFrom(this.state === 'paused' ? this.sentenceIndex : 0);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    if (this.audio) {
      this.audio.pause();
    } else {
      this.token++;
      window.speechSynthesis.cancel();
    }
    this.setState('paused');
  }

  /** Start again from the beginning. */
  restart(): void {
    if (!this.source) return;
    this.haltPlayback();
    this.sentenceIndex = 0;
    this.setState('idle');
    this.play();
  }

  /** Stop and forget the current narration. */
  stop(): void {
    this.haltPlayback();
    this.handlers?.onSentence(-1);
    this.state = 'idle';
    this.source = null;
    this.handlers = null;
  }

  // ---- internals ----------------------------------------------------------

  private setState(state: NarrationState): void {
    this.state = state;
    this.handlers?.onState(state);
  }

  private haltPlayback(): void {
    this.token++;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio = null;
    }
    if (this.canSpeak) window.speechSynthesis.cancel();
  }

  private playRecording(): void {
    const source = this.source;
    if (!source) return;

    if (!this.audio) {
      const audio = new Audio(source.audioFile);
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        if (this.audio === audio) this.setState('ended');
      });
      audio.addEventListener('error', () => {
        if (this.audio !== audio) return;
        // The file could not be played: fall back to the device voice next time.
        this.audio = null;
        this.recorded.set(source.audioFile, false);
        this.setState('idle');
      });
      this.audio = audio;
    }

    if (this.state === 'ended') this.audio.currentTime = 0;
    this.setState('playing');
    this.audio.play().catch(() => {
      if (this.state === 'playing') this.setState('idle');
    });
  }

  private speakFrom(index: number): void {
    const synth = window.speechSynthesis;
    const token = ++this.token;
    if (synth.speaking || synth.pending) synth.cancel();

    if (index >= this.sentences.length) {
      this.sentenceIndex = 0;
      this.handlers?.onSentence(-1);
      this.setState('ended');
      return;
    }

    this.sentenceIndex = index;
    const utterance = new SpeechSynthesisUtterance(this.sentences[index]);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    const voice = pickVoice(synth.getVoices());
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (token === this.token) this.speakFrom(index + 1);
    };
    utterance.onerror = () => {
      if (token !== this.token) return;
      this.handlers?.onSentence(-1);
      this.setState('idle');
    };

    this.handlers?.onSentence(index);
    this.setState('playing');
    synth.speak(utterance);
  }
}

/** Prefer a clear English voice when the device offers a choice. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang.replace('_', '-').startsWith('en'));
  const preferred = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex'];
  for (const name of preferred) {
    const match = english.find((voice) => voice.name.includes(name));
    if (match) return match;
  }
  return english.find((voice) => voice.lang.replace('_', '-') === 'en-US') ?? english[0] ?? null;
}
