import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  MockTimestamp,
  mockAddDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockServerTimestamp,
  mockDeleteField,
} = vi.hoisted(() => {
  class MockTimestamp {
    constructor(public date: Date) {}
    toDate() {
      return this.date;
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d);
    }
  }
  return {
    MockTimestamp,
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    mockDeleteField: vi.fn(() => 'DELETE_FIELD'),
  };
});

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  serverTimestamp: () => mockServerTimestamp(),
  deleteField: () => mockDeleteField(),
  collection: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  query: vi.fn((c) => c),
  orderBy: vi.fn(),
  Timestamp: MockTimestamp,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

import {
  completeTrainingSession,
  findInProgressSession,
  findInProgressStandaloneSession,
  getLatestStandaloneLevel,
  listTrainingSessions,
  resetChildProgress,
  startStandaloneSession,
  startTrainingSession,
  updateTrainingSessionProgress,
} from './trainingSessionsRepo';

describe('trainingSessionsRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startTrainingSession', () => {
    it('legt eine neue Protokoll-Sitzung mit status in-progress an', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'sess-1' });

      const id = await startTrainingSession('u1', 'c1', {
        sessionDay: 1,
        ageGroupAtTest: 6,
        rngSeed: 'seed-day1',
        exercises: [],
      });

      expect(id).toBe('sess-1');
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1/children/c1/trainingSessions' }),
        expect.objectContaining({
          sessionDay: 1,
          ageGroupAtTest: 6,
          rngSeed: 'seed-day1',
          exercises: [],
          status: 'in-progress',
          timestamp: 'SERVER_TIMESTAMP',
        }),
      );
    });
  });

  describe('startStandaloneSession (Issue #15)', () => {
    it('legt eine Standalone-Sitzung mit sessionDay: 0, mode: standalone und Checkpoint an', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'standalone-sess-1' });

      const id = await startStandaloneSession('u1', 'c1', {
        exerciseId: 'side',
        ageGroup: 4,
        rngSeed: 'mindcat-v1:practice:side',
        initialLevel: 3,
      });

      expect(id).toBe('standalone-sess-1');
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1/children/c1/trainingSessions' }),
        expect.objectContaining({
          sessionDay: 0,
          mode: 'standalone',
          ageGroupAtTest: 4,
          rngSeed: 'mindcat-v1:practice:side',
          exercises: [],
          checkpoint: expect.objectContaining({
            exerciseIndex: 0,
            exerciseId: 'side',
            engineState: expect.objectContaining({
              level: 3,
            }),
            updatedAt: 'SERVER_TIMESTAMP',
          }),
          status: 'in-progress',
          timestamp: 'SERVER_TIMESTAMP',
        }),
      );
    });
  });

  describe('getLatestStandaloneLevel (Issue #15)', () => {
    it('liefert Level 1 wenn noch keine Sitzungen vorliegen', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const level = await getLatestStandaloneLevel('u1', 'c1', 'maze');
      expect(level).toBe(1);
    });

    it('ermittelt höchstes Level aus abgeschlossenen Übungen und Checkpoints', async () => {
      const mockDocs = [
        {
          id: 's1',
          data: () => ({
            sessionDay: 1,
            mode: 'training',
            ageGroupAtTest: 6,
            rngSeed: 's1',
            timestamp: new Date('2026-01-01'),
            status: 'completed',
            exercises: [
              {
                exerciseId: 'maze',
                levelsCompleted: 3,
                highestLevel: 4,
                trials: 12,
                correct: 10,
                errors: 2,
                missed: 0,
                trialToAdvanceRate: 3,
                durationMs: 30000,
                perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
              },
            ],
          }),
        },
        {
          id: 's2',
          data: () => ({
            sessionDay: 0,
            mode: 'standalone',
            ageGroupAtTest: 6,
            rngSeed: 's2',
            timestamp: new Date('2026-01-02'),
            status: 'in-progress',
            exercises: [],
            checkpoint: {
              exerciseIndex: 0,
              exerciseId: 'maze',
              engineState: {
                level: 6,
                streak: 2,
                qualifierSeenInStreak: false,
                totalTrials: 18,
                correct: 16,
                errors: 2,
                missed: 0,
                perLevel: [],
                done: false,
              },
            },
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const level = await getLatestStandaloneLevel('u1', 'c1', 'maze');
      expect(level).toBe(6);
    });
  });

  describe('findInProgressStandaloneSession (Issue #15)', () => {
    it('findet jüngste laufende Standalone-Sitzung', async () => {
      const mockDocs = [
        {
          id: 'standalone-1',
          data: () => ({
            sessionDay: 0,
            mode: 'standalone',
            ageGroupAtTest: 6,
            rngSeed: 's1',
            timestamp: new Date('2026-01-01'),
            status: 'in-progress',
            exercises: [],
            checkpoint: {
              exerciseIndex: 0,
              exerciseId: 'side',
              engineState: {
                level: 3,
                streak: 0,
                qualifierSeenInStreak: false,
                totalTrials: 9,
                correct: 9,
                errors: 0,
                missed: 0,
                perLevel: [],
                done: false,
              },
            },
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const session = await findInProgressStandaloneSession('u1', 'c1', 'side');
      expect(session).not.toBeNull();
      expect(session?.id).toBe('standalone-1');
      expect(session?.mode).toBe('standalone');
    });
  });

  describe('updateTrainingSessionProgress & completeTrainingSession', () => {
    it('aktualisiert Zwischenstand mit serverTimestamp', async () => {
      await updateTrainingSessionProgress('u1', 'c1', 'sess-1', {
        checkpoint: {
          exerciseIndex: 1,
          exerciseId: 'chase',
          engineState: {
            level: 2,
            streak: 1,
            qualifierSeenInStreak: false,
            totalTrials: 4,
            correct: 4,
            errors: 0,
            missed: 0,
            perLevel: [],
            done: false,
          },
        },
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1/children/c1/trainingSessions/sess-1' }),
        expect.objectContaining({
          checkpoint: expect.objectContaining({
            exerciseIndex: 1,
            exerciseId: 'chase',
            updatedAt: 'SERVER_TIMESTAMP',
          }),
        }),
      );
    });

    it('schließt Sitzung ab und löscht Checkpoint', async () => {
      await completeTrainingSession('u1', 'c1', 'sess-1', []);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u1/children/c1/trainingSessions/sess-1' }),
        expect.objectContaining({
          status: 'completed',
          checkpoint: 'DELETE_FIELD',
          completedAt: 'SERVER_TIMESTAMP',
        }),
      );
    });
  });

  describe('listTrainingSessions & findInProgressSession', () => {
    it('listTrainingSessions mappt und sortiert Sessions', async () => {
      const mockDocs = [
        {
          id: 's1',
          data: () => ({
            sessionDay: 1,
            mode: 'training',
            ageGroupAtTest: 6,
            rngSeed: 's1',
            timestamp: new Date('2026-01-01'),
            status: 'completed',
            exercises: [],
          }),
        },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const sessions = await listTrainingSessions('u1', 'c1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe('s1');
      expect(sessions[0]?.sessionDay).toBe(1);
    });

    it('findInProgressSession findet die jüngste laufende Sitzung für einen Tag', async () => {
      const mockDocs = [
        {
          id: 's1',
          data: () => ({
            sessionDay: 2,
            mode: 'training',
            ageGroupAtTest: 6,
            rngSeed: 's1',
            timestamp: new Date('2026-01-02'),
            status: 'in-progress',
            exercises: [],
          }),
        },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const session = await findInProgressSession('u1', 'c1', 2);
      expect(session?.id).toBe('s1');
      expect(session?.sessionDay).toBe(2);
      expect(session?.status).toBe('in-progress');
    });
  });

  describe('resetChildProgress (Issue #15)', () => {
    it('löscht alle TrainingSession-Dokumente des Kindes', async () => {
      const docRefs = [
        { ref: { path: 'users/u1/children/c1/trainingSessions/s1' } },
        { ref: { path: 'users/u1/children/c1/trainingSessions/s2' } },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: docRefs });

      await resetChildProgress('u1', 'c1');

      expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
      expect(mockDeleteDoc).toHaveBeenCalledWith(docRefs[0]!.ref);
      expect(mockDeleteDoc).toHaveBeenCalledWith(docRefs[1]!.ref);
    });

    it('löscht optional auch alle Assessment-Dokumente', async () => {
      const sessionDocRefs = [{ ref: { path: 'users/u1/children/c1/trainingSessions/s1' } }];
      const assessmentDocRefs = [{ ref: { path: 'users/u1/children/c1/assessments/a1' } }];

      mockGetDocs
        .mockResolvedValueOnce({ docs: sessionDocRefs })
        .mockResolvedValueOnce({ docs: assessmentDocRefs });

      await resetChildProgress('u1', 'c1', { resetAssessments: true });

      expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
      expect(mockDeleteDoc).toHaveBeenCalledWith(sessionDocRefs[0]!.ref);
      expect(mockDeleteDoc).toHaveBeenCalledWith(assessmentDocRefs[0]!.ref);
    });
  });
});
