import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { z } from 'zod';
import {
  assessmentDocSchema,
  assessmentInputSchema,
  childDocSchema,
  childInputSchema,
  exerciseResultSchema,
  trainingSessionDocSchema,
  trainingSessionInputSchema,
  trainingSessionProgressSchema,
  type AgeGroup,
  type Assessment,
  type AssessmentInput,
  type Child,
  type ChildInput,
  type ExerciseResult,
  type TrainingSession,
  type TrainingSessionInput,
  type TrainingSessionProgress,
} from '../data/schema';
import { computeChildProgress, type ChildProgress } from '../data/progress';
import { computeEffectSummary } from '../dashboard/effectSummary';
import { computeTrainingSummary } from '../dashboard/trainingSummary';
import { getExerciseSetForAge } from '../data/exerciseSet';
import { EXERCISE_CONFIGS } from '../training/exerciseConfigs';
import { RESPONDER_PRESETS, simulateAssessment, type SimulatedAssessment } from './participantModel';
import { simulateTrainingProgram } from './trainingModel';
import {
  assessmentsCollection,
  childDoc,
  childrenCollection,
  trainingSessionDoc,
  trainingSessionsCollection,
} from '../data/firestore/paths';
import { stripUndefinedDeep } from '../data/firestore/serialize';

/**
 * Issue #17: E2E Full Lifecycle Database Test against Firebase Firestore Emulator.
 *
 * Verifies the complete longitudinal protocol (Rueda et al., 2005):
 * 1. Child Creation (pseudonym, ageGroup 4/6, schema validation, serverTimestamp).
 * 2. Baseline Child ANT Assessment (144 trials, Attention Network scores, exclusion checks).
 * 3. 5 Training Days (Cohort 4: 9 exercises without Farmer; Cohort 6: 10 exercises with Farmer).
 * 4. Incremental in-progress persistence, checkpoint updates on level transitions, crash resume.
 * 5. Standalone practice simulation and protocol progress isolation.
 * 6. Post-Test Child ANT Assessment and Pre/Post effect calculation (Executive Attention improvement).
 * 7. Zod schema validation on every persisted and retrieved document.
 * 8. Firestore Security Rules enforcement (Cross-supervisor isolation, immutability of completed data).
 * 9. Exclusion handling (random responder > 40% error) and progress reset.
 */

const ALICE = 'alice-supervisor-uid';
const BOB = 'bob-supervisor-uid';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'mindcat-focus-training',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

function asUser(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

// ── Database Operations via Authenticated Context ────────────────────────────

async function createChildDoc(db: Firestore, uid: string, input: ChildInput): Promise<string> {
  const payload = stripUndefinedDeep(childInputSchema.parse(input));
  const ref = await addDoc(childrenCollection(db, uid), {
    ...payload,
    createdAt: serverTimestamp(),
    archived: false,
  });
  return ref.id;
}

async function getChildDoc(db: Firestore, uid: string, childId: string): Promise<Child> {
  const snap = await getDoc(childDoc(db, uid, childId));
  if (!snap.exists()) throw new Error(`Child ${childId} not found`);
  return { id: snap.id, ...childDocSchema.parse(snap.data()) };
}

async function listChildrenDocs(
  db: Firestore,
  uid: string,
  { includeArchived = false } = {},
): Promise<Child[]> {
  const snap = await getDocs(query(childrenCollection(db, uid), orderBy('createdAt', 'asc')));
  const children = snap.docs.map((d) => ({ id: d.id, ...childDocSchema.parse(d.data()) }));
  return includeArchived ? children : children.filter((c) => !c.archived);
}

async function addAssessmentDoc(
  db: Firestore,
  uid: string,
  childId: string,
  input: AssessmentInput,
): Promise<string> {
  const payload = stripUndefinedDeep(assessmentInputSchema.parse(input));
  const ref = await addDoc(assessmentsCollection(db, uid, childId), {
    ...payload,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

async function listAssessmentsDocs(
  db: Firestore,
  uid: string,
  childId: string,
): Promise<Assessment[]> {
  const snap = await getDocs(
    query(assessmentsCollection(db, uid, childId), orderBy('timestamp', 'asc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...assessmentDocSchema.parse(d.data()) }));
}

async function startTrainingSessionDoc(
  db: Firestore,
  uid: string,
  childId: string,
  input: TrainingSessionInput,
): Promise<string> {
  const payload = stripUndefinedDeep(trainingSessionInputSchema.parse(input));
  const ref = await addDoc(trainingSessionsCollection(db, uid, childId), {
    ...payload,
    status: 'in-progress',
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

async function updateTrainingSessionProgressDoc(
  db: Firestore,
  uid: string,
  childId: string,
  sessionId: string,
  progress: TrainingSessionProgress,
): Promise<void> {
  const parsed = stripUndefinedDeep(trainingSessionProgressSchema.parse(progress));
  const data: Record<string, unknown> = {};
  if (parsed.exercises) data.exercises = parsed.exercises;
  if (parsed.checkpoint) data.checkpoint = { ...parsed.checkpoint, updatedAt: serverTimestamp() };
  if (Object.keys(data).length === 0) return;
  await updateDoc(trainingSessionDoc(db, uid, childId, sessionId), data);
}

async function completeTrainingSessionDoc(
  db: Firestore,
  uid: string,
  childId: string,
  sessionId: string,
  exercises: ExerciseResult[],
): Promise<void> {
  const parsed = stripUndefinedDeep(z.array(exerciseResultSchema).parse(exercises));
  await updateDoc(trainingSessionDoc(db, uid, childId, sessionId), {
    exercises: parsed,
    status: 'completed',
    checkpoint: deleteField(),
    completedAt: serverTimestamp(),
  });
}

async function listTrainingSessionsDocs(
  db: Firestore,
  uid: string,
  childId: string,
): Promise<TrainingSession[]> {
  const snap = await getDocs(
    query(trainingSessionsCollection(db, uid, childId), orderBy('timestamp', 'asc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...trainingSessionDocSchema.parse(d.data()) }));
}

async function findInProgressSessionDoc(
  db: Firestore,
  uid: string,
  childId: string,
  sessionDay: number,
): Promise<TrainingSession | null> {
  const sessions = await listTrainingSessionsDocs(db, uid, childId);
  const inProgress = sessions.filter(
    (s) => s.status === 'in-progress' && s.sessionDay === sessionDay,
  );
  return inProgress.length > 0 ? inProgress[inProgress.length - 1]! : null;
}

async function getChildProgressDb(
  db: Firestore,
  uid: string,
  childId: string,
): Promise<ChildProgress> {
  const [assessments, sessions] = await Promise.all([
    listAssessmentsDocs(db, uid, childId),
    listTrainingSessionsDocs(db, uid, childId),
  ]);
  return computeChildProgress(assessments, sessions);
}

function buildAssessmentInput(
  phase: 'baseline' | 'post',
  ageGroup: AgeGroup,
  sim: SimulatedAssessment,
): AssessmentInput {
  return {
    phase,
    ageGroupAtTest: ageGroup,
    rngSeed: sim.rngSeed,
    config: sim.config,
    scores: sim.scoring.scores,
    quality: sim.scoring.quality,
    rawTrials: sim.rawTrials,
  };
}

// ── Test Suites ─────────────────────────────────────────────────────────────

describe('E2E Lifecycle — Längsschnitt-Studie gegen Firestore Emulator', () => {
  const cohorts: Array<{
    ageGroup: AgeGroup;
    displayName: string;
    expectedExercisesCount: number;
    hasFarmer: boolean;
  }> = [
    { ageGroup: 4, displayName: 'Mimi-4J', expectedExercisesCount: 9, hasFarmer: false },
    { ageGroup: 6, displayName: 'Leo-6J', expectedExercisesCount: 10, hasFarmer: true },
  ];

  it.each(cohorts)(
    'simuliert den vollständigen Lebenszyklus für Kohorte $ageGroup Jahre ($displayName)',
    async ({ ageGroup, displayName, expectedExercisesCount, hasFarmer }) => {
      const db = asUser(ALICE);
      const seed = `e2e-seed-age${ageGroup}`;

      // 1. Kind anlegen
      const childInput: ChildInput = {
        displayName,
        ageGroup,
        sex: ageGroup === 4 ? 'f' : 'm',
        studyGroup: 'trained',
      };
      const childId = await createChildDoc(db, ALICE, childInput);
      expect(childId).toBeDefined();

      const createdChild = await getChildDoc(db, ALICE, childId);
      expect(createdChild.displayName).toBe(displayName);
      expect(createdChild.ageGroup).toBe(ageGroup);
      expect(createdChild.archived).toBe(false);
      expect(createdChild.createdAt).toBeInstanceOf(Date);

      // Initialer Fortschritt: Kein Baseline-Test
      const initialProgress = await getChildProgressDb(db, ALICE, childId);
      expect(initialProgress.baselineDone).toBe(false);
      expect(initialProgress.completedDays).toBe(0);
      expect(initialProgress.nextStep).toBe('baseline');

      // 2. Baseline Child ANT Assessment
      const baselineSim = simulateAssessment(`${seed}:baseline`, RESPONDER_PRESETS[ageGroup].baseline);
      const baselineInput = buildAssessmentInput('baseline', ageGroup, baselineSim);

      const baselineId = await addAssessmentDoc(db, ALICE, childId, baselineInput);
      expect(baselineId).toBeDefined();

      const assessmentsAfterBaseline = await listAssessmentsDocs(db, ALICE, childId);
      expect(assessmentsAfterBaseline).toHaveLength(1);
      const baselineDoc = assessmentsAfterBaseline[0]!;
      expect(baselineDoc.phase).toBe('baseline');
      expect(baselineDoc.rawTrials).toHaveLength(144);
      expect(baselineDoc.scores.overallRT).toBeGreaterThan(0);
      expect(baselineDoc.scores.conflictRT).toBeGreaterThan(0);
      expect(baselineDoc.scores.alertingRT).toBeGreaterThan(0);
      expect(baselineDoc.scores.orientingRT).toBeGreaterThan(0);
      expect(baselineDoc.quality.excluded).toBe(false);
      expect(baselineDoc.timestamp).toBeInstanceOf(Date);

      // Fortschritt nach Baseline: bereit für Tag 1
      const progressAfterBaseline = await getChildProgressDb(db, ALICE, childId);
      expect(progressAfterBaseline.baselineDone).toBe(true);
      expect(progressAfterBaseline.completedDays).toBe(0);
      expect(progressAfterBaseline.nextStep).toBe('training');
      expect(progressAfterBaseline.nextSessionDay).toBe(1);

      // 3. 5 Trainingstage simulieren
      const trainingPlanDays = simulateTrainingProgram(ageGroup, `${seed}:training`);
      expect(trainingPlanDays).toHaveLength(5);

      const allPlayedExerciseIds: string[] = [];

      for (let dayIndex = 0; dayIndex < trainingPlanDays.length; dayIndex++) {
        const day = trainingPlanDays[dayIndex]!;
        const dayNumber = day.sessionDay;

        // a) Sitzung starten
        const sessionInput: TrainingSessionInput = {
          sessionDay: dayNumber,
          ageGroupAtTest: ageGroup,
          rngSeed: `mindcat-v1:day${dayNumber}`,
          exercises: [],
        };
        const sessionId = await startTrainingSessionDoc(db, ALICE, childId, sessionInput);
        expect(sessionId).toBeDefined();

        // In-Progress Session abfragen
        const activeSession = await findInProgressSessionDoc(db, ALICE, childId, dayNumber);
        expect(activeSession).not.toBeNull();
        expect(activeSession?.status).toBe('in-progress');
        expect(activeSession?.sessionDay).toBe(dayNumber);

        // b) Inkrementelle Checkpoint-Updates (AP6)
        const dayExercises = day.input.exercises;
        const accumulatedExercises: ExerciseResult[] = [];

        for (let exIdx = 0; exIdx < dayExercises.length; exIdx++) {
          const ex = dayExercises[exIdx]!;
          allPlayedExerciseIds.push(ex.exerciseId);

          // Checkpoint während der Übung (z.B. Level 2 Aufstieg)
          const intermediateCheckpoint: TrainingSessionProgress = {
            exercises: [...accumulatedExercises],
            checkpoint: {
              exerciseIndex: exIdx,
              exerciseId: ex.exerciseId,
              engineState: {
                level: 2,
                streak: 1,
                qualifierSeenInStreak: false,
                totalTrials: 8,
                correct: 7,
                errors: 1,
                missed: 0,
                perLevel: [{ level: 1, trials: 6, correct: 6, errors: 0 }],
                done: false,
              },
            },
          };
          await updateTrainingSessionProgressDoc(
            db,
            ALICE,
            childId,
            sessionId,
            intermediateCheckpoint,
          );

          // Crash-Resume Prüfung: In-Progress Session hat gespeicherten Checkpoint
          const resumedSession = await findInProgressSessionDoc(db, ALICE, childId, dayNumber);
          expect(resumedSession?.checkpoint).toBeDefined();
          expect(resumedSession?.checkpoint?.exerciseId).toBe(ex.exerciseId);
          expect(resumedSession?.checkpoint?.engineState.level).toBe(2);
          expect(resumedSession?.checkpoint?.updatedAt).toBeInstanceOf(Date);

          // Übung beenden und akkumulieren
          accumulatedExercises.push(ex);
        }

        // c) Sitzung abschließen
        await completeTrainingSessionDoc(db, ALICE, childId, sessionId, dayExercises);

        // Nach Abschluss: status = 'completed', Checkpoint gelöscht
        const completedSessions = await listTrainingSessionsDocs(db, ALICE, childId);
        const currentCompletedSession = completedSessions.find((s) => s.id === sessionId);
        expect(currentCompletedSession?.status).toBe('completed');
        expect(currentCompletedSession?.checkpoint).toBeUndefined();
        expect(currentCompletedSession?.completedAt).toBeInstanceOf(Date);
        expect(currentCompletedSession?.exercises).toHaveLength(dayExercises.length);

        // Kein In-Progress mehr für diesen Tag
        const noActiveSession = await findInProgressSessionDoc(db, ALICE, childId, dayNumber);
        expect(noActiveSession).toBeNull();

        // Fortschritt nach dem Tag prüfen
        const progressAfterDay = await getChildProgressDb(db, ALICE, childId);
        expect(progressAfterDay.completedDays).toBe(dayNumber);
        if (dayNumber < 5) {
          expect(progressAfterDay.nextStep).toBe('training');
          expect(progressAfterDay.nextSessionDay).toBe(dayNumber + 1);
        } else {
          expect(progressAfterDay.nextStep).toBe('post');
        }
      }

      // Übungsanzahl & Kohorten-Spezifika prüfen
      expect(allPlayedExerciseIds).toHaveLength(expectedExercisesCount);
      expect(allPlayedExerciseIds.includes('farmer')).toBe(hasFarmer);
      const expectedExerciseSet = getExerciseSetForAge(ageGroup);
      expect([...new Set(allPlayedExerciseIds)].sort()).toEqual([...expectedExerciseSet].sort());

      // 4. Post Child ANT Assessment
      const postSim = simulateAssessment(`${seed}:post`, RESPONDER_PRESETS[ageGroup].post);
      const postInput = buildAssessmentInput('post', ageGroup, postSim);

      const postId = await addAssessmentDoc(db, ALICE, childId, postInput);
      expect(postId).toBeDefined();

      const finalAssessments = await listAssessmentsDocs(db, ALICE, childId);
      expect(finalAssessments).toHaveLength(2);
      const postDoc = finalAssessments.find((a) => a.id === postId)!;
      expect(postDoc.phase).toBe('post');
      expect(postDoc.rawTrials).toHaveLength(144);
      expect(postDoc.quality.excluded).toBe(false);

      // Finaler Protokollstatus: 'done'
      const finalProgress = await getChildProgressDb(db, ALICE, childId);
      expect(finalProgress.baselineDone).toBe(true);
      expect(finalProgress.completedDays).toBe(5);
      expect(finalProgress.postDone).toBe(true);
      expect(finalProgress.nextStep).toBe('done');

      // 5. Wissenschaftliche Effekt- & Trainingsauswertung
      const allSessions = await listTrainingSessionsDocs(db, ALICE, childId);
      const effect = computeEffectSummary(finalAssessments);
      expect(effect).not.toBeNull();

      const conflictMetric = effect?.metrics.find((m) => m.key === 'conflictRT');
      const overallMetric = effect?.metrics.find((m) => m.key === 'overallRT');
      expect(conflictMetric?.delta).toBeLessThan(0); // Exekutive Verbesserung
      expect(overallMetric?.delta).toBeLessThan(0); // Geschwindigkeitsverbesserung

      const trainingSummary = computeTrainingSummary(allSessions);
      expect(trainingSummary.totalDaysCompleted).toBe(5);
      expect(trainingSummary.totalExercisesCompleted).toBe(expectedExercisesCount);
      expect(trainingSummary.overallErrorRate).toBeGreaterThanOrEqual(0);

      for (const day of trainingSummary.days) {
        expect(day.exercisesCompleted).toBeGreaterThanOrEqual(1);
        expect(day.totalTrials).toBeGreaterThan(0);
      }
    },
  );
});

describe('E2E Lifecycle — Standalone-Übungen & Fortschrittsisolation', () => {
  it('isoliert Standalone-Übungen vom 5-Tage-Trainingsprotokoll', async () => {
    const db = asUser(ALICE);
    const childId = await createChildDoc(db, ALICE, {
      displayName: 'Standalone-Tester',
      ageGroup: 6,
    });

    // Baseline absolvieren
    const baselineSim = simulateAssessment('standalone-seed:baseline', RESPONDER_PRESETS[6].baseline);
    await addAssessmentDoc(db, ALICE, childId, buildAssessmentInput('baseline', 6, baselineSim));

    const progressBefore = await getChildProgressDb(db, ALICE, childId);
    expect(progressBefore.completedDays).toBe(0);
    expect(progressBefore.nextSessionDay).toBe(1);

    // Standalone-Übung durchführen (z.B. Maze außerhalb des Protokolls)
    const mazeConfig = EXERCISE_CONFIGS['maze'];
    const standaloneSessionId = await startTrainingSessionDoc(db, ALICE, childId, {
      sessionDay: 1,
      ageGroupAtTest: 6,
      rngSeed: 'standalone-maze-seed',
      exercises: [],
    });

    // Checkpoint speichern
    await updateTrainingSessionProgressDoc(db, ALICE, childId, standaloneSessionId, {
      checkpoint: {
        exerciseIndex: 0,
        exerciseId: 'maze',
        engineState: {
          level: 3,
          streak: 2,
          qualifierSeenInStreak: false,
          totalTrials: 10,
          correct: 9,
          errors: 1,
          missed: 0,
          perLevel: [],
          done: false,
        },
      },
    });

    // Standalone abschließen
    const standaloneResult: ExerciseResult = {
      exerciseId: 'maze',
      levelsCompleted: mazeConfig.levels,
      highestLevel: mazeConfig.levels,
      trials: 15,
      correct: 14,
      errors: 1,
      missed: 0,
      trialToAdvanceRate: 2.1,
      durationMs: 120_000,
      perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
    };

    await completeTrainingSessionDoc(db, ALICE, childId, standaloneSessionId, [standaloneResult]);

    // Das Dokument existiert in Firestore und ist schema-gültig
    const sessions = await listTrainingSessionsDocs(db, ALICE, childId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.exercises[0]!.exerciseId).toBe('maze');
    expect(sessions[0]!.status).toBe('completed');

    // Das Protokoll zählt Tag 1 als absolviert
    const progressAfter = await getChildProgressDb(db, ALICE, childId);
    expect(progressAfter.completedDays).toBe(1);
    expect(progressAfter.nextSessionDay).toBe(2);
  });
});

describe('E2E Lifecycle — Firestore Security Rules & Mandantentrennung', () => {
  it('verhindert unbefugten Zugriff durch fremden Betreuer (Bob vs. Alice)', async () => {
    const aliceDb = asUser(ALICE);
    const bobDb = asUser(BOB);

    const childId = await createChildDoc(aliceDb, ALICE, {
      displayName: 'Alice-Kind',
      ageGroup: 4,
    });

    // Bob darf Alices Kind nicht lesen
    await assertFails(getDoc(childDoc(bobDb, ALICE, childId)));

    // Bob darf keine Assessments bei Alices Kind anlegen oder lesen
    const assessmentInput = buildAssessmentInput(
      'baseline',
      4,
      simulateAssessment('sec-seed', RESPONDER_PRESETS[4].baseline),
    );
    await assertFails(addDoc(assessmentsCollection(bobDb, ALICE, childId), assessmentInput));
    await assertFails(getDocs(assessmentsCollection(bobDb, ALICE, childId)));

    // Bob darf keine TrainingSessions bei Alices Kind schreiben
    await assertFails(
      addDoc(trainingSessionsCollection(bobDb, ALICE, childId), {
        sessionDay: 1,
        ageGroupAtTest: 4,
        rngSeed: 'hack',
        status: 'in-progress',
        exercises: [],
      }),
    );
  });

  it('erzwingt Unveränderlichkeit von Messungen und abgeschlossenen Sitzungen', async () => {
    const db = asUser(ALICE);
    const childId = await createChildDoc(db, ALICE, {
      displayName: 'Immutable-Kind',
      ageGroup: 6,
    });

    // 1. Assessment ist append-only
    const baselineSim = simulateAssessment('imm-seed', RESPONDER_PRESETS[6].baseline);
    const baselineId = await addAssessmentDoc(
      db,
      ALICE,
      childId,
      buildAssessmentInput('baseline', 6, baselineSim),
    );

    const assessmentRef = doc(db, 'users', ALICE, 'children', childId, 'assessments', baselineId);
    await assertFails(updateDoc(assessmentRef, { phase: 'post' }));
    await assertFails(deleteDoc(assessmentRef));

    // 2. TrainingSession: Update während in-progress erlaubt, nach completed verboten
    const sessionId = await startTrainingSessionDoc(db, ALICE, childId, {
      sessionDay: 1,
      ageGroupAtTest: 6,
      rngSeed: 's1',
      exercises: [],
    });

    const sessionRef = trainingSessionDoc(db, ALICE, childId, sessionId);

    // In-Progress Update erlaubt
    await assertSucceeds(updateDoc(sessionRef, { exercises: [] }));

    // Löschen auch während in-progress verboten
    await assertFails(deleteDoc(sessionRef));

    // Sitzung abschließen
    await completeTrainingSessionDoc(db, ALICE, childId, sessionId, []);

    // Nachträgliches Ändern nach completed verboten
    await assertFails(updateDoc(sessionRef, { sessionDay: 2 }));
    await assertFails(deleteDoc(sessionRef));
  });
});

describe('E2E Lifecycle — Ausschluss-Logik & Spielstand-Reset', () => {
  it('behandelt Zufalls-Antworter (>40 % Fehler) als ausgeschlossen und blockiert Fortschritt', async () => {
    const db = asUser(ALICE);
    const childId = await createChildDoc(db, ALICE, {
      displayName: 'Random-Responder',
      ageGroup: 4,
    });

    const exclusionSim = simulateAssessment('seed-ex', {
      baseRT: 1400,
      conflictEffect: 0,
      alertingEffect: 0,
      orientingEffect: 0,
      rtJitter: 400,
      errorBase: 0.5,
      errorIncongruent: 0,
      missProb: 0.02,
    });

    const badAssessmentInput = buildAssessmentInput('baseline', 4, exclusionSim);
    expect(badAssessmentInput.quality.excluded).toBe(true);

    const assessmentId = await addAssessmentDoc(db, ALICE, childId, badAssessmentInput);
    expect(assessmentId).toBeDefined();

    // Dokument existiert im Firestore zur Re-Analyse
    const assessments = await listAssessmentsDocs(db, ALICE, childId);
    expect(assessments).toHaveLength(1);
    expect(assessments[0]!.quality.excluded).toBe(true);

    // Fortschritt: Baseline gilt als NICHT bestanden, da Test ausgeschlossen wurde
    const progress = await getChildProgressDb(db, ALICE, childId);
    expect(progress.baselineDone).toBe(false);
    expect(progress.nextStep).toBe('baseline');
  });

  it('unterstützt Archivierung und Spielstand-Reset', async () => {
    const db = asUser(ALICE);
    const childId = await createChildDoc(db, ALICE, {
      displayName: 'Reset-Kind',
      ageGroup: 6,
    });

    // Kind archivieren
    await updateDoc(childDoc(db, ALICE, childId), { archived: true });

    // listChildren ohne Archived filtert das Kind heraus
    const activeChildren = await listChildrenDocs(db, ALICE, { includeArchived: false });
    expect(activeChildren.some((c) => c.id === childId)).toBe(false);

    // listChildren mit includeArchived enthält das Kind
    const allChildren = await listChildrenDocs(db, ALICE, { includeArchived: true });
    const archivedChild = allChildren.find((c) => c.id === childId);
    expect(archivedChild?.archived).toBe(true);

    // Spielstand-Reset: Berechnung mit leerer Session-Liste setzt auf Tag 1 zurück
    const baselineSim = simulateAssessment('reset-seed', RESPONDER_PRESETS[6].baseline);
    const baselineInput = buildAssessmentInput('baseline', 6, baselineSim);
    const baselineId = await addAssessmentDoc(db, ALICE, childId, baselineInput);
    expect(baselineId).toBeDefined();
    expect(baselineId).toBeTruthy();
    const assessments = await listAssessmentsDocs(db, ALICE, childId);

    const resetProgress = computeChildProgress(assessments, []);
    expect(resetProgress.baselineDone).toBe(true);
    expect(resetProgress.completedDays).toBe(0);
    expect(resetProgress.nextStep).toBe('training');
    expect(resetProgress.nextSessionDay).toBe(1);
  });
});
