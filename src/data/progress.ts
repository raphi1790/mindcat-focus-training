import type { AssessmentPhase, AssessmentQuality, TrainingSessionStatus } from './schema';

/**
 * Studienablauf pro Kind: Baseline-ANT → 5 Trainingstage → Post-ANT.
 * Pure Funktion (ohne Firestore), damit die Ablauflogik testbar ist.
 */

export const TOTAL_TRAINING_DAYS = 5;

export interface ProgressAssessment {
  phase: AssessmentPhase;
  quality: Pick<AssessmentQuality, 'excluded'>;
}

export interface ProgressSession {
  sessionDay: number;
  /**
   * Lebenszyklus (AP6). Fehlt bei Alt-Daten → wie `completed` behandelt.
   * Laufende (`in-progress`) Sitzungen zählen nicht als abgeschlossener Tag.
   */
  status?: TrainingSessionStatus;
}

export type NextStep = 'baseline' | 'training' | 'post' | 'done';

export interface ChildProgress {
  /** Gültige (nicht ausgeschlossene) Baseline vorhanden? */
  baselineDone: boolean;
  /** Höchster abgeschlossener Trainingstag (0 = noch keiner). */
  completedDays: number;
  /** Nächster Trainingstag (1–5); bei fertigem Training 5. */
  nextSessionDay: number;
  /** Gültiger Post-Test vorhanden? */
  postDone: boolean;
  /** Was steht als Nächstes an? */
  nextStep: NextStep;
}

export function computeChildProgress(
  assessments: readonly ProgressAssessment[],
  sessions: readonly ProgressSession[],
): ChildProgress {
  // Ausgeschlossene Läufe (>40 % Fehler) zählen nicht als erledigt:
  // Der Test muss wiederholt werden, das Roh-Dokument bleibt erhalten.
  const baselineDone = assessments.some((a) => a.phase === 'baseline' && !a.quality.excluded);
  const postDone = assessments.some((a) => a.phase === 'post' && !a.quality.excluded);

  // Nur echt abgeschlossene Tage zählen — eine laufende (in-progress) Sitzung
  // ist ein noch offener, fortsetzbarer Tag (AP6), kein erledigter.
  const completedDays = sessions.reduce(
    (max, s) => (s.status !== 'in-progress' && s.sessionDay > max ? s.sessionDay : max),
    0,
  );
  const trainingDone = completedDays >= TOTAL_TRAINING_DAYS;
  const nextSessionDay = trainingDone ? TOTAL_TRAINING_DAYS : completedDays + 1;

  let nextStep: NextStep;
  if (!baselineDone) {
    nextStep = 'baseline';
  } else if (!trainingDone) {
    nextStep = 'training';
  } else if (!postDone) {
    nextStep = 'post';
  } else {
    nextStep = 'done';
  }

  return { baselineDone, completedDays, nextSessionDay, postDone, nextStep };
}
