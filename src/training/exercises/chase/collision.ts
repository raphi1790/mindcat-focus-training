import type { Rng } from '../../../platform/rng';
import { circlesOverlap, type Bounds, type Vec2 } from '../../shared/arenaMath';

export const CAT_SIZE = 10;
export const UMBRELLA_SIZE = 10;
export const CAT_RADIUS = 4.5;
export const UMBRELLA_RADIUS = 4.5;
export const CAT_SPEED = 50; // % der Arena pro Sekunde
export const CHASE_CENTER: Vec2 = { x: 50, y: 50 };

export const UMBRELLA_BOUNDS: Bounds = {
  minX: UMBRELLA_RADIUS,
  maxX: 100 - UMBRELLA_RADIUS,
  minY: UMBRELLA_RADIUS,
  maxY: 100 - UMBRELLA_RADIUS,
};

export const FLEE_PROBABILITY_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 0.25,
  3: 0.45,
  4: 0.6,
  5: 0.75,
  6: 0.85,
  7: 0.95,
};

export function fleeProbabilityForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return FLEE_PROBABILITY_BY_LEVEL[clamped] ?? 0;
}

/** Intervall (ms) zwischen periodischen Vektor-Anpassungen des Regenschirms. */
export function stepIntervalForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return Math.max(220, 700 - (clamped - 1) * 75);
}

/** Kontinuierliche Laufgeschwindigkeit des Regenschirms (% der Arena pro Sekunde). */
export function umbrellaSpeedForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return 16 + (clamped - 1) * 3.5;
}

/** Zeitlimit (ms) pro Trial. */
export function timeLimitForLevel(level: number): number {
  const clamped = Math.min(Math.max(Math.floor(level), 1), 7);
  return Math.max(4200, 9000 - (clamped - 1) * 800);
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function bounceAxis(coord: number, vel: number, min: number, max: number): [number, number] {
  if (coord < min) return [Math.min(max, min + (min - coord)), Math.abs(vel)];
  if (coord > max) return [Math.max(min, max - (coord - max)), -Math.abs(vel)];
  return [coord, vel];
}

function advanceAndBounce(
  pos: Vec2,
  vel: Vec2,
  dist: number,
  bounds: Bounds,
): { pos: Vec2; vel: Vec2 } {
  const [x, vx] = bounceAxis(pos.x + vel.x * dist, vel.x, bounds.minX, bounds.maxX);
  const [y, vy] = bounceAxis(pos.y + vel.y * dist, vel.y, bounds.minY, bounds.maxY);
  return { pos: { x, y }, vel: { x: vx, y: vy } };
}

/**
 * Erzeugt eine deterministische Startposition des Regenschirms mit Mindestabstand
 * zur Katze im Bereich `[margin, 100 - margin]`.
 */
export function spawnUmbrellaPos(
  catPos: Vec2,
  rng: Rng,
  minDistance = 20,
  margin = 10,
): Vec2 {
  const span = 100 - 2 * margin;
  for (let i = 0; i < 20; i++) {
    const pos = {
      x: margin + rng.next() * span,
      y: margin + rng.next() * span,
    };
    if (Math.hypot(pos.x - catPos.x, pos.y - catPos.y) >= minDistance) {
      return pos;
    }
  }
  return {
    x: catPos.x < 50 ? 100 - margin * 2 : margin * 2,
    y: catPos.y < 50 ? 100 - margin * 2 : margin * 2,
  };
}

/**
 * Wählt einen normierten 2D-Richtungsvektor für den Regenschirm.
 * Höhere Level wählen mit `fleeProbabilityForLevel(level)` eine Richtung,
 * die nach kurzer Vorausschau (inkl. Wand-Abprall) die Distanz zur Katze maximiert.
 */
export function chooseUmbrellaDirection(
  pos: Vec2,
  catPos: Vec2,
  level: number,
  rng: Rng,
  bounds: Bounds = UMBRELLA_BOUNDS,
): Vec2 {
  const baseAngle = rng.next() * Math.PI * 2;
  if (rng.next() >= fleeProbabilityForLevel(level)) {
    return { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  }

  let bestDir: Vec2 = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  let bestDist = -1;
  const lookahead = 12;

  for (let i = 0; i < 8; i++) {
    const angle = baseAngle + (i * Math.PI) / 4;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const predicted = advanceAndBounce(pos, dir, lookahead, bounds).pos;
    const d = distSq(predicted, catPos);
    if (d > bestDist) {
      bestDist = d;
      bestDir = dir;
    }
  }

  return bestDir;
}

export interface UmbrellaStepState {
  pos: Vec2;
  vel: Vec2;
  turnTimerMs: number;
}

/**
 * Bewegt den Regenschirm kontinuierlich über `dtMs`, lässt ihn an den Arena-Rändern
 * abprallen und passt seinen Richtungsvektor periodisch alle `stepIntervalForLevel(level)` ms an.
 */
export function stepUmbrellaContinuous(
  pos: Vec2,
  vel: Vec2,
  catPos: Vec2,
  level: number,
  dtMs: number,
  turnTimerMs: number,
  rng: Rng,
  bounds: Bounds = UMBRELLA_BOUNDS,
): UmbrellaStepState {
  const dist = (umbrellaSpeedForLevel(level) * dtMs) / 1000;
  const moved = advanceAndBounce(pos, vel, dist, bounds);
  let nextVel = moved.vel;
  let nextTimer = turnTimerMs + dtMs;
  const turnInterval = stepIntervalForLevel(level);

  while (nextTimer >= turnInterval) {
    nextTimer -= turnInterval;
    nextVel = chooseUmbrellaDirection(moved.pos, catPos, level, rng, bounds);
  }

  return { pos: moved.pos, vel: nextVel, turnTimerMs: nextTimer };
}

/** Prüft Fang per Hitbox-Kreisüberlappung zwischen Katze und Regenschirm. */
export function checkChaseOverlap(
  catPos: Vec2,
  targetPos: Vec2,
  catRadius = CAT_RADIUS,
  targetRadius = UMBRELLA_RADIUS,
): boolean {
  return circlesOverlap(catPos, catRadius, targetPos, targetRadius);
}
