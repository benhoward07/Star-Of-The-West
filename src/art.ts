/**
 * Built-in drawings: the medal, the rank insignia and the title emblem.
 * These are plain SVG so there are no image files to load.
 */

import type { MedalData } from './GameState';

let uid = 0;

const STAR_POINTS =
  '0,-22 5.2,-7.1 20.9,-6.8 8.4,2.7 12.9,17.8 0,8.8 -12.9,17.8 -8.4,2.7 -20.9,-6.8 -5.2,-7.1';

/** A medal on its ribbon. Unearned medals are drawn in grey. */
export function medalSvg(medal: Pick<MedalData, 'ribbon' | 'earned'>, size = 96): string {
  const id = `medal${uid++}`;
  const [a, b, c] = medal.earned ? medal.ribbon : ['#4b4d63', '#5e6078', '#4b4d63'];
  const light = medal.earned ? '#fff3a6' : '#8b8da3';
  const mid = medal.earned ? '#ffd700' : '#6c6e85';
  const dark = medal.earned ? '#b8860b' : '#4b4d63';
  const star = medal.earned ? '#8a6500' : '#3f4157';
  return `
<svg class="medal-art${medal.earned ? ' earned' : ''}" width="${size}" height="${Math.round(size * 1.45)}" viewBox="0 0 100 145" role="img" aria-label="${medal.earned ? 'Medal earned' : 'Medal not yet earned'}">
  <defs>
    <radialGradient id="${id}g" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>
    </radialGradient>
    <clipPath id="${id}c"><circle cx="50" cy="98" r="38"/></clipPath>
  </defs>
  <g class="medal-ribbon">
    <path d="M30 0h40v52L50 66 30 52z" fill="${a}"/>
    <path d="M43.5 0h13v61.5L50 66l-6.5-4.5z" fill="${b}"/>
    <path d="M30 0h6v56l-6-4zM64 0h6v52l-6 4z" fill="${c}" opacity="0.55"/>
  </g>
  <g class="medal-disc">
    <circle cx="50" cy="98" r="40" fill="${dark}"/>
    <circle cx="50" cy="98" r="37" fill="url(#${id}g)"/>
    <circle cx="50" cy="98" r="30" fill="none" stroke="${dark}" stroke-width="1.5" opacity="0.7"/>
    <polygon points="${STAR_POINTS}" transform="translate(50 99)" fill="${star}"/>
    <g clip-path="url(#${id}c)"><rect class="medal-shine" x="-40" y="50" width="26" height="100" fill="#fff" opacity="0.55" transform="skewX(-20)"/></g>
  </g>
</svg>`;
}

/**
 * Rank insignia: chevrons for Cadet to Sergeant, bars for Lieutenant and
 * Captain, a star for Colonel, and a plain badge for Recruit.
 */
export function rankInsigniaSvg(rankIndex: number, size = 44): string {
  const gold = '#ffd700';
  let mark = '';
  if (rankIndex >= 1 && rankIndex <= 3) {
    const count = rankIndex;
    const top = 24 - count * 4.5;
    for (let i = 0; i < count; i++) {
      const y = top + i * 9;
      mark += `<path d="M12 ${y + 8} 24 ${y} 36 ${y + 8}" fill="none" stroke="${gold}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  } else if (rankIndex === 4 || rankIndex === 5) {
    const count = rankIndex - 3;
    const left = 24 - (count * 8 + (count - 1) * 4) / 2;
    for (let i = 0; i < count; i++) {
      mark += `<rect x="${left + i * 12}" y="13" width="8" height="22" rx="1.5" fill="${gold}"/>`;
    }
  } else if (rankIndex >= 6) {
    mark = `<polygon points="${STAR_POINTS}" transform="translate(24 25) scale(0.72)" fill="${gold}"/>`;
  } else {
    mark = `<circle cx="24" cy="24" r="5" fill="none" stroke="${gold}" stroke-width="3" opacity="0.8"/>`;
  }
  return `
<svg class="rank-insignia" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M24 2 44 9v15c0 11-8.5 18.5-20 22C12.5 42.5 4 35 4 24V9z" fill="#22224a" stroke="#6ae5e0" stroke-width="2"/>
  ${mark}
</svg>`;
}

/** Title screen emblem: a gold star over the water. */
export function emblemSvg(size = 148): string {
  return `
<svg class="emblem" width="${size}" height="${size}" viewBox="0 0 160 160" aria-hidden="true">
  <defs>
    <radialGradient id="emblemGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0" stop-color="#6ae5e0" stop-opacity="0.35"/><stop offset="1" stop-color="#6ae5e0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="emblemStar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3a6"/><stop offset="1" stop-color="#ffc400"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="78" fill="url(#emblemGlow)"/>
  <circle cx="80" cy="80" r="66" fill="#1f1f3d" stroke="#6ae5e0" stroke-width="2.5"/>
  <circle cx="80" cy="80" r="58" fill="none" stroke="#6ae5e0" stroke-width="1" opacity="0.45" stroke-dasharray="2 5"/>
  <polygon class="emblem-star" points="${STAR_POINTS}" transform="translate(80 68) scale(2)" fill="url(#emblemStar)"/>
  <g fill="none" stroke-linecap="round" stroke-width="3.5">
    <path d="M34 112c8-7 15-7 23 0s15 7 23 0 15-7 23 0 15 7 23 0" stroke="#6ae5e0"/>
    <path d="M46 126c7-6 13-6 20 0s13 6 20 0 13-6 20 0" stroke="#6be5ad" opacity="0.8"/>
  </g>
</svg>`;
}
