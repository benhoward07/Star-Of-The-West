export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareSummary {
  rank: string;
  score: number;
  medals: number;
  totalMedals: number;
}

export function shareText(summary: ShareSummary): string {
  return (
    `I reached the rank of ${summary.rank} with ${summary.score} points and ` +
    `${summary.medals} of ${summary.totalMedals} medals in the Star of the West learning game at The Citadel!`
  );
}

/** Open the phone's share sheet, or copy the result to the clipboard if there isn't one. */
export async function shareResults(summary: ShareSummary, url: string): Promise<ShareOutcome> {
  const text = shareText(summary);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Star of the West', text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to the clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
