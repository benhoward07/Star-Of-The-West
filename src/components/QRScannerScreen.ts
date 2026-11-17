import type QrScanner from 'qr-scanner';
import type { AppContext, Screen } from '../ScreenManager';
import { buzz, el } from '../dom';
import { parseTopicLink } from '../services/links';

/** Uses the phone's camera to scan a station's QR code. */
export class QRScannerScreen implements Screen {
  readonly element: HTMLElement;
  private scanner: QrScanner | null = null;
  private status: HTMLElement;
  private video: HTMLVideoElement;
  private viewport: HTMLElement;
  /** Bumped each time the screen opens or closes, so a slow camera start can be abandoned. */
  private session = 0;

  constructor(private ctx: AppContext) {
    this.video = el('video', { class: 'scanner-video', playsinline: true, muted: true });
    this.viewport = el(
      'div',
      { class: 'scanner-viewport' },
      this.video,
      el('div', { class: 'scanner-frame', 'aria-hidden': 'true' }),
    );
    this.status = el('p', { class: 'scanner-status', 'aria-live': 'polite' });

    this.element = el(
      'main',
      { class: 'scanner-screen' },
      el('h1', { class: 'screen-title' }, 'Scan a Station'),
      el('p', { class: 'lead' }, "Point your camera at a station's QR code."),
      this.viewport,
      this.status,
      el(
        'div',
        { class: 'actions' },
        el(
          'button',
          { class: 'btn secondary', type: 'button', onClick: () => ctx.screens.show('topics') },
          'Cancel and choose a topic instead',
        ),
      ),
    );
  }

  onShow(): void {
    void this.start();
  }

  onHide(): void {
    this.session++;
    this.scanner?.stop();
    this.scanner?.destroy();
    this.scanner = null;
  }

  private fail(message: string): void {
    this.viewport.classList.add('unavailable');
    this.status.textContent = message;
  }

  private async start(): Promise<void> {
    const session = ++this.session;
    this.viewport.classList.remove('unavailable');
    this.status.textContent = 'Starting camera...';

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail('The camera only works on a secure (https) link. Tap Cancel and choose a topic from the list instead.');
      return;
    }

    try {
      const { default: Scanner } = await import('qr-scanner');
      if (session !== this.session) return;

      const scanner = new Scanner(this.video, (result) => this.handleScan(result.data), {
        preferredCamera: 'environment',
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      });
      this.scanner = scanner;
      await scanner.start();

      if (session !== this.session) {
        scanner.stop();
        scanner.destroy();
        return;
      }
      this.status.textContent = 'Looking for a QR code...';
    } catch (error) {
      if (session !== this.session) return;
      const name = error instanceof DOMException ? error.name : '';
      this.fail(
        name === 'NotAllowedError'
          ? 'Camera access was not allowed. Allow the camera for this site in Safari, or tap Cancel and choose a topic from the list.'
          : 'No camera could be started on this device. Tap Cancel and choose a topic from the list.',
      );
    }
  }

  private handleScan(text: string): void {
    const { game, screens } = this.ctx;
    const topicId = parseTopicLink(text, game.topicIds);
    if (!topicId) {
      this.status.textContent = "That code isn't part of this game. Try a station's code.";
      return;
    }
    buzz(80);
    game.startGame();
    // Not started by a tap, so the narration waits for the player to press Play.
    screens.show('narration', { topicId, autoplay: false });
  }
}
