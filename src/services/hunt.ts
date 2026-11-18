/**
 * Rules for the 3D code hunt: where the floating QR codes go and when the
 * player is aiming at one. No 3D library and no browser features in here, so
 * every rule can be unit tested.
 *
 * Directions use the same axes as the 3D view: x is to the right, y is up, and
 * the player starts out facing -z. Azimuth is the compass-style angle measured
 * clockwise from that starting direction; elevation is the angle above the
 * horizon. All angles are in degrees.
 */

export type Zone = 'sky' | 'wall';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlacedCode {
  topicId: string;
  zone: Zone;
  azimuth: number;
  elevation: number;
  /** Unit vector from the player toward the code. */
  direction: Vec3;
}

/** How high each kind of code floats, as [lowest, highest] elevation. */
export const ZONE_ELEVATION: Record<Zone, readonly [number, number]> = {
  sky: [40, 70],
  wall: [-5, 20],
};
/** Codes are never closer together than this. */
export const MIN_SEPARATION_DEG = 45;
/** No code starts this close to where the player is already looking. */
export const START_CLEARANCE_DEG = 25;
/** How close the centre of the view must be to a code to scan it. */
export const AIM_TOLERANCE_DEG = 9;
/** Tilting the phone above this counts as looking at the sky. */
export const SKY_PITCH_DEG = 30;
/** Tilting the phone below this counts as looking at the ground. */
export const GROUND_PITCH_DEG = -35;

const DEG = Math.PI / 180;
const START_DIRECTION: Vec3 = { x: 0, y: 0, z: -1 };

/** Small repeatable random number generator: the same seed gives the same numbers. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function directionFor(azimuth: number, elevation: number): Vec3 {
  const az = azimuth * DEG;
  const el = elevation * DEG;
  return {
    x: Math.sin(az) * Math.cos(el),
    y: Math.sin(el),
    z: -Math.cos(az) * Math.cos(el),
  };
}

/** Angle in degrees between two directions (they need not be unit length). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const lengths = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  if (lengths === 0) return 180;
  const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / lengths;
  return Math.acos(Math.min(1, Math.max(-1, cos))) / DEG;
}

/** How far a direction is tilted above (+) or below (-) the horizon, in degrees. */
export function pitchOf(direction: Vec3): number {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length === 0) return 0;
  return Math.asin(Math.min(1, Math.max(-1, direction.y / length))) / DEG;
}

export function zoneForPitch(pitch: number): Zone | 'ground' {
  if (pitch >= SKY_PITCH_DEG) return 'sky';
  if (pitch <= GROUND_PITCH_DEG) return 'ground';
  return 'wall';
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick a random spot for every topic's code.
 *
 * With two or more topics there is always at least one sky code and one wall
 * code. Codes keep their distance from each other and from the direction the
 * player starts out facing.
 */
export function placeCodes(topicIds: readonly string[], rng: () => number = Math.random): PlacedCode[] {
  const order = shuffled(topicIds, rng);
  const placed: PlacedCode[] = [];

  order.forEach((topicId, index) => {
    const zone: Zone = index === 0 ? 'sky' : index === 1 ? 'wall' : rng() < 0.5 ? 'sky' : 'wall';
    const [low, high] = ZONE_ELEVATION[zone];

    // Try random spots until one has enough room. If the sky is crowded (many
    // topics), settle for the roomiest spot that was tried.
    let best: PlacedCode | null = null;
    let bestRoom = -Infinity;
    for (let attempt = 0; attempt < 200; attempt++) {
      const azimuth = rng() * 360 - 180;
      const elevation = low + rng() * (high - low);
      const direction = directionFor(azimuth, elevation);

      let room = angleBetween(direction, START_DIRECTION) - START_CLEARANCE_DEG;
      for (const other of placed) {
        room = Math.min(room, angleBetween(direction, other.direction) - MIN_SEPARATION_DEG);
      }
      if (room > bestRoom) {
        bestRoom = room;
        best = { topicId, zone, azimuth, elevation, direction };
      }
      if (room >= 0) break;
    }
    if (best) placed.push(best);
  });

  // Hand the codes back in topic order, so the caller's list is stable.
  return topicIds.flatMap((id) => placed.filter((code) => code.topicId === id));
}

/** The code nearest the centre of the view, if it is within the tolerance. */
export function aimedCode<T extends { direction: Vec3 }>(
  forward: Vec3,
  codes: readonly T[],
  toleranceDeg: number = AIM_TOLERANCE_DEG,
): T | null {
  let nearest: T | null = null;
  let nearestAngle = toleranceDeg;
  for (const code of codes) {
    const angle = angleBetween(forward, code.direction);
    if (angle <= nearestAngle) {
      nearest = code;
      nearestAngle = angle;
    }
  }
  return nearest;
}
