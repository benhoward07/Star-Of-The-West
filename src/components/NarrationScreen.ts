import type { TopicData } from '../GameState';
import type { AppContext, Screen } from '../ScreenManager';
import { splitSentences, type NarrationState } from '../services/AudioManager';
import { clear, el } from '../dom';

export interface NarrationParams {
  topicId: string;
  /** True when the player tapped to get here, so audio is allowed to start right away. */
  autoplay?: boolean;
}

/** Plays a topic's narration, shows the words, then leads into the quiz. */
export class NarrationScreen implements Screen<NarrationParams> {
  readonly element: HTMLElement;
  private sentenceNodes: HTMLElement[] = [];
  private playButton: HTMLButtonElement | null = null;
  private statusNode: HTMLElement | null = null;
  private visualizer: HTMLElement | null = null;

  constructor(private ctx: AppContext) {
    this.element = el('main', { class: 'narration-screen' });
  }

  onShow(params: NarrationParams): void {
    const { game, audio, screens } = this.ctx;
    const topic = game.getTopic(params.topicId);
    if (!topic) {
      screens.show('topics');
      return;
    }

    const mode = audio.modeFor(topic);
    this.build(topic, mode);

    audio.load(topic, {
      onState: (state) => this.renderState(state, mode),
      onSentence: (index) => this.highlight(index),
    });
    if (params.autoplay && mode !== 'text') audio.play();
  }

  onHide(): void {
    this.ctx.audio.stop();
  }

  private build(topic: TopicData, mode: 'mp3' | 'speech' | 'text'): void {
    const { audio, screens } = this.ctx;

    this.sentenceNodes = splitSentences(topic.narration).map((sentence) =>
      el('span', { class: 'sentence' }, `${sentence} `),
    );

    this.playButton = el('button', {
      class: 'btn primary play-btn',
      type: 'button',
      onClick: () => (audio.currentState === 'playing' ? audio.pause() : audio.play()),
    });
    this.statusNode = el('p', { class: 'audio-status', 'aria-live': 'polite' });
    this.visualizer = el(
      'div',
      { class: 'visualizer', 'aria-hidden': 'true' },
      el('span'), el('span'), el('span'), el('span'), el('span'),
    );

    const hasQuiz = (topic.quizQuestions?.length ?? 0) > 0;

    clear(this.element);
    this.element.append(
      el(
        'button',
        { class: 'back-link', type: 'button', onClick: () => screens.show('topics') },
        '‹ Topics',
      ),
      el('p', { class: 'eyebrow' }, topic.location),
      el('h1', { class: 'screen-title' }, topic.title),
      el('img', { class: 'narration-art', src: topic.image, alt: '' }),
      mode === 'text'
        ? el('p', { class: 'audio-status' }, 'Audio is not available on this device. Read the story below.')
        : el(
            'section',
            { class: 'card audio-card' },
            el(
              'div',
              { class: 'audio-controls' },
              this.playButton,
              el(
                'button',
                { class: 'btn secondary small', type: 'button', onClick: () => audio.restart() },
                'Restart',
              ),
              this.visualizer,
            ),
            this.statusNode,
          ),
      el('section', { class: 'card transcript', 'aria-label': 'Narration text' }, el('p', {}, ...this.sentenceNodes)),
      el(
        'div',
        { class: 'actions' },
        el(
          'button',
          {
            class: 'btn gold',
            type: 'button',
            onClick: () => screens.show(hasQuiz ? 'quiz' : 'topics', { topicId: topic.id }),
          },
          hasQuiz ? 'Start Quiz ›' : 'Back to Topics',
        ),
      ),
    );
    this.renderState('idle', mode);
  }

  private renderState(state: NarrationState, mode: 'mp3' | 'speech' | 'text'): void {
    if (!this.playButton || !this.statusNode || !this.visualizer) return;

    const labels: Record<NarrationState, string> = {
      idle: '▶ Play Narration',
      playing: '❚❚ Pause',
      paused: '▶ Resume',
      ended: '↻ Play Again',
    };
    this.playButton.textContent = labels[state];
    this.visualizer.classList.toggle('on', state === 'playing');

    const voice = mode === 'mp3' ? 'Recorded narration' : "Read aloud by your device's voice";
    const status: Record<NarrationState, string> = {
      idle: `${voice}. Turn your volume up and tap Play.`,
      playing: `${voice}. Now playing...`,
      paused: 'Paused.',
      ended: 'Finished. Ready for the quiz?',
    };
    this.statusNode.textContent = status[state];
  }

  private highlight(index: number): void {
    this.sentenceNodes.forEach((node, i) => node.classList.toggle('speaking', i === index));
    const active = this.sentenceNodes[index];
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
