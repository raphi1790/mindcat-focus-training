// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HoldToExit from "./HoldToExit";

describe("HoldToExit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rendert Schließen-Symbol mit Hilfetext", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    expect(screen.getByText("✕")).toBeDefined();
    expect(
      screen.getByTitle("3 Sekunden gedrückt halten, um zu beenden (oder Escape halten)")
    ).toBeDefined();
  });

  it("Maus gedrückt halten löst nach 3000ms onExit aus", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    const button = screen.getByText("✕").parentElement!;

    fireEvent.mouseDown(button);
    expect(onExit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onExit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("Maus vorzeitig loslassen bricht den Exit-Vorgang ab", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    const button = screen.getByText("✕").parentElement!;

    fireEvent.mouseDown(button);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.mouseUp(button);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onExit).not.toHaveBeenCalled();
  });

  it("Escape-Taste gedrückt halten löst nach 3000ms onExit aus", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("Escape vorzeitig loslassen bricht den Exit-Vorgang ab", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.keyUp(window, { key: "Escape" });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onExit).not.toHaveBeenCalled();
  });

  it("Fenster-Fokusverlust (blur) bricht den laufenden Hold sofort ab", () => {
    const onExit = vi.fn();
    render(<HoldToExit onExit={onExit} />);

    // Start hold via Escape
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Window blur event fires (e.g. user Alt-Tabs or OS dialog opens)
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    // Timer expires
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onExit).not.toHaveBeenCalled();
  });

  it("Arcade-Kombination: Polling auf gleichzeitiges Drücken von Button 0 & 1 für 3s", () => {
    const onExit = vi.fn();

    const buttons = [
      { pressed: true },
      { pressed: true },
      { pressed: false },
      { pressed: false },
    ];

    const mockGamepad = {
      axes: [0, 0],
      buttons,
    } as unknown as Gamepad;

    Object.defineProperty(navigator, "getGamepads", { value: () => [mockGamepad], configurable: true, writable: true });

    render(<HoldToExit onExit={onExit} />);

    // rAF loop polls gamepads and starts hold
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onExit).not.toHaveBeenCalled();

    // After 3000ms of holding combo, onExit is called
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("Arcade-Kombination: Loslassen von Button 0 oder 1 bricht den Hold ab", () => {
    const onExit = vi.fn();

    const buttons = [
      { pressed: true },
      { pressed: true },
    ];

    const mockGamepad = {
      axes: [0, 0],
      buttons,
    } as unknown as Gamepad;

    Object.defineProperty(navigator, "getGamepads", { value: () => [mockGamepad], configurable: true, writable: true });

    render(<HoldToExit onExit={onExit} />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Release button 1
    buttons[1]!.pressed = false;

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Continue time past 3000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onExit).not.toHaveBeenCalled();
  });
});
