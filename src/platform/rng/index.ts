/**
 * Seeded RNG für reproduzierbare Trial-Sequenzen.
 *
 * Jedes Assessment und jede Trainingssitzung erzeugt ihre Zufallsfolgen über
 * createRng(seed); der Seed wird persistiert. Damit ist jede präsentierte
 * Sequenz (Trial-Reihenfolge, Fixationszeiten, …) exakt rekonstruierbar —
 * Voraussetzung für wissenschaftliche Nachvollziehbarkeit.
 *
 * Implementierung: cyrb128-Hash (String-Seed → 128 Bit) + mulberry32.
 * Kein Crypto-Anspruch — Gleichverteilung und Determinismus genügen.
 */

export interface Rng {
  /** Der Seed, aus dem diese Instanz erzeugt wurde (zum Persistieren). */
  readonly seed: string;
  /** Gleichverteilte Zahl in [0, 1). */
  next(): number;
  /** Ganzzahl in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** Zufälliges Element aus einem nicht-leeren Array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates-Permutation als neue Kopie (Eingabe bleibt unverändert). */
  shuffle<T>(items: readonly T[]): T[];
}

/** cyrb128: schneller 128-Bit-Hash für String-Seeds. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** mulberry32: kompakter, gut verteilter 32-Bit-PRNG. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const [a] = cyrb128(seed);
  const next = mulberry32(a);

  return {
    seed,
    next,
    int(minInclusive, maxExclusive) {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new Error('rng.int erwartet ganzzahlige Grenzen');
      }
      if (maxExclusive <= minInclusive) {
        throw new Error(`rng.int: leerer Bereich [${minInclusive}, ${maxExclusive})`);
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: leeres Array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j] as never, copy[i] as never];
      }
      return copy;
    },
  };
}

/**
 * Pro-Trial-Sub-RNG: eigene Instanz je Trial-Index statt eines fortlaufenden
 * Stroms. Trial k ist damit für jedes Kind identisch, unabhängig davon, wie
 * viele Züge frühere Trials verbraucht haben (Laufzeit-/Performance-abhängig,
 * z. B. Schirm-Schritte bei Chase) — und ein StrictMode-Doppellauf des
 * Trial-Setup-Effekts erzeugt dieselbe Sequenz erneut, statt sie zu verschieben.
 */
export function createTrialRng(seed: string, trialIndex: number): Rng {
  return createRng(`${seed}:trial${trialIndex}`);
}

/** Frischer, eindeutiger Seed (z. B. je Assessment) — wird persistiert. */
export function generateSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
