import { POINTS_PER_DIFFICULTY, QUIZ_BONUS, SPEED_BONUS, RANKS, type TopicAward } from '../GameState';
import type { AppContext, Screen } from '../ScreenManager';
import { medalSvg, rankInsigniaSvg } from '../art';
import { buzz, clear, el } from '../dom';

export interface MedalParams {
  award: TopicAward;
}

const CONFETTI_COLORS = ['#ffd700', '#6ae5e0', '#6be5ad', '#ffffff', '#ff8a65'];

/** Celebrates a finished topic: the medal, the points, and any promotion. */
export class MedalAwardScreen implements Screen<MedalParams> {
  readonly element: HTMLElement;

  constructor(private ctx: AppContext) {
    this.element = el('main', { class: 'medal-screen' });
  }

  onShow(params: MedalParams): void {
    const { game, screens } = this.ctx;
    const award = params?.award;
    const topic = award ? game.getTopic(award.topicId) : undefined;
    if (!award || !topic) {
      screens.show('topics');
      return;
    }

    const next = () => screens.show(game.allTopicsCompleted ? 'conclusion' : 'topics');
    const nextLabel = game.allTopicsCompleted ? 'See Final Results ›' : 'Continue ›';

    clear(this.element);

    // Replaying a finished topic is practice only.
    if (!award.firstTime || !award.medal) {
      this.element.append(
        el('p', { class: 'eyebrow' }, topic.title),
        el('h1', { class: 'screen-title' }, 'Practice Complete'),
        el(
          'section',
          { class: 'card center' },
          el('p', { class: 'big-number' }, `${award.correctCount} / ${award.questionCount}`),
          el('p', {}, 'correct answers'),
          el('p', { class: 'muted' }, 'You already earned the points and medal for this topic.'),
        ),
        el('div', { class: 'actions' }, el('button', { class: 'btn primary', type: 'button', onClick: next }, nextLabel)),
      );
      return;
    }

    const promoted = award.rankAfter !== award.rankBefore;
    const rankIndex = RANKS.findIndex((rank) => rank.name === award.rankAfter);
    buzz(promoted ? [80, 60, 80, 60, 160] : [80, 60, 120]);

    const row = (label: string, points: number) =>
      el('div', { class: 'score-row' }, el('span', {}, label), el('span', { class: 'points' }, `+${points}`));

    this.element.append(
      this.confetti(promoted ? 36 : 20),
      el('p', { class: 'eyebrow' }, topic.title),
      el('h1', { class: 'screen-title gold-text' }, 'Medal Earned!'),
      el('div', { class: 'medal-stage', html: medalSvg(award.medal, 132) }),
      el('h2', { class: 'medal-name' }, award.medal.name),
      el('p', { class: 'medal-desc' }, award.medal.description),
      el(
        'section',
        { class: 'card score-card' },
        row(`Topic complete (${POINTS_PER_DIFFICULTY} × difficulty ${topic.difficulty})`, award.topicPoints),
        row(`Correct answers (${award.correctCount} × ${QUIZ_BONUS})`, award.quizPoints),
        row(`Speed bonus (${award.fastCount} × ${SPEED_BONUS})`, award.speedPoints),
        el(
          'div',
          { class: 'score-row total' },
          el('span', {}, 'Points earned'),
          el('span', { class: 'points' }, `+${award.totalPoints}`),
        ),
        el(
          'div',
          { class: 'score-row' },
          el('span', {}, 'Total score'),
          el('span', { class: 'points' }, String(game.score.value)),
        ),
      ),
      promoted
        ? el(
            'section',
            { class: 'card promotion' },
            el('span', { html: rankInsigniaSvg(rankIndex, 56) }),
            el(
              'div',
              {},
              el('p', { class: 'promotion-label' }, 'Promoted!'),
              el('p', { class: 'promotion-rank' }, `${award.rankBefore} → ${award.rankAfter}`),
            ),
          )
        : el('p', { class: 'muted center' }, `Rank: ${award.rankAfter}`),
      el('div', { class: 'actions' }, el('button', { class: 'btn primary', type: 'button', onClick: next }, nextLabel)),
    );
  }

  private confetti(count: number): HTMLElement {
    const layer = el('div', { class: 'confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < count; i++) {
      const piece = el('span');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDelay = `${Math.random() * 0.9}s`;
      piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.append(piece);
    }
    return layer;
  }
}
