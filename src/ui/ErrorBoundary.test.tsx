// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test crash in child component");
  }
  return <div>Alles in Ordnung</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("rendert Kinder normal, wenn kein Fehler auftritt", () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Alles in Ordnung")).toBeDefined();
  });

  it("fängt Fehler ab, zeigt kindgerechten Screen und erlaubt Reset per Klick", () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Hoppla…")).toBeDefined();
    expect(screen.getByText(/dein Fortschritt ist gespeichert/i)).toBeDefined();

    const resetBtn = screen.getByRole("button", { name: /Zurück zum Dashboard/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("unterstützt useConfirmInput (Enter / Space) zum Zurückkehren ins Dashboard", () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onReset).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: " " });
    expect(onReset).toHaveBeenCalledTimes(2);
  });
});
