import type { Rng } from '../../../platform/rng';
import type { Choice } from '../../../platform/input';

/**
 * Number-Stroop (Plan §6.2, Übung 7): Konfliktlösung. 2AFC "größere Menge
 * wählen". Level 1–2: Apfel-Cluster ohne Ziffern-Konflikt (reiner
 * Mengenvergleich, immer `neutral`). Ab Level 3: Ziffern-Cluster, deren
 * Anzahl vs. gedruckter Ziffernwert kongruent oder inkongruent stehen kann
 * (z. B. sieben „2" vs. zwei „9" → Menge zählt, Wert ist Distraktor).
 */

export type StroopTrialType = 'neutral' | 'congruent' | 'incongruent';

export interface StroopSide {
  count: number;
  /** Gedruckte Ziffer des Clusters, oder null bei Apfel-Clustern. */
  symbol: number | null;
}

export interface StroopTrial {
  type: StroopTrialType;
  left: StroopSide;
  right: StroopSide;
  correctSide: Choice;
}

function pickTwoDistinct(rng: Rng, min: number, max: number): [number, number] {
  const a = rng.int(min, max + 1);
  let b: number;
  do {
    b = rng.int(min, max + 1);
  } while (b === a);
  return [a, b];
}

export function generateAppleTrial(rng: Rng): StroopTrial {
  const [a, b] = pickTwoDistinct(rng, 2, 9);
  const higherOnLeft = rng.next() < 0.5;
  const higher = Math.max(a, b);
  const lower = Math.min(a, b);
  const left = higherOnLeft ? higher : lower;
  const right = higherOnLeft ? lower : higher;
  return {
    type: 'neutral',
    left: { count: left, symbol: null },
    right: { count: right, symbol: null },
    correctSide: left > right ? 'L' : 'R',
  };
}

export function generateDigitTrial(rng: Rng): StroopTrial {
  const isIncongruent = rng.next() < 0.5;
  const [countA, countB] = pickTwoDistinct(rng, 2, 9);
  const countHigh = Math.max(countA, countB);
  const countLow = Math.min(countA, countB);
  const [digitA, digitB] = pickTwoDistinct(rng, 1, 9);
  const digitHigh = Math.max(digitA, digitB);
  const digitLow = Math.min(digitA, digitB);

  const higherCountOnLeft = rng.next() < 0.5;
  const leftCount = higherCountOnLeft ? countHigh : countLow;
  const rightCount = higherCountOnLeft ? countLow : countHigh;
  // Kongruent: die Seite mit der größeren Menge trägt auch die größere Ziffer.
  // Inkongruent: die Seite mit der größeren Menge trägt die kleinere Ziffer.
  const leftGetsHighDigit = higherCountOnLeft ? !isIncongruent : isIncongruent;
  const leftDigit = leftGetsHighDigit ? digitHigh : digitLow;
  const rightDigit = leftGetsHighDigit ? digitLow : digitHigh;

  return {
    type: isIncongruent ? 'incongruent' : 'congruent',
    left: { count: leftCount, symbol: leftDigit },
    right: { count: rightCount, symbol: rightDigit },
    correctSide: leftCount > rightCount ? 'L' : 'R',
  };
}

export function generateStroopTrial(rng: Rng, level: number): StroopTrial {
  return level <= 2 ? generateAppleTrial(rng) : generateDigitTrial(rng);
}
