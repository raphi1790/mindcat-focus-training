import { describe, expect, it } from 'vitest';
import { createRng } from '../../platform/rng';
import { ANT_TIMINGS } from './config';
import { generatePracticeBlock, generateTestBlock, type PlannedTrial } from './trials';

const conditionKey = (t: PlannedTrial) => `${t.cue}|${t.flanker}|${t.position}|${t.targetDir}`;
const cellKey = (t: PlannedTrial) => `${t.cue}|${t.flanker}`;

describe('generateTestBlock', () => {
  it('erzeugt die vollständige 48er-Kreuzung (jede Kombination genau einmal)', () => {
    const block = generateTestBlock(createRng('block-seed'));
    expect(block).toHaveLength(48);
    const keys = new Set(block.map(conditionKey));
    expect(keys.size).toBe(48);
  });

  it('hält alle Fixationsdauern im kanonischen Bereich 400–1600 ms', () => {
    const block = generateTestBlock(createRng('fixation-seed'));
    for (const t of block) {
      expect(t.fixationMs).toBeGreaterThanOrEqual(ANT_TIMINGS.fixationMinMs);
      expect(t.fixationMs).toBeLessThanOrEqual(ANT_TIMINGS.fixationMaxMs);
    }
  });

  it('ist deterministisch: gleicher Seed → identische Sequenz inkl. Fixationszeiten', () => {
    const a = generateTestBlock(createRng('same-seed'));
    const b = generateTestBlock(createRng('same-seed'));
    expect(a).toEqual(b);
  });

  it('unterscheidet sich bei verschiedenen Seeds (Reihenfolge nicht fix)', () => {
    const a = generateTestBlock(createRng('seed-1'));
    const b = generateTestBlock(createRng('seed-2'));
    expect(a).not.toEqual(b);
  });

  it('liefert bei fortlaufender Nutzung desselben Rng unterschiedliche Blöcke', () => {
    const rng = createRng('session-seed');
    const first = generateTestBlock(rng);
    const second = generateTestBlock(rng);
    expect(first).not.toEqual(second);
  });
});

describe('generatePracticeBlock', () => {
  it('erzeugt 24 Trials: jede Cue×Flanker-Zelle genau zweimal', () => {
    const block = generatePracticeBlock(createRng('practice-seed'));
    expect(block).toHaveLength(24);
    const counts = new Map<string, number>();
    for (const t of block) {
      counts.set(cellKey(t), (counts.get(cellKey(t)) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const count of counts.values()) expect(count).toBe(2);
  });

  it('balanciert Position und Richtung innerhalb jeder Zelle und global', () => {
    const block = generatePracticeBlock(createRng('practice-balance'));
    const byCell = new Map<string, PlannedTrial[]>();
    for (const t of block) {
      const list = byCell.get(cellKey(t)) ?? [];
      list.push(t);
      byCell.set(cellKey(t), list);
    }
    for (const pair of byCell.values()) {
      expect(new Set(pair.map((t) => t.position))).toEqual(new Set(['top', 'bottom']));
      expect(new Set(pair.map((t) => t.targetDir))).toEqual(new Set(['L', 'R']));
    }
    expect(block.filter((t) => t.position === 'top')).toHaveLength(12);
    expect(block.filter((t) => t.targetDir === 'L')).toHaveLength(12);
  });

  it('ist deterministisch bei gleichem Seed', () => {
    const a = generatePracticeBlock(createRng('same-practice'));
    const b = generatePracticeBlock(createRng('same-practice'));
    expect(a).toEqual(b);
  });
});
