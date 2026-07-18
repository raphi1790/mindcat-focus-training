import { describe, expect, it } from 'vitest';
import { progressLabel } from './progressLabel';
import { computeChildProgress } from '../data/progress';

describe('progressLabel', () => {
  it('neues Kind → Einstufungstest steht an', () => {
    expect(progressLabel(computeChildProgress([], []))).toBe('Einstufungstest steht an');
  });

  it('mitten im Training → nennt den nächsten Tag', () => {
    const p = computeChildProgress(
      [{ phase: 'baseline', quality: { excluded: false } }],
      [{ sessionDay: 1 }, { sessionDay: 2 }],
    );
    expect(progressLabel(p)).toBe('Trainingstag 3 von 5');
  });

  it('Training fertig → Abschlusstest steht an', () => {
    const p = computeChildProgress(
      [{ phase: 'baseline', quality: { excluded: false } }],
      [{ sessionDay: 5 }],
    );
    expect(progressLabel(p)).toBe('Abschlusstest steht an');
  });

  it('alles erledigt → Programm abgeschlossen', () => {
    const p = computeChildProgress(
      [
        { phase: 'baseline', quality: { excluded: false } },
        { phase: 'post', quality: { excluded: false } },
      ],
      [{ sessionDay: 1 }, { sessionDay: 2 }, { sessionDay: 3 }, { sessionDay: 4 }, { sessionDay: 5 }],
    );
    expect(progressLabel(p)).toBe('Programm abgeschlossen');
  });
});
