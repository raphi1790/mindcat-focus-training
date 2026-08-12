import type { Rng } from '../../../platform/rng';

/**
 * Farmer / Go-No-Go (Plan §6.2, Übung 8, nur 6-Jährige): Inhibitionskontrolle.
 * a=7, b=66, c=6 (≥1 No-Go im Streak). Schaf = Go (klicken), Wolf = No-Go
 * (zurückhalten). Höhere Level führen "Morph"-Trials ein: Das Schaf startet
 * normal, mutiert nach `morphDelayMs` aber zum Wolf — ein bereits
 * eingeleiteter Klick muss inhibiert werden.
 */

export type FarmerStimulusKind = 'sheep' | 'wolf' | 'morph';

export interface FarmerTrial {
  kind: FarmerStimulusKind;
  /** Wolf und Morph sind No-Go-Trials (korrekt = kein Klick im gesamten Fenster). */
  isNoGoTrial: boolean;
  responseWindowMs: number;
  /** Nur bei kind === 'morph': Zeitpunkt des Schaf→Wolf-Wechsels. */
  morphDelayMs: number | null;
}

export function responseWindowMsForLevel(level: number): number {
  return Math.max(900, 2000 - (level - 1) * 180);
}

function morphChanceForLevel(level: number): number {
  if (level <= 2) return 0;
  return Math.min(0.6, (level - 2) * 0.15);
}

const NO_GO_PROBABILITY = 0.3;

export function generateFarmerTrial(rng: Rng, level: number): FarmerTrial {
  const responseWindowMs = responseWindowMsForLevel(level);
  const isNoGo = rng.next() < NO_GO_PROBABILITY;

  if (!isNoGo) {
    return { kind: 'sheep', isNoGoTrial: false, responseWindowMs, morphDelayMs: null };
  }

  const isMorph = rng.next() < morphChanceForLevel(level);
  if (isMorph) {
    return {
      kind: 'morph',
      isNoGoTrial: true,
      responseWindowMs,
      morphDelayMs: Math.round(responseWindowMs * 0.45),
    };
  }
  return { kind: 'wolf', isNoGoTrial: true, responseWindowMs, morphDelayMs: null };
}
