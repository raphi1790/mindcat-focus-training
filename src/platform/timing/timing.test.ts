import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deadlineAfter, isAbort, nextPaint, now, raf, waitMs } from './index';

/**
 * rAF wird als Mock mit manueller Frame-Steuerung simuliert; performance.now
 * läuft über die Fake-Timer von Vitest mit.
 */

let rafQueue: FrameRequestCallback[] = [];
let rafIdCounter = 0;
const pendingIds = new Set<number>();

function flushFrame(timeAdvanceMs = 16) {
  vi.advanceTimersByTime(timeAdvanceMs);
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(performance.now());
}

beforeEach(() => {
  vi.useFakeTimers();
  rafQueue = [];
  pendingIds.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafIdCounter;
    pendingIds.add(id);
    rafQueue.push((t) => {
      if (pendingIds.has(id)) cb(t);
    });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingIds.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('raf / nextPaint', () => {
  it('raf resolved im nächsten Frame mit einem Zeitstempel', async () => {
    const p = raf();
    flushFrame();
    const ts = await p;
    expect(typeof ts).toBe('number');
  });

  it('nextPaint benötigt genau zwei Frames (Double-rAF)', async () => {
    let resolved = false;
    const p = nextPaint().then((ts) => {
      resolved = true;
      return ts;
    });

    flushFrame(); // Frame 1: noch nicht fertig
    await Promise.resolve();
    expect(resolved).toBe(false);

    flushFrame(); // Frame 2: jetzt gestempelt
    const ts = await p;
    expect(resolved).toBe(true);
    expect(ts).toBeGreaterThan(0);
  });

  it('raf rejected mit AbortError, wenn das Signal abbricht', async () => {
    const controller = new AbortController();
    const p = raf(controller.signal);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbort);
  });

  it('raf rejected sofort, wenn das Signal bereits abgebrochen ist', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(raf(controller.signal)).rejects.toSatisfy(isAbort);
  });
});

describe('waitMs', () => {
  it('misst planned/actual/drift', async () => {
    const p = waitMs(400);
    vi.advanceTimersByTime(400);
    const result = await p;
    expect(result.plannedMs).toBe(400);
    expect(result.actualMs).toBeGreaterThanOrEqual(400);
    expect(result.driftMs).toBe(result.actualMs - 400);
    expect(result.endTs).toBeGreaterThan(0);
  });

  it('bricht via AbortSignal ab', async () => {
    const controller = new AbortController();
    const p = waitMs(1000, controller.signal);
    vi.advanceTimersByTime(100);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbort);
  });
});

describe('deadlineAfter', () => {
  it('rechnet bereits verstrichene Zeit seit Onset an', async () => {
    const onset = now();
    // 500 ms vergehen zwischen Onset und Deadline-Aufruf
    vi.advanceTimersByTime(500);
    const p = deadlineAfter(onset, 1700);
    // Es dürfen nur noch ~1200 ms verbleiben
    vi.advanceTimersByTime(1200);
    const result = await p;
    expect(result.plannedMs).toBeLessThanOrEqual(1200);
  });

  it('resolved sofort, wenn die Deadline schon überschritten ist', async () => {
    const onset = now();
    vi.advanceTimersByTime(2000);
    const p = deadlineAfter(onset, 1700);
    vi.advanceTimersByTime(0);
    const result = await p;
    expect(result.plannedMs).toBe(0);
  });
});
