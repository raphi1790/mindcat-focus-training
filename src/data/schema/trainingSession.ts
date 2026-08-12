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

/**
 * Zod-Spiegel von `ExerciseProgressState` (src/training/engine/exerciseProgress.ts)
 * an der Firestore-Grenze: bildet den Übungs-Fortschritt eines Resume-Checkpoints
 * ab (AP6, Fix-Plan Testrunde 1). Muss strukturell identisch zum Engine-Typ
 * bleiben — ein Test in `schema.test.ts` sichert das ab.
 */
export const exerciseProgressStateSchema = z.object({
  level: z.number().int().min(1),
  streak: z.number().int().nonnegative(),
  qualifierSeenInStreak: z.boolean(),
  totalTrials: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  perLevel: z.array(perLevelStatsSchema),
  done: z.boolean(),
});
export type ExerciseProgressStateShape = z.infer<typeof exerciseProgressStateSchema>;

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

/**
 * Lebenszyklus eines Trainingstags (AP6): `in-progress` während des Spielens
 * (inkrementell fortgeschrieben, fortsetzbar nach Absturz), `completed` nach
 * echtem Tagesabschluss. Alt-Dokumente ohne Feld gelten als `completed`.
 */
export const trainingSessionStatusSchema = z.enum(['in-progress', 'completed']);
export type TrainingSessionStatus = z.infer<typeof trainingSessionStatusSchema>;

/**
 * Resume-Checkpoint (Write-Form): welche Übung gerade läuft und mit welchem
 * Engine-Zustand sie fortgesetzt wird. `updatedAt` hängt das Repo als
 * `serverTimestamp()` an (nicht Teil des Client-Payloads).
 */
export const trainingCheckpointInputSchema = z.object({
  exerciseIndex: z.number().int().nonnegative(),
  exerciseId: exerciseIdSchema,
  engineState: exerciseProgressStateSchema,
});
export type TrainingCheckpointInput = z.infer<typeof trainingCheckpointInputSchema>;

/** Checkpoint-Lese-Form: zusätzlich der Server-Zeitstempel (→ Date). */
export const trainingCheckpointSchema = trainingCheckpointInputSchema.extend({
  updatedAt: dateFromTimestamp.optional(),
});
export type TrainingCheckpoint = z.infer<typeof trainingCheckpointSchema>;

/** Create-Payload (Zeitstempel setzt der Server). */
export const trainingSessionInputSchema = z.object({
  sessionDay: z.number().int().min(1).max(5),
  ageGroupAtTest: ageGroupSchema,
  /** Seed der Sitzung (Reproduzierbarkeit der Übungs-Zufallsanteile). */
  rngSeed: z.string().min(1),
  exercises: z.array(exerciseResultSchema),
});
export type TrainingSessionInput = z.infer<typeof trainingSessionInputSchema>;

/**
 * Inkrementelles Update-Payload (AP6): Ergebnisliste und/oder Checkpoint einer
 * laufenden Sitzung. Beide Felder optional — ein Level-Aufstieg schreibt nur
 * den Checkpoint, ein Übungsabschluss die erweiterte Ergebnisliste.
 */
export const trainingSessionProgressSchema = z.object({
  exercises: z.array(exerciseResultSchema).optional(),
  checkpoint: trainingCheckpointInputSchema.optional(),
});
export type TrainingSessionProgress = z.infer<typeof trainingSessionProgressSchema>;

/** Persistiertes Dokument (Lese-Schema). */
export const trainingSessionDocSchema = trainingSessionInputSchema.extend({
  timestamp: dateFromTimestamp,
  /** Fehlt bei Alt-Dokumenten (vor AP6) → als abgeschlossen behandeln. */
  status: trainingSessionStatusSchema.default('completed'),
  /** Nur bei laufenden Sitzungen gesetzt; nach Abschluss entfernt. */
  checkpoint: trainingCheckpointSchema.optional(),
  /** Zeitpunkt des echten Tagesabschlusses (fehlt bei Alt-/laufenden Dokumenten). */
  completedAt: dateFromTimestamp.optional(),
});
export type TrainingSessionDoc = z.infer<typeof trainingSessionDocSchema>;

export type TrainingSession = TrainingSessionDoc & { id: string };
