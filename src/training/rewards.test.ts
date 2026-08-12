import { describe, expect, it } from 'vitest';
import { perfectTrialCount, starsForResult } from './rewards';

describe('perfectTrialCount', () => {
  it('nutzt minTrials, wenn es über levels×streak liegt (farmer: b=66 > 7×6=42)', () => {
    expect(perfectTrialCount('farmer')).toBe(66);
  });

  it('nutzt levels×streak, wenn minTrials nicht bindet (side: 7×3=21=b)', () => {
    expect(perfectTrialCount('side')).toBe(21);
  });

  it('maze: 6 Level × 1 = 6', () => {
    expect(perfectTrialCount('maze')).toBe(6);
  });
});

describe('starsForResult', () => {
  it('perfekter Lauf → 3 Sterne', () => {
    expect(starsForResult({ exerciseId: 'side', trials: 21 })).toBe(3);
  });

  it('bis 20 % über perfekt → noch 3 Sterne', () => {
    expect(starsForResult({ exerciseId: 'side', trials: 25 })).toBe(3);
  });

  it('mittlere Fehlerzahl → 2 Sterne', () => {
    expect(starsForResult({ exerciseId: 'side', trials: 30 })).toBe(2);
  });

  it('viele Fehler → 1 Stern (nie 0 — Abschluss zählt immer)', () => {
    expect(starsForResult({ exerciseId: 'side', trials: 60 })).toBe(1);
  });

  it('maze: 6 Trials perfekt → 3 Sterne, 12 Trials → 1 Stern', () => {
    expect(starsForResult({ exerciseId: 'maze', trials: 6 })).toBe(3);
    expect(starsForResult({ exerciseId: 'maze', trials: 12 })).toBe(1);
  });
});
