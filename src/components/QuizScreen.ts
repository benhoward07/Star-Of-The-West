import {
  FAST_ANSWER_SECONDS,
  QUESTION_TIME_SECONDS,
  QUIZ_BONUS,
  SPEED_BONUS,
  type AnswerResult,
  type QuizQuestion,
  type TopicData,
} from '../GameState';
import type { AppContext, Screen } from '../ScreenManager';
import { add, buzz, clear, el } from '../dom';

export interface QuizParams {
  topicId: string;
}

/** Multiple choice questions with a countdown and instant feedback. */
export class QuizScreen implements Screen<QuizParams> {
  readonly element: HTMLElement;
  private topic: TopicData | null = null;
  private questions: QuizQuestion[] = [];
  private index = 0;
  private answers: AnswerResult[] = [];
  private timer: number | null = null;
  private startedAt = 0;
  private answered = false;

  constructor(private ctx: AppContext) {
    this.element = el('main', { class: 'quiz-screen' });
  }

  onShow(params: QuizParams): void {
    const topic = this.ctx.game.getTopic(params.topicId);
    if (!topic || !topic.quizQuestions?.length) {
      this.ctx.screens.show('topics');
      return;
    }
    this.topic = topic;
    this.questions = topic.quizQuestions;
    this.index = 0;
    this.answers = [];
    this.renderQuestion();
  }

  onHide(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private renderQuestion(): void {
    const topic = this.topic;
    if (!topic) return;
    const question = this.questions[this.index];
    const practice = topic.completed;
    this.answered = false;

    const dots = el('div', { class: 'quiz-dots', 'aria-hidden': 'true' });
    this.questions.forEach((_, i) => {
      const result = this.answers[i];
      const state = result ? (result.correct ? 'right' : 'wrong') : i === this.index ? 'current' : '';
      dots.append(el('span', { class: `dot ${state}`.trim() }));
    });

    const timerFill = el('div', { class: 'timer-fill' });
    const timerText = el('span', { class: 'timer-text' }, String(QUESTION_TIME_SECONDS));
    const speedTag = el('span', { class: 'speed-tag on' }, `⚡ Speed bonus +${SPEED_BONUS}`);
    const feedback = el('div', { class: 'feedback', 'aria-live': 'polite' });

    const buttons = question.options.map((option, i) =>
      el(
        'button',
        { class: 'option', type: 'button', onClick: () => finish(i) },
        el('span', { class: 'option-letter' }, 'ABCD'[i] ?? String(i + 1)),
        el('span', { class: 'option-text' }, option),
      ),
    );

    /** Lock in an answer. `choice` is null when time ran out. */
    const finish = (choice: number | null) => {
      if (this.answered) return;
      this.answered = true;
      this.stopTimer();

      const elapsed = (performance.now() - this.startedAt) / 1000;
      const correct = choice === question.correctAnswer;
      const fast = correct && elapsed <= FAST_ANSWER_SECONDS;
      this.answers.push({ correct, fast });
      buzz(correct ? 40 : [60, 60, 60]);

      buttons.forEach((button, i) => {
        button.disabled = true;
        if (i === question.correctAnswer) button.classList.add('correct');
        else if (i === choice) button.classList.add('incorrect');
      });
      speedTag.classList.toggle('on', fast);
      speedTag.classList.toggle('earned', fast);

      const answerText = question.options[question.correctAnswer];
      let headline: string;
      if (correct) {
        const bonus = practice ? '' : fast ? ` +${QUIZ_BONUS} points, +${SPEED_BONUS} speed bonus` : ` +${QUIZ_BONUS} points`;
        headline = `Correct!${bonus}`;
      } else if (choice === null) {
        headline = `Time's up! The answer is: ${answerText}`;
      } else {
        headline = `Not quite. The answer is: ${answerText}`;
      }

      const last = this.index === this.questions.length - 1;
      feedback.className = `feedback show ${correct ? 'good' : 'bad'}`;
      add(
        feedback,
        el('p', { class: 'feedback-headline' }, headline),
        question.explanation ? el('p', { class: 'feedback-note' }, question.explanation) : null,
        el(
          'button',
          { class: 'btn primary', type: 'button', onClick: () => this.advance() },
          last ? 'See Your Results ›' : 'Next Question ›',
        ),
      );
      feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    clear(this.element);
    add(
      this.element,
      el('p', { class: 'eyebrow' }, `${topic.title} · Question ${this.index + 1} of ${this.questions.length}`),
      dots,
      practice
        ? el('p', { class: 'practice-note' }, 'Practice round: you already earned the points and medal for this topic.')
        : null,
      el(
        'div',
        { class: 'timer-row' },
        el('div', { class: 'timer-bar', role: 'timer', 'aria-label': 'Time left' }, timerFill),
        timerText,
      ),
      practice ? null : speedTag,
      el('h1', { class: 'question' }, question.question),
      el('div', { class: 'options' }, ...buttons),
      feedback,
    );

    this.startedAt = performance.now();
    this.stopTimer();
    this.timer = window.setInterval(() => {
      const elapsed = (performance.now() - this.startedAt) / 1000;
      const left = Math.max(0, QUESTION_TIME_SECONDS - elapsed);
      timerFill.style.width = `${(left / QUESTION_TIME_SECONDS) * 100}%`;
      timerText.textContent = String(Math.ceil(left));
      timerFill.classList.toggle('warn', left <= 5);
      if (elapsed > FAST_ANSWER_SECONDS) speedTag.classList.remove('on');
      if (left <= 0) finish(null);
    }, 100);
  }

  private advance(): void {
    const topic = this.topic;
    if (!topic) return;

    if (this.index < this.questions.length - 1) {
      this.index++;
      this.renderQuestion();
      window.scrollTo(0, 0);
      return;
    }

    const award = this.ctx.game.completeTopic(topic.id, this.answers);
    this.ctx.screens.show('medal', { award });
  }
}
