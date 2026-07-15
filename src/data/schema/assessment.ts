import { z } from 'zod';
import { ageGroupSchema, dateFromTimestamp } from './common';

/**
 * Ein Child-ANT-Lauf unter users/{uid}/children/{childId}/assessments/{id}.
 *
 * Wissenschaftliche Anforderungen (Plan §5.1):
 *  - vollständiges Roh-Trial-Log für Reanalyse
 *  - Seed + Konfiguration für Reproduzierbarkeit
 *  - Exclusion-Regel (> 40 % Fehler) als Qualitätsflag, nicht als Löschung
 */

export const CUES = ['none', 'central', 'double', 'spatial'] as const;
export const FLANKERS = ['neutral', 'congruent', 'incongruent'] as const;
export const TARGET_POSITIONS = ['top', 'bottom'] as const;
export const DIRECTIONS = ['L', 'R'] as const;

export const cueSchema = z.enum(CUES);
export const flankerSchema = z.enum(FLANKERS);
export const targetPositionSchema = z.enum(TARGET_POSITIONS);
export const directionSchema = z.enum(DIRECTIONS);

export type Cue = z.infer<typeof cueSchema>;
export type Flanker = z.infer<typeof flankerSchema>;
export type TargetPosition = z.infer<typeof targetPositionSchema>;
export type ResponseDirection = z.infer<typeof directionSchema>;

export const assessmentPhaseSchema = z.enum(['baseline', 'post', 'interim']);
export type AssessmentPhase = z.infer<typeof assessmentPhaseSchema>;

/** Ein einzelner Trial im Roh-Log. */
export const trialSchema = z.object({
  /** Fortlaufender Index über alle Test-Trials (0-basiert). */
  index: z.number().int().nonnegative(),
  /** Testblock 1..n (Übungsblock wird nicht geloggt). */
  block: z.number().int().min(1),
  cue: cueSchema,
  flanker: flankerSchema,
  position: targetPositionSchema,
  targetDir: directionSchema,
  /** Gegebene Antwort; null = keine Antwort (Miss). */
  responseDir: directionSchema.nullable(),
  /** true/false = richtig/falsch; null = Miss. */
  correct: z.boolean().nullable(),
  /** Reaktionszeit in ms relativ zum Paint-Onset; null bei Miss. */
  rt: z.number().positive().nullable(),
  /** performance.now()-Zeitstempel des Target-Onsets (post-paint). */
  onsetTs: z.number().nonnegative(),
  /** Geplante Fixationsdauer dieses Trials in ms (aus dem Seed). */
  fixationMs: z.number().positive(),
});
export type Trial = z.infer<typeof trialSchema>;

/** ANT-Netzwerk-Scores (Median-RT korrekter Trials, Rueda 2004). */
export const antScoresSchema = z.object({
  /** Median-RT aller korrekten Trials in ms. */
  overallRT: z.number(),
  /** incongruent − congruent. */
  conflictRT: z.number(),
  /** no-cue − double-cue. */
  alertingRT: z.number(),
  /** central-cue − spatial-cue. */
  orientingRT: z.number(),
  /** (Fehler + Misses) / Trials in %. */
  overallErrorRate: z.number().min(0).max(100),
  /** Accuracy je Bedingung, Schlüssel z. B. 'flanker:incongruent'. */
  accuracyByCondition: z.record(z.string(), z.number()),
});
export type AntScores = z.infer<typeof antScoresSchema>;

/** Qualitätsflag statt Datenlöschung: Ausschluss bleibt nachvollziehbar. */
export const assessmentQualitySchema = z.object({
  /** true bei Fehlerrate > 40 % (Exclusion-Regel der Studie). */
  excluded: z.boolean(),
  reason: z.string().optional(),
  validTrialCount: z.number().int().nonnegative(),
});
export type AssessmentQuality = z.infer<typeof assessmentQualitySchema>;

/** Test-Konfiguration — persistiert, damit Läufe vergleichbar bleiben. */
export const antConfigSchema = z.object({
  practiceTrials: z.number().int().positive(),
  testBlocks: z.number().int().positive(),
  trialsPerBlock: z.number().int().positive(),
  timings: z
    .object({
      fixationMinMs: z.number().positive(),
      fixationMaxMs: z.number().positive(),
      cueMs: z.number().positive(),
      postCueFixationMs: z.number().positive(),
      targetMaxMs: z.number().positive(),
    })
    .catchall(z.number()),
});
export type AntConfig = z.infer<typeof antConfigSchema>;

/** Create-Payload (Zeitstempel setzt der Server). */
export const assessmentInputSchema = z.object({
  phase: assessmentPhaseSchema,
  ageGroupAtTest: ageGroupSchema,
  rngSeed: z.string().min(1),
  config: antConfigSchema,
  scores: antScoresSchema,
  quality: assessmentQualitySchema,
  rawTrials: z.array(trialSchema),
});
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;

/** Persistiertes Dokument (Lese-Schema). */
export const assessmentDocSchema = assessmentInputSchema.extend({
  timestamp: dateFromTimestamp,
});
export type AssessmentDoc = z.infer<typeof assessmentDocSchema>;

export type Assessment = AssessmentDoc & { id: string };
