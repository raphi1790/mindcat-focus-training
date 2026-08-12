import { describe, expect, it } from 'vitest';
import { createTrialGate } from './trialGate';

describe('createTrialGate', () => {
  it('lässt die erste Schließung zu', () => {
    const gate = createTrialGate();
    expect(gate.tryClose()).toBe(true);
  });

  it('verweigert jede weitere Schließung, bis reset() aufgerufen wird', () => {
    const gate = createTrialGate();
    expect(gate.tryClose()).toBe(true);
    expect(gate.tryClose()).toBe(false);
    expect(gate.tryClose()).toBe(false);
  });

  it('öffnet nach reset() wieder für genau eine Schließung', () => {
    const gate = createTrialGate();
    gate.tryClose();
    gate.reset();
    expect(gate.tryClose()).toBe(true);
    expect(gate.tryClose()).toBe(false);
  });

  it('simuliert StrictMode-Doppelaufruf eines Updaters: nur der erste Aufruf gewinnt', () => {
    const gate = createTrialGate();
    let closes = 0;
    const attempt = () => {
      if (gate.tryClose()) closes += 1;
    };
    // StrictMode ruft den Updater zweimal auf, bevor der Trial-Setup-Effect
    // den Gate für den nächsten Trial zurücksetzt.
    attempt();
    attempt();
    expect(closes).toBe(1);
  });
});
