import { getExerciseSetForAge } from '../data/exerciseSet';
import type { AgeGroup, ExerciseId } from '../data/schema';

/**
 * 5-Tage-Scheduler (Plan §6.2/§9 Phase 4): verteilt das altersabhängige
 * Übungsset (`getExerciseSetForAge`, bereits in kanonischer Reihenfolge —
 * Navigations-/Motorik-Übungen zuerst, Konflikt-/Inhibitionsübungen zuletzt)
 * gleichmäßig auf 5 Trainingstage. Überschüssige Übungen (bei 9 Übungen auf
 * 5 Tage) landen auf den früheren Tagen, sodass Tag 5 nie mehr Übungen hat
 * als die Tage davor.
 */
export function buildTrainingPlan(ageGroup: AgeGroup): ExerciseId[][] {
  const exercises = getExerciseSetForAge(ageGroup);
  const days: ExerciseId[][] = [[], [], [], [], []];

  const perDay = Math.floor(exercises.length / 5);
  let remainder = exercises.length % 5;
  let index = 0;

  for (let day = 0; day < 5; day++) {
    let count = perDay;
    if (remainder > 0) {
      count += 1;
      remainder -= 1;
    }
    days[day] = exercises.slice(index, index + count);
    index += count;
  }

  return days;
}
