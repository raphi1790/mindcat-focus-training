import type { Rng } from '../../platform/rng';

/**
 * Prozedurale Katzen-Portraits für die Discrimination-Übungen — Attribut-
 * Vektor statt Bild-Assets, damit Vorlage/Kandidaten rein datengetrieben und
 * reproduzierbar (seeded RNG) erzeugt werden können.
 */

export interface PortraitAttributes {
  furColor: number;
  eyeColor: number;
  pattern: number;
  accessory: number;
}

export const FUR_COLOR_COUNT = 6;
export const EYE_COLOR_COUNT = 6;
export const PATTERN_COUNT = 5;
export const ACCESSORY_COUNT = 6;

const ATTRIBUTE_KEYS = ['furColor', 'eyeColor', 'pattern', 'accessory'] as const;
type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

const ATTRIBUTE_RANGES: Record<AttributeKey, number> = {
  furColor: FUR_COLOR_COUNT,
  eyeColor: EYE_COLOR_COUNT,
  pattern: PATTERN_COUNT,
  accessory: ACCESSORY_COUNT,
};

export function randomPortrait(rng: Rng): PortraitAttributes {
  return {
    furColor: rng.int(0, FUR_COLOR_COUNT),
    eyeColor: rng.int(0, EYE_COLOR_COUNT),
    pattern: rng.int(0, PATTERN_COUNT),
    accessory: rng.int(0, ACCESSORY_COUNT),
  };
}

/** Erzeugt ein Portrait, das sich vom Template in genau `diffCount` Attributen unterscheidet. */
export function makeDistractor(
  rng: Rng,
  template: PortraitAttributes,
  diffCount: number,
): PortraitAttributes {
  const clampedCount = Math.min(Math.max(diffCount, 1), ATTRIBUTE_KEYS.length);
  const keysToChange = rng.shuffle(ATTRIBUTE_KEYS).slice(0, clampedCount);
  const result: PortraitAttributes = { ...template };
  for (const key of keysToChange) {
    const range = ATTRIBUTE_RANGES[key];
    let value = template[key];
    if (range > 1) {
      do {
        value = rng.int(0, range);
      } while (value === template[key]);
    }
    result[key] = value;
  }
  return result;
}

export function portraitsEqual(a: PortraitAttributes, b: PortraitAttributes): boolean {
  return (
    a.furColor === b.furColor &&
    a.eyeColor === b.eyeColor &&
    a.pattern === b.pattern &&
    a.accessory === b.accessory
  );
}

export function countDifferingAttributes(a: PortraitAttributes, b: PortraitAttributes): number {
  return ATTRIBUTE_KEYS.reduce((count, key) => count + (a[key] === b[key] ? 0 : 1), 0);
}

export interface DiscriminationTrial {
  template: PortraitAttributes;
  candidates: PortraitAttributes[];
  correctIndex: number;
}

export function generateDiscriminationTrial(
  rng: Rng,
  diffAttrCount: number,
  candidateCount: number,
): DiscriminationTrial {
  const template = randomPortrait(rng);
  const correctIndex = rng.int(0, candidateCount);
  const candidates: PortraitAttributes[] = [];
  for (let i = 0; i < candidateCount; i++) {
    candidates.push(i === correctIndex ? template : makeDistractor(rng, template, diffAttrCount));
  }
  return { template, candidates, correctIndex };
}
