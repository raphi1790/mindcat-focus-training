// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soundManager } from '../../ui';
import ArenaWorld from './ArenaWorld';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function baseProps(overrides: Partial<React.ComponentProps<typeof ArenaWorld>> = {}) {
  return {
    catPos: { x: 50, y: 50 },
    flash: null as 'success' | 'error' | null,
    level: 1,
    streak: { current: 1, target: 3 },
    counter: '1 / 21',
    instructions: 'Bewege die Katze!',
    onExit: () => {},
    ...overrides,
  };
}

describe('ArenaWorld', () => {
  it('positioniert die Katze direkt in Prozent-Koordinaten ohne CSS-Transition-Lag', () => {
    const { getByTestId } = render(
      <ArenaWorld {...baseProps({ catPos: { x: 25.5, y: 72.25 }, catSize: 12 })}>
        <div data-testid="custom-layer">Hindernis</div>
      </ArenaWorld>,
    );

    const cat = getByTestId('arena-cat');
    expect(cat.style.left).toBe('25.5%');
    expect(cat.style.top).toBe('72.25%');
    expect(cat.style.width).toBe('12%');
    expect(cat.style.transform).toBe('translate(-50%, -50%)');
    expect(cat.className).not.toContain('transition-all');
    expect(cat.className).not.toContain('duration-150');
    expect(cat.textContent).toContain('🐱');
    expect(getByTestId('custom-layer').textContent).toBe('Hindernis');
  });

  it('rendert Erfolgs- und Fehler-Feedback sowie Lob-Popup', () => {
    const { container, rerender } = render(<ArenaWorld {...baseProps({ flash: 'success' })} />);
    expect(container.textContent).toContain('😸');
    expect(container.textContent).toMatch(/Super!|Toll!|Klasse!|Spitze!|Juhu!/);

    rerender(<ArenaWorld {...baseProps({ flash: 'error' })} />);
    expect(container.textContent).toContain('🙀');
  });

  it('löst bei bump-Erhöhung Shake-Animation und Bump-Sound aus', () => {
    const playSpy = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
    const { getByTestId, rerender } = render(<ArenaWorld {...baseProps({ bump: 0 })} />);
    expect(getByTestId('arena-surface').className).not.toContain('animate-shake');

    rerender(<ArenaWorld {...baseProps({ bump: 1 })} />);
    expect(playSpy).toHaveBeenCalledWith('bump');
    expect(getByTestId('arena-surface').className).toContain('animate-shake');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(getByTestId('arena-surface').className).not.toContain('animate-shake');
  });

  it('spielt Schritt-Sound gethrottelt (~180ms) und schweigt bei Trial-Reset-Sprüngen', () => {
    const playSpy = vi.spyOn(soundManager, 'play').mockImplementation(() => {});
    const { rerender } = render(<ArenaWorld {...baseProps({ catPos: { x: 50, y: 50 } })} />);
    expect(playSpy).not.toHaveBeenCalled();

    // Erster kleiner Schritt spielt 'step'
    act(() => vi.advanceTimersByTime(16));
    rerender(<ArenaWorld {...baseProps({ catPos: { x: 52, y: 50 } })} />);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledWith('step');

    // Weiterer Schritt innerhalb von 180ms wird gedrosselt
    act(() => vi.advanceTimersByTime(50));
    rerender(<ArenaWorld {...baseProps({ catPos: { x: 54, y: 50 } })} />);
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Nach Ablauf von >= 180ms wird wieder gespielt
    act(() => vi.advanceTimersByTime(150));
    rerender(<ArenaWorld {...baseProps({ catPos: { x: 56, y: 50 } })} />);
    expect(playSpy).toHaveBeenCalledTimes(2);

    // Großer Sprung (Trial-Reset) bleibt stumm
    act(() => vi.advanceTimersByTime(250));
    rerender(<ArenaWorld {...baseProps({ catPos: { x: 10, y: 10 } })} />);
    expect(playSpy).toHaveBeenCalledTimes(2);
  });
});
