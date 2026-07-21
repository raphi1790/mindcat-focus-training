import { addDoc, deleteField, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '../../services/firebase';
import {
  exerciseResultSchema,
  trainingSessionDocSchema,
  trainingSessionInputSchema,
  trainingSessionProgressSchema,
  type ExerciseResult,
  type TrainingSession,
  type TrainingSessionInput,
  type TrainingSessionProgress,
} from '../schema';
import { trainingSessionDoc, trainingSessionsCollection } from './paths';
import { stripUndefinedDeep } from './serialize';

/**
 * Trainingstage. Inkrementell speicherbar (AP6, Fix-Plan Testrunde 1): eine
 * Sitzung wird als `in-progress` angelegt, nach jeder Übung / jedem Level-
 * Aufstieg fortgeschrieben und am Tagesende auf `completed` gesetzt. Ein
 * Crash/Reload überlebt damit jeden abgeschlossenen Level-Aufstieg; die Rules
 * erlauben `update` nur, solange die Sitzung läuft (danach unveränderlich),
 * `delete` bleibt gesperrt.
 */

/** Neuen Trainingstag als laufende Sitzung anlegen. */
export async function startTrainingSession(
  uid: string,
  childId: string,
  input: TrainingSessionInput,
): Promise<string> {
  const payload = stripUndefinedDeep(trainingSessionInputSchema.parse(input));
  const ref = await addDoc(trainingSessionsCollection(db, uid, childId), {
    ...payload,
    status: 'in-progress',
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Zwischenstand einer laufenden Sitzung schreiben: erweiterte Ergebnisliste
 * (nach jedem Übungsabschluss) und/oder Resume-Checkpoint (nach jedem Level-
 * Aufstieg). Nur die übergebenen Felder werden geschrieben; `updatedAt` des
 * Checkpoints setzt der Server.
 */
export async function updateTrainingSessionProgress(
  uid: string,
  childId: string,
  sessionId: string,
  progress: TrainingSessionProgress,
): Promise<void> {
  const parsed = stripUndefinedDeep(trainingSessionProgressSchema.parse(progress));
  const data: Record<string, unknown> = {};
  if (parsed.exercises) data.exercises = parsed.exercises;
  if (parsed.checkpoint) data.checkpoint = { ...parsed.checkpoint, updatedAt: serverTimestamp() };
  if (Object.keys(data).length === 0) return;
  await updateDoc(trainingSessionDoc(db, uid, childId, sessionId), data);
}

/**
 * Sitzung abschließen: finale Ergebnisliste, `status: 'completed'`, Checkpoint
 * entfernen, Abschlusszeitpunkt setzen. Nach diesem Update ist das Dokument
 * per Rules wieder unveränderlich.
 */
export async function completeTrainingSession(
  uid: string,
  childId: string,
  sessionId: string,
  exercises: ExerciseResult[],
): Promise<void> {
  const parsed = stripUndefinedDeep(z.array(exerciseResultSchema).parse(exercises));
  await updateDoc(trainingSessionDoc(db, uid, childId, sessionId), {
    exercises: parsed,
    status: 'completed',
    checkpoint: deleteField(),
    completedAt: serverTimestamp(),
  });
}

export async function listTrainingSessions(
  uid: string,
  childId: string,
): Promise<TrainingSession[]> {
  const snapshot = await getDocs(
    query(trainingSessionsCollection(db, uid, childId), orderBy('timestamp', 'asc')),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...trainingSessionDocSchema.parse(d.data()) }));
}

/**
 * Jüngste laufende Sitzung des Kindes für einen bestimmten Tag (AP6: Resume).
 * Ältere verwaiste In-Progress-Dokumente werden ignoriert (sie zählen
 * nirgends). Kein zusätzlicher Firestore-Index nötig — die kleine Dokument-
 * menge pro Kind wird über die bestehende, nach `timestamp` sortierte Liste
 * gefiltert (letztes Element = jüngstes).
 */
export async function findInProgressSession(
  uid: string,
  childId: string,
  sessionDay: number,
): Promise<TrainingSession | null> {
  const sessions = await listTrainingSessions(uid, childId);
  const inProgress = sessions.filter(
    (s) => s.status === 'in-progress' && s.sessionDay === sessionDay,
  );
  return inProgress.length > 0 ? inProgress[inProgress.length - 1]! : null;
}
