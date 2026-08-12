import type { Rng } from '../../../platform/rng';

/**
 * Number (Plan §6.2, Übung 6): Symbol-Matching. Zieldigit ("Stil A") muss aus
 * einem Kandidaten-Array ("Stil B", Cross-Format) herausgefunden werden.
 * Level ↑ = größerer Zahlenraum + optisch verwechselbare Distraktoren (6/9,
 * 3/8, 1/7).
 */

const CONFUSABLE: Record<number, number[]> = {
  6: [9],
  9: [6],
  3: [8],
  8: [3],
  1: [7],
  7: [1],
};

export function digitRangeForLevel(level: number): number {
  return Math.min(9, 2 + level * 2);
}

export function candidateCountForLevel(level: number): number {
  if (level <= 2) return 3;
  if (level <= 4) return 4;
  return 5;
}

function pickDistractor(rng: Rng, target: number, maxDigit: number, used: Set<number>, level: number): number {
  if (level >= 4) {
    const confusables = (CONFUSABLE[target] ?? []).filter((v) => v <= maxDigit && !used.has(v));
    if (confusables.length > 0) return rng.pick(confusables);
  }
  let value: number;
  let guard = 0;
  do {
    value = rng.int(1, maxDigit + 1);
    guard += 1;
  } while (used.has(value) && guard < 30);
  return value;
}

export interface NumberTrial {
  target: number;
  candidates: number[];
  correctIndex: number;
}

export function generateNumberTrial(rng: Rng, level: number): NumberTrial {
  const maxDigit = digitRangeForLevel(level);
  const target = rng.int(1, maxDigit + 1);
  const candidateCount = candidateCountForLevel(level);
  const correctIndex = rng.int(0, candidateCount);

  const used = new Set<number>([target]);
  const candidates: number[] = new Array(candidateCount).fill(0);
  candidates[correctIndex] = target;

  for (let i = 0; i < candidateCount; i++) {
    if (i === correctIndex) continue;
    const value = pickDistractor(rng, target, maxDigit, used, level);
    used.add(value);
    candidates[i] = value;
  }

  return { target, candidates, correctIndex };
}
