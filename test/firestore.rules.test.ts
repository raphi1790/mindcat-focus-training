import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

/**
 * Phase 6 (Plan §9, §3): Verifiziert `firestore.rules` gegen den Firestore-
 * Emulator. Kinderdaten sind sensibel — die Rules müssen jeden Zugriff strikt
 * an den eingeloggten Betreuer (`request.auth.uid == uid`) binden und Mess-
 * dokumente (assessments/trainingSessions) unveränderlich halten.
 *
 * Ausführen über `npm run test:rules` (startet den Emulator via
 * `firebase emulators:exec`). Ohne laufenden Emulator wird die Datei nicht
 * ausgeführt (nicht Teil von `npm test`).
 */

const rulesPath = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CHILD = 'child-1';

let env: RulesTestEnvironment;

const validAssessment = {
  phase: 'baseline',
  ageGroupAtTest: 6,
  rngSeed: 'seed-1',
  timestamp: new Date(),
  scores: { overallRT: 900 },
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'mindcat-focus-training',
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** Firestore-Handle eines eingeloggten Betreuers. */
function asUser(uid: string) {
  return env.authenticatedContext(uid).firestore();
}

describe('firestore.rules — Betreuer-Bindung', () => {
  it('Betreuer darf sein eigenes Kind lesen und schreiben', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}`);
    await assertSucceeds(setDoc(ref, { displayName: 'Fuchs', ageGroup: 6, archived: false }));
    await assertSucceeds(getDoc(ref));
  });

  it('Fremder Betreuer darf das Kind weder lesen noch schreiben', async () => {
    // Alice legt ein Kind an (Rules umgangen, reines Seeding).
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}/children/${CHILD}`), {
        displayName: 'Fuchs',
        ageGroup: 6,
        archived: false,
      });
    });
    const bob = asUser(BOB);
    const ref = doc(bob, `users/${ALICE}/children/${CHILD}`);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { displayName: 'Hack', ageGroup: 4, archived: false }));
  });

  it('Nicht eingeloggt: kein Zugriff', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `users/${ALICE}/children/${CHILD}`)));
  });
});

describe('firestore.rules — Assessments (append-only)', () => {
  it('Betreuer darf ein Assessment anlegen und lesen', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertSucceeds(setDoc(ref, validAssessment));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      getDocs(collection(db, `users/${ALICE}/children/${CHILD}/assessments`)),
    );
  });

  it('Assessments sind unveränderlich: Update und Delete verboten (auch für den Besitzer)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `users/${ALICE}/children/${CHILD}/assessments/a1`),
        validAssessment,
      );
    });
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertFails(setDoc(ref, { ...validAssessment, rngSeed: 'tampered' }));
    await assertFails(deleteDoc(ref));
  });

  it('Fremder darf Assessments nicht lesen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `users/${ALICE}/children/${CHILD}/assessments/a1`),
        validAssessment,
      );
    });
    const bob = asUser(BOB);
    await assertFails(getDoc(doc(bob, `users/${ALICE}/children/${CHILD}/assessments/a1`)));
  });
});

describe('firestore.rules — TrainingSessions (inkrementell, dann unveränderlich)', () => {
  const session = { sessionDay: 1, ageGroupAtTest: 6, rngSeed: 's', timestamp: new Date(), exercises: [] };
  const inProgress = { ...session, status: 'in-progress' };
  const completed = { ...session, status: 'completed' };

  /** Dokument unter Umgehung der Rules seeden (reines Test-Setup). */
  async function seed(path: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), path), data);
    });
  }

  it('Betreuer darf eine Trainingssitzung anlegen und lesen', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertSucceeds(setDoc(ref, inProgress));
    await assertSucceeds(getDoc(ref));
  });

  it('laufende Sitzung (in-progress) darf inkrementell aktualisiert werden', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertSucceeds(updateDoc(ref, { exercises: [{ exerciseId: 'side' }] }));
    await assertSucceeds(
      updateDoc(ref, {
        checkpoint: { exerciseIndex: 1, exerciseId: 'chase', engineState: {} },
      }),
    );
  });

  it('Abschluss-Übergang (in-progress → completed) ist erlaubt', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertSucceeds(updateDoc(ref, { status: 'completed' }));
  });

  it('abgeschlossene Sitzung ist unveränderlich: Update verboten', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, completed);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { sessionDay: 2 }));
  });

  it('Alt-Dokument ohne status-Feld bleibt gesperrt (Update verboten)', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, session);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { sessionDay: 2 }));
  });

  it('Löschen ist immer verboten — auch für laufende Sitzungen', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(deleteDoc(ref));
  });
});

describe('firestore.rules — Legacy & Fremdpfade gesperrt', () => {
  it('Legacy testResults-Collection ist komplett gesperrt', async () => {
    const db = asUser(ALICE);
    await assertFails(getDoc(doc(db, `testResults/x`)));
    await assertFails(setDoc(doc(db, `testResults/x`), { foo: 'bar' }));
  });

  it('Betreuer darf nicht in den Teilbaum eines anderen uid schreiben', async () => {
    const db = asUser(ALICE);
    await assertFails(setDoc(doc(db, `users/${BOB}/children/${CHILD}`), { displayName: 'x', ageGroup: 4, archived: false }));
  });
});
