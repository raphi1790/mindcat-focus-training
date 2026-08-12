import { EXERCISE_IDS, type AgeGroup, type ExerciseId } from './schema';

/**
 * Trainingsset nach Altersgruppe (Plan §4 Punkt 5, §6.2).
 *
 * Alle Rueda-Übungen gelten für beide Kohorten — mit einer Ausnahme:
 * "Farmer" (Go/No-Go, Inhibitionskontrolle) ist nur für 6-Jährige vorgesehen
 * (10 statt 9 Übungen). Die Übungen selbst existieren größtenteils noch
 * nicht (Phase 4) — diese Funktion liefert nur die Set-Definition.
 */
export function getExerciseSetForAge(ageGroup: AgeGroup): ExerciseId[] {
  return EXERCISE_IDS.filter((id) => ageGroup === 6 || id !== 'farmer');
}
