import { describe, expect, it } from 'vitest';
import { GameState } from '../src/GameState';
import {
  AIM_TOLERANCE_DEG,
  MIN_SEPARATION_DEG,
  START_CLEARANCE_DEG,
  ZONE_ELEVATION,
  aimedCode,
  angleBetween,
  directionFor,
  mulberry32,
  pitchOf,
  placeCodes,
  zoneForPitch,
} from '../src/services/hunt';

const topicIds = new GameState().topicIds;
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

describe('3D code hunt: directions', () => {
  it('starts out facing -z, with azimuth turning clockwise', () => {
    const ahead = directionFor(0, 0);
    expect(ahead.x).toBeCloseTo(0);
    expect(ahead.y).toBeCloseTo(0);
    expect(ahead.z).toBeCloseTo(-1);

    const right = directionFor(90, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);

    expect(directionFor(123, 90).y).toBeCloseTo(1);
  });

  it('measures the angle between two directions', () => {
    expect(angleBetween(directionFor(0, 0), directionFor(90, 0))).toBeCloseTo(90);
    expect(angleBetween(directionFor(0, 0), directionFor(180, 0))).toBeCloseTo(180);
    expect(angleBetween(directionFor(40, 10), directionFor(40, 10))).toBeCloseTo(0);
    expect(angleBetween(directionFor(0, 0), directionFor(0, 55))).toBeCloseTo(55);
    // Length does not matter.
    expect(angleBetween({ x: 0, y: 0, z: -5 }, { x: 3, y: 0, z: 0 })).toBeCloseTo(90);
  });

  it('reads the tilt of a direction and names the zone', () => {
    expect(pitchOf(directionFor(77, 50))).toBeCloseTo(50);
    expect(pitchOf(directionFor(-20, -40))).toBeCloseTo(-40);
    expect(zoneForPitch(60)).toBe('sky');
    expect(zoneForPitch(30)).toBe('sky');
    expect(zoneForPitch(10)).toBe('wall');
    expect(zoneForPitch(-10)).toBe('wall');
    expect(zoneForPitch(-60)).toBe('ground');
  });
});

describe('3D code hunt: random placement', () => {
  it('places exactly one code per topic, in topic order', () => {
    for (const seed of SEEDS) {
      const codes = placeCodes(topicIds, mulberry32(seed));
      expect(codes.map((code) => code.topicId)).toEqual(topicIds);
    }
  });

  it('always has a code in the sky and a code at wall level', () => {
    for (const seed of SEEDS) {
      const zones = placeCodes(topicIds, mulberry32(seed)).map((code) => code.zone);
      expect(zones).toContain('sky');
      expect(zones).toContain('wall');
    }
  });

  it('keeps every code inside its zone', () => {
    for (const seed of SEEDS) {
      for (const code of placeCodes(topicIds, mulberry32(seed))) {
        const [low, high] = ZONE_ELEVATION[code.zone];
        expect(code.elevation).toBeGreaterThanOrEqual(low);
        expect(code.elevation).toBeLessThanOrEqual(high);
        expect(zoneForPitch(code.elevation)).toBe(code.zone);
        expect(angleBetween(code.direction, directionFor(code.azimuth, code.elevation))).toBeCloseTo(0);
      }
    }
  });

  it('keeps codes apart from each other and away from the starting view', () => {
    const ahead = directionFor(0, 0);
    for (const seed of SEEDS) {
      const codes = placeCodes(topicIds, mulberry32(seed));
      for (let i = 0; i < codes.length; i++) {
        expect(angleBetween(codes[i].direction, ahead)).toBeGreaterThanOrEqual(START_CLEARANCE_DEG);
        for (let j = i + 1; j < codes.length; j++) {
          expect(angleBetween(codes[i].direction, codes[j].direction)).toBeGreaterThanOrEqual(MIN_SEPARATION_DEG);
        }
      }
    }
  });

  it('gives the same layout for the same seed and a new one for a new seed', () => {
    expect(placeCodes(topicIds, mulberry32(42))).toEqual(placeCodes(topicIds, mulberry32(42)));

    const layouts = new Set(SEEDS.map((seed) => JSON.stringify(placeCodes(topicIds, mulberry32(seed)))));
    expect(layouts.size).toBe(SEEDS.length);
  });

  it('moves each topic between the sky and the walls from hunt to hunt', () => {
    for (const id of topicIds) {
      const zones = new Set(
        SEEDS.map((seed) => placeCodes(topicIds, mulberry32(seed)).find((code) => code.topicId === id)?.zone),
      );
      expect(zones).toEqual(new Set(['sky', 'wall']));
    }
  });

  it('still places every code when there are far more topics than room', () => {
    const many = Array.from({ length: 20 }, (_, i) => `topic${i + 1}`);
    const codes = placeCodes(many, mulberry32(7));
    expect(codes.map((code) => code.topicId)).toEqual(many);
  });

  it('handles one topic or none', () => {
    expect(placeCodes([], mulberry32(1))).toEqual([]);
    expect(placeCodes(['only'], mulberry32(1))).toHaveLength(1);
  });
});

describe('3D code hunt: aiming', () => {
  const codes = placeCodes(topicIds, mulberry32(11));

  it('finds a code when the view is centred on it', () => {
    for (const code of codes) {
      expect(aimedCode(code.direction, codes)).toBe(code);
    }
  });

  it('finds a code just inside the tolerance and not just outside it', () => {
    const [code] = codes;
    const inside = directionFor(code.azimuth, code.elevation + AIM_TOLERANCE_DEG - 1);
    const outside = directionFor(code.azimuth, code.elevation + AIM_TOLERANCE_DEG + 1);
    expect(aimedCode(inside, codes)).toBe(code);
    expect(aimedCode(outside, codes)).toBeNull();
  });

  it('finds nothing in the starting view', () => {
    for (const seed of SEEDS) {
      expect(aimedCode(directionFor(0, 0), placeCodes(topicIds, mulberry32(seed)))).toBeNull();
    }
  });

  it('picks the nearer of two codes', () => {
    const pair = [{ direction: directionFor(0, 0) }, { direction: directionFor(10, 0) }];
    expect(aimedCode(directionFor(7, 0), pair, 20)).toBe(pair[1]);
    expect(aimedCode(directionFor(2, 0), pair, 20)).toBe(pair[0]);
  });
});
