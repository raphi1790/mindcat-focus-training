import {
  type AgeGroup,
  type AssessmentInput,
  type StudyGroup,
} from '../data/schema';
import {
  RESPONDER_PRESETS,
  simulateAssessment,
  type SimulatedAssessment,
} from './participantModel';
import { simulateTrainingProgram } from './trainingModel';
import { createChild } from '../data/firestore/childrenRepo';
import { addAssessment } from '../data/firestore/assessmentsRepo';
import {
  startTrainingSession,
  completeTrainingSession,
} from '../data/firestore/trainingSessionsRepo';

export interface SeedParticipantOptions {
  uid: string;
  ageGroup?: AgeGroup;
  displayName?: string;
  studyGroup?: StudyGroup;
  sex?: 'm' | 'f' | 'x';
  birthMonth?: string;
  days?: number;
  withPost?: boolean;
  seed?: string;
}

export interface ParticipantScores {
  conflict: number;
  alerting: number;
  orienting: number;
  overallRT: number;
  errorRate: number;
}

export interface SeedParticipantResult {
  childId: string;
  displayName: string;
  ageGroup: AgeGroup;
  studyGroup: StudyGroup;
  baselineId: string;
  baselineScores: ParticipantScores;
  sessionIds: string[];
  postId?: string;
  postScores?: ParticipantScores;
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

/**
 * Simuliert einen vollständigen Probanden wissenschaftlich valide
 * (Child ANT Baseline → n Trainingstage → Post-ANT) und speichert
 * die Datensätze direkt über die Zod-validierten Firestore-Repositories.
 */
export async function seedParticipant(
  options: SeedParticipantOptions,
): Promise<SeedParticipantResult> {
  const ageGroup: AgeGroup = options.ageGroup ?? 6;
  if (ageGroup !== 4 && ageGroup !== 6) {
    throw new Error(`Ungültige Altersgruppe: ${ageGroup}. Erlaubt sind 4 oder 6.`);
  }

  const days = options.days !== undefined ? options.days : 5;
  if (days < 0 || days > 5) {
    throw new Error(`Ungültige Trainingstage: ${days}. Erlaubt sind 0 bis 5.`);
  }

  const displayName =
    options.displayName?.trim() || (ageGroup === 6 ? 'Mila (Pilot 6J)' : 'Leo (Pilot 4J)');
  const studyGroup: StudyGroup = options.studyGroup ?? 'trained';
  const withPost = options.withPost !== undefined ? options.withPost : days === 5;
  const seed = options.seed || `seed-${Date.now()}`;

  // 1. Kind in Firestore anlegen
  const childId = await createChild(options.uid, {
    displayName,
    ageGroup,
    studyGroup,
    sex: options.sex,
    birthMonth: options.birthMonth,
  });

  const presets = RESPONDER_PRESETS[ageGroup];

  // 2. Baseline Child ANT simulieren und speichern
  const baselineSim = simulateAssessment(`${seed}:baseline`, presets.baseline);
  const baselineInput = buildAssessmentInput('baseline', ageGroup, baselineSim);
  const baselineId = await addAssessment(options.uid, childId, baselineInput);

  const baselineScores: ParticipantScores = {
    conflict: Math.round(baselineSim.scoring.scores.conflictRT),
    alerting: Math.round(baselineSim.scoring.scores.alertingRT),
    orienting: Math.round(baselineSim.scoring.scores.orientingRT),
    overallRT: Math.round(baselineSim.scoring.scores.overallRT),
    errorRate: baselineSim.scoring.scores.overallErrorRate,
  };

  // 3. Trainingstage simulieren und speichern
  const sessionIds: string[] = [];
  if (days > 0) {
    const trainingProgram = simulateTrainingProgram(ageGroup, `${seed}:training`);
    const sessionsToRun = trainingProgram.slice(0, days);

    for (const day of sessionsToRun) {
      const sessionId = await startTrainingSession(options.uid, childId, day.input);
      await completeTrainingSession(options.uid, childId, sessionId, day.input.exercises);
      sessionIds.push(sessionId);
    }
  }

  // 4. Post-Test Child ANT simulieren und speichern (falls gewünscht)
  let postId: string | undefined;
  let postScores: ParticipantScores | undefined;

  if (withPost) {
    const postSim = simulateAssessment(`${seed}:post`, presets.post);
    const postInput = buildAssessmentInput('post', ageGroup, postSim);
    postId = await addAssessment(options.uid, childId, postInput);

    postScores = {
      conflict: Math.round(postSim.scoring.scores.conflictRT),
      alerting: Math.round(postSim.scoring.scores.alertingRT),
      orienting: Math.round(postSim.scoring.scores.orientingRT),
      overallRT: Math.round(postSim.scoring.scores.overallRT),
      errorRate: postSim.scoring.scores.overallErrorRate,
    };
  }

  return {
    childId,
    displayName,
    ageGroup,
    studyGroup,
    baselineId,
    baselineScores,
    sessionIds,
    postId,
    postScores,
  };
}
