import type { GameState } from './GameState';
import type { AudioManager } from './services/AudioManager';
import type { ProgressStorage } from './services/Storage';

export type ScreenName =
  | 'title'
  | 'topics'
  | 'narration'
  | 'quiz'
  | 'medal'
  | 'conclusion'
  | 'scanner'
  | 'hunt';

/** One full-page view of the game. */
export interface Screen<Params = unknown> {
  readonly element: HTMLElement;
  /** Called each time the screen is shown. */
  onShow?(params: Params): void;
  /** Called when the player leaves the screen. */
  onHide?(): void;
}

/** Everything a screen needs to do its job. */
export interface AppContext {
  game: GameState;
  audio: AudioManager;
  storage: ProgressStorage;
  screens: ScreenManager;
}

/** Shows exactly one screen at a time. */
export class ScreenManager {
  private screens = new Map<ScreenName, Screen<any>>();
  private currentName: ScreenName | null = null;

  constructor(private root: HTMLElement) {}

  register(name: ScreenName, screen: Screen<any>): void {
    screen.element.classList.add('screen');
    screen.element.dataset.screen = name;
    this.screens.set(name, screen);
    this.root.appendChild(screen.element);
  }

  get current(): ScreenName | null {
    return this.currentName;
  }

  show(name: ScreenName, params?: unknown): void {
    const next = this.screens.get(name);
    if (!next) throw new Error(`Unknown screen: ${name}`);

    if (this.currentName) {
      const previous = this.screens.get(this.currentName);
      previous?.element.classList.remove('active');
      previous?.onHide?.();
    }

    this.currentName = name;
    next.element.classList.add('active');
    window.scrollTo(0, 0);
    next.onShow?.(params);
  }
}
