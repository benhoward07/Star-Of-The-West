import type { AppContext, Screen } from '../ScreenManager';
import { emblemSvg } from '../art';
import { clear, el } from '../dom';

/** Welcome screen with the instructions and the Begin button. */
export class TitleScreen implements Screen {
  readonly element: HTMLElement;
  private actions: HTMLElement;

  constructor(private ctx: AppContext) {
    this.actions = el('div', { class: 'actions' });

    this.element = el(
      'main',
      { class: 'title-screen' },
      el('div', { class: 'title-hero' }, el('div', { html: emblemSvg() })),
      // Title text
      el('h1', { class: 'title' }, 'Star of the West'),
      // Subtitle
      el('p', { class: 'subtitle' }, 'A Citadel Learning Experience'),
      el(
        'section',
        { class: 'card instructions' },
        el('h2', {}, 'How to play'),
        // Instructions
        el(
          'ol',
          {},
          el('li', {}, "Hunt for the floating 3D codes, scan a station's QR code, or just tap a topic."),
          el('li', {}, 'Listen to the story of the Star of the West.'),
          el('li', {}, 'Answer the quiz. Quick, correct answers earn bonus points.'),
          el('li', {}, 'Collect all three medals and rise from Recruit to Colonel.'),
        ),
      ),
      this.actions,
    );
  }

  onShow(): void {
    const { game, storage, screens } = this.ctx;
    clear(this.actions);

    const begin = () => {
      game.startGame();
      screens.show('topics');
    };

    if (game.hasProgress) {
      this.actions.append(
        el('button', { class: 'btn primary', type: 'button', onClick: begin }, 'Continue Experience'),
        el(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            onClick: () => {
              if (!confirm('Start over? Your score, medals and rank will be cleared.')) return;
              game.reset();
              storage.clear();
              this.onShow();
            },
          },
          'Start Over',
        ),
      );
    } else {
      this.actions.append(
        el('button', { class: 'btn primary', type: 'button', onClick: begin }, 'Begin Experience'),
      );
    }
  }
}
