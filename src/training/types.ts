import type { AgeGroup, ExerciseResult } from '../data/schema';
import type { ExerciseProgressState } from './engine';

/**
 * Einheitliche Props aller Trainingsübungen (Vorbild: `ChildAnt`/
 * `AssessmentRunner` im Assessment-Modul). `seed` steuert alle
 * Zufallsanteile der Übung (Reproduzierbarkeit); `onComplete` liefert ein
 * schema-konformes `ExerciseResult`, `onCancel` feuert bei `HoldToExit` ohne
 * Persistierung.
 *
 * `initialState`/`onLevelUp` sind der Resume-Anschluss (AP6): der Runner
 * reicht sie an `useExerciseEngine` durch — Startzustand für den Wiedereinstieg
 * und Callback für jeden Level-Aufstieg (Checkpoint). Beide optional; frei
 * gespielte Einzelübungen lassen sie weg.
 */
export interface ExerciseProps {
  ageGroup: AgeGroup;
  seed: string;
  onComplete: (result: ExerciseResult) => void;
  onCancel: () => void;
  initialState?: ExerciseProgressState;
  onLevelUp?: (state: ExerciseProgressState) => void;
}
