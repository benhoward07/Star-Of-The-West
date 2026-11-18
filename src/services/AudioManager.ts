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

/**
 * A short fingerprint of a narration's text. The generated recordings store
 * it, so the game can tell when the words were edited after recording.
 */
export function narrationHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** What public/audio/narration.json says about one generated recording. */
export interface RecordingInfo {
  /** narrationHash() of the text that was recorded. */
  hash: string;
  /** Start and end time, in seconds, of each sentence. */
  sentences: [number, number][];
}

function parseManifest(data: unknown): Map<string, RecordingInfo> {
  const result = new Map<string, RecordingInfo>();
  const files = (data as { files?: unknown } | null)?.files;
  if (typeof files !== 'object' || files === null) return result;
  for (const [file, value] of Object.entries(files as Record<string, unknown>)) {
    const info = value as Partial<RecordingInfo> | null;
    if (typeof info?.hash !== 'string' || !Array.isArray(info.sentences)) continue;
    const sentences = info.sentences.filter(
      (pair): pair is [number, number] =>
        Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number',
    );
    result.set(file, { hash: info.hash, sentences });
  }
  return result;
}

export class AudioManager {
  private recorded = new Map<string, boolean>();
  private recordings = new Map<string, RecordingInfo>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private reportedSentence = -1;
  private source: NarrationSource | null = null;
  private handlers: NarrationHandlers | null = null;
  private sentences: string[] = [];
  private sentenceIndex = 0;
  private audio: HTMLAudioElement | null = null;
  private state: NarrationState = 'idle';
  /** Bumped whenever playback is interrupted, so stale speech callbacks are ignored. */
  private token = 0;

  /** Check once, at startup, which recorded narration files actually exist. */
  async probe(files: string[], manifestUrl = 'audio/narration.json'): Promise<void> {
    try {
      const response = await fetch(manifestUrl);
      if (response.ok) this.recordings = parseManifest(await response.json());
    } catch {
      // No sentence timings: recordings still play, just without highlighting.
    }

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
    if (this.recorded.get(source.audioFile) && !this.isStale(source)) return 'mp3';
    return this.canSpeak ? 'speech' : 'text';
  }

  /** True when a generated recording no longer matches the narration text. */
  private isStale(source: NarrationSource): boolean {
    const info = this.recordings.get(source.audioFile);
    return info !== undefined && info.hash !== narrationHash(source.narration);
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
      this.stopTicker();
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

  /** While a recording plays, keep the highlighted sentence in step with it. */
  private startTicker(): void {
    this.stopTicker();
    const timings = this.source ? this.recordings.get(this.source.audioFile)?.sentences : undefined;
    if (!timings || timings.length === 0) return;

    const report = () => {
      const time = this.audio?.currentTime ?? 0;
      let index = -1;
      for (let i = 0; i < timings.length; i++) {
        if (time >= timings[i][0] - 0.05) index = i;
      }
      if (index !== this.reportedSentence) {
        this.reportedSentence = index;
        this.handlers?.onSentence(index);
      }
    };
    report();
    this.ticker = setInterval(report, 100);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private haltPlayback(): void {
    this.token++;
    this.stopTicker();
    this.reportedSentence = -1;
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
        if (this.audio !== audio) return;
        this.stopTicker();
        this.reportedSentence = -1;
        this.handlers?.onSentence(-1);
        this.setState('ended');
      });
      audio.addEventListener('error', () => {
        if (this.audio !== audio) return;
        // The file could not be played: fall back to the device voice next time.
        this.stopTicker();
        this.audio = null;
        this.recorded.set(source.audioFile, false);
        this.handlers?.onSentence(-1);
        this.setState('idle');
      });
      this.audio = audio;
    }

    if (this.state === 'ended') this.audio.currentTime = 0;
    this.setState('playing');
    this.startTicker();
    this.audio.play().catch(() => {
      if (this.state !== 'playing') return;
      this.stopTicker();
      this.setState('idle');
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
