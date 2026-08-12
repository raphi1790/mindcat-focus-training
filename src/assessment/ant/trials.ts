import type { Rng } from '../../platform/rng';
import {
  CUES,
  FLANKERS,
  TARGET_POSITIONS,
  DIRECTIONS,
  type Cue,
  type Flanker,
  type TargetPosition,
  type ResponseDirection,
} from '../../data/schema';
import { ANT_TIMINGS } from './config';

/**
 * Seeded Trial-Generierung für den Child ANT.
 *
 * Alle Zufallsentscheidungen (Reihenfolge, Fixationsdauern, Practice-
 * Zuordnungen) laufen ausschließlich über den übergebenen Rng. Derselbe Seed
 * erzeugt exakt dieselbe Trial-Sequenz — der Seed wird im Assessment
 * persistiert (Plan §5.1, Reproduzierbarkeit).
 */

/** Ein geplanter (noch nicht ausgeführter) Trial. */
export interface PlannedTrial {
  cue: Cue;
  flanker: Flanker;
  position: TargetPosition;
  targetDir: ResponseDirection;
  /** Dauer der ersten Fixation in ms (400–1600, aus dem Seed). */
  fixationMs: number;
}

function randomFixationMs(rng: Rng): number {
  return rng.int(ANT_TIMINGS.fixationMinMs, ANT_TIMINGS.fixationMaxMs + 1);
}

/**
 * Ein Testblock = vollständige Kreuzung 4 Cues × 3 Flanker × 2 Positionen ×
 * 2 Richtungen = 48 Trials, seeded geshuffelt. Jede Bedingungskombination
 * kommt damit exakt einmal pro Block vor (Counterbalancing per Design).
 */
export function generateTestBlock(rng: Rng): PlannedTrial[] {
  const trials: PlannedTrial[] = [];
  for (const cue of CUES) {
    for (const flanker of FLANKERS) {
      for (const position of TARGET_POSITIONS) {
        for (const targetDir of DIRECTIONS) {
          trials.push({ cue, flanker, position, targetDir, fixationMs: randomFixationMs(rng) });
        }
      }
    }
  }
  return rng.shuffle(trials);
}

/**
 * Übungsblock = 24 Trials: jede Cue×Flanker-Zelle (12) genau zweimal, dabei
 * Position (top/bottom) und Richtung (L/R) je Zelle einmal vertreten; die
 * Paarung Position↔Richtung und die Gesamtreihenfolge sind seeded-zufällig.
 */
export function generatePracticeBlock(rng: Rng): PlannedTrial[] {
  const trials: PlannedTrial[] = [];
  for (const cue of CUES) {
    for (const flanker of FLANKERS) {
      const positions = rng.shuffle(TARGET_POSITIONS) as [TargetPosition, TargetPosition];
      const directions = rng.shuffle(DIRECTIONS) as [ResponseDirection, ResponseDirection];
      for (const i of [0, 1] as const) {
        trials.push({
          cue,
          flanker,
          position: positions[i],
          targetDir: directions[i],
          fixationMs: randomFixationMs(rng),
        });
      }
    }
  }
  return rng.shuffle(trials);
}
