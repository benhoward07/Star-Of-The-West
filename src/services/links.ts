/**
 * Links used inside the QR codes.
 *
 * Each station's code holds the game's address plus `?topic=<id>`, so scanning
 * it with the normal phone camera opens the game on that topic, and the
 * in-game scanner can read the very same code.
 */

/** The game's address without any query string or file name, ending in "/". */
export function gameBaseUrl(href: string = location.href): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/[^/]*$/, '');
  return url.toString();
}

export function topicLink(baseUrl: string, topicId: string): string {
  return `${baseUrl}?topic=${encodeURIComponent(topicId)}`;
}

/**
 * Read a topic id out of scanned text or a page address.
 * Accepts a full link with `?topic=`, or just the bare topic id.
 * Returns null unless it names one of `validIds`.
 */
export function parseTopicLink(text: string, validIds: string[]): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let candidate: string | null = null;
  try {
    candidate = new URL(trimmed).searchParams.get('topic');
  } catch {
    candidate = trimmed;
  }
  return candidate !== null && validIds.includes(candidate) ? candidate : null;
}
