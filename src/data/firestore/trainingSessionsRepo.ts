import { addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  trainingSessionDocSchema,
  trainingSessionInputSchema,
  type TrainingSession,
  type TrainingSessionInput,
} from '../schema';
import { trainingSessionsCollection } from './paths';

/** Trainingstage. Append-only (siehe firestore.rules). */

export async function addTrainingSession(
  uid: string,
  childId: string,
  input: TrainingSessionInput,
): Promise<string> {
  const payload = trainingSessionInputSchema.parse(input);
  const ref = await addDoc(trainingSessionsCollection(db, uid, childId), {
    ...payload,
    timestamp: serverTimestamp(),
  });
  return ref.id;
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
