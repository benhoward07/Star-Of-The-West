import type { GameState } from '../GameState';
import { clear, el } from '../dom';
import { gameBaseUrl, topicLink } from '../services/links';

type QrEncoder = { toDataURL(text: string, options?: object): Promise<string> };

function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

/**
 * The printable sheet of QR codes (open the game with `?print=1`).
 * The codes point at whatever address the game is being served from.
 */
export async function showPrintPage(root: HTMLElement, game: GameState): Promise<void> {
  document.body.classList.add('print-mode');
  document.title = 'Star of the West: QR Codes';

  // On this PC's own browser the address is "localhost", which a phone cannot
  // reach, so ask the local server for its Wi-Fi address instead.
  let base = gameBaseUrl();
  if (isPrivateHost(location.hostname)) {
    try {
      const response = await fetch('./__lan');
      const info = (await response.json()) as { url?: string | null };
      if (info.url) base = gameBaseUrl(info.url);
    } catch {
      // Not the local dev server: keep the current address.
    }
  }
  const localOnly = isPrivateHost(new URL(base).hostname);

  const module = (await import('qrcode')) as unknown as { default?: QrEncoder } & QrEncoder;
  const encoder: QrEncoder = module.default ?? module;
  const qr = (text: string) =>
    encoder.toDataURL(text, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });

  const card = async (label: string, title: string, hint: string, url: string) =>
    el(
      'section',
      { class: 'qr-card' },
      el('p', { class: 'qr-label' }, label),
      el('h2', {}, title),
      el('img', { class: 'qr-image', src: await qr(url), alt: `QR code for ${title}` }),
      el('p', { class: 'qr-hint' }, hint),
      el('p', { class: 'qr-url' }, url),
    );

  const cards = [
    await card('Start here', 'Star of the West', 'Scan with your phone camera to open the game.', base),
  ];
  for (const topic of game.topics.value) {
    cards.push(
      await card(
        topic.location,
        topic.title,
        'Scan with your phone camera, or with the Scan button inside the game.',
        topicLink(base, topic.id),
      ),
    );
  }

  clear(root);
  root.append(
    el(
      'main',
      { class: 'print-page' },
      el(
        'header',
        { class: 'print-header' },
        el('h1', {}, 'Star of the West: QR Codes'),
        el('p', {}, 'Print this page, cut out the codes, and post one at each station.'),
        localOnly
          ? el(
              'p',
              { class: 'print-warning' },
              `These codes point to ${base}, which only works on this Wi-Fi network while the local server is running. ` +
                'For codes that work anywhere, open this page from the public GitHub Pages link and print from there.',
            )
          : el('p', { class: 'print-note' }, `These codes open: ${base}`),
        el(
          'div',
          { class: 'print-actions' },
          el('button', { class: 'btn primary', type: 'button', onClick: () => window.print() }, 'Print'),
          el('a', { class: 'btn secondary', href: './' }, 'Back to the game'),
        ),
      ),
      el('div', { class: 'qr-grid' }, ...cards),
    ),
  );
}
