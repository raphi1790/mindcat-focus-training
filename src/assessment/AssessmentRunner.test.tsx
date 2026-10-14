// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as firestore from "../data/firestore";
import { soundManager } from "../ui";
import { ANT_CONFIG, type AntRunResult } from "./ant";
import AssessmentRunner from "./AssessmentRunner";

vi.mock("../data/firestore", () => ({
  addAssessment: vi.fn(),
}));

let mockComplete: ((result: AntRunResult) => void) | null = null;
let mockCancel: (() => void) | null = null;

vi.mock("./ant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ant")>();
  return {
    ...actual,
    ChildAnt: ({
      onComplete,
      onCancel,
    }: {
      onComplete: (r: AntRunResult) => void;
      onCancel: () => void;
    }) => {
      mockComplete = onComplete;
      mockCancel = onCancel;
      return <div data-testid="child-ant">Child ANT Running</div>;
    },
  };
});

const sampleResult: AntRunResult = {
  rngSeed: "test-seed-123",
  config: ANT_CONFIG,
  scores: {
    overallRT: 1420,
    conflictRT: 180,
    alertingRT: 45,
    orientingRT: 55,
    overallErrorRate: 4.2,
    accuracyByCondition: {},
  },
  quality: {
    validTrialCount: 72,
    excluded: false,
  },
  rawTrials: [],
};

describe("AssessmentRunner", () => {
  beforeEach(() => {
    vi.spyOn(soundManager, "play").mockImplementation(() => {});
    vi.mocked(firestore.addAssessment).mockResolvedValue("doc-id-123" as never);
    mockComplete = null;
    mockCancel = null;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("rendert während des Tests den ChildAnt-Screen", () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssessmentRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        phase="baseline"
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId("child-ant")).toBeDefined();
  });

  it("leitet onCancel an ChildAnt weiter", () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssessmentRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        phase="baseline"
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    expect(mockCancel).not.toBeNull();
    mockCancel!();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("speichert das Ergebnis und zeigt die kindgerechte Siegeransicht (Katze, Sterne, Lob) ohne klinische Tabelle", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssessmentRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        phase="baseline"
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    // Test abschließen
    await act(async () => {
      mockComplete!(sampleResult);
    });

    // Firestore-Speicherung verifizieren
    expect(firestore.addAssessment).toHaveBeenCalledWith(
      "u1",
      "c1",
      expect.objectContaining({
        phase: "baseline",
        ageGroupAtTest: 4,
        rngSeed: "test-seed-123",
      })
    );

    // Sound-Fanfare abgespielt
    expect(soundManager.play).toHaveBeenCalledWith("fanfare");

    // Kindgerechte Elemente: Katze, 3 Sterne, Lob
    expect(screen.getByTestId("celebration-cat").textContent).toBe("🐱");
    expect(screen.getByTestId("stars-container")).toBeDefined();
    expect(screen.getByText("Großartig gemacht!")).toBeDefined();
    expect(
      screen.getByText("Du hast den Fisch-Test erfolgreich gemeistert!")
    ).toBeDefined();

    // WICHTIG: Keine klinische RT-Tabelle im Kinderscreen!
    expect(screen.queryByText(/Overall-RT/i)).toBeNull();
    expect(screen.queryByText(/Conflict-Score/i)).toBeNull();
    expect(screen.queryByText(/Alerting-Score/i)).toBeNull();
    expect(screen.queryByText(/Orienting-Score/i)).toBeNull();
    expect(screen.queryByText(/Lauf ausgeschlossen/i)).toBeNull();

    // Button vorhanden
    const finishBtn = screen.getByRole("button", {
      name: /Zurück zum Dashboard 🐱/i,
    });
    expect(finishBtn).toBeDefined();

    // Klick auf Button schließt ab
    fireEvent.click(finishBtn);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("unterstützt useConfirmInput (Enter & Space) auf dem Done-Screen", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssessmentRunner
        uid="u1"
        childId="c1"
        ageGroup={6}
        phase="post"
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    await act(async () => {
      mockComplete!(sampleResult);
    });

    // Enter drückt "Zurück zum Dashboard"
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Leertaste drückt "Zurück zum Dashboard"
    fireEvent.keyDown(window, { key: " " });
    expect(onFinished).toHaveBeenCalledTimes(2);
  });

  it("zeigt SaveError-Screen bei Speicherfehler und erlaubt Retry via useConfirmInput", async () => {
    const onFinished = vi.fn();
    const onCancel = vi.fn();

    vi.mocked(firestore.addAssessment).mockRejectedValueOnce(
      new Error("Verbindungsfehler zur Datenbank")
    );

    render(
      <AssessmentRunner
        uid="u1"
        childId="c1"
        ageGroup={4}
        phase="baseline"
        onFinished={onFinished}
        onCancel={onCancel}
      />
    );

    await act(async () => {
      mockComplete!(sampleResult);
    });

    // Fehler-Screen sichtbar
    expect(screen.getByText("Speichern fehlgeschlagen")).toBeDefined();
    expect(screen.getByText("Verbindungsfehler zur Datenbank")).toBeDefined();

    // Nächster Versuch gelingt
    vi.mocked(firestore.addAssessment).mockResolvedValueOnce(
      "doc-retry-123" as never
    );

    // Retry per Enter (useConfirmInput)
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    // Jetzt im Done-Screen
    expect(screen.getByText("Großartig gemacht!")).toBeDefined();
  });
});
