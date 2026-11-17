import { RANKS, type GameState } from '../GameState';
import { rankInsigniaSvg } from '../art';
import { clear, el } from '../dom';

/** The status bar: current rank, score, medals, and progress to the next rank. */
export class HUD {
  readonly element: HTMLElement;

  constructor(private game: GameState) {
    this.element = el('section', { class: 'hud', 'aria-label': 'Your progress' });
    const render = () => this.render();
    game.score.subscribe(render);
    game.rank.subscribe(render);
    game.medals.subscribe(render);
    this.render();
  }

  private render(): void {
    const game = this.game;
    const total = game.medals.value.length;
    const next = game.nextRank;

    let hint = 'Top rank reached. Well done, Colonel!';
    let progress = 1;
    if (next) {
      const needs: string[] = [];
      if (next.pointsNeeded > 0) needs.push(`${next.pointsNeeded} more point${next.pointsNeeded === 1 ? '' : 's'}`);
      if (next.medalsNeeded > 0) needs.push(`${next.medalsNeeded} more medal${next.medalsNeeded === 1 ? '' : 's'}`);
      hint = `${needs.join(' and ')} to reach ${next.name}`;

      const current = RANKS[game.rankIndex];
      const target = RANKS[game.rankIndex + 1];
      const span = Math.max(1, target.minScore - current.minScore);
      progress = Math.min(1, Math.max(0, (game.score.value - current.minScore) / span));
    }

    clear(this.element);
    this.element.append(
      el(
        'div',
        { class: 'hud-row' },
        el(
          'div',
          { class: 'hud-rank' },
          el('span', { html: rankInsigniaSvg(game.rankIndex, 40) }),
          el('div', {}, el('div', { class: 'hud-label' }, 'Rank'), el('div', { class: 'hud-value' }, game.rank.value)),
        ),
        el(
          'div',
          { class: 'hud-stat' },
          el('div', { class: 'hud-label' }, 'Score'),
          el('div', { class: 'hud-value' }, String(game.score.value)),
        ),
        el(
          'div',
          { class: 'hud-stat' },
          el('div', { class: 'hud-label' }, 'Medals'),
          el('div', { class: 'hud-value gold' }, `${game.earnedMedalCount}/${total}`),
        ),
      ),
      el(
        'div',
        { class: 'hud-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(progress * 100) },
        el('div', { class: 'hud-progress-fill', style: `width:${Math.round(progress * 100)}%` }),
      ),
      el('div', { class: 'hud-hint' }, hint),
    );
  }
}
