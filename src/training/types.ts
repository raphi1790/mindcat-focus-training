import type { AgeGroup, ExerciseResult } from '../data/schema';

/**
 * Einheitliche Props aller Trainingsübungen (Vorbild: `ChildAnt`/
 * `AssessmentRunner` im Assessment-Modul). `seed` steuert alle
 * Zufallsanteile der Übung (Reproduzierbarkeit); `onComplete` liefert ein
 * schema-konformes `ExerciseResult`, `onCancel` feuert bei `HoldToExit` ohne
 * Persistierung.
 */
export interface ExerciseProps {
  ageGroup: AgeGroup;
  seed: string;
  onComplete: (result: ExerciseResult) => void;
  onCancel: () => void;
}
