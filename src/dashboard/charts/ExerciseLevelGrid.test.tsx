// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExerciseLevelOverview } from '../exerciseLevelStatus';
import ExerciseLevelGrid from './ExerciseLevelGrid';

describe('ExerciseLevelGrid', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleOverview: ExerciseLevelOverview = {
    activeCheckpoint: {
      sessionDay: 2,
      exerciseId: 'maze',
      exerciseLabel: 'Maze (Antizipation/Planung)',
      exerciseIcon: '🧩',
      level: 3,
    },
    totalCompletedExercises: 3,
    exercises: [
      {
        exerciseId: 'side',
        label: 'Side (Motorische Kontrolle)',
        icon: '🐱',
        maxLevel: 7,
        highestLevel: 7,
        isCompletedMax: true,
        totalTrials: 25,
        totalErrors: 2,
        totalMissed: 0,
        sessionsCount: 1,
        hasPlayed: true,
      },
      {
        exerciseId: 'chase',
        label: 'Chase (Verfolgung)',
        icon: '🌂',
        maxLevel: 7,
        highestLevel: 4,
        isCompletedMax: false,
        totalTrials: 20,
        totalErrors: 3,
        totalMissed: 1,
        sessionsCount: 1,
        hasPlayed: true,
      },
      {
        exerciseId: 'maze',
        label: 'Maze (Antizipation/Planung)',
        icon: '🧩',
        maxLevel: 6,
        highestLevel: 3,
        isCompletedMax: false,
        totalTrials: 6,
        totalErrors: 1,
        totalMissed: 0,
        sessionsCount: 0,
        hasPlayed: true,
        activeCheckpoint: { sessionDay: 2, level: 3 },
      },
      {
        exerciseId: 'anticipation-visible',
        label: 'Anticipation – sichtbar',
        icon: '🦆',
        maxLevel: 7,
        highestLevel: 0,
        isCompletedMax: false,
        totalTrials: 0,
        totalErrors: 0,
        totalMissed: 0,
        sessionsCount: 0,
        hasPlayed: false,
      },
    ],
  };

  it('zeigt den aktiven Checkpoint-Banner mit Tag und Level an', () => {
    render(<ExerciseLevelGrid overview={sampleOverview} />);

    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toBeDefined();
    expect(within(statusBanner).getByText(/Aktiver Spielstand gespeichert \(Tag 2\)/i)).toBeDefined();
    expect(within(statusBanner).getByText(/Maze \(Antizipation\/Planung\)/i)).toBeDefined();
    expect(within(statusBanner).getByText('Level 3')).toBeDefined();
    expect(within(statusBanner).getByText('Wird bei Start fortgesetzt')).toBeDefined();
  });

  it('rendert Badges für Maximalstufe, laufenden Checkpoint und ungespielte Übungen', () => {
    render(<ExerciseLevelGrid overview={sampleOverview} />);

    expect(screen.getByText('Level 7 ⭐')).toBeDefined();
    expect(screen.getByText('Level 4/7')).toBeDefined();
    expect(screen.getByText('⚡ Level 3')).toBeDefined();
    expect(screen.getByText('Nicht gestartet')).toBeDefined();
  });

  it('rendert barrierefreie Progressbars mit korrekten ARIA-Attributen', () => {
    render(<ExerciseLevelGrid overview={sampleOverview} />);

    const sideBar = screen.getByRole('progressbar', {
      name: 'Side (Motorische Kontrolle): Level 7 von 7',
    });
    expect(sideBar.getAttribute('aria-valuenow')).toBe('7');
    expect(sideBar.getAttribute('aria-valuemax')).toBe('7');

    const chaseBar = screen.getByRole('progressbar', {
      name: 'Chase (Verfolgung): Level 4 von 7',
    });
    expect(chaseBar.getAttribute('aria-valuenow')).toBe('4');
    expect(chaseBar.getAttribute('aria-valuemax')).toBe('7');
  });

  it('rendert die Tabellenansicht mit allen Übungsdetails', () => {
    render(<ExerciseLevelGrid overview={sampleOverview} />);

    expect(screen.getByText('Erreichte Level nach Übung')).toBeDefined();
    expect(screen.getAllByText(/Side \(Motorische Kontrolle\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Maximalstufe erreicht')).toBeDefined();
    expect(screen.getByText('In Bearbeitung (Tag 2)')).toBeDefined();
  });

  it('blendet den Checkpoint-Banner aus, wenn kein aktiver Checkpoint existiert', () => {
    const noCpOverview: ExerciseLevelOverview = {
      ...sampleOverview,
      activeCheckpoint: null,
    };
    render(<ExerciseLevelGrid overview={noCpOverview} />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});
