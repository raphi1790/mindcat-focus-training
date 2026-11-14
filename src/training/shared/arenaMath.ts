/**
 * Reine, abhängigkeitsfreie 2D-Geometrie- und Kollisions-Helfer für die
 * kontinuierliche Arena im Prozent-Koordinatensystem (`0..100`).
 */

export { MAX_DT_MS, useAnimationLoop } from './useAnimationLoop';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const DEFAULT_ARENA_BOUNDS: Bounds = {
  minX: 0,
  maxX: 100,
  minY: 0,
  maxY: 100,
};

/** Begrenzt eine 2D-Position auf `[min, max]` (skalar oder je Achse). */
export function clampPos(
  pos: Vec2,
  min: number | Vec2,
  max: number | Vec2,
): Vec2 {
  const minX = typeof min === 'number' ? min : min.x;
  const minY = typeof min === 'number' ? min : min.y;
  const maxX = typeof max === 'number' ? max : max.x;
  const maxY = typeof max === 'number' ? max : max.y;
  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

/** Prüft strikte Kreis-Kreis-Überlappung (`Abstand < rA + rB`). */
export function circlesOverlap(a: Vec2, rA: number, b: Vec2, rB: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < rA + rB;
}

/** Prüft strikte Kreis-Rechteck-Überlappung (`Abstand zur nächsten Kante < radius`). */
export function circleRectOverlap(center: Vec2, radius: number, rect: Rect): boolean {
  const cx = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const cy = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - cx, center.y - cy) < radius;
}

function clampCircleToBounds(pos: Vec2, radius: number, bounds: Bounds): Vec2 {
  const minX = bounds.minX + radius;
  const maxX = bounds.maxX - radius;
  const minY = bounds.minY + radius;
  const maxY = bounds.maxY - radius;
  return {
    x: minX > maxX ? (bounds.minX + bounds.maxX) / 2 : Math.min(Math.max(pos.x, minX), maxX),
    y: minY > maxY ? (bounds.minY + bounds.maxY) / 2 : Math.min(Math.max(pos.y, minY), maxY),
  };
}

function resolveCircleRect(center: Vec2, radius: number, rect: Rect): { pos: Vec2; penetration: number } {
  const cx = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const cy = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  const ox = center.x - cx;
  const oy = center.y - cy;
  const dist = Math.hypot(ox, oy);

  if (dist >= radius) {
    return { pos: center, penetration: 0 };
  }

  if (dist === 0) {
    // Mittelpunkt liegt im Rechteck: über die nächste Kante herausschieben.
    const toLeft = center.x - rect.x;
    const toRight = rect.x + rect.width - center.x;
    const toTop = center.y - rect.y;
    const toBottom = rect.y + rect.height - center.y;
    const minEdge = Math.min(toLeft, toRight, toTop, toBottom);
    const penetration = radius + minEdge;
    if (minEdge === toLeft) return { pos: { x: rect.x - radius, y: center.y }, penetration };
    if (minEdge === toRight) return { pos: { x: rect.x + rect.width + radius, y: center.y }, penetration };
    if (minEdge === toTop) return { pos: { x: center.x, y: rect.y - radius }, penetration };
    return { pos: { x: center.x, y: rect.y + rect.height + radius }, penetration };
  }

  const penetration = radius - dist;
  return {
    pos: {
      x: center.x + (ox / dist) * penetration,
      y: center.y + (oy / dist) * penetration,
    },
    penetration,
  };
}

/**
 * Bewegt einen Kreis um `delta` innerhalb `bounds` (eingesetzt um `radius`),
 * gleitet weich entlang von `obstacles`-Kanten und nudged an Ecken vorbei
 * (Corner-Assist). Sub-stepping verhindert Tunneln bei großen Schrittweiten.
 */
export function slideMoveWithObstacles(
  pos: Vec2,
  delta: Vec2,
  radius: number,
  obstacles: readonly Rect[],
  bounds: Bounds = DEFAULT_ARENA_BOUNDS,
): Vec2 {
  const moveDist = Math.hypot(delta.x, delta.y);
  const maxStep = Math.max(radius * 0.5, 0.5);
  const steps = moveDist === 0 ? 1 : Math.max(1, Math.ceil(moveDist / maxStep));
  const stepDx = delta.x / steps;
  const stepDy = delta.y / steps;

  let cur = clampCircleToBounds(pos, radius, bounds);

  for (let s = 0; s < steps; s++) {
    cur = clampCircleToBounds({ x: cur.x + stepDx, y: cur.y + stepDy }, radius, bounds);

    // Pro Substep jeweils das am tiefsten eindringende Hindernis zuerst lösen,
    // damit aneinanderstoßende Wand-Rechtecke an der Naht keinen Quer-Drift erzeugen.
    for (let iter = 0; iter < 4; iter++) {
      let bestPos: Vec2 | null = null;
      let maxPenetration = 1e-6;

      for (const rect of obstacles) {
        const res = resolveCircleRect(cur, radius, rect);
        if (res.penetration > maxPenetration) {
          maxPenetration = res.penetration;
          bestPos = res.pos;
        }
      }

      if (!bestPos) break;
      cur = clampCircleToBounds(bestPos, radius, bounds);
    }
  }

  return cur;
}
