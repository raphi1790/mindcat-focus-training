import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateChild,
  mockAddAssessment,
  mockStartTrainingSession,
  mockCompleteTrainingSession,
} = vi.hoisted(() => ({
  mockCreateChild: vi.fn(),
  mockAddAssessment: vi.fn(),
  mockStartTrainingSession: vi.fn(),
  mockCompleteTrainingSession: vi.fn(),
}));

vi.mock('../data/firestore/childrenRepo', () => ({
  createChild: mockCreateChild,
}));

vi.mock('../data/firestore/assessmentsRepo', () => ({
  addAssessment: mockAddAssessment,
}));

vi.mock('../data/firestore/trainingSessionsRepo', () => ({
  startTrainingSession: mockStartTrainingSession,
  completeTrainingSession: mockCompleteTrainingSession,
}));

import {
  assessmentInputSchema,
  childInputSchema,
  trainingSessionInputSchema,
} from '../data/schema';
import { seedParticipant } from './seedParticipant';

describe('seedParticipant — CLI Participant Seeder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateChild.mockResolvedValue('child-123');
    let assessmentIdx = 0;
    mockAddAssessment.mockImplementation(async () => `assessment-${++assessmentIdx}`);
    let sessionIdx = 0;
    mockStartTrainingSession.mockImplementation(async () => `session-${++sessionIdx}`);
    mockCompleteTrainingSession.mockResolvedValue(undefined);
  });

  it('erstellt für 6-Jährige vollständig Kind, Baseline, 5 Trainingstage (inkl. Farmer) und Post-ANT', async () => {
    const result = await seedParticipant({
      uid: 'supervisor-1',
      ageGroup: 6,
      displayName: 'Mila Test',
      studyGroup: 'trained',
      days: 5,
      withPost: true,
      seed: 'test-seed-6',
    });

    expect(result.childId).toBe('child-123');
    expect(result.displayName).toBe('Mila Test');
    expect(result.ageGroup).toBe(6);
    expect(result.studyGroup).toBe('trained');
    expect(result.baselineId).toBe('assessment-1');
    expect(result.postId).toBe('assessment-2');
    expect(result.sessionIds).toHaveLength(5);

    // Prüfe Child-Payload gegen Zod-Schema
    expect(mockCreateChild).toHaveBeenCalledTimes(1);
    const childPayload = mockCreateChild.mock.calls[0]?.[1];
    expect(() => childInputSchema.parse(childPayload)).not.toThrow();

    // Prüfe Assessments (Baseline + Post) gegen Zod-Schema
    expect(mockAddAssessment).toHaveBeenCalledTimes(2);
    const baselinePayload = mockAddAssessment.mock.calls[0]?.[2];
    const postPayload = mockAddAssessment.mock.calls[1]?.[2];
    expect(() => assessmentInputSchema.parse(baselinePayload)).not.toThrow();
    expect(() => assessmentInputSchema.parse(postPayload)).not.toThrow();
    expect(baselinePayload.phase).toBe('baseline');
    expect(postPayload.phase).toBe('post');
    expect(baselinePayload.rawTrials).toHaveLength(144);
    expect(postPayload.rawTrials).toHaveLength(144);

    // Executive Attention Verbesserung im Post-Test
    expect(result.postScores!.conflict).toBeLessThan(result.baselineScores.conflict);

    // Prüfe 5 Trainingstage
    expect(mockStartTrainingSession).toHaveBeenCalledTimes(5);
    expect(mockCompleteTrainingSession).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 5; i++) {
      const sessionInput = mockStartTrainingSession.mock.calls[i]?.[2];
      expect(() => trainingSessionInputSchema.parse(sessionInput)).not.toThrow();
      expect(sessionInput.sessionDay).toBe(i + 1);
    }
  });

  it('unterstützt für 4-Jährige Teil-Training (z.B. 2 Tage ohne Post-Assessment)', async () => {
    const result = await seedParticipant({
      uid: 'supervisor-1',
      ageGroup: 4,
      days: 2,
      withPost: false,
      seed: 'test-seed-4',
    });

    expect(result.ageGroup).toBe(4);
    expect(result.displayName).toBe('Leo (Pilot 4J)');
    expect(result.sessionIds).toHaveLength(2);
    expect(result.postId).toBeUndefined();
    expect(result.postScores).toBeUndefined();
    expect(mockAddAssessment).toHaveBeenCalledTimes(1);
    expect(mockStartTrainingSession).toHaveBeenCalledTimes(2);

    // 4-Jährige dürfen niemals Farmer im Trainingsplan haben
    for (let i = 0; i < 2; i++) {
      const sessionInput = mockStartTrainingSession.mock.calls[i]?.[2];
      const exerciseIds = sessionInput.exercises.map((e: { exerciseId: string }) => e.exerciseId);
      expect(exerciseIds).not.toContain('farmer');
    }
  });

  it('wirft Fehler bei ungültigen Parametern (Altersgruppe oder Tage)', async () => {
    await expect(
      seedParticipant({ uid: 'u1', ageGroup: 5 as unknown as 4 }),
    ).rejects.toThrow(/Ungültige Altersgruppe/);

    await expect(
      seedParticipant({ uid: 'u1', ageGroup: 6, days: 6 }),
    ).rejects.toThrow(/Ungültige Trainingstage/);
  });
});
