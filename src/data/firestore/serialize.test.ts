import { describe, expect, it } from 'vitest';
import { stripUndefinedDeep } from './serialize';

describe('stripUndefinedDeep', () => {
  it('entfernt Top-Level-Felder mit undefined (Firestore-Kompatibilität)', () => {
    expect(stripUndefinedDeep({ a: 1, sex: undefined, studyGroup: undefined })).toEqual({ a: 1 });
  });

  it('entfernt undefined auch in verschachtelten Objekten und Arrays', () => {
    const input = {
      quality: { excluded: false, reason: undefined, validTrialCount: 3 },
      rawTrials: [{ rt: 500, responseDir: undefined }, { rt: null }],
    };
    expect(stripUndefinedDeep(input)).toEqual({
      quality: { excluded: false, validTrialCount: 3 },
      rawTrials: [{ rt: 500 }, { rt: null }],
    });
  });

  it('lässt null, 0, leere Strings und false unangetastet', () => {
    const input = { a: null, b: 0, c: '', d: false };
    expect(stripUndefinedDeep(input)).toEqual(input);
  });

  it('lässt Klassen-Instanzen (z. B. Date) unverändert durch', () => {
    const date = new Date('2026-07-19');
    const result = stripUndefinedDeep({ createdAt: date });
    expect(result.createdAt).toBe(date);
  });
});
