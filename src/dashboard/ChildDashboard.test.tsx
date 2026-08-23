// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/firebase', () => ({
  db: {},
  auth: {},
  googleProvider: {},
}));

import type { Child, TrainingSession } from '../data/schema';
import { createExerciseProgress } from '../training/engine';
import ChildDashboard from './ChildDashboard';
import * as useChildDashboardDataModule from './useChildDashboardData';
import * as useGroupComparisonDataModule from './useGroupComparisonData';

const mockChild: Child = {
  id: 'c1',
  displayName: 'Felix',
  ageGroup: 6,
  studyGroup: 'trained',
  archived: false,
  createdAt: new Date('2026-01-01'),
};

const sampleSession: TrainingSession = {
  id: 's1',
  sessionDay: 1,
  ageGroupAtTest: 6,
  rngSeed: 'seed-1',
  timestamp: new Date('2026-01-02'),
  status: 'completed',
  exercises: [
    {
      exerciseId: 'side',
      levelsCompleted: 7,
      highestLevel: 7,
      trials: 21,
      correct: 21,
      errors: 0,
      missed: 0,
      trialToAdvanceRate: 3,
      durationMs: 45_000,
      perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
    },
  ],
};

const inProgressSession: TrainingSession = {
  id: 's2',
  sessionDay: 2,
  ageGroupAtTest: 6,
  rngSeed: 'seed-2',
  timestamp: new Date('2026-01-03'),
  status: 'in-progress',
  exercises: [],
  checkpoint: {
    exerciseIndex: 0,
    exerciseId: 'chase',
    engineState: {
      ...createExerciseProgress(),
      level: 4,
      totalTrials: 12,
      correct: 10,
      errors: 2,
      missed: 0,
    },
    updatedAt: new Date('2026-01-03T10:00:00Z'),
  },
};

describe('ChildDashboard', () => {
  beforeEach(() => {
    vi.spyOn(useGroupComparisonDataModule, 'useGroupComparisonData').mockReturnValue({
      loading: false,
      error: null,
      entries: [],
      totalChildrenWithEffect: 0,
      reload: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('zeigt Ladezustand an, wenn Daten geladen werden', () => {
    vi.spyOn(useChildDashboardDataModule, 'useChildDashboardData').mockReturnValue({
      loading: true,
      error: null,
      assessments: [],
      sessions: [],
      effectSummary: null,
      trainingSummary: {
        days: [],
        totalExercisesCompleted: 0,
        totalDaysCompleted: 0,
        avgTrialToAdvanceRate: null,
        overallErrorRate: 0,
        byExercise: [],
      },
      histogram: null,
      histogramSource: null,
      reload: vi.fn(),
    });

    render(<ChildDashboard uid="u1" child={mockChild} />);
    expect(screen.getByText(/Auswertung wird geladen…/i)).toBeDefined();
  });

  it('zeigt Fehlermeldung an, wenn das Laden fehlschlägt', () => {
    vi.spyOn(useChildDashboardDataModule, 'useChildDashboardData').mockReturnValue({
      loading: false,
      error: 'Netzwerkfehler',
      assessments: [],
      sessions: [],
      effectSummary: null,
      trainingSummary: {
        days: [],
        totalExercisesCompleted: 0,
        totalDaysCompleted: 0,
        avgTrialToAdvanceRate: null,
        overallErrorRate: 0,
        byExercise: [],
      },
      histogram: null,
      histogramSource: null,
      reload: vi.fn(),
    });

    render(<ChildDashboard uid="u1" child={mockChild} />);
    expect(screen.getByText('Netzwerkfehler')).toBeDefined();
  });

  it('zeigt Hinweis an, wenn noch gar keine Daten vorhanden sind', () => {
    vi.spyOn(useChildDashboardDataModule, 'useChildDashboardData').mockReturnValue({
      loading: false,
      error: null,
      assessments: [],
      sessions: [],
      effectSummary: null,
      trainingSummary: {
        days: [],
        totalExercisesCompleted: 0,
        totalDaysCompleted: 0,
        avgTrialToAdvanceRate: null,
        overallErrorRate: 0,
        byExercise: [],
      },
      histogram: null,
      histogramSource: null,
      reload: vi.fn(),
    });

    render(<ChildDashboard uid="u1" child={mockChild} />);
    expect(
      screen.getByText(/Noch keine Daten für Felix vorhanden\./i),
    ).toBeDefined();
  });

  it('zeigt Trainingsverlauf mit Übungslevels und aktivem Checkpoint an', () => {
    vi.spyOn(useChildDashboardDataModule, 'useChildDashboardData').mockReturnValue({
      loading: false,
      error: null,
      assessments: [],
      sessions: [sampleSession, inProgressSession],
      effectSummary: null,
      trainingSummary: {
        days: [
          {
            sessionDay: 1,
            exercisesCompleted: 1,
            totalTrials: 21,
            totalCorrect: 21,
            totalErrors: 0,
            totalMissed: 0,
            errorRate: 0,
            avgTrialToAdvanceRate: 3,
            highestLevelReached: 7,
          },
        ],
        totalExercisesCompleted: 1,
        totalDaysCompleted: 1,
        avgTrialToAdvanceRate: 3,
        overallErrorRate: 0,
        byExercise: [
          {
            exerciseId: 'side',
            sessionsCount: 1,
            totalTrials: 21,
            totalErrors: 0,
            totalMissed: 0,
            highestLevel: 7,
          },
        ],
      },
      histogram: null,
      histogramSource: null,
      reload: vi.fn(),
    });

    render(<ChildDashboard uid="u1" child={mockChild} />);

    // Sektions-Überschrift
    expect(screen.getByText('Trainingsverlauf')).toBeDefined();

    // Checkpoint-Banner für Tag 2 (Chase Level 4)
    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toBeDefined();
    expect(within(statusBanner).getByText(/Aktiver Spielstand gespeichert \(Tag 2\)/i)).toBeDefined();
    expect(within(statusBanner).getByText(/Chase \(Verfolgung\)/i)).toBeDefined();
    expect(within(statusBanner).getByText('Level 4')).toBeDefined();

    // Level-Badges
    expect(screen.getByText('Level 7 ⭐')).toBeDefined();
    expect(screen.getByText('⚡ Level 4')).toBeDefined();

    // 5-Tage-Verlauf
    expect(screen.getByText('Verlauf über die 5 Trainingstage')).toBeDefined();
    expect(screen.getByText('Abgeschlossene Übungen')).toBeDefined();
  });
});
