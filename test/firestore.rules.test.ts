import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

/**
 * Phase 6 (Plan §9, §3, Issue #26): Verifiziert `firestore.rules` gegen den Firestore-
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
  timestamp: serverTimestamp(),
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

/** Dokument unter Umgehung der Rules seeden (reines Test-Setup). */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('firestore.rules — Betreuer-Bindung', () => {
  it('Betreuer darf sein eigenes Kind lesen und schreiben', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}`);
    await assertSucceeds(setDoc(ref, { displayName: 'Fuchs', ageGroup: 6, archived: false }));
    await assertSucceeds(getDoc(ref));
  });

  it('Fremder Betreuer darf das Kind weder lesen noch schreiben', async () => {
    await seed(`users/${ALICE}/children/${CHILD}`, {
      displayName: 'Fuchs',
      ageGroup: 6,
      archived: false,
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

describe('firestore.rules — Assessments (append-only & immutability)', () => {
  it('Betreuer darf ein Assessment mit Server-Timestamp anlegen und lesen', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertSucceeds(setDoc(ref, validAssessment));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      getDocs(collection(db, `users/${ALICE}/children/${CHILD}/assessments`)),
    );
  });

  it('Erstellen eines Assessments ohne Server-Timestamp schlägt fehl', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertFails(setDoc(ref, { ...validAssessment, timestamp: new Date() }));
  });

  it('Erstellen eines Assessments ohne Timestamp-Feld schlägt fehl', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    const withoutTs = {
      phase: validAssessment.phase,
      ageGroupAtTest: validAssessment.ageGroupAtTest,
      rngSeed: validAssessment.rngSeed,
      scores: validAssessment.scores,
    };
    await assertFails(setDoc(ref, withoutTs));
  });

  it('Assessments sind unveränderlich: Update und Löschen sind verboten', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/assessments/a1`, {
      ...validAssessment,
      timestamp: new Date(),
    });
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertFails(setDoc(ref, { ...validAssessment, rngSeed: 'tampered' }));
    await assertFails(updateDoc(ref, { rngSeed: 'tampered' }));
    // Löschen ist unter allen Umständen verboten (Schutz wissenschaftlicher Messdaten)
    await assertFails(deleteDoc(ref));
  });

  it('Fremder darf Assessments nicht lesen oder löschen', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/assessments/a1`, {
      ...validAssessment,
      timestamp: new Date(),
    });
    const bob = asUser(BOB);
    const ref = doc(bob, `users/${ALICE}/children/${CHILD}/assessments/a1`);
    await assertFails(getDoc(ref));
    await assertFails(deleteDoc(ref));
  });
});

describe('firestore.rules — TrainingSessions (inkrementell, dann unveränderlich)', () => {
  const session = { sessionDay: 1, ageGroupAtTest: 6, rngSeed: 's', timestamp: new Date(), exercises: [] };
  const inProgress = { ...session, status: 'in-progress' };
  const completed = { ...session, status: 'completed' };

  it('Betreuer darf eine Trainingssitzung mit Server-Timestamp anlegen und lesen', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertSucceeds(setDoc(ref, { ...inProgress, timestamp: serverTimestamp() }));
    await assertSucceeds(getDoc(ref));
  });

  it('Erstellen einer Trainingssitzung ohne Server-Timestamp schlägt fehl', async () => {
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(setDoc(ref, inProgress));
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

  it('Ändern von sessionDay, ageGroupAtTest oder rngSeed bei laufenden Sitzungen schlägt fehl', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { sessionDay: 2 }));
    await assertFails(updateDoc(ref, { ageGroupAtTest: 4 }));
    await assertFails(updateDoc(ref, { rngSeed: 'tampered-seed' }));
  });

  it('Ungültiger Status-Übergang bei laufenden Sitzungen schlägt fehl', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { status: 'cancelled' }));
    await assertFails(updateDoc(ref, { status: 'archived' }));
  });

  it('Ändern des Erstellungs-Timestamps bei laufenden Sitzungen schlägt fehl', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { timestamp: serverTimestamp() }));
  });

  it('abgeschlossene Sitzung ist unveränderlich: Update verboten', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, completed);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { exercises: [{ exerciseId: 'maze' }] }));
  });

  it('Alt-Dokument ohne status-Feld bleibt gesperrt (Update verboten)', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, session);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(updateDoc(ref, { sessionDay: 2 }));
  });

  it('Besitzer darf Trainingssitzungen löschen (Spielstand-Reset)', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const db = asUser(ALICE);
    const ref = doc(db, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertSucceeds(deleteDoc(ref));
  });

  it('Fremder darf Trainingssitzungen nicht löschen', async () => {
    await seed(`users/${ALICE}/children/${CHILD}/trainingSessions/t1`, inProgress);
    const bob = asUser(BOB);
    const ref = doc(bob, `users/${ALICE}/children/${CHILD}/trainingSessions/t1`);
    await assertFails(deleteDoc(ref));
  });
});

describe('firestore.rules — Legacy & Fremdpfade gesperrt', () => {
  it('Legacy testResults-Collection ist komplett gesperrt', async () => {
    const db = asUser(ALICE);
    await assertFails(getDoc(doc(db, 'testResults/x')));
    await assertFails(setDoc(doc(db, 'testResults/x'), { foo: 'bar' }));
  });

  it('Betreuer darf nicht in den Teilbaum eines anderen uid schreiben', async () => {
    const db = asUser(ALICE);
    await assertFails(
      setDoc(doc(db, `users/${BOB}/children/${CHILD}`), {
        displayName: 'x',
        ageGroup: 4,
        archived: false,
      }),
    );
  });
});
