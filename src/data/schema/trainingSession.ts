import { z } from 'zod';
import { ageGroupSchema, dateFromTimestamp } from './common';

/**
 * Ein Trainingstag unter users/{uid}/children/{childId}/trainingSessions/{id}.
 * Metriken orientieren sich an Tabelle 1 der Studie (abgeschlossene Übungen,
 * Trials, Trial-to-Advance-Rate, Fehler-/Miss-Quoten).
 */

/** Übungs-IDs des Rueda-Trainingsprogramms (Plan §6.2). */
export const EXERCISE_IDS = [
  'side',
  'chase',
  'maze',
  'anticipation-visible',
  'anticipation-invisible',
  'discrimination',
  'discrimination-delay',
  'number',
  'number-stroop',
  'farmer', // nur Altersgruppe 6
] as const;

export const exerciseIdSchema = z.enum(EXERCISE_IDS);
export type ExerciseId = z.infer<typeof exerciseIdSchema>;

export const perLevelStatsSchema = z.object({
  level: z.number().int().min(1),
  trials: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
});
export type PerLevelStats = z.infer<typeof perLevelStatsSchema>;

export const exerciseResultSchema = z.object({
  exerciseId: exerciseIdSchema,
  levelsCompleted: z.number().int().nonnegative(),
  highestLevel: z.number().int().min(1),
  trials: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  /** Trials pro Level-Aufstieg (vgl. Studie Tabelle 1, ~4–5.5). */
  trialToAdvanceRate: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  perLevel: z.array(perLevelStatsSchema),
  /** Optionales Detail-Log für Feinanalysen (Struktur übungsspezifisch). */
  rawEvents: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type ExerciseResult = z.infer<typeof exerciseResultSchema>;

/** Create-Payload (Zeitstempel setzt der Server). */
export const trainingSessionInputSchema = z.object({
  sessionDay: z.number().int().min(1).max(5),
  ageGroupAtTest: ageGroupSchema,
  /** Seed der Sitzung (Reproduzierbarkeit der Übungs-Zufallsanteile). */
  rngSeed: z.string().min(1),
  exercises: z.array(exerciseResultSchema),
});
export type TrainingSessionInput = z.infer<typeof trainingSessionInputSchema>;

/** Persistiertes Dokument (Lese-Schema). */
export const trainingSessionDocSchema = trainingSessionInputSchema.extend({
  timestamp: dateFromTimestamp,
});
export type TrainingSessionDoc = z.infer<typeof trainingSessionDocSchema>;

export type TrainingSession = TrainingSessionDoc & { id: string };
