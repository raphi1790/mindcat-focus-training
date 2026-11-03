#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// 1. Load env/.env before initializing Firebase
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
for (const envPath of [
  path.resolve(process.cwd(), 'env/.env'),
  path.resolve(process.cwd(), '../../env/.env'),
  path.resolve(scriptDir, '../env/.env'),
  path.resolve(scriptDir, '../../../env/.env'),
]) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // ignore
    }
  }
}

// 2. Dynamically import Firebase and app modules after environment is loaded
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  connectAuthEmulator,
} = await import('firebase/auth');
const { connectFirestoreEmulator } = await import('firebase/firestore');
const { auth, db } = await import('../src/services/firebase');
const { seedParticipant } = await import('../src/validation/seedParticipant');
import type { AgeGroup, StudyGroup } from '../src/data/schema';

function printHelp(): void {
  console.log(`
Mindcat Focus Training — Participant Seeder (Option 1)

Wissenschaftlich valide Simulation eines vollständigen Probanden
(Child ANT Baseline → Trainingstage → Post-Test) mit direkter
Persistenz in Firestore (Qual/Dev/Emulator).

Verwendung:
  npm run seed:participant [Optionen]

Optionen:
  -a, --age <4|6>       Altersgruppe des Kindes (Default: 6)
  -n, --name <string>   Anzeigename / Pseudonym des Kindes
  -g, --group <group>   Studiengruppe: 'trained' | 'control' (Default: 'trained')
  -d, --days <0-5>      Anzahl der Trainingstage (Default: 5)
      --no-post         Post-Assessment überspringen (Default: false)
  -s, --seed <string>   RNG-Seed für deterministische Simulation
  -e, --email <email>   E-Mail des Betreuers (Default: SEED_USER_EMAIL oder test@mindcat.local)
  -p, --password <pw>   Passwort des Betreuers (Default: SEED_USER_PASSWORD oder Test123456!)
      --emulator        Verbindung zu lokalem Firebase-Emulator herstellen
  -h, --help            Hilfe anzeigen
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      age: { type: 'string', short: 'a', default: '6' },
      name: { type: 'string', short: 'n' },
      group: { type: 'string', short: 'g', default: 'trained' },
      days: { type: 'string', short: 'd', default: '5' },
      'no-post': { type: 'boolean', default: false },
      seed: { type: 'string', short: 's' },
      email: { type: 'string', short: 'e' },
      password: { type: 'string', short: 'p' },
      emulator: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const ageNum = parseInt(values.age ?? '6', 10);
  if (ageNum !== 4 && ageNum !== 6) {
    console.error('❌ Ungültige Altersgruppe:', values.age, '(nur 4 oder 6 erlaubt)');
    process.exit(1);
  }
  const ageGroup: AgeGroup = ageNum as AgeGroup;

  const daysNum = parseInt(values.days ?? '5', 10);
  if (isNaN(daysNum) || daysNum < 0 || daysNum > 5) {
    console.error('❌ Ungültige Trainingstage:', values.days, '(nur 0 bis 5 erlaubt)');
    process.exit(1);
  }

  const studyGroup = (values.group ?? 'trained') as StudyGroup;
  if (studyGroup !== 'trained' && studyGroup !== 'control') {
    console.error('❌ Ungültige Studiengruppe:', values.group, "(nur 'trained' oder 'control' erlaubt)");
    process.exit(1);
  }

  const email = values.email || process.env.SEED_USER_EMAIL || 'test-supervisor@mindcat.local';
  const password = values.password || process.env.SEED_USER_PASSWORD || 'Test123456!';
  const withPost = !values['no-post'] && daysNum === 5;

  // Emulator-Support
  const useEmulator = values.emulator || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (useEmulator) {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [host, portStr] = firestoreHost.split(':');
    connectFirestoreEmulator(db, host, parseInt(portStr || '8080', 10));

    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    connectAuthEmulator(auth, authHost.startsWith('http') ? authHost : `http://${authHost}`);
    console.log(`🔧 Verbunden mit lokalem Firebase Emulator (${firestoreHost} / ${authHost})`);
  }

  console.log(`🔐 Authentifiziere als Betreuer: ${email}...`);

  let uid: string;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (signInErr: unknown) {
    const errCode = (signInErr as { code?: string })?.code;
    if (
      errCode === 'auth/user-not-found' ||
      errCode === 'auth/invalid-credential' ||
      errCode === 'auth/invalid-login-credentials'
    ) {
      try {
        console.log(`ℹ️ Betreuer existiert noch nicht — erstelle neuen Account: ${email}...`);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid;
      } catch (createErr: unknown) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        console.error(`❌ Fehler bei der Erstellung des Betreuers (${email}):`, msg);
        process.exit(1);
      }
    } else {
      const msg = signInErr instanceof Error ? signInErr.message : String(signInErr);
      console.error(`❌ Authentifizierungsfehler (${email}):`, msg);
      process.exit(1);
    }
  }

  console.log(`✅ Authentifiziert! Betreuer-UID: ${uid}`);
  console.log(`🚀 Starte Probanden-Generierung...`);

  try {
    const result = await seedParticipant({
      uid,
      ageGroup,
      displayName: values.name,
      studyGroup,
      days: daysNum,
      withPost,
      seed: values.seed,
    });

    console.log('\n============================================================');
    console.log('🎉 Proband erfolgreich generiert & in Firestore gespeichert!');
    console.log('============================================================');
    console.log(`👤 Betreuer       : ${email} (UID: ${uid})`);
    console.log(`🧒 Kind           : ${result.displayName} (Alter: ${result.ageGroup} Jahre, ID: ${result.childId})`);
    console.log(`📊 Studiengruppe  : ${result.studyGroup}`);
    console.log(`📋 Baseline ANT   : ID: ${result.baselineId}`);
    console.log(`                    Conflict Effect : ${result.baselineScores.conflict} ms`);
    console.log(`                    Alerting Effect : ${result.baselineScores.alerting} ms`);
    console.log(`                    Orienting Effect: ${result.baselineScores.orienting} ms`);
    console.log(`                    Genauigkeit     : ${(100 - result.baselineScores.errorRate).toFixed(1)} %`);
    console.log(`🏋️ Trainingstage  : ${result.sessionIds.length} Sitzungen abgeschlossen`);

    if (result.postId && result.postScores) {
      const conflictImprovement = result.baselineScores.conflict - result.postScores.conflict;
      console.log(`📋 Post-Test ANT  : ID: ${result.postId}`);
      console.log(`                    Conflict Effect : ${result.postScores.conflict} ms (Gain: ${conflictImprovement > 0 ? '+' : ''}${conflictImprovement} ms)`);
      console.log(`                    Alerting Effect : ${result.postScores.alerting} ms`);
      console.log(`                    Orienting Effect: ${result.postScores.orienting} ms`);
      console.log(`                    Genauigkeit     : ${(100 - result.postScores.errorRate).toFixed(1)} %`);
    }

    console.log('============================================================');
    console.log('👉 Das Kind ist sofort im Betreuer-Dashboard verfügbar.');
    console.log(`   Melde dich im Webinterface (${email}) an, um alle Charts zu sehen!`);
    console.log('============================================================\n');
    process.exit(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Fehler beim Erstellen der Probandendaten:', msg);
    process.exit(1);
  }
}

main();
