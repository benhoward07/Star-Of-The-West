import type { AppContext, Screen } from '../ScreenManager';
import { medalSvg, rankInsigniaSvg } from '../art';
import { clear, el } from '../dom';
import { gameBaseUrl } from '../services/links';
import { shareResults } from '../services/share';

const RANK_MESSAGES: Record<string, string> = {
  Recruit: 'Every officer starts as a recruit. Visit a station to begin your climb.',
  Cadet: 'A solid start, Cadet. More stations are waiting.',
  Corporal: 'Good work, Corporal. Keep collecting medals.',
  Sergeant: 'Well done, Sergeant. You know this story well.',
  Lieutenant: 'Impressive, Lieutenant. One more push to the top.',
  Captain: 'Outstanding, Captain. Sharpen those quiz answers to make Colonel.',
  Colonel: 'Top rank! You have mastered the story of the Star of the West, Colonel.',
};

/** Final results: rank, score, medals, sharing and replay. */
export class ConclusionScreen implements Screen {
  readonly element: HTMLElement;

  constructor(private ctx: AppContext) {
    this.element = el('main', { class: 'conclusion-screen' });
  }

  onShow(): void {
    const { game, storage, screens } = this.ctx;
    const done = game.allTopicsCompleted;
    const totalTopics = game.topics.value.length;
    const shareStatus = el('p', { class: 'share-status', 'aria-live': 'polite' });

    const medals = el('div', { class: 'medal-row' });
    for (const medal of game.medals.value) {
      medals.append(
        el(
          'div',
          { class: medal.earned ? 'medal-slot earned' : 'medal-slot' },
          el('span', { html: medalSvg(medal, 64) }),
          el('span', { class: 'medal-slot-name' }, medal.name),
        ),
      );
    }

    const share = async () => {
      const outcome = await shareResults(
        {
          rank: game.rank.value,
          score: game.score.value,
          medals: game.earnedMedalCount,
          totalMedals: game.medals.value.length,
        },
        gameBaseUrl(),
      );
      const messages = {
        shared: 'Shared!',
        copied: 'Result copied. Paste it anywhere to share.',
        cancelled: '',
        failed: 'Sharing is not available on this device.',
      };
      shareStatus.textContent = messages[outcome];
    };

    clear(this.element);
    this.element.append(
      el('p', { class: 'eyebrow' }, done ? 'Experience Complete' : 'Results So Far'),
      el('h1', { class: 'screen-title' }, done ? 'Mission Accomplished' : 'Your Progress'),
      el(
        'section',
        { class: 'card rank-card' },
        el('span', { html: rankInsigniaSvg(game.rankIndex, 96) }),
        el('p', { class: 'hud-label' }, 'Final rank'),
        el('p', { class: 'final-rank' }, game.rank.value),
        el('p', { class: 'muted' }, RANK_MESSAGES[game.rank.value] ?? ''),
      ),
      el(
        'section',
        { class: 'stat-grid' },
        el('div', { class: 'card stat' }, el('p', { class: 'big-number' }, String(game.score.value)), el('p', {}, 'points')),
        el(
          'div',
          { class: 'card stat' },
          el('p', { class: 'big-number' }, `${game.completedTopicCount}/${totalTopics}`),
          el('p', {}, 'topics'),
        ),
      ),
      el('section', { class: 'card' }, el('h2', {}, 'Medals'), medals),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'btn gold', type: 'button', onClick: share }, 'Share Results'),
        shareStatus,
        done
          ? null
          : el('button', { class: 'btn primary', type: 'button', onClick: () => screens.show('topics') }, 'Back to Topics'),
        el(
          'button',
          {
            class: done ? 'btn primary' : 'btn ghost',
            type: 'button',
            onClick: () => {
              if (!done && !confirm('Play again from the start? Your progress will be cleared.')) return;
              game.reset();
              storage.clear();
              screens.show('title');
            },
          },
          'Play Again',
        ),
      ),
    );
  }
}
