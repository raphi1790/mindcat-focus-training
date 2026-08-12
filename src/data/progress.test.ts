import { describe, expect, it } from 'vitest';
import { computeChildProgress } from './progress';

const ok = { excluded: false };
const excluded = { excluded: true };

describe('computeChildProgress', () => {
  it('neues Kind → Baseline steht an', () => {
    const p = computeChildProgress([], []);
    expect(p).toEqual({
      baselineDone: false,
      completedDays: 0,
      nextSessionDay: 1,
      postDone: false,
      nextStep: 'baseline',
    });
  });

  it('ausgeschlossene Baseline (>40 % Fehler) zählt nicht — Baseline erneut', () => {
    const p = computeChildProgress([{ phase: 'baseline', quality: excluded }], []);
    expect(p.baselineDone).toBe(false);
    expect(p.nextStep).toBe('baseline');
  });

  it('gültige Baseline, kein Training → Trainingstag 1', () => {
    const p = computeChildProgress([{ phase: 'baseline', quality: ok }], []);
    expect(p.nextStep).toBe('training');
    expect(p.nextSessionDay).toBe(1);
  });

  it('mitten im Training → nächster Tag = höchster Tag + 1', () => {
    const p = computeChildProgress(
      [{ phase: 'baseline', quality: ok }],
      [{ sessionDay: 1 }, { sessionDay: 2 }, { sessionDay: 3 }],
    );
    expect(p.completedDays).toBe(3);
    expect(p.nextSessionDay).toBe(4);
    expect(p.nextStep).toBe('training');
  });

  it('laufende (in-progress) Sitzung zählt nicht als abgeschlossener Tag (AP6)', () => {
    const p = computeChildProgress(
      [{ phase: 'baseline', quality: ok }],
      [
        { sessionDay: 1, status: 'completed' },
        { sessionDay: 2, status: 'in-progress' },
      ],
    );
    // Tag 2 läuft noch → höchster abgeschlossener Tag ist 1, nächster Tag 2.
    expect(p.completedDays).toBe(1);
    expect(p.nextSessionDay).toBe(2);
    expect(p.nextStep).toBe('training');
  });

  it('Training fertig (Tag 5) → Post-Test steht an', () => {
    const p = computeChildProgress(
      [{ phase: 'baseline', quality: ok }],
      [{ sessionDay: 5 }],
    );
    expect(p.nextStep).toBe('post');
    expect(p.nextSessionDay).toBe(5);
  });

  it('Interim-Assessments beeinflussen den Ablauf nicht', () => {
    const p = computeChildProgress(
      [
        { phase: 'baseline', quality: ok },
        { phase: 'interim', quality: ok },
      ],
      [{ sessionDay: 5 }],
    );
    expect(p.nextStep).toBe('post');
  });

  it('ausgeschlossener Post-Test → Post erneut', () => {
    const p = computeChildProgress(
      [
        { phase: 'baseline', quality: ok },
        { phase: 'post', quality: excluded },
      ],
      [{ sessionDay: 5 }],
    );
    expect(p.postDone).toBe(false);
    expect(p.nextStep).toBe('post');
  });

  it('kompletter Durchlauf → done', () => {
    const p = computeChildProgress(
      [
        { phase: 'baseline', quality: ok },
        { phase: 'post', quality: ok },
      ],
      [{ sessionDay: 1 }, { sessionDay: 2 }, { sessionDay: 3 }, { sessionDay: 4 }, { sessionDay: 5 }],
    );
    expect(p).toEqual({
      baselineDone: true,
      completedDays: 5,
      nextSessionDay: 5,
      postDone: true,
      nextStep: 'done',
    });
  });

  it('Post ohne Baseline (Datenanomalie) → trotzdem zuerst Baseline', () => {
    const p = computeChildProgress([{ phase: 'post', quality: ok }], []);
    expect(p.nextStep).toBe('baseline');
  });
});
