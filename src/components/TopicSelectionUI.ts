import { POINTS_PER_DIFFICULTY, type TopicData } from '../GameState';
import type { AppContext, Screen } from '../ScreenManager';
import { clear, el } from '../dom';
import { HUD } from './HUD';

export interface TopicSelectionOptions {
  /** Optional photo shown at the top of the screen, e.g. './images/summerall-field.jpg'. */
  locationImage?: string;
}

/** The hub: progress, the 3D hunt and Scan QR buttons, and one card per topic. */
export class TopicSelectionUI implements Screen {
  readonly element: HTMLElement;
  private list: HTMLElement;
  private footer: HTMLElement;

  constructor(
    private ctx: AppContext,
    options: TopicSelectionOptions = {},
  ) {
    const hud = new HUD(ctx.game);
    this.list = el('div', { class: 'topic-list' });
    this.footer = el('div', { class: 'actions' });

    this.element = el(
      'main',
      { class: 'topics-screen' },
      hud.element,
      options.locationImage
        ? el('img', { class: 'location-image', src: options.locationImage, alt: 'The Citadel campus' })
        : null,
      el('h1', { class: 'screen-title' }, 'Choose a Topic'),
      el('p', { class: 'lead' }, "Hunt for the floating 3D codes, scan a station's QR code, or tap a topic to begin."),
      el(
        'button',
        { class: 'btn primary hunt-btn', type: 'button', onClick: () => ctx.screens.show('hunt') },
        el('span', { class: 'cube-icon', 'aria-hidden': 'true' }),
        'Hunt for 3D Codes',
      ),
      el(
        'button',
        { class: 'btn secondary scan-btn', type: 'button', onClick: () => ctx.screens.show('scanner') },
        el('span', { class: 'scan-icon', 'aria-hidden': 'true' }),
        'Scan Station QR Code',
      ),
      this.list,
      this.footer,
    );

    ctx.game.topics.subscribe(() => this.render());
    this.render();
  }

  onShow(): void {
    this.render();
  }

  private render(): void {
    const { game, storage, screens } = this.ctx;

    clear(this.list);
    for (const topic of game.topics.value) this.list.append(this.card(topic));

    clear(this.footer);
    if (game.completedTopicCount > 0) {
      this.footer.append(
        el(
          'button',
          { class: 'btn primary', type: 'button', onClick: () => screens.show('conclusion') },
          game.allTopicsCompleted ? 'See Final Results' : 'View Results So Far',
        ),
      );
    }
    this.footer.append(
      el(
        'div',
        { class: 'link-row' },
        el('a', { class: 'text-link', href: '?print=1', target: '_blank', rel: 'noopener' }, 'Print QR codes'),
        game.hasProgress
          ? el(
              'button',
              {
                class: 'text-link',
                type: 'button',
                onClick: () => {
                  if (!confirm('Reset progress? Your score, medals and rank will be cleared.')) return;
                  game.reset();
                  storage.clear();
                  screens.show('title');
                },
              },
              'Reset progress',
            )
          : null,
      ),
    );
  }

  private card(topic: TopicData): HTMLElement {
    const points = POINTS_PER_DIFFICULTY * topic.difficulty;
    const pips = el('span', { class: 'pips', role: 'img', 'aria-label': `Difficulty ${topic.difficulty} of 5` });
    for (let i = 1; i <= 5; i++) pips.append(el('span', { class: i <= topic.difficulty ? 'pip on' : 'pip' }));

    return el(
      'button',
      {
        class: topic.completed ? 'topic-card completed' : 'topic-card',
        type: 'button',
        // Starting from a tap lets the narration begin playing straight away.
        onClick: () => this.ctx.screens.show('narration', { topicId: topic.id, autoplay: true }),
      },
      el('img', { class: 'topic-thumb', src: topic.image, alt: '' }),
      el(
        'span',
        { class: 'topic-body' },
        el('span', { class: 'topic-station' }, topic.location),
        el('span', { class: 'topic-title' }, topic.title),
        el('span', { class: 'topic-desc' }, topic.description),
        el(
          'span',
          { class: 'topic-meta' },
          pips,
          topic.completed
            ? el('span', { class: 'badge done' }, 'Medal earned')
            : el('span', { class: 'badge' }, `${points} pts + quiz bonus`),
        ),
      ),
    );
  }
}
