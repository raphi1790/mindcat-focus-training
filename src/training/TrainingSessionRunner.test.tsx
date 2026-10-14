// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as firestore from "../data/firestore";
import type { ExerciseResult, TrainingSession } from "../data/schema";
import { soundManager } from "../ui";
import TrainingSessionRunner from "./TrainingSessionRunner";

vi.mock("../data/firestore", () => ({
  findInProgressSession: vi.fn(),
  startTrainingSession: vi.fn(),
  updateTrainingSessionProgress: vi.fn(),
  completeTrainingSession: vi.fn(),
}));

const sampleExerciseResult: ExerciseResult = {
  exerciseId: "side",
  levelsCompleted: 7,
  highestLevel: 7,
  trials: 21,
  correct: 21,
  errors: 0,
  missed: 0,
  trialToAdvanceRate: 3,
  durationMs: 30000,
  perLevel: [{ level: 1, trials: 3, correct: 3, errors: 0 }],
};

describe("TrainingSessionRunner — Eingabebestätigung (useConfirmInput)", () => {
  beforeEach(() => {
    vi.spyOn(soundManager, "play").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("SessionCelebration: Tastatur- & Arcade-Bestätigung (Enter/Space) ruft onFinished auf", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    // Simuliere: Sitzung hat bereits alle Übungen absolviert
    const existingSession: TrainingSession = {
      id: "sess-1",
      sessionDay: 1,
      ageGroupAtTest: 4,
      status: "in-progress",
      rngSeed: "seed-1",
      exercises: [sampleExerciseResult],
      timestamp: new Date(),
    };

    vi.mocked(firestore.findInProgressSession).mockResolvedValue(existingSession);
    vi.mocked(firestore.completeTrainingSession).mockResolvedValue(undefined);

    render(
      <TrainingSessionRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        sessionDay={1}
        exerciseIds={["side"]}
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    // Warten auf Mount-Initialisierung & Celebration-Screen
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Trainingstag 1 geschafft!")).toBeDefined();

    // Tastatur-Bestätigung per Enter
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Tastatur-Bestätigung per Leertaste
    fireEvent.keyDown(window, { key: " " });
    expect(onFinished).toHaveBeenCalledTimes(2);
  });

  it("SessionSaveError: Tastatur- & Arcade-Bestätigung (Enter) versucht erneutes Speichern", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    const existingSession: TrainingSession = {
      id: "sess-1",
      sessionDay: 1,
      ageGroupAtTest: 4,
      status: "in-progress",
      rngSeed: "seed-1",
      exercises: [sampleExerciseResult],
      timestamp: new Date(),
    };

    vi.mocked(firestore.findInProgressSession).mockResolvedValue(existingSession);
    vi.mocked(firestore.completeTrainingSession).mockRejectedValueOnce(
      new Error("Speicher-Timeout bei Sitzungsabschluss")
    );

    render(
      <TrainingSessionRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        sessionDay={1}
        exerciseIds={["side"]}
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Speichern fehlgeschlagen")).toBeDefined();
    expect(
      screen.getByText("Speicher-Timeout bei Sitzungsabschluss")
    ).toBeDefined();

    // Zweiter Versuch gelingt
    vi.mocked(firestore.completeTrainingSession).mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    expect(screen.getByText("Trainingstag 1 geschafft!")).toBeDefined();
  });

  it("SessionInitError: Tastatur- & Arcade-Bestätigung (Enter) kehrt zum Dashboard zurück", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    vi.mocked(firestore.findInProgressSession).mockRejectedValueOnce(
      new Error("Netzwerk offline")
    );

    render(
      <TrainingSessionRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        sessionDay={1}
        exerciseIds={["side"]}
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Start fehlgeschlagen")).toBeDefined();
    expect(screen.getByText("Netzwerk offline")).toBeDefined();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
