import { describe, expect, it } from 'vitest';
import type { Cue, Flanker, Trial } from '../../data/schema';
import { EXCLUSION_ERROR_RATE_PERCENT, median, scoreAnt } from './scoring';

let trialCounter = 0;

/** Test-Trial mit sinnvollen Defaults; correct/rt konsistent gesetzt. */
function makeTrial(
  overrides: Partial<Trial> & { cue: Cue; flanker: Flanker },
): Trial {
  const correct = overrides.correct !== undefined ? overrides.correct : true;
  return {
    index: trialCounter++,
    block: 1,
    position: 'top',
    targetDir: 'L',
    responseDir: correct === null ? null : 'L',
    rt: correct === null ? null : 1000,
    onsetTs: 5000,
    fixationMs: 800,
    ...overrides,
    correct,
  };
}

describe('median', () => {
  it('ist für die leere Menge nicht definiert (null)', () => {
    expect(median([])).toBeNull();
  });

  it('liefert das mittlere Element bei ungerader Anzahl', () => {
    expect(median([300, 100, 200])).toBe(200);
  });

  it('mittelt die beiden mittleren Elemente bei gerader Anzahl', () => {
    expect(median([400, 100, 300, 200])).toBe(250);
  });

  it('verändert die Eingabe nicht', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('scoreAnt — Netzwerk-Scores', () => {
  it('berechnet Alerting, Orienting, Conflict und Overall-RT aus Medianen korrekter Trials', () => {
    const trials: Trial[] = [
      makeTrial({ cue: 'none', flanker: 'neutral', rt: 1000 }),
      makeTrial({ cue: 'none', flanker: 'neutral', rt: 1200 }), // cue:none → 1100
      makeTrial({ cue: 'double', flanker: 'neutral', rt: 900 }), // cue:double → 900
      makeTrial({ cue: 'central', flanker: 'congruent', rt: 1000 }),
      makeTrial({ cue: 'central', flanker: 'congruent', rt: 1100 }), // central 1050, congruent 1050
      makeTrial({ cue: 'spatial', flanker: 'incongruent', rt: 950 }), // spatial 950, incongruent 950
    ];
    const { scores, quality } = scoreAnt(trials);

    expect(scores.alertingRT).toBe(200); // 1100 − 900
    expect(scores.orientingRT).toBe(100); // 1050 − 950
    expect(scores.conflictRT).toBe(-100); // 950 − 1050
    expect(scores.overallRT).toBe(1000); // Median aller 6 korrekten RTs
    expect(scores.overallErrorRate).toBe(0);
    expect(quality.excluded).toBe(false);
    expect(quality.validTrialCount).toBe(6);
  });

  it('ignoriert falsche Antworten und Misses in den RT-Medianen', () => {
    const trials: Trial[] = [
      makeTrial({ cue: 'none', flanker: 'congruent', rt: 1000 }),
      makeTrial({ cue: 'none', flanker: 'congruent', rt: 4, correct: false }),
      makeTrial({ cue: 'none', flanker: 'congruent', correct: null }),
      makeTrial({ cue: 'double', flanker: 'incongruent', rt: 800 }),
      makeTrial({ cue: 'central', flanker: 'congruent', rt: 900 }),
      makeTrial({ cue: 'spatial', flanker: 'incongruent', rt: 700 }),
    ];
    const { scores } = scoreAnt(trials);
    // cue:none-Median nur aus dem korrekten 1000er-Trial:
    expect(scores.alertingRT).toBe(200); // 1000 − 800
  });

  it('berechnet Accuracy je Bedingung in Prozent', () => {
    const trials: Trial[] = [
      makeTrial({ cue: 'none', flanker: 'incongruent' }),
      makeTrial({ cue: 'none', flanker: 'incongruent', correct: false, rt: 900 }),
      makeTrial({ cue: 'double', flanker: 'congruent' }),
      makeTrial({ cue: 'central', flanker: 'congruent' }),
      makeTrial({ cue: 'spatial', flanker: 'incongruent' }),
    ];
    const { scores } = scoreAnt(trials);
    expect(scores.accuracyByCondition['cue:none']).toBe(50);
    expect(scores.accuracyByCondition['flanker:incongruent']).toBeCloseTo((2 / 3) * 100);
    expect(scores.accuracyByCondition['flanker:congruent']).toBe(100);
  });
});

describe('scoreAnt — Fehlerrate & Exclusion', () => {
  // 6 korrekte Trials, die alle 6 Score-Bedingungen abdecken:
  const coveringCorrectTrials = (): Trial[] => [
    makeTrial({ cue: 'none', flanker: 'congruent' }),
    makeTrial({ cue: 'double', flanker: 'incongruent' }),
    makeTrial({ cue: 'central', flanker: 'congruent' }),
    makeTrial({ cue: 'spatial', flanker: 'incongruent' }),
    makeTrial({ cue: 'none', flanker: 'incongruent' }),
    makeTrial({ cue: 'double', flanker: 'congruent' }),
  ];

  it('zählt Misses wie Fehler in die Fehlerrate', () => {
    const trials = [
      ...coveringCorrectTrials(),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: false, rt: 500 }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
    ];
    const { scores } = scoreAnt(trials);
    expect(scores.overallErrorRate).toBe(25); // 2 von 8
  });

  it('schließt bei exakt 40 % Fehlerrate NICHT aus (Regel ist "> 40 %")', () => {
    const trials = [
      ...coveringCorrectTrials(),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: false, rt: 500 }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: false, rt: 500 }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
    ];
    const { scores, quality } = scoreAnt(trials);
    expect(scores.overallErrorRate).toBe(EXCLUSION_ERROR_RATE_PERCENT);
    expect(quality.excluded).toBe(false);
    expect(quality.validTrialCount).toBe(6);
  });

  it('schließt bei Fehlerrate über 40 % aus und dokumentiert den Grund', () => {
    const trials = [
      ...coveringCorrectTrials(),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: false, rt: 500 }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: false, rt: 500 }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
      makeTrial({ cue: 'none', flanker: 'neutral', correct: null }),
    ];
    const { scores, quality } = scoreAnt(trials);
    expect(scores.overallErrorRate).toBeGreaterThan(EXCLUSION_ERROR_RATE_PERCENT);
    expect(quality.excluded).toBe(true);
    expect(quality.reason).toContain('Fehlerrate');
  });

  it('schließt aus, wenn eine Score-Bedingung keine korrekten Trials hat', () => {
    // cue:spatial kommt nur als falsche Antwort vor → Orienting nicht berechenbar.
    const trials: Trial[] = [
      makeTrial({ cue: 'none', flanker: 'congruent' }),
      makeTrial({ cue: 'double', flanker: 'incongruent' }),
      makeTrial({ cue: 'central', flanker: 'congruent' }),
      makeTrial({ cue: 'none', flanker: 'incongruent' }),
      makeTrial({ cue: 'spatial', flanker: 'neutral', correct: false, rt: 600 }),
    ];
    const { quality } = scoreAnt(trials);
    expect(quality.excluded).toBe(true);
    expect(quality.reason).toContain('cue:spatial');
  });

  it('markiert ein leeres Trial-Log als ausgeschlossen', () => {
    const { quality } = scoreAnt([]);
    expect(quality.excluded).toBe(true);
    expect(quality.validTrialCount).toBe(0);
  });
});
